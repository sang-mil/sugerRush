import {
  PlayerEntity,
  Projectile,
  GameSnapshot,
  CharacterId,
  KillEvent,
  BotPersonalityType,
  MapObstacle,
  PowerUpItem,
  PowerUpType,
  HotZoneState,
  MapAnnouncement,
  SugarType
} from '../types/game';
import {
  CHARACTERS,
  COMBAT_CONFIG,
  DYNAMIC_MAP_CONFIG,
  WORLD_SIZE,
  INITIAL_BOT_COUNT,
  BOT_NAMES,
  generateMapObstacles,
  calculateScaleFactor,
  calculateMaxHp,
  calculateAttackDamage,
  calculateSugarDecayRate,
  calculateDangerLevel,
  calculateBounty,
  getBountyTier
} from './constants';
import { Camera } from './Camera';
import { SugarManager } from './SugarManager';
import { ParticleSystem } from './ParticleSystem';
import { BotAI } from './BotAI';
import { MultiplayerClient, RemotePlayerState, RemoteProjectileState } from './MultiplayerClient';
import { soundManager } from './audio';
import {
  checkCircleCollision,
  checkCircleRectCollision,
  resolveCircleRectCollision,
  clampToWorldBounds,
  getDistance,
  getDistanceSq
} from './Collision';

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public camera: Camera;
  public sugarManager: SugarManager;
  public particleSystem: ParticleSystem;

  public player!: PlayerEntity;
  public bots: PlayerEntity[] = [];
  public projectiles: Projectile[] = [];
  public powerUps: PowerUpItem[] = [];
  public obstacles: MapObstacle[] = [];
  public killFeed: KillEvent[] = [];
  public remotePlayers: RemotePlayerState[] = [];
  public remoteProjectiles: RemoteProjectileState[] = [];

  // Dynamic Map System v2 state
  public hotZone!: HotZoneState;
  private hotZoneCandidates: { x: number; y: number }[] = [
    { x: WORLD_SIZE * 0.5, y: WORLD_SIZE * 0.5 },
    { x: WORLD_SIZE * 0.28, y: WORLD_SIZE * 0.28 },
    { x: WORLD_SIZE * 0.72, y: WORLD_SIZE * 0.28 },
    { x: WORLD_SIZE * 0.28, y: WORLD_SIZE * 0.72 },
    { x: WORLD_SIZE * 0.72, y: WORLD_SIZE * 0.72 },
    { x: WORLD_SIZE * 0.5, y: WORLD_SIZE * 0.25 },
    { x: WORLD_SIZE * 0.5, y: WORLD_SIZE * 0.75 }
  ];
  private currentHotZoneIndex = 0;
  private activeAnnouncement: MapAnnouncement | null = null;
  private hotZoneDmgTimer = 0;
  private isKingInHotZone = false;

  // Screen Shake & Juiciness Hit Stop
  private screenShakeTime = 0;
  private screenShakeIntensity = 0;
  private hitStopTime = 0;

  public addScreenShake(intensity: number, duration: number) {
    this.screenShakeIntensity = Math.max(this.screenShakeIntensity, intensity);
    this.screenShakeTime = Math.max(this.screenShakeTime, duration);
  }

  public triggerHitStop(duration: number) {
    this.hitStopTime = Math.max(this.hitStopTime, duration);
  }

  // Inputs
  public keys: Record<string, boolean> = {};
  public mobileMove: { x: number; y: number } = { x: 0, y: 0 };
  public mousePos: { x: number; y: number } = { x: 0, y: 0 };
  public isMouseDown: boolean = false;

  // Timers & Stats
  private lastFrameTime = performance.now();
  private gameStartTime = Date.now();
  private isRunning = false;
  private animFrameId: number | null = null;
  private onSnapshotUpdate?: (snapshot: GameSnapshot) => void;
  private onGameOver?: (snapshot: GameSnapshot) => void;

  private lastSnapshotTime = 0;
  private projectilePool: Projectile[] = [];
  private topPlayer: PlayerEntity | null = null;
  private multiplayerClient?: MultiplayerClient;
  private multiplayerRank: number | null = null;
  private activePlayers: PlayerEntity[] = [];
  private renderPlayers: PlayerEntity[] = [];
  public showDebug = false;

  private idCounter = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.camera = new Camera(canvas.width, canvas.height);
    this.sugarManager = new SugarManager();
    this.particleSystem = new ParticleSystem();
    this.obstacles = generateMapObstacles();
    this.initHotZone();
  }

  private initHotZone() {
    const curr = this.hotZoneCandidates[0];
    const next = this.hotZoneCandidates[1];

    this.hotZone = {
      x: curr.x,
      y: curr.y,
      radius: DYNAMIC_MAP_CONFIG.hotZoneRadius,
      timer: DYNAMIC_MAP_CONFIG.hotZoneDuration,
      timeRemaining: DYNAMIC_MAP_CONFIG.hotZoneDuration,
      isWarning: false,
      nextX: next.x,
      nextY: next.y,
      isKingInside: false
    };
    this.isKingInHotZone = false;
  }

  public triggerAnnouncement(title: string, subtitle: string, color: string = '#F59E0B') {
    this.activeAnnouncement = {
      id: `ann_${Date.now()}`,
      title,
      subtitle,
      color,
      timestamp: Date.now(),
      expiresAt: Date.now() + 3000
    };
  }

  // Helper to find a safe spawn position free of obstacles and distant from active players
  public getSafeSpawnPosition(radius: number = 24): { x: number; y: number } {
    const minPadding = 220;
    const worldMax = WORLD_SIZE - minPadding;
    const activePlayers = [this.player, ...(this.bots || [])].filter((p) => p && !p.isDead);

    for (let attempt = 0; attempt < 60; attempt++) {
      const candidateX = minPadding + Math.random() * (worldMax - minPadding);
      const candidateY = minPadding + Math.random() * (worldMax - minPadding);

      // 1. Check map obstacles
      let overlapsObstacle = false;
      for (const obs of this.obstacles) {
        if (checkCircleRectCollision(candidateX, candidateY, radius + 25, obs.x, obs.y, obs.width, obs.height)) {
          overlapsObstacle = true;
          break;
        }
      }
      if (overlapsObstacle) continue;

      // 2. Check distance to active players
      let tooCloseToPlayer = false;
      for (const p of activePlayers) {
        if (getDistance(candidateX, candidateY, p.x, p.y) < 260) {
          tooCloseToPlayer = true;
          break;
        }
      }
      if (tooCloseToPlayer) continue;

      return { x: candidateX, y: candidateY };
    }

    // Fallback: relax player proximity check
    for (let attempt = 0; attempt < 40; attempt++) {
      const candidateX = minPadding + Math.random() * (worldMax - minPadding);
      const candidateY = minPadding + Math.random() * (worldMax - minPadding);

      let overlapsObstacle = false;
      for (const obs of this.obstacles) {
        if (checkCircleRectCollision(candidateX, candidateY, radius + 15, obs.x, obs.y, obs.width, obs.height)) {
          overlapsObstacle = true;
          break;
        }
      }
      if (!overlapsObstacle) return { x: candidateX, y: candidateY };
    }

    return { x: 350, y: 350 };
  }

  // Initialize match
  public initGame(playerName: string, characterId: CharacterId, callbacks: {
    onSnapshotUpdate: (snapshot: GameSnapshot) => void;
    onGameOver: (snapshot: GameSnapshot) => void;
  }, botCount = INITIAL_BOT_COUNT, multiplayerClient?: MultiplayerClient) {
    this.onSnapshotUpdate = callbacks.onSnapshotUpdate;
    this.onGameOver = callbacks.onGameOver;
    this.gameStartTime = Date.now();
    BotAI.resetCache();
    this.projectiles = [];
    this.powerUps = [];
    this.killFeed = [];
    this.remotePlayers = [];
    this.multiplayerRank = null;
    this.remoteProjectiles = [];
    this.multiplayerClient = multiplayerClient;

    // Create Main Player with guaranteed safe spawn location
    const playerSpawn = this.getSafeSpawnPosition(24);
    this.player = this.createPlayerEntity(
      `player_${this.idCounter++}`,
      playerName || 'Player123',
      characterId,
      false,
      playerSpawn.x,
      playerSpawn.y
    );

    // Create AI Bots
    this.bots = [];
    const personalities: BotPersonalityType[] = ['collector', 'hunter', 'coward', 'aggressive', 'balanced'];
    const charKeys = Object.keys(CHARACTERS) as CharacterId[];

    for (let i = 0; i < Math.max(0, Math.min(botCount, 20)); i++) {
      const botName = BOT_NAMES[i % BOT_NAMES.length];
      const botChar = charKeys[i % charKeys.length];
      const botPers = personalities[i % personalities.length];

      // Safe spawn away from obstacles and other players
      const botSpawn = this.getSafeSpawnPosition(24);

      const bot = this.createPlayerEntity(`bot_${this.idCounter++}`, botName, botChar, true, botSpawn.x, botSpawn.y);
      bot.personality = botPers;
      // Give bots initial small sugar boost so the board is dynamic right away
      bot.sugar = Math.floor(50 + Math.random() * 200);
      this.updatePlayerGrowthStats(bot);
      this.bots.push(bot);
    }

    this.sugarManager.seedSugar();
    this.camera.follow(this.player.x, this.player.y);
    if (this.multiplayerClient) {
      this.multiplayerClient.connect(playerName || 'Player123', characterId);
    }
    soundManager.playStartFanfare();
  }

  private createPlayerEntity(
    id: string,
    name: string,
    characterId: CharacterId,
    isBot: boolean,
    x: number,
    y: number
  ): PlayerEntity {
    const char = CHARACTERS[characterId] || CHARACTERS.cookie;
    const baseRadius = 24;

    return {
      id,
      name,
      characterId,
      isBot,
      x,
      y,
      radius: baseRadius,
      hp: char.maxHp,
      maxHp: char.maxHp,
      baseMaxHp: char.maxHp,
      speed: char.speed,
      baseSpeed: char.speed,
      attackDamage: char.attackDamage,
      baseAttackDamage: char.attackDamage,
      attackRange: char.attackRange,
      attackSpeed: char.attackSpeed,
      attackInterval: char.attackInterval,
      invincibleTimeRemaining: COMBAT_CONFIG.respawnInvincibility / 1000,
      sugar: 0,
      score: 0,
      kills: 0,
      bounty: 200,
      scaleFactor: 1.0,
      facingAngle: 0,
      vx: 0,
      vy: 0,
      lastAttackTime: 0,
      abilityCooldownRemaining: 0,
      isShielded: false,
      shieldTimeRemaining: 0,
      shieldReduction: 0,
      isDashing: false,
      dashTimeRemaining: 0,
      dashVx: 0,
      dashVy: 0,
      hitFlashTime: 0,
      isDead: false,
      respawnTimer: 0,
      speedBoostTimeRemaining: 0,
      damageBoostTimeRemaining: 0,
      powerUpShieldAmount: 0,
      powerUpShieldTimeRemaining: 0,
      rainbowTimeRemaining: 0,
      puddingComboStage: 0,
      puddingLastComboTime: 0,
      puddingSwingTimer: 0,
      puddingSwingAngle: 0,
      donutChargeStartTime: null,
      donutChargeTimer: 0,
      donutCurrentLevel: 1,
      squashX: 1.0,
      squashY: 1.0,
      tiltAngle: 0,
      faceExpression: 'idle',
      faceTimer: 0,
      delayedHp: char.maxHp,
      eatPopTimer: 0,
      deathAnimTimer: 0
    };
  }

  // Update dynamic stats according to Sugar
  private updatePlayerGrowthStats(p: PlayerEntity) {
    p.scaleFactor = calculateScaleFactor(p.sugar);
    p.radius = 24 * p.scaleFactor;

    const oldMaxHp = p.maxHp;
    p.maxHp = calculateMaxHp(p.characterId, p.baseMaxHp, p.sugar);

    // Increase current HP proportionally when max HP increases
    if (p.maxHp > oldMaxHp) {
      p.hp += p.maxHp - oldMaxHp;
    }
    p.hp = Math.min(p.hp, p.maxHp);

    p.attackDamage = calculateAttackDamage(p.baseAttackDamage, p.sugar);
    p.bounty = calculateBounty(p.sugar, p.kills);

    // Slight speed slowdown as player becomes giant dessert
    const speedPenalty = (p.scaleFactor - 1.0) * 0.8;
    p.speed = Math.max(2.8, p.baseSpeed - speedPenalty);
  }

  public start() {
    this.isRunning = true;
    this.lastFrameTime = performance.now();
    this.loop();
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  public destroy() {
    this.stop();
    this.multiplayerClient?.disconnect();
    this.multiplayerClient = undefined;
    this.remotePlayers = [];
  }

  public applyRemoteSelfState(state: RemotePlayerState) {
    if (!this.player || state.hp === undefined) return;
    if (state.rank !== undefined) this.multiplayerRank = state.rank;
    this.player.hp = Math.max(0, Math.min(this.player.maxHp, state.hp));
    if (state.isDead) this.player.isDead = true;
  }

  public addRemoteProjectile(projectile: RemoteProjectileState) {
    this.remoteProjectiles.push({ ...projectile, lifeRemaining: 1.8 });
  }

  private loop = () => {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1); // Cap delta time
    this.lastFrameTime = now;
    this.particleSystem.reportFrameTime(dt);

    this.update(dt);
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  // Main Game Update
  private update(dt: number) {
    // 0a. Process Hit Stop
    if (this.hitStopTime > 0) {
      this.hitStopTime -= dt;
      return; // Freeze update for juiciness impact
    }

    // 0b. Screen Shake Decay
    if (this.screenShakeTime > 0) {
      this.screenShakeTime -= dt;
      if (this.screenShakeTime <= 0) {
        this.screenShakeIntensity = 0;
      }
    }

    const allPlayers = [this.player, ...this.bots];

    // 1. Process Main Player Input & Abilities
    if (!this.player.isDead) {
      this.handlePlayerMovement();
      this.handlePlayerAimAndAttack();

      // Ability trigger via SPACE key
      if (this.keys['Space'] || this.keys['space']) {
        this.triggerAbility(this.player);
        this.keys['Space'] = false;
        this.keys['space'] = false;
      }
    }

    // 2. Process Hot Zone, Power-up Spawns & Bot AI
    this.updateHotZoneSystem(dt);
    this.updatePowerUpSpawns();

    const topPlayer = this.updateTopPlayer(allPlayers);
    const kingId = topPlayer && topPlayer.bounty >= DYNAMIC_MAP_CONFIG.bountyTiers.king ? topPlayer.id : null;
    this.activePlayers.length = 0;
    for (const player of allPlayers) {
      if (!player.isDead) this.activePlayers.push(player);
    }

    this.bots.forEach((bot) => {
      if (bot.isDead) {
        bot.respawnTimer -= dt;
        if (bot.respawnTimer <= 0) {
          // Respawn Bot with guaranteed safe location
          const respawnPos = this.getSafeSpawnPosition(bot.radius);
          bot.isDead = false;
          bot.x = respawnPos.x;
          bot.y = respawnPos.y;
          bot.hp = bot.maxHp;
          bot.delayedHp = bot.maxHp;
          bot.sugar = 30;
          bot.invincibleTimeRemaining = COMBAT_CONFIG.respawnInvincibility / 1000;
          bot.targetLockId = null;
          bot.reactionEndTime = 0;
          bot.speedBoostTimeRemaining = 0;
          bot.damageBoostTimeRemaining = 0;
          bot.powerUpShieldAmount = 0;
          bot.powerUpShieldTimeRemaining = 0;
          bot.rainbowTimeRemaining = 0;
          this.updatePlayerGrowthStats(bot);
          this.particleSystem.addBurst(bot.x, bot.y, '#34D399', 15);
        }
      } else {
        BotAI.updateBot(
          bot,
          this.activePlayers,
          this.sugarManager.sugars,
          this.powerUps,
          this.hotZone,
          kingId,
          (b, tx, ty, cTime) => this.handleCharacterAttack(b, tx, ty, cTime),
          (b) => this.triggerAbility(b)
        );
      }
    });

    // 3. Update Player Cooldowns, Buffs & Special Effects
    allPlayers.forEach((p) => {
      if (p.isDead) return;

      // Delayed Red HP Bar smooth lerp
      if (p.delayedHp === undefined) p.delayedHp = p.hp;
      if (p.delayedHp > p.hp) {
        p.delayedHp = Math.max(p.hp, p.delayedHp - (p.delayedHp - p.hp) * 5 * dt);
      } else {
        p.delayedHp = p.hp;
      }

      // Decrement animation timers
      if (p.faceTimer && p.faceTimer > 0) p.faceTimer -= dt;
      if (p.eatPopTimer && p.eatPopTimer > 0) p.eatPopTimer -= dt;

      // Squash & Stretch & Tilting physics
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 0.5) {
        // Moving: stretch along movement direction
        const stretchAmount = Math.min(0.12, speed * 0.02);
        p.squashX = 1.0 + stretchAmount;
        p.squashY = 1.0 - stretchAmount * 0.8;

        // Tilt Z rotation (-8 deg to +8 deg)
        const targetTilt = Math.max(-0.14, Math.min(0.14, p.vx * 0.025));
        p.tiltAngle = (p.tiltAngle || 0) + (targetTilt - (p.tiltAngle || 0)) * 12 * dt;
      } else {
        // Idle breathing sine bounce (1.5 - 2s cycle)
        const breathe = Math.sin(performance.now() * 0.0035 + (p.id.charCodeAt(0) || 0)) * 0.035;
        p.squashX = 1.0 - breathe;
        p.squashY = 1.0 + breathe;
        p.tiltAngle = (p.tiltAngle || 0) * (1 - 8 * dt);
      }

      // Pudding Swing Timer
      if (p.puddingSwingTimer && p.puddingSwingTimer > 0) {
        p.puddingSwingTimer = Math.max(0, p.puddingSwingTimer - dt);
      }

      // Donut Charge Timer
      if (p.characterId === 'donut' && p.donutChargeStartTime) {
        const cTime = Math.max(0, (performance.now() - p.donutChargeStartTime) / 1000);
        p.donutChargeTimer = cTime;
        p.donutCurrentLevel = cTime >= 1.2 ? 3 : cTime >= 0.5 ? 2 : 1;
      }

      // Decrement Power-up Buff Timers
      if (p.speedBoostTimeRemaining > 0) {
        p.speedBoostTimeRemaining = Math.max(0, p.speedBoostTimeRemaining - dt);
      }
      if (p.damageBoostTimeRemaining > 0) {
        p.damageBoostTimeRemaining = Math.max(0, p.damageBoostTimeRemaining - dt);
      }
      if (p.powerUpShieldTimeRemaining > 0) {
        p.powerUpShieldTimeRemaining = Math.max(0, p.powerUpShieldTimeRemaining - dt);
        if (p.powerUpShieldTimeRemaining <= 0) {
          p.powerUpShieldAmount = 0;
        }
      }

      // Decrement Invincibility
      if (p.invincibleTimeRemaining > 0) {
        p.invincibleTimeRemaining = Math.max(0, p.invincibleTimeRemaining - dt);
      }

      // Decrement Ability Cooldown
      if (p.abilityCooldownRemaining > 0) {
        p.abilityCooldownRemaining = Math.max(0, p.abilityCooldownRemaining - dt);
      }

      // Handle Shield Timer
      if (p.isShielded) {
        p.shieldTimeRemaining -= dt;
        if (p.shieldTimeRemaining <= 0) {
          p.isShielded = false;
        }
      }

      // Handle Dash Burst
      if (p.isDashing) {
        p.dashTimeRemaining -= dt;
        p.x += p.dashVx;
        p.y += p.dashVy;
        this.particleSystem.addTrail(p.x, p.y, CHARACTERS[p.characterId].color, p.radius);

        if (p.dashTimeRemaining <= 0) {
          p.isDashing = false;
        }
      } else {
        // Normal movement update
        p.x += p.vx;
        p.y += p.vy;
      }

      // Decrement Hit Flash
      if (p.hitFlashTime > 0) {
        p.hitFlashTime -= dt;
      }

      // Process Obstacle Collisions
      this.obstacles.forEach((obs) => {
        const resolved = resolveCircleRectCollision(p.x, p.y, p.radius, obs);
        if (resolved.collided) {
          p.x = resolved.x;
          p.y = resolved.y;
        }
      });

      // Clamp to World
      const clamped = clampToWorldBounds(p.x, p.y, p.radius, WORLD_SIZE);
      p.x = clamped.x;
      p.y = clamped.y;

      // Decrement Rainbow Sugar Buff
      if (p.rainbowTimeRemaining && p.rainbowTimeRemaining > 0) {
        p.rainbowTimeRemaining = Math.max(0, p.rainbowTimeRemaining - dt);
      }

      // Process Sugar Decay
      this.sugarManager.processSugarDecay(p, dt);
      this.updatePlayerGrowthStats(p);

      // Collect Sugars
      this.sugarManager.collectSugarForPlayer(p, (sugar) => {
        const multiplier = (p.rainbowTimeRemaining && p.rainbowTimeRemaining > 0) ? DYNAMIC_MAP_CONFIG.specialSugars.rainbow.sugarMultiplier : 1.0;
        const sugarGain = Math.round(sugar.value * multiplier);

        p.sugar += sugarGain;
        p.score += sugar.scoreValue;
        p.eatPopTimer = 0.15; // Scale pop animation trigger
        this.updatePlayerGrowthStats(p);

        let label: string | null = null;
        let labelColor = sugar.color;

        if (sugar.type === 'golden') {
          label = `+${sugarGain} GOLDEN!`;
          labelColor = '#FBBF24';
          if (p.id === this.player.id) soundManager.playGoldenSugarPickup();
        } else if (sugar.type === 'rainbow') {
          p.rainbowTimeRemaining = DYNAMIC_MAP_CONFIG.specialSugars.rainbow.duration;
          label = `🌈 RAINBOW BOOST! (1.5x)`;
          labelColor = '#A855F7';
          if (p.id === this.player.id) soundManager.playGoldenSugarPickup();
        } else if (sugar.type === 'toxic') {
          const hpLoss = Math.round(p.maxHp * DYNAMIC_MAP_CONFIG.specialSugars.toxic.hpLossPercent);
          p.hp -= hpLoss;
          label = `☠️ +${sugarGain} TOXIC (-15% HP!)`;
          labelColor = '#22C55E';
          if (p.id === this.player.id) soundManager.playHit();

          if (p.hp <= 0) {
            this.handlePlayerKill('ToxicSugar', p);
          }
        } else {
          if (p.id === this.player.id) soundManager.playSugarPickup();
        }

        if (label) {
          this.particleSystem.addFloatingText(sugar.x, sugar.y, label, labelColor, 15);
        }
      });

      // Collect Power-Ups
      for (let i = this.powerUps.length - 1; i >= 0; i--) {
        const pu = this.powerUps[i];
        if (checkCircleCollision(p.x, p.y, p.radius, pu.x, pu.y, pu.radius)) {
          if (pu.type === 'heal') {
            const healAmt = Math.round(p.maxHp * COMBAT_CONFIG.powerUps.heal.hpPercent);
            p.hp = Math.min(p.maxHp, p.hp + healAmt);
            this.particleSystem.addFloatingText(p.x, p.y, '+30% HP', '#34D399', 18);
          } else if (pu.type === 'shield') {
            p.powerUpShieldAmount = Math.round(p.maxHp * COMBAT_CONFIG.powerUps.shield.hpPercent);
            p.powerUpShieldTimeRemaining = COMBAT_CONFIG.powerUps.shield.duration;
            this.particleSystem.addFloatingText(p.x, p.y, 'SHIELD ACTIVE', '#60A5FA', 18);
          } else if (pu.type === 'speed') {
            p.speedBoostTimeRemaining = COMBAT_CONFIG.powerUps.speed.duration;
            this.particleSystem.addFloatingText(p.x, p.y, 'SPEED BOOST!', '#FBBF24', 18);
          } else if (pu.type === 'damage') {
            p.damageBoostTimeRemaining = COMBAT_CONFIG.powerUps.damage.duration;
            this.particleSystem.addFloatingText(p.x, p.y, 'DAMAGE UP!', '#F97316', 18);
          }

          if (p.id === this.player.id) {
            soundManager.playGoldenSugarPickup();
          }

          const burstColor =
            pu.type === 'heal' ? '#34D399' : pu.type === 'shield' ? '#60A5FA' : pu.type === 'speed' ? '#FBBF24' : '#F97316';
          this.particleSystem.addBurst(pu.x, pu.y, burstColor, 15);
          this.powerUps.splice(i, 1);
        }
      }
    });

    // 3b. Entity-to-Entity Physical Separation (Prevent Overlapping & Stacking)
    const activeEntities = this.activePlayers;
    for (let i = 0; i < activeEntities.length; i++) {
      for (let j = i + 1; j < activeEntities.length; j++) {
        const e1 = activeEntities[i];
        const e2 = activeEntities[j];
        const distSq = getDistanceSq(e1.x, e1.y, e2.x, e2.y);
        const minDist = (e1.radius + e2.radius) * 0.95;

        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const nx = (e1.x - e2.x) / dist;
          const ny = (e1.y - e2.y) / dist;

          // Push apart smoothly
          const pushRatio = 0.5;
          e1.x += nx * overlap * pushRatio;
          e1.y += ny * overlap * pushRatio;
          e2.x -= nx * overlap * pushRatio;
          e2.y -= ny * overlap * pushRatio;
        }
      }
    }

    // 4. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];

      // Move
      proj.x += proj.vx;
      proj.y += proj.vy;
      const distTraveled = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy);
      proj.rangeRemaining -= distTraveled;

      // Check wall collision
      let hitWall = false;
      for (const obs of this.obstacles) {
        if (checkCircleRectCollision(proj.x, proj.y, proj.radius, obs.x, obs.y, obs.width, obs.height)) {
          hitWall = true;
          this.particleSystem.addBurst(proj.x, proj.y, proj.color, 6);
          break;
        }
      }

      if (hitWall || proj.rangeRemaining <= 0 || proj.x < 0 || proj.x > WORLD_SIZE || proj.y < 0 || proj.y > WORLD_SIZE) {
        this.releaseProjectile(proj);
        this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
        this.projectiles.pop();
        continue;
      }

      // Check player collision
      let projDestroyed = false;
      for (const victim of allPlayers) {
        if (victim.isDead || victim.id === proj.ownerId) continue;

        if (checkCircleCollision(proj.x, proj.y, proj.radius, victim.x, victim.y, victim.radius)) {
          if (victim.invincibleTimeRemaining > 0) {
            this.particleSystem.addBurst(proj.x, proj.y, '#34D399', 6);
            this.particleSystem.addFloatingText(victim.x, victim.y, 'INVINCIBLE!', '#34D399', 14);
            projDestroyed = true;
            break;
          }

          // Calculate Damage
          let finalDamage = proj.damage;

          if (victim.isShielded) {
            finalDamage *= 1 - victim.shieldReduction;
            this.particleSystem.addFloatingText(victim.x, victim.y, 'BLOCKED!', '#60A5FA', 16);
          }

          if (victim.powerUpShieldAmount > 0 && victim.powerUpShieldTimeRemaining > 0) {
            const absorbed = Math.min(finalDamage, victim.powerUpShieldAmount);
            victim.powerUpShieldAmount -= absorbed;
            finalDamage -= absorbed;
            this.particleSystem.addFloatingText(victim.x, victim.y, `SHIELD -${Math.round(absorbed)}`, '#60A5FA', 14);
            if (victim.powerUpShieldAmount <= 0) {
              victim.powerUpShieldTimeRemaining = 0;
            }
          }

          finalDamage = Math.max(0, Math.round(finalDamage));
          victim.hp -= finalDamage;
          victim.hitFlashTime = 0.15;

          this.particleSystem.addBurst(proj.x, proj.y, proj.color, 10);
          this.particleSystem.addFloatingText(victim.x, victim.y, `-${finalDamage}`, '#EF4444', 18);

          if (victim.id === this.player.id || proj.ownerId === this.player.id) {
            soundManager.playHit();
          }

          // Check Kill
          if (victim.hp <= 0) {
            this.handlePlayerKill(proj.ownerId, victim);
          }

          projDestroyed = true;
          break;
        }
      }

      if (!projDestroyed && this.multiplayerClient) {
        for (const victim of this.remotePlayers) {
          if (victim.isDead || victim.id === proj.ownerId) continue;
          if (!checkCircleCollision(proj.x, proj.y, proj.radius, victim.x, victim.y, victim.radius)) continue;

          const finalDamage = Math.max(1, Math.round(proj.damage));
          this.multiplayerClient.sendHit(victim.id, finalDamage);
          this.particleSystem.addBurst(proj.x, proj.y, proj.color, 10);
          this.particleSystem.addFloatingText(victim.x, victim.y, `-${finalDamage}`, '#EF4444', 18);
          if (proj.ownerId === this.player.id) soundManager.playHit();
          projDestroyed = true;
          break;
        }
      }

      if (projDestroyed) {
        this.releaseProjectile(proj);
        this.projectiles[i] = this.projectiles[this.projectiles.length - 1];
        this.projectiles.pop();
      }
    }

    // 5. Sugar Spawning
    this.sugarManager.maintainSugarCount();

    // 6. Camera Follow
    if (!this.player.isDead) {
      this.camera.follow(this.player.x, this.player.y);
    }
    this.camera.update();

    this.multiplayerClient?.sendState({
      id: this.player.id,
      name: this.player.name,
      characterId: this.player.characterId,
      x: this.player.x,
      y: this.player.y,
      radius: this.player.radius,
      score: this.player.score,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      isDead: this.player.isDead
    });

    // 7. Particle System Update
    this.particleSystem.update();
    this.updateRemoteProjectiles(dt);

    // 8. Snapshot & UI Sync
    this.emitSnapshot();
  }

  // Dynamic Map System v2: Hot Zone cycle and HP Drain
  private updateHotZoneSystem(dt: number) {
    if (!this.hotZone) return;

    this.hotZone.timeRemaining -= dt;

    // Check warning threshold (5 seconds before relocation)
    if (this.hotZone.timeRemaining <= DYNAMIC_MAP_CONFIG.hotZoneWarningDuration && !this.hotZone.isWarning) {
      this.hotZone.isWarning = true;
      this.triggerAnnouncement('🔥 HOT ZONE MOVING SOON!', 'Relocating in 5 seconds...', '#F97316');
    }

    // Check relocation trigger
    if (this.hotZone.timeRemaining <= 0) {
      this.currentHotZoneIndex = (this.currentHotZoneIndex + 1) % this.hotZoneCandidates.length;
      const curr = this.hotZoneCandidates[this.currentHotZoneIndex];
      const nextIndex = (this.currentHotZoneIndex + 1) % this.hotZoneCandidates.length;
      const next = this.hotZoneCandidates[nextIndex];

      this.hotZone.x = curr.x;
      this.hotZone.y = curr.y;
      this.hotZone.nextX = next.x;
      this.hotZone.nextY = next.y;
      this.hotZone.timeRemaining = DYNAMIC_MAP_CONFIG.hotZoneDuration;
      this.hotZone.isWarning = false;
      this.isKingInHotZone = false;

      this.triggerAnnouncement('🔥 HOT ZONE MOVED!', 'New Hot Zone active! High reward & HP drain risk!', '#EF4444');

      // Spawn extra Special Sugars in the new Hot Zone
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (this.hotZone.radius * 0.75);
        const sx = this.hotZone.x + Math.cos(angle) * dist;
        const sy = this.hotZone.y + Math.sin(angle) * dist;
        this.sugarManager.spawnSugarItem(sx, sy, undefined, undefined, true);
      }
    }

    // Check players in Hot Zone & apply HP Drain
    const dmg = DYNAMIC_MAP_CONFIG.hotZoneDamagePerSec * dt;
    this.hotZoneDmgTimer += dt;

    let kingInZoneNow = false;
    const topPlayer = this.topPlayer;
    const kingId = topPlayer && topPlayer.bounty >= DYNAMIC_MAP_CONFIG.bountyTiers.king ? topPlayer.id : null;

    this.activePlayers.forEach((p) => {
      if (p.isDead) return;
      const distSq = getDistanceSq(p.x, p.y, this.hotZone.x, this.hotZone.y);
      if (distSq <= this.hotZone.radius * this.hotZone.radius) {
        if (p.id === kingId) {
          kingInZoneNow = true;
        }

        p.hp -= dmg;
        if (this.hotZoneDmgTimer >= 1.0) {
          this.particleSystem.addFloatingText(p.x, p.y, '-5 HP', '#EF4444', 13);
        }

        if (p.hp <= 0) {
          this.handlePlayerKill('HotZone', p);
        }
      }
    });

    if (this.hotZoneDmgTimer >= 1.0) {
      this.hotZoneDmgTimer = 0;
    }

    // King entered Hot Zone announcement
    if (kingInZoneNow && !this.isKingInHotZone && topPlayer) {
      this.isKingInHotZone = true;
      this.triggerAnnouncement(
        '👑 KING ENTERED HOT ZONE!',
        `${topPlayer.name} is risking it all in the Hot Zone!`,
        '#FBBF24'
      );

      // Spawn 3 Golden Sugars in Hot Zone
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (this.hotZone.radius * 0.5);
        this.sugarManager.spawnSugarItem(
          this.hotZone.x + Math.cos(angle) * dist,
          this.hotZone.y + Math.sin(angle) * dist,
          'golden'
        );
      }
    }
  }

  // Handles Player Killing
  private handlePlayerKill(killerId: string, victim: PlayerEntity) {
    victim.isDead = true;
    victim.hp = 0;
    victim.respawnTimer = 3.5;

    // Drop Sugar
    this.sugarManager.dropSugarOnDeath(victim.x, victim.y, victim.sugar);

    // Find Killer
    const allPlayers = [this.player, ...this.bots];
    const killer = allPlayers.find((p) => p.id === killerId);

    const victimTier = getBountyTier(victim.bounty);
    let bountyAwarded = victim.bounty;

    if (victimTier === 'KING') {
      bountyAwarded += 400;
      this.triggerAnnouncement(
        '👑 KING OF SUGAR DEFEATED!',
        `${killer ? killer.name : 'Environmental Hazard'} claimed the King's Bounty!`,
        '#FBBF24'
      );
    } else if (victimTier === 'HIGH_VALUE') {
      bountyAwarded += 200;
    } else if (victimTier === 'WANTED') {
      bountyAwarded += 100;
    }

    if (killer) {
      killer.kills += 1;
      killer.score += bountyAwarded + 300;
      this.updatePlayerGrowthStats(killer);

      this.particleSystem.addFloatingText(
        killer.x,
        killer.y,
        `👑 KILLED ${victim.name.toUpperCase()}! +${bountyAwarded}`,
        '#FBBF24',
        22
      );

      if (killer.id === this.player.id) {
        soundManager.playKill();
      }
    }

    if (victim.id === this.player.id) {
      soundManager.playDeath();
    }

    // Particle Explosion for Death
    this.particleSystem.addBurst(victim.x, victim.y, CHARACTERS[victim.characterId].color, 30, 1.8);

    // Record Kill Event
    const killEvent: KillEvent = {
      id: `k_${Date.now()}_${Math.random()}`,
      killerName: killer ? killer.name : 'Environmental',
      killerCharacter: killer ? killer.characterId : 'cookie',
      victimName: victim.name,
      victimCharacter: victim.characterId,
      bountyClaimed: bountyAwarded,
      timestamp: Date.now()
    };

    this.killFeed.unshift(killEvent);
    if (this.killFeed.length > 5) this.killFeed.pop();

    // Reset victim's sugar
    victim.sugar = 0;

    // Trigger Game Over if Main Player Dies
    if (victim.id === this.player.id && this.onGameOver) {
      setTimeout(() => {
        if (this.onGameOver) {
          this.onGameOver(this.generateSnapshot());
        }
      }, 1200);
    }
  }

  // Handle Player WASD Movement
  private handlePlayerMovement() {
    let dx = 0;
    let dy = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
    dx += this.mobileMove.x;
    dy += this.mobileMove.y;

    if (dx !== 0 && dy !== 0) {
      dx *= 0.7071;
      dy *= 0.7071;
    }

    const speedBoost = this.player.speedBoostTimeRemaining > 0 ? 1.3 : 1.0;
    let chargePenalty = 1.0;

    if (this.player.characterId === 'donut' && this.player.donutChargeStartTime) {
      const cTime = Math.max(0, (performance.now() - this.player.donutChargeStartTime) / 1000);
      chargePenalty = cTime >= 1.2 ? 0.5 : 0.7; // 50% speed penalty at max charge, 70% while charging
    }

    this.player.vx = dx * this.player.speed * speedBoost * chargePenalty;
    this.player.vy = dy * this.player.speed * speedBoost * chargePenalty;
  }

  // Aiming & Character Combat Dispatcher
  private handlePlayerAimAndAttack() {
    const worldMouse = this.camera.screenToWorld(this.mousePos.x, this.mousePos.y);
    this.player.facingAngle = Math.atan2(worldMouse.y - this.player.y, worldMouse.x - this.player.x);

    const now = performance.now();

    if (this.player.characterId === 'pudding') {
      // Pudding Melee Swing (Spoon Smash 3-Hit Combo)
      if (this.isMouseDown) {
        if (now - this.player.lastAttackTime >= this.player.attackInterval) {
          this.executePuddingMeleeSwing(this.player, worldMouse.x, worldMouse.y);
          this.player.lastAttackTime = now;
        }
      }
    } else if (this.player.characterId === 'donut') {
      // Donut Charged Sugar Shot
      if (this.isMouseDown) {
        if (!this.player.donutChargeStartTime && now - this.player.lastAttackTime >= this.player.attackInterval) {
          this.player.donutChargeStartTime = now;
        }

        if (this.player.donutChargeStartTime) {
          const cTime = (now - this.player.donutChargeStartTime) / 1000;
          this.player.donutChargeTimer = cTime;

          const prevLevel = this.player.donutCurrentLevel || 1;
          const newLevel = cTime >= 1.2 ? 3 : cTime >= 0.5 ? 2 : 1;
          this.player.donutCurrentLevel = newLevel;

          if (newLevel === 3 && prevLevel < 3) {
            this.particleSystem.addFloatingText(this.player.x, this.player.y, 'MAX CHARGE!! 🍩', '#FFE4E6', 22);
            this.particleSystem.addBurst(this.player.x, this.player.y, '#FFE4E6', 14);
            soundManager.playGoldenSugarPickup();
          }

          if (Math.random() < 0.35) {
            const angle = Math.random() * Math.PI * 2;
            const dist = this.player.radius + 15 + Math.random() * 15;
            const px = this.player.x + Math.cos(angle) * dist;
            const py = this.player.y + Math.sin(angle) * dist;
            const color = newLevel === 3 ? '#FFE4E6' : newLevel === 2 ? '#F59E0B' : '#F43F5E';
            this.particleSystem.addTrail(px, py, color, 3);
          }
        }
      } else {
        // Released Mouse -> Fire Charged Shot
        if (this.player.donutChargeStartTime) {
          const chargeDuration = (now - this.player.donutChargeStartTime) / 1000;
          this.shootDonutChargedShot(this.player, worldMouse.x, worldMouse.y, chargeDuration);
          this.player.donutChargeStartTime = null;
          this.player.donutChargeTimer = 0;
          this.player.donutCurrentLevel = 1;
          this.player.lastAttackTime = now;
        }
      }
    } else {
      // Cookie & Candy standard shooting
      if (this.isMouseDown) {
        if (now - this.player.lastAttackTime >= this.player.attackInterval) {
          this.shootProjectile(this.player, worldMouse.x, worldMouse.y);
          this.player.lastAttackTime = now;
        }
      }
    }
  }

  // Attack Router for Bots and Players
  public handleCharacterAttack(attacker: PlayerEntity, targetX: number, targetY: number, chargeTimeSeconds?: number) {
    if (attacker.characterId === 'pudding') {
      this.executePuddingMeleeSwing(attacker, targetX, targetY);
    } else if (attacker.characterId === 'donut') {
      this.shootDonutChargedShot(attacker, targetX, targetY, chargeTimeSeconds || 0);
    } else {
      this.shootProjectile(attacker, targetX, targetY);
    }
  }

  private damageRemotePlayersInRadius(attacker: PlayerEntity, radius: number, damage: number, color: string, label: string) {
    if (!this.multiplayerClient) return;

    for (const victim of this.remotePlayers) {
      if (victim.isDead) continue;
      const hitRadius = radius + victim.radius;
      const distanceSq = getDistanceSq(attacker.x, attacker.y, victim.x, victim.y);
      if (distanceSq > hitRadius * hitRadius) continue;

      const finalDamage = Math.max(1, Math.round(damage));
      this.multiplayerClient.sendHit(victim.id, finalDamage);
      this.particleSystem.addFloatingText(victim.x, victim.y, `${label} -${finalDamage}`, color, 20);
      this.particleSystem.addBurst(victim.x, victim.y, color, 12);
    }
  }

  // Pudding Melee Arc Swing with 3-Hit Combo
  public executePuddingMeleeSwing(attacker: PlayerEntity, targetX: number, targetY: number) {
    const now = performance.now();
    const comboWindow = 700; // 0.7s combo reset window
    const lastTime = attacker.puddingLastComboTime || 0;

    let stage = 0;
    if (now - lastTime <= comboWindow) {
      stage = ((attacker.puddingComboStage ?? -1) + 1) % 3;
    } else {
      stage = 0;
    }

    const angle = Math.atan2(targetY - attacker.y, targetX - attacker.x);
    attacker.facingAngle = angle;
    attacker.puddingComboStage = stage;
    attacker.puddingLastComboTime = now;
    attacker.puddingSwingTimer = 0.22;
    attacker.puddingSwingAngle = angle;
    attacker.faceExpression = 'attack';
    attacker.faceTimer = 0.35;

    // Multipliers: Hit 1 = 1.0x, Hit 2 = 1.1x, Hit 3 = 1.5x + Knockback
    const multiplier = stage === 2 ? 1.5 : stage === 1 ? 1.1 : 1.0;
    let damage = attacker.attackDamage * multiplier;
    if (attacker.damageBoostTimeRemaining > 0) {
      damage *= 1.25;
    }

    soundManager.playShoot('pudding');

    if (stage === 2) {
      this.addScreenShake(10, 0.25);
      this.triggerHitStop(0.08);
    }

    const reach = attacker.radius + 85 * attacker.scaleFactor;
    const fanAngleHalf = Math.PI * 0.4; // 144 degree arc
    const allPlayers = [this.player, ...this.bots];

    let hitAny = false;

    allPlayers.forEach((victim) => {
      if (victim.isDead || victim.id === attacker.id) return;

        const reachWithVictim = reach + victim.radius;
        const distSq = getDistanceSq(attacker.x, attacker.y, victim.x, victim.y);
      if (distSq <= reachWithVictim * reachWithVictim) {
        const victimAngle = Math.atan2(victim.y - attacker.y, victim.x - attacker.x);
        let angleDiff = Math.abs(victimAngle - angle);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        angleDiff = Math.abs(angleDiff);

        if (angleDiff <= fanAngleHalf) {
          hitAny = true;
          if (victim.invincibleTimeRemaining > 0) {
            this.particleSystem.addFloatingText(victim.x, victim.y, 'INVINCIBLE!', '#34D399', 14);
            return;
          }

          let finalDamage = damage;
          if (victim.isShielded) {
            finalDamage *= 1 - victim.shieldReduction;
          }

          if (victim.powerUpShieldAmount > 0 && victim.powerUpShieldTimeRemaining > 0) {
            const absorbed = Math.min(finalDamage, victim.powerUpShieldAmount);
            victim.powerUpShieldAmount -= absorbed;
            finalDamage -= absorbed;
            if (victim.powerUpShieldAmount <= 0) victim.powerUpShieldTimeRemaining = 0;
          }

          finalDamage = Math.max(0, Math.round(finalDamage));
          victim.hp -= finalDamage;
          victim.hitFlashTime = 0.18;

          this.particleSystem.addBurst(victim.x, victim.y, '#F59E0B', stage === 2 ? 18 : 10);

          const hitLabel = stage === 2 ? `3rd SLAM! -${finalDamage}` : stage === 1 ? `2nd HIT -${finalDamage}` : `-${finalDamage}`;
          const hitColor = stage === 2 ? '#EF4444' : stage === 1 ? '#F59E0B' : '#FDE047';
          this.particleSystem.addFloatingText(victim.x, victim.y, hitLabel, hitColor, stage === 2 ? 22 : 17);

          if (victim.id === this.player.id || attacker.id === this.player.id) {
            soundManager.playHit();
          }

          // Knockback on 3rd Hit
          if (stage === 2) {
            const knockbackDist = 95 * attacker.scaleFactor;
            victim.x = Math.max(50, Math.min(WORLD_SIZE - 50, victim.x + Math.cos(angle) * knockbackDist));
            victim.y = Math.max(50, Math.min(WORLD_SIZE - 50, victim.y + Math.sin(angle) * knockbackDist));
          }

          if (victim.hp <= 0) {
            this.handlePlayerKill(attacker.id, victim);
          }
        }
      }
    });

    if (this.multiplayerClient) {
      for (const victim of this.remotePlayers) {
        if (victim.isDead || victim.id === attacker.id) continue;
        const reachWithVictim = reach + victim.radius;
        const distSq = getDistanceSq(attacker.x, attacker.y, victim.x, victim.y);
        if (distSq > reachWithVictim * reachWithVictim) continue;

        const victimAngle = Math.atan2(victim.y - attacker.y, victim.x - attacker.x);
        let angleDiff = Math.abs(victimAngle - angle);
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        if (Math.abs(angleDiff) > fanAngleHalf) continue;

        const finalDamage = Math.max(1, Math.round(damage));
        this.multiplayerClient.sendHit(victim.id, finalDamage);
        this.particleSystem.addBurst(victim.x, victim.y, '#F59E0B', stage === 2 ? 18 : 10);
        this.particleSystem.addFloatingText(victim.x, victim.y, `-${finalDamage}`, '#FDE047', stage === 2 ? 22 : 17);
        hitAny = true;
      }
    }

    if (!hitAny) {
      const swingTipX = attacker.x + Math.cos(angle) * reach;
      const swingTipY = attacker.y + Math.sin(angle) * reach;
      this.particleSystem.addBurst(swingTipX, swingTipY, '#FDE047', 6);
    }
  }

  private obtainProjectile(
    ownerId: string,
    characterId: CharacterId,
    x: number,
    y: number,
    vx: number,
    vy: number,
    damage: number,
    maxRange: number,
    radius: number,
    color: string,
    isAoE = false
  ): Projectile {
    let p = this.projectilePool.pop();
    if (!p) {
      p = {
        id: `proj_${this.idCounter++}`,
        ownerId,
        characterId,
        x,
        y,
        vx,
        vy,
        damage,
        rangeRemaining: maxRange,
        maxRange,
        radius,
        color,
        isAoE
      };
    } else {
      p.id = `proj_${this.idCounter++}`;
      p.ownerId = ownerId;
      p.characterId = characterId;
      p.x = x;
      p.y = y;
      p.vx = vx;
      p.vy = vy;
      p.damage = damage;
      p.rangeRemaining = maxRange;
      p.maxRange = maxRange;
      p.radius = radius;
      p.color = color;
      p.isAoE = isAoE;
    }
    return p;
  }

  private releaseProjectile(p: Projectile) {
    if (this.projectilePool.length < 150) {
      this.projectilePool.push(p);
    }
  }

  private broadcastProjectile(projectile: Projectile) {
    this.multiplayerClient?.sendProjectile({
      id: projectile.id,
      ownerId: projectile.ownerId,
      characterId: projectile.characterId,
      x: projectile.x,
      y: projectile.y,
      vx: projectile.vx,
      vy: projectile.vy,
      radius: projectile.radius,
      color: projectile.color,
      isAoE: projectile.isAoE
    });
  }

  // Shoot Donut Charged Sugar Shot
  public shootDonutChargedShot(shooter: PlayerEntity, targetX: number, targetY: number, chargeDurationSeconds: number) {
    const angle = Math.atan2(targetY - shooter.y, targetX - shooter.x);
    const char = CHARACTERS[shooter.characterId];

    shooter.faceExpression = 'attack';
    shooter.faceTimer = 0.35;

    let multiplier = 1.0;
    let projRadius = 10;
    let projSpeed = 12.0;
    let color = '#F43F5E';
    let level = 1;

    if (chargeDurationSeconds >= 1.2) {
      multiplier = 2.5;
      projRadius = 22;
      projSpeed = 15.0;
      color = '#FFE4E6';
      level = 3;

      this.addScreenShake(8, 0.22);
      this.triggerHitStop(0.06);

      // Recoil kickback
      shooter.x = Math.max(50, Math.min(WORLD_SIZE - 50, shooter.x - Math.cos(angle) * 14));
      shooter.y = Math.max(50, Math.min(WORLD_SIZE - 50, shooter.y - Math.sin(angle) * 14));
    } else if (chargeDurationSeconds >= 0.5) {
      multiplier = 1.5;
      projRadius = 15;
      projSpeed = 13.5;
      color = '#FB7185';
      level = 2;
    }

    let damage = Math.round(shooter.attackDamage * multiplier);
    if (shooter.damageBoostTimeRemaining > 0) {
      damage = Math.round(damage * 1.25);
    }

    const proj = this.obtainProjectile(
      shooter.id,
      shooter.characterId,
      shooter.x + Math.cos(angle) * (shooter.radius + projRadius),
      shooter.y + Math.sin(angle) * (shooter.radius + projRadius),
      Math.cos(angle) * projSpeed,
      Math.sin(angle) * projSpeed,
      damage,
      char.attackRange,
      projRadius,
      color,
      level === 3
    );

    this.projectiles.push(proj);
    this.broadcastProjectile(proj);

    if (shooter.id === this.player.id) {
      soundManager.playShoot(shooter.characterId);
    }

    if (level === 3) {
      this.particleSystem.addBurst(shooter.x, shooter.y, '#FFE4E6', 16, 1.8);
      this.particleSystem.addFloatingText(shooter.x, shooter.y, '🍩 FULL CHARGE RELEASE!!', '#FFE4E6', 22);
    }
  }

  // Shoot projectile for Cookie / Candy
  public shootProjectile(shooter: PlayerEntity, targetX: number, targetY: number) {
    const angle = Math.atan2(targetY - shooter.y, targetX - shooter.x);
    const speed = 11.0;
    const char = CHARACTERS[shooter.characterId];

    shooter.faceExpression = 'attack';
    shooter.faceTimer = 0.3;

    let damage = shooter.attackDamage;
    if (shooter.damageBoostTimeRemaining > 0) {
      damage = Math.round(damage * 1.25);
    }

    const proj = this.obtainProjectile(
      shooter.id,
      shooter.characterId,
      shooter.x + Math.cos(angle) * (shooter.radius + 10),
      shooter.y + Math.sin(angle) * (shooter.radius + 10),
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
      damage,
      char.attackRange,
      9,
      char.color
    );

    this.projectiles.push(proj);
    this.broadcastProjectile(proj);

    if (shooter.id === this.player.id) {
      soundManager.playShoot(shooter.characterId);
    }
  }

  // Trigger Unique Character Ability
  public triggerAbility(p: PlayerEntity) {
    if (p.isDead || p.abilityCooldownRemaining > 0) return;

    const char = CHARACTERS[p.characterId];
    p.abilityCooldownRemaining = char.abilityCooldown;

    soundManager.playAbility(p.characterId);

    switch (p.characterId) {
      case 'cookie': {
        // Cookie Shield: 25% Max HP Shield barrier + 40% reduction for 3s
        const shieldHp = Math.round(p.maxHp * 0.25);
        p.powerUpShieldAmount = Math.max(p.powerUpShieldAmount, shieldHp);
        p.powerUpShieldTimeRemaining = 3.0;
        p.isShielded = true;
        p.shieldTimeRemaining = 3.0;
        p.shieldReduction = 0.4;
        this.particleSystem.addFloatingText(p.x, p.y, 'COOKIE SHIELD! (+25% HP)', '#F59E0B', 20);
        this.particleSystem.addBurst(p.x, p.y, '#F59E0B', 15);
        break;
      }
      case 'candy': {
        // Sugar Dash: 140px instant dash with 0.15s invulnerability
        p.isDashing = true;
        p.dashTimeRemaining = 0.18;
        const dashSpeed = 140 / 0.18;
        p.dashVx = Math.cos(p.facingAngle) * (dashSpeed / 60);
        p.dashVy = Math.sin(p.facingAngle) * (dashSpeed / 60);
        p.invincibleTimeRemaining = 0.15;
        this.particleSystem.addFloatingText(p.x, p.y, 'SUGAR DASH!', '#EC4899', 20);
        this.particleSystem.addBurst(p.x, p.y, '#EC4899', 12);
        break;
      }
      case 'pudding': {
        // Pudding Slam: 360 degree circle AoE slam
        const slamRadius = p.radius + 140 * p.scaleFactor;
        const slamDmg = Math.round(p.attackDamage * 1.5);
        const allPlayers = [this.player, ...this.bots];

        allPlayers.forEach((victim) => {
          if (victim.id === p.id || victim.isDead) return;
          const reachWithVictim = slamRadius + victim.radius;
          const distSq = getDistanceSq(p.x, p.y, victim.x, victim.y);

          if (distSq <= reachWithVictim * reachWithVictim) {
            const angle = Math.atan2(victim.y - p.y, victim.x - p.x);
            const pushDist = 130 * p.scaleFactor;
            victim.x = Math.max(50, Math.min(WORLD_SIZE - 50, victim.x + Math.cos(angle) * pushDist));
            victim.y = Math.max(50, Math.min(WORLD_SIZE - 50, victim.y + Math.sin(angle) * pushDist));

            let finalDmg = slamDmg;
            if (victim.isShielded) finalDmg *= 1 - victim.shieldReduction;
            if (victim.powerUpShieldAmount > 0 && victim.powerUpShieldTimeRemaining > 0) {
              const absorbed = Math.min(finalDmg, victim.powerUpShieldAmount);
              victim.powerUpShieldAmount -= absorbed;
              finalDmg -= absorbed;
            }
            finalDmg = Math.max(0, Math.round(finalDmg));

            victim.hp -= finalDmg;
            victim.hitFlashTime = 0.2;

            this.particleSystem.addFloatingText(victim.x, victim.y, `🍮 SLAM -${finalDmg}`, '#F59E0B', 22);

            if (victim.hp <= 0) {
              this.handlePlayerKill(p.id, victim);
            }
          }
        });

        this.damageRemotePlayersInRadius(p, slamRadius, slamDmg, '#F59E0B', 'SLAM');

        this.particleSystem.addBurst(p.x, p.y, '#F59E0B', 28, 2.0);
        this.particleSystem.addFloatingText(p.x, p.y, '🍮 PUDDING SLAM!!', '#F59E0B', 24);
        break;
      }
      case 'donut': {
        // Sugar Hole Blast: Radial shockwave knocking back nearby enemies
        const blastRadius = 220;
        const allPlayers = [this.player, ...this.bots];

        allPlayers.forEach((victim) => {
          if (victim.id === p.id || victim.isDead) return;
          const distSq = getDistanceSq(p.x, p.y, victim.x, victim.y);

          if (distSq < blastRadius * blastRadius) {
            const angle = Math.atan2(victim.y - p.y, victim.x - p.x);
            const pushDist = 180;
            victim.x = Math.max(50, Math.min(WORLD_SIZE - 50, victim.x + Math.cos(angle) * pushDist));
            victim.y = Math.max(50, Math.min(WORLD_SIZE - 50, victim.y + Math.sin(angle) * pushDist));

            const blastDmg = Math.round(p.attackDamage * 1.5);
            victim.hp -= blastDmg;
            victim.hitFlashTime = 0.2;

            this.particleSystem.addFloatingText(victim.x, victim.y, `BLAST -${blastDmg}`, '#F43F5E', 20);

            if (victim.hp <= 0) {
              this.handlePlayerKill(p.id, victim);
            }
          }
        });

        this.damageRemotePlayersInRadius(p, blastRadius, Math.round(p.attackDamage * 1.5), '#F43F5E', 'BLAST');

        this.particleSystem.addBurst(p.x, p.y, '#F43F5E', 25, 1.6);
        this.particleSystem.addFloatingText(p.x, p.y, 'DONUT BLAST!', '#F43F5E', 22);
        break;
      }
    }
  }

  // Render method
  private render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();

    // Apply Screen Shake Camera Offset
    if (this.screenShakeTime > 0 && this.screenShakeIntensity > 0) {
      const offsetX = (Math.random() - 0.5) * 2 * this.screenShakeIntensity;
      const offsetY = (Math.random() - 0.5) * 2 * this.screenShakeIntensity;
      this.ctx.translate(offsetX, offsetY);
    }

    const worldToScreen = (wx: number, wy: number) => this.camera.worldToScreen(wx, wy);

    // 1. Draw Dessert Floor Grid & World Boundary
    this.drawBackground(worldToScreen);

    // 1b. Draw Hot Zone (Dynamic Map System v2)
    this.drawHotZone(worldToScreen);

    // 2. Draw Map Obstacles
    this.drawObstacles(worldToScreen);

    // 3. Draw Sugar Items
    this.sugarManager.draw(this.ctx, worldToScreen, performance.now());

    // 3b. Draw Map Power-Ups
    this.drawPowerUps(worldToScreen);

    // 4. Draw Projectiles
    this.drawProjectiles(worldToScreen);
    this.drawRemoteProjectiles(worldToScreen);

    // 5. Draw Players & Bots
    this.renderPlayers.length = 0;
    this.renderPlayers.push(this.player, ...this.bots);
    this.renderPlayers.sort((a, b) => a.y - b.y);

    this.renderPlayers.forEach((p) => {
      if (!p.isDead) {
        this.drawPlayerEntity(p, worldToScreen);
      }
    });

    this.remotePlayers.forEach((player) => this.drawRemotePlayer(player, worldToScreen));

    // 5b. Draw King Directional Marker
    this.drawKingDirectionalMarker();

    // 6. Draw Particle System Effects & Damage Numbers
    this.particleSystem.draw(this.ctx, worldToScreen);

    // 7. Draw Aiming Crosshair & Attack Cooldown Gauge
    this.drawCrosshairAndCooldown();

    // 8. Debug Overlay (Press F2 to toggle)
    if (this.showDebug) {
      this.drawDebugOverlay();
    }

    this.ctx.restore();
  }

  // Draw Hot Zone on map floor
  private drawHotZone(worldToScreen: (wx: number, wy: number) => { x: number; y: number }) {
    if (!this.hotZone) return;

    const ctx = this.ctx;
    const pos = worldToScreen(this.hotZone.x, this.hotZone.y);

    ctx.save();
    ctx.translate(pos.x, pos.y);

    const time = performance.now() * 0.003;
    const pulse = Math.sin(time) * 15;
    const currentRadius = this.hotZone.radius + pulse;

    // Glowing translucent fill
    const isWarn = this.hotZone.isWarning;
    ctx.fillStyle = isWarn ? 'rgba(239, 68, 68, 0.22)' : 'rgba(245, 158, 11, 0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
    ctx.fill();

    // Pulsing Border Ring
    ctx.strokeStyle = isWarn ? '#EF4444' : '#F59E0B';
    ctx.lineWidth = isWarn ? 5 : 3;
    ctx.shadowColor = isWarn ? '#EF4444' : '#F59E0B';
    ctx.shadowBlur = 20;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, currentRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Center Label
    ctx.setLineDash([]);
    ctx.fillStyle = isWarn ? '#EF4444' : '#FDE047';
    ctx.font = "bold 16px 'Fredoka', sans-serif";
    ctx.textAlign = 'center';
    ctx.shadowBlur = 8;
    ctx.fillText('🔥 HOT ZONE (2.0x SUGAR)', 0, -12);

    const timerSec = Math.ceil(this.hotZone.timeRemaining);
    ctx.font = "bold 13px 'Fredoka', sans-serif";
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(isWarn ? `⚠️ RELOCATING IN ${timerSec}s!` : `Relocates in ${timerSec}s`, 0, 10);

    ctx.restore();
  }

  // Draw offscreen King indicator on edge of screen
  private drawKingDirectionalMarker() {
    if (this.player.isDead) return;

    const topPlayer = this.topPlayer;

    if (!topPlayer || topPlayer.isDead || topPlayer.id === this.player.id) return;
    if (topPlayer.bounty < DYNAMIC_MAP_CONFIG.bountyTiers.king) return;

    const kingPos = this.camera.worldToScreen(topPlayer.x, topPlayer.y);
    const margin = 50;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Check if King is offscreen
    if (kingPos.x < 0 || kingPos.x > w || kingPos.y < 0 || kingPos.y > h) {
      const cx = w / 2;
      const cy = h / 2;
      const dx = kingPos.x - cx;
      const dy = kingPos.y - cy;
      const angle = Math.atan2(dy, dx);

      const edgeX = Math.max(margin, Math.min(w - margin, cx + Math.cos(angle) * (cx - margin)));
      const edgeY = Math.max(margin, Math.min(h - margin, cy + Math.sin(angle) * (cy - margin)));

      const ctx = this.ctx;
      ctx.save();
      ctx.translate(edgeX, edgeY);

      // Arrow pointer
      ctx.rotate(angle);
      ctx.fillStyle = '#FBBF24';
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(-10, -10);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();

      // Crown icon badge
      ctx.rotate(-angle);
      ctx.fillStyle = '#FBBF24';
      ctx.font = "bold 13px 'Fredoka', sans-serif";
      ctx.textAlign = 'center';
      const dist = Math.round(getDistance(this.player.x, this.player.y, topPlayer.x, topPlayer.y));
      ctx.fillText(`👑 ${topPlayer.name} (${dist}m)`, 0, -18);

      ctx.restore();
    }
  }

  // Draw Grid & Map Bounds
  private drawBackground(worldToScreen: (wx: number, wy: number) => { x: number; y: number }) {
    const ctx = this.ctx;
    ctx.save();

    // Dark dessert canvas floor background
    ctx.fillStyle = '#170E20';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid lines
    const gridSize = 100;
    const startX = Math.floor((this.camera.x - this.camera.viewportWidth / 2) / gridSize) * gridSize;
    const endX = startX + this.camera.viewportWidth + gridSize * 2;
    const startY = Math.floor((this.camera.y - this.camera.viewportHeight / 2) / gridSize) * gridSize;
    const endY = startY + this.camera.viewportHeight + gridSize * 2;

    ctx.strokeStyle = '#271936';
    ctx.lineWidth = 1;

    for (let x = startX; x <= endX; x += gridSize) {
      const p1 = worldToScreen(x, startY);
      const p2 = worldToScreen(x, endY);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    for (let y = startY; y <= endY; y += gridSize) {
      const p1 = worldToScreen(startX, y);
      const p2 = worldToScreen(endX, y);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // World Boundary Wall (Glowing Sweet Border)
    const topLeft = worldToScreen(0, 0);
    const bottomRight = worldToScreen(WORLD_SIZE, WORLD_SIZE);

    ctx.strokeStyle = '#EC4899';
    ctx.lineWidth = 8;
    ctx.shadowColor = '#EC4899';
    ctx.shadowBlur = 15;
    ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);

    ctx.restore();
  }

  // Draw Map Obstacles
  private drawObstacles(worldToScreen: (wx: number, wy: number) => { x: number; y: number }) {
    const ctx = this.ctx;
    ctx.save();

    for (const obs of this.obstacles) {
      const pos = worldToScreen(obs.x, obs.y);

      // Frustum check
      if (pos.x < -150 || pos.x > ctx.canvas.width + 150 || pos.y < -150 || pos.y > ctx.canvas.height + 150) {
        continue;
      }

      ctx.save();
      ctx.fillStyle = obs.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;

      if (obs.type === 'marshmallow') {
        // Soft rounded block
        const radius = 16;
        ctx.beginPath();
        ctx.roundRect(pos.x, pos.y, obs.width, obs.height, radius);
        ctx.fill();
        ctx.stroke();
      } else {
        // Candy block
        ctx.fillRect(pos.x, pos.y, obs.width, obs.height);
        ctx.strokeRect(pos.x, pos.y, obs.width, obs.height);

        // Diagonal stripes
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x + obs.width, pos.y + obs.height);
        ctx.stroke();
      }

      ctx.restore();
    }

    ctx.restore();
  }

  // Draw Projectiles
  private drawProjectiles(worldToScreen: (wx: number, wy: number) => { x: number; y: number }) {
    const ctx = this.ctx;
    ctx.save();

    for (const proj of this.projectiles) {
      const pos = worldToScreen(proj.x, proj.y);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Glow effect
      ctx.shadowColor = proj.color;
      ctx.shadowBlur = 12;

      ctx.fillStyle = proj.color;
      ctx.beginPath();
      ctx.arc(0, 0, proj.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, proj.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    ctx.restore();
  }

  private drawRemoteProjectiles(worldToScreen: (wx: number, wy: number) => { x: number; y: number }) {
    const ctx = this.ctx;
    for (const projectile of this.remoteProjectiles) {
      const pos = worldToScreen(projectile.x, projectile.y);
      if (pos.x < -50 || pos.x > ctx.canvas.width + 50 || pos.y < -50 || pos.y > ctx.canvas.height + 50) continue;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.shadowColor = projectile.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = projectile.color;
      ctx.beginPath();
      ctx.arc(0, 0, projectile.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(0, 0, projectile.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private updateRemoteProjectiles(dt: number) {
    for (let i = this.remoteProjectiles.length - 1; i >= 0; i--) {
      const projectile = this.remoteProjectiles[i];
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;
      projectile.lifeRemaining = (projectile.lifeRemaining ?? 1.8) - dt;

      if (
        projectile.lifeRemaining <= 0 ||
        projectile.x < 0 || projectile.x > WORLD_SIZE ||
        projectile.y < 0 || projectile.y > WORLD_SIZE
      ) {
        this.remoteProjectiles[i] = this.remoteProjectiles[this.remoteProjectiles.length - 1];
        this.remoteProjectiles.pop();
      }
    }
  }

  // Draw Cartoon Facial Expressions for Characters
  private drawCartoonFace(ctx: CanvasRenderingContext2D, p: PlayerEntity, radius: number) {
    ctx.save();

    // Determine facial expression
    let expr = p.faceExpression || 'idle';
    if (p.isDead) {
      expr = 'dead';
    } else if (p.hitFlashTime > 0) {
      expr = 'hit';
    } else if (p.faceTimer && p.faceTimer > 0) {
      expr = p.faceExpression || 'attack';
    } else if (p.hp / p.maxHp <= 0.3) {
      expr = 'low_hp';
    } else if (p.bounty >= DYNAMIC_MAP_CONFIG.bountyTiers.king) {
      expr = 'king';
    }

    const eyeOffsetX = radius * 0.28;
    const eyeOffsetY = -radius * 0.08;
    const eyeRadius = Math.max(2, radius * 0.12);

    // Cute blush ovals
    ctx.fillStyle = 'rgba(244, 114, 182, 0.45)';
    ctx.beginPath();
    ctx.ellipse(-eyeOffsetX * 1.2, eyeOffsetY + eyeRadius * 1.5, radius * 0.14, radius * 0.08, 0, 0, Math.PI * 2);
    ctx.ellipse(eyeOffsetX * 1.2, eyeOffsetY + eyeRadius * 1.5, radius * 0.14, radius * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#18181B';
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = Math.max(2, radius * 0.08);
    ctx.lineCap = 'round';

    switch (expr) {
      case 'dead': {
        const sz = eyeRadius * 0.9;
        ctx.beginPath();
        ctx.moveTo(-eyeOffsetX - sz, eyeOffsetY - sz);
        ctx.lineTo(-eyeOffsetX + sz, eyeOffsetY + sz);
        ctx.moveTo(-eyeOffsetX + sz, eyeOffsetY - sz);
        ctx.lineTo(-eyeOffsetX - sz, eyeOffsetY + sz);

        ctx.moveTo(eyeOffsetX - sz, eyeOffsetY - sz);
        ctx.lineTo(eyeOffsetX + sz, eyeOffsetY + sz);
        ctx.moveTo(eyeOffsetX + sz, eyeOffsetY - sz);
        ctx.lineTo(eyeOffsetX - sz, eyeOffsetY + sz);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, eyeOffsetY + radius * 0.28, radius * 0.1, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'hit': {
        const sz = eyeRadius * 0.8;
        ctx.beginPath();
        ctx.moveTo(-eyeOffsetX - sz, eyeOffsetY - sz);
        ctx.lineTo(-eyeOffsetX + sz * 0.5, eyeOffsetY);
        ctx.lineTo(-eyeOffsetX - sz, eyeOffsetY + sz);

        ctx.moveTo(eyeOffsetX + sz, eyeOffsetY - sz);
        ctx.lineTo(eyeOffsetX - sz * 0.5, eyeOffsetY);
        ctx.lineTo(eyeOffsetX + sz, eyeOffsetY + sz);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, eyeOffsetY + radius * 0.25, radius * 0.12, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'attack': {
        ctx.beginPath();
        ctx.arc(-eyeOffsetX, eyeOffsetY, eyeRadius * 1.1, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius * 1.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-eyeOffsetX - eyeRadius * 0.3, eyeOffsetY - eyeRadius * 0.3, eyeRadius * 0.4, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX - eyeRadius * 0.3, eyeOffsetY - eyeRadius * 0.3, eyeRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#18181B';
        ctx.beginPath();
        ctx.arc(0, eyeOffsetY + radius * 0.18, radius * 0.18, 0, Math.PI);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#F43F5E';
        ctx.beginPath();
        ctx.arc(0, eyeOffsetY + radius * 0.28, radius * 0.1, 0, Math.PI);
        ctx.fill();
        break;
      }
      case 'low_hp': {
        ctx.beginPath();
        ctx.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-eyeOffsetX - eyeRadius * 0.3, eyeOffsetY - eyeRadius * 0.3, eyeRadius * 0.35, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX - eyeRadius * 0.3, eyeOffsetY - eyeRadius * 0.3, eyeRadius * 0.35, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#18181B';
        ctx.beginPath();
        ctx.arc(0, eyeOffsetY + radius * 0.35, radius * 0.16, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();

        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.arc(eyeOffsetX * 1.3, eyeOffsetY - radius * 0.2, radius * 0.08, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'king':
      case 'kill': {
        const sz = eyeRadius * 0.8;
        ctx.beginPath();
        ctx.moveTo(-eyeOffsetX - sz, eyeOffsetY + sz * 0.3);
        ctx.lineTo(-eyeOffsetX, eyeOffsetY - sz);
        ctx.lineTo(-eyeOffsetX + sz, eyeOffsetY + sz * 0.3);

        ctx.moveTo(eyeOffsetX - sz, eyeOffsetY + sz * 0.3);
        ctx.lineTo(eyeOffsetX, eyeOffsetY - sz);
        ctx.lineTo(eyeOffsetX + sz, eyeOffsetY + sz * 0.3);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(-radius * 0.07, eyeOffsetY + radius * 0.18, radius * 0.09, 0, Math.PI);
        ctx.arc(radius * 0.07, eyeOffsetY + radius * 0.18, radius * 0.09, 0, Math.PI);
        ctx.stroke();
        break;
      }
      default: {
        ctx.beginPath();
        ctx.arc(-eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX, eyeOffsetY, eyeRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(-eyeOffsetX - eyeRadius * 0.3, eyeOffsetY - eyeRadius * 0.3, eyeRadius * 0.38, 0, Math.PI * 2);
        ctx.arc(eyeOffsetX - eyeRadius * 0.3, eyeOffsetY - eyeRadius * 0.3, eyeRadius * 0.38, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#18181B';
        ctx.beginPath();
        ctx.arc(0, eyeOffsetY + radius * 0.12, radius * 0.16, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }

  // Draw Floating Golden Crown for King of Sugar
  private drawKingCrown(ctx: CanvasRenderingContext2D, radius: number) {
    ctx.save();
    const floatY = -radius - 38 + Math.sin(performance.now() * 0.005) * 5;
    ctx.translate(0, floatY);

    ctx.shadowColor = '#FBBF24';
    ctx.shadowBlur = 12;

    ctx.fillStyle = '#FBBF24';
    ctx.strokeStyle = '#B45309';
    ctx.lineWidth = 2;

    const w = radius * 0.9;
    const h = radius * 0.5;

    ctx.beginPath();
    ctx.moveTo(-w / 2, h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(w / 2, -h / 4);
    ctx.lineTo(w / 4, h / 4);
    ctx.lineTo(0, -h / 2);
    ctx.lineTo(-w / 4, h / 4);
    ctx.lineTo(-w / 2, -h / 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.arc(0, -h / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3B82F6';
    ctx.beginPath();
    ctx.arc(-w / 2, -h / 4, 2.5, 0, Math.PI * 2);
    ctx.arc(w / 2, -h / 4, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Draw Player Avatar, Character Emblem, HP bar, Name, and Danger Aura
  private drawPlayerEntity(p: PlayerEntity, worldToScreen: (wx: number, wy: number) => { x: number; y: number }) {
    const ctx = this.ctx;
    const pos = worldToScreen(p.x, p.y);
    const char = CHARACTERS[p.characterId];

    // Frustum check
    if (pos.x < -100 || pos.x > ctx.canvas.width + 100 || pos.y < -100 || pos.y > ctx.canvas.height + 100) {
      return;
    }

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // Apply Squash & Stretch and Tilting Rotation
    const squashX = p.squashX || 1.0;
    const squashY = p.squashY || 1.0;
    const tilt = p.tiltAngle || 0;
    const eatPop = (p.eatPopTimer && p.eatPopTimer > 0) ? 0.08 : 0;

    ctx.rotate(tilt);
    ctx.scale(squashX + eatPop, squashY + eatPop);

    // 1. Danger Level Glowing Aura (DANGER or HIGH level)
    const dangerLevel = calculateDangerLevel(p.sugar);
    if (dangerLevel === 'DANGER' || dangerLevel === 'HIGH') {
      ctx.save();
      const auraColor = dangerLevel === 'DANGER' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.3)';
      const pulseRadius = p.radius + 8 + Math.sin(performance.now() * 0.008) * 6;

      ctx.fillStyle = auraColor;
      ctx.beginPath();
      ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Shield Bubble (Ability Shield or Power-Up Shield)
    if (p.isShielded || (p.powerUpShieldAmount > 0 && p.powerUpShieldTimeRemaining > 0)) {
      ctx.save();
      ctx.strokeStyle = '#60A5FA';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#3B82F6';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2b. Speed Boost Aura Ring
    if (p.speedBoostTimeRemaining > 0) {
      ctx.save();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2c. Damage Boost Flame Ring
    if (p.damageBoostTimeRemaining > 0) {
      ctx.save();
      ctx.strokeStyle = '#F97316';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2d. Donut Charging Energy Aura
    if (p.characterId === 'donut' && p.donutChargeStartTime) {
      ctx.save();
      const cTime = Math.max(0, (performance.now() - p.donutChargeStartTime) / 1000);
      const lvl = cTime >= 1.2 ? 3 : cTime >= 0.5 ? 2 : 1;
      const auraColor = lvl === 3 ? '#FFE4E6' : lvl === 2 ? '#F59E0B' : '#F43F5E';
      const auraRadius = Math.max(0, p.radius + 10 + (cTime * 12));

      ctx.strokeStyle = auraColor;
      ctx.lineWidth = lvl === 3 ? 6 : 4;
      ctx.shadowColor = auraColor;
      ctx.shadowBlur = lvl === 3 ? 22 : 12;

      ctx.beginPath();
      ctx.arc(0, 0, auraRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = auraColor;
      ctx.font = "bold 12px 'Fredoka', sans-serif";
      ctx.textAlign = 'center';
      const label = lvl === 3 ? '⚡ MAX CHARGE! ⚡' : lvl === 2 ? '●● CHARGING' : '● CHARGING';
      ctx.fillText(label, 0, p.radius + 24);
      ctx.restore();
    }

    // 2e. Pudding Spoon Swing Arc Animation
    if (p.characterId === 'pudding' && p.puddingSwingTimer && p.puddingSwingTimer > 0) {
      ctx.save();
      const swingAngle = p.puddingSwingAngle || p.facingAngle;
      const comboStage = p.puddingComboStage || 0;
      const arcColor = comboStage === 2 ? '#EF4444' : comboStage === 1 ? '#F59E0B' : '#FDE047';
      const reach = p.radius + 85 * p.scaleFactor;

      ctx.rotate(swingAngle);

      ctx.fillStyle = comboStage === 2 ? 'rgba(239, 68, 68, 0.35)' : 'rgba(245, 158, 11, 0.25)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, reach, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = arcColor;
      ctx.lineWidth = comboStage === 2 ? 6 : 4;
      ctx.shadowColor = arcColor;
      ctx.shadowBlur = 15;
      ctx.stroke();

      // Spoon Head Icon
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(reach * 0.85, 0, 14 * p.scaleFactor, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // Respawn Invincibility Ring & Tag
    if (p.invincibleTimeRemaining > 0) {
      ctx.save();
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#10B981';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#34D399';
      ctx.font = "bold 11px 'Fredoka', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillText('INVINCIBLE', 0, -p.radius - 32);
      ctx.restore();

      // Blinking opacity
      if (Math.floor(performance.now() / 80) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }
    }

    // 3. Main Dessert Body Circle
    ctx.save();

    if (p.hitFlashTime > 0) {
      ctx.fillStyle = '#FFFFFF';
    } else {
      ctx.fillStyle = char.color;
    }

    ctx.strokeStyle = p.id === this.player.id ? '#FFFFFF' : char.accentColor;
    ctx.lineWidth = p.id === this.player.id ? 4 : 3;

    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Custom Dessert Details per Character
    ctx.fillStyle = char.accentColor;

    if (p.characterId === 'cookie') {
      // Chocolate chips
      const chips = [
        { x: -p.radius * 0.3, y: -p.radius * 0.3, r: p.radius * 0.18 },
        { x: p.radius * 0.3, y: -p.radius * 0.2, r: p.radius * 0.15 },
        { x: 0, y: p.radius * 0.3, r: p.radius * 0.2 },
        { x: -p.radius * 0.4, y: p.radius * 0.2, r: p.radius * 0.14 }
      ];
      chips.forEach((chip) => {
        ctx.beginPath();
        ctx.arc(chip.x, chip.y, chip.r, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (p.characterId === 'candy') {
      // Swirl lines
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 0.5, 0, Math.PI * 1.2);
      ctx.stroke();
    } else if (p.characterId === 'pudding') {
      // Golden syrup topping
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(0, -p.radius * 0.3, p.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.characterId === 'donut') {
      // Inner donut hole
      ctx.fillStyle = '#170E20';
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore(); // End Body

    // 3b. Cartoon Face
    this.drawCartoonFace(ctx, p, p.radius);

    // 3c. Floating Pudding Spoon Accessory (idle)
    if (p.characterId === 'pudding' && (!p.puddingSwingTimer || p.puddingSwingTimer <= 0)) {
      ctx.save();
      const spoonFloatX = p.radius + 14;
      const spoonFloatY = Math.sin(performance.now() * 0.004) * 3;
      ctx.translate(spoonFloatX, spoonFloatY);
      ctx.rotate(0.3 + Math.sin(performance.now() * 0.003) * 0.1);

      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = '#78350F';
      ctx.lineWidth = 2;
      ctx.fillRect(-2, -14, 4, 18);

      ctx.beginPath();
      ctx.ellipse(0, -18, 7 * p.scaleFactor, 10 * p.scaleFactor, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 4. Direction Pointer / Cannon Barrel
    ctx.save();
    ctx.rotate(p.facingAngle);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(p.radius + 4, 0, p.radius * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 5. Overhead Tags: Name, Health Bar, Bounty Tag
    const barW = Math.max(54, p.radius * 2.2);
    const barH = 8;
    const barY = -p.radius - 24;

    // Outer Container
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.roundRect(-barW / 2 - 2, barY - 2, barW + 4, barH + 4, 5);
    ctx.fill();

    // Delayed Red Residual HP Bar (Damage feedback)
    const delayedRatio = Math.max(0, Math.min(1, (p.delayedHp ?? p.hp) / p.maxHp));
    ctx.fillStyle = '#EF4444';
    ctx.beginPath();
    ctx.roundRect(-barW / 2, barY, barW * delayedRatio, barH, 3);
    ctx.fill();

    // Current HP Bar
    const hpRatio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    ctx.fillStyle = hpRatio > 0.5 ? '#10B981' : hpRatio > 0.25 ? '#F59E0B' : '#EF4444';
    ctx.beginPath();
    ctx.roundRect(-barW / 2, barY, barW * hpRatio, barH, 3);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-barW / 2, barY, barW, barH, 3);
    ctx.stroke();
    ctx.restore();

    // Name Tag & Bounty
    ctx.font = `bold ${Math.max(12, Math.floor(13 * (p.radius / 24)))}px 'Fredoka', sans-serif`;
    ctx.fillStyle = p.id === this.player.id ? '#FDE047' : '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(`${char.icon} ${p.name}`, 0, barY - 6);

    // Bounty Tier Indicator Badge & King Crown
    const tier = getBountyTier(p.bounty);
    if (tier === 'KING') {
      this.drawKingCrown(ctx, p.radius);
    }

    if (tier !== 'NORMAL') {
      ctx.font = "bold 11px 'Fredoka', sans-serif";
      let badgeText = `🎯 WANTED $${p.bounty}`;
      let badgeColor = '#F97316';

      if (tier === 'KING') {
        badgeText = `👑 KING OF SUGAR ($${p.bounty})`;
        badgeColor = '#FBBF24';
      } else if (tier === 'HIGH_VALUE') {
        badgeText = `🏆 HIGH VALUE ($${p.bounty})`;
        badgeColor = '#EC4899';
      }

      ctx.fillStyle = badgeColor;
      ctx.shadowColor = badgeColor;
      ctx.shadowBlur = 8;
      ctx.fillText(badgeText, 0, barY - 20);
    }

    ctx.restore();
  }

  private drawRemotePlayer(player: RemotePlayerState, worldToScreen: (wx: number, wy: number) => { x: number; y: number }) {
    if (player.isDead) return;
    const pos = worldToScreen(player.x, player.y);
    if (pos.x < -100 || pos.x > this.canvas.width + 100 || pos.y < -100 || pos.y > this.canvas.height + 100) return;

    const char = CHARACTERS[player.characterId] || CHARACTERS.cookie;
    const radius = player.radius || 24;
    this.ctx.save();
    this.ctx.translate(pos.x, pos.y);
    this.ctx.fillStyle = char.color;
    this.ctx.strokeStyle = '#38BDF8';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = "bold 12px 'Fredoka', sans-serif";
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${char.icon} ${player.name}`, 0, -radius - 10);
    this.ctx.restore();
  }

  // Generate Snapshot for React UI (Scoreboard, HUD, Leaderboard)
  private emitSnapshot(force = false) {
    if (!this.onSnapshotUpdate) return;
    const now = performance.now();
    if (force || now - this.lastSnapshotTime >= 80) { // Throttle React UI updates to ~12 FPS
      this.lastSnapshotTime = now;
      this.onSnapshotUpdate(this.generateSnapshot());
    }
  }

  private updateTopPlayer(players: PlayerEntity[]): PlayerEntity | null {
    let topPlayer: PlayerEntity | null = null;
    for (const player of players) {
      if (!topPlayer || player.score > topPlayer.score) {
        topPlayer = player;
      }
    }
    this.topPlayer = topPlayer;
    return topPlayer;
  }

  public generateSnapshot(): GameSnapshot {
    const allPlayers = [this.player, ...this.bots];

    // Sort leaderboard by score descending
    const sorted = [...allPlayers].sort((a, b) => b.score - a.score);
    const playerRank = this.multiplayerRank ?? (sorted.findIndex((p) => p.id === this.player.id) + 1);

    const topPlayer = sorted[0];
    const kingPlayer =
      topPlayer && topPlayer.bounty >= DYNAMIC_MAP_CONFIG.bountyTiers.king && !topPlayer.isDead
        ? {
            id: topPlayer.id,
            name: topPlayer.name,
            x: topPlayer.x,
            y: topPlayer.y,
            sugar: topPlayer.sugar,
            bounty: topPlayer.bounty
          }
        : null;

    const topPlayers = sorted.map((p, idx) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      sugar: Math.floor(p.sugar),
      bounty: p.bounty,
      bountyTier: getBountyTier(p.bounty),
      isPlayer: p.id === this.player.id,
      rank: idx + 1
    }));

    // Filter expired active announcement
    let announcement: MapAnnouncement | null = null;
    if (this.activeAnnouncement && Date.now() < this.activeAnnouncement.expiresAt) {
      announcement = this.activeAnnouncement;
    }

    return {
      player: { ...this.player },
      topPlayers,
      playerRank,
      decayRate: calculateSugarDecayRate(this.player.sugar),
      dangerLevel: calculateDangerLevel(this.player.sugar),
      killEvents: [...this.killFeed],
      timeSurvived: Math.floor((Date.now() - this.gameStartTime) / 1000),
      hotZone: this.hotZone ? { ...this.hotZone } : undefined,
      kingPlayer,
      activeAnnouncement: announcement
    };
  }

  // Spawn power-ups on map maintaining limits
  private updatePowerUpSpawns() {
    const limits = COMBAT_CONFIG.powerUps;
    const counts: Record<PowerUpType, number> = { heal: 0, shield: 0, speed: 0, damage: 0 };

    for (const pu of this.powerUps) {
      counts[pu.type] = (counts[pu.type] || 0) + 1;
    }

    const types: PowerUpType[] = ['heal', 'shield', 'speed', 'damage'];
    for (const type of types) {
      const maxCount = limits[type].maxCount;
      if (counts[type] < maxCount) {
        const spawnPos = this.getSafeSpawnPosition(18);
        this.powerUps.push({
          id: `pu_${this.idCounter++}`,
          type,
          x: spawnPos.x,
          y: spawnPos.y,
          radius: 18,
          spawnTime: Date.now()
        });
      }
    }
  }

  // Draw Power-Up items floating on the map
  private drawPowerUps(worldToScreen: (wx: number, wy: number) => { x: number; y: number }) {
    const ctx = this.ctx;
    ctx.save();

    const now = performance.now();

    for (const pu of this.powerUps) {
      const pos = worldToScreen(pu.x, pu.y);

      if (pos.x < -80 || pos.x > ctx.canvas.width + 80 || pos.y < -80 || pos.y > ctx.canvas.height + 80) {
        continue;
      }

      ctx.save();

      // Floating bobbing animation
      const offsetY = Math.sin(now * 0.005 + pu.x) * 5;
      ctx.translate(pos.x, pos.y + offsetY);

      const radius = 18;

      let glowColor = '#34D399';
      let symbol = '❤️';

      switch (pu.type) {
        case 'heal':
          glowColor = '#EF4444';
          symbol = '❤️';
          break;
        case 'shield':
          glowColor = '#3B82F6';
          symbol = '🛡️';
          break;
        case 'speed':
          glowColor = '#FBBF24';
          symbol = '⚡';
          break;
        case 'damage':
          glowColor = '#F97316';
          symbol = '🔥';
          break;
      }

      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 12;

      // Outer pill background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Icon symbol
      ctx.font = "15px 'Segoe UI Emoji', sans-serif";
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, 0, 1);

      ctx.restore();
    }

    ctx.restore();
  }

  // Draw Crosshair with Attack Cooldown Gauge & READY indicator
  private drawCrosshairAndCooldown() {
    if (this.player.isDead) return;

    const ctx = this.ctx;
    const mx = this.mousePos.x;
    const my = this.mousePos.y;

    const now = Date.now();
    const elapsed = now - this.player.lastAttackTime;
    const cdProgress = Math.min(1.0, elapsed / this.player.attackInterval);

    ctx.save();
    ctx.translate(mx, my);

    const radius = 18;

    // Cooldown Arc or READY Ring
    if (cdProgress < 1.0) {
      // Outer subtle ring
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Filling arc gauge
      ctx.beginPath();
      ctx.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cdProgress);
      ctx.strokeStyle = '#F59E0B'; // Amber yellow
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      // READY state ring
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = '#10B981'; // Emerald green
      ctx.lineWidth = 3;
      ctx.shadowColor = '#10B981';
      ctx.shadowBlur = 8;
      ctx.stroke();

      // READY text label
      ctx.font = "bold 10px 'Fredoka', sans-serif";
      ctx.fillStyle = '#10B981';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 4;
      ctx.fillText('READY', 0, radius + 14);
    }

    // Crosshair Center Dot
    ctx.fillStyle = cdProgress === 1.0 ? '#10B981' : '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // Draw Performance & Engine Debug Overlay (Toggle with F2)
  private drawDebugOverlay() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = "bold 12px monospace";

    const fps = this.particleSystem.getFps();
    const activeParticles = this.particleSystem.particles.length;
    const quality = this.particleSystem.qualityLevel;
    const activeProjectiles = this.projectiles.length;
    const poolProjectiles = this.projectilePool.length;
    const sugarCount = this.sugarManager.sugars.length;
    const activeBots = this.bots.filter(b => !b.isDead).length;

    const stats = [
      `⚡ SUGAR RUSH PERFORMANCE MONITOR [F2 to hide]`,
      `FPS: ${fps} FPS | Frame DT: ${(1000 / Math.max(1, fps)).toFixed(1)}ms`,
      `Quality Mode: ${quality}`,
      `Active Projectiles: ${activeProjectiles} (Pooled: ${poolProjectiles})`,
      `Active Particles: ${activeParticles} / 150`,
      `Sugars on Map: ${sugarCount}`,
      `Active Bots: ${activeBots}`
    ];

    const boxWidth = 380;
    const boxHeight = stats.length * 18 + 16;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = fps >= 55 ? '#10B981' : fps >= 40 ? '#F59E0B' : '#EF4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(16, 16, boxWidth, boxHeight, 8);
    ctx.fill();
    ctx.stroke();

    stats.forEach((line, idx) => {
      ctx.fillStyle = idx === 0 ? '#FBBF24' : '#E2E8F0';
      ctx.fillText(line, 28, 36 + idx * 18);
    });

    ctx.restore();
  }
}
