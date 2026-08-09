export type CharacterId = 'cookie' | 'candy' | 'pudding' | 'donut';

export type CharacterRole = 'Balanced' | 'Balanced / Beginner Friendly' | 'Speed / Assassin' | 'Speed / Hit & Run' | 'Tank' | 'Tank / Melee Brawler' | 'Area Control' | 'Charged Sniper / Burst' | string;

export type FaceExpression = 'idle' | 'attack' | 'hit' | 'low_hp' | 'kill' | 'dead' | 'king';

export interface CharacterStats {
  id: CharacterId;
  name: string;
  nameKo: string;
  role: CharacterRole;
  maxHp: number;
  speed: number;
  attackDamage: number;
  attackSpeed: number; // Attacks per second
  attackInterval: number; // Interval in milliseconds
  attackRange: number;
  abilityCooldown: number; // Seconds
  abilityName: string;
  abilityDescription: string;
  primaryAttackName: string;
  color: string;
  accentColor: string;
  icon: string; // Emoji or visual symbol
}

export type BotPersonalityType = 'collector' | 'hunter' | 'coward' | 'aggressive' | 'balanced';

export type DangerLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'DANGER';

export type PowerUpType = 'heal' | 'shield' | 'speed' | 'damage';

export interface PowerUpItem extends Entity {
  id: string;
  type: PowerUpType;
  spawnTime: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  radius: number;
}

export interface PlayerEntity extends Entity {
  name: string;
  characterId: CharacterId;
  isBot: boolean;
  personality?: BotPersonalityType;
  
  // Dynamic stats
  hp: number;
  maxHp: number;
  baseMaxHp: number;
  speed: number;
  baseSpeed: number;
  attackDamage: number;
  baseAttackDamage: number;
  attackRange: number;
  attackSpeed: number;
  attackInterval: number; // ms
  invincibleTimeRemaining: number; // seconds
  
  // Growth
  sugar: number;
  score: number;
  kills: number;
  bounty: number;
  scaleFactor: number; // Visual scale multiplier
  
  // Combat state
  facingAngle: number; // Radians
  vx: number;
  vy: number;
  lastAttackTime: number;
  abilityCooldownRemaining: number;
  isShielded: boolean;
  shieldTimeRemaining: number;
  shieldReduction: number; // percentage reduction (0.3 to 0.6)
  isDashing: boolean;
  dashTimeRemaining: number;
  dashVx: number;
  dashVy: number;
  
  // AI Bot targeting & reaction state
  targetLockId?: string | null;
  reactionEndTime?: number;

  // Feedback & Animation State
  hitFlashTime: number;
  isDead: boolean;
  respawnTimer: number;
  squashX?: number;
  squashY?: number;
  tiltAngle?: number;
  faceExpression?: FaceExpression;
  faceTimer?: number;
  delayedHp?: number;
  eatPopTimer?: number;
  deathAnimTimer?: number;

  // Active Power-up Buffs
  speedBoostTimeRemaining: number;
  damageBoostTimeRemaining: number;
  powerUpShieldAmount: number;
  powerUpShieldTimeRemaining: number;
  rainbowTimeRemaining: number;

  // Character-specific Combat Overhaul v3 state
  puddingComboStage?: number; // 0: Hit 1, 1: Hit 2, 2: Hit 3
  puddingLastComboTime?: number; // ms timestamp
  puddingSwingTimer?: number; // visual swing duration
  puddingSwingAngle?: number; // angle of swing
  donutChargeStartTime?: number | null; // ms timestamp
  donutChargeTimer?: number; // charge duration in seconds
  donutCurrentLevel?: number; // 1, 2, 3
  donutAiTargetChargeDuration?: number; // AI target charge duration
}

export interface Projectile extends Entity {
  id: string;
  ownerId: string;
  characterId: CharacterId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  rangeRemaining: number;
  maxRange: number;
  radius: number;
  color: string;
  isAoE?: boolean;
}

export type SugarType = 'cube' | 'candy' | 'donut_hole' | 'golden' | 'rainbow' | 'toxic';

export interface SugarItem extends Entity {
  id: string;
  type: SugarType;
  value: number; // Sugar amount
  scoreValue: number;
  color: string;
  spawnTime: number;
  rotation: number;
}

export interface HotZoneState {
  x: number;
  y: number;
  radius: number;
  nextX: number;
  nextY: number;
  isWarning: boolean;
  timer: number;
  timeRemaining: number;
  isKingInside: boolean;
}

export interface MapAnnouncement {
  id: string;
  title: string;
  subtitle?: string;
  color: string;
  timestamp: number;
  expiresAt: number;
}

export interface MapObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'candy_block' | 'marshmallow' | 'jelly_wall';
  color: string;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  text?: string; // Floating text like "-15" or "+10 Sugar"
}

export interface KillEvent {
  id: string;
  killerName: string;
  killerCharacter: CharacterId;
  victimName: string;
  victimCharacter: CharacterId;
  bountyClaimed: number;
  timestamp: number;
}

export interface GameSnapshot {
  player: PlayerEntity;
  topPlayers: { id: string; name: string; score: number; sugar: number; bounty: number; isPlayer: boolean; rank: number; bountyTier: 'NORMAL' | 'WANTED' | 'HIGH_VALUE' | 'KING' }[];
  playerRank: number;
  decayRate: number; // Sugar lost per sec
  dangerLevel: DangerLevel;
  killEvents: KillEvent[];
  timeSurvived: number; // seconds
  hotZone: HotZoneState;
  kingPlayer: { id: string; name: string; x: number; y: number; bounty: number } | null;
  activeAnnouncement: MapAnnouncement | null;
}

export type GameState = 'MENU' | 'CHAR_SELECT' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
