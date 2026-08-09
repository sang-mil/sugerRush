import { CharacterStats, CharacterId, MapObstacle } from '../types/game';

export const WORLD_SIZE = 3000;

export const INITIAL_BOT_COUNT = 10;
export const MAX_BOT_COUNT = 20;
export const MAX_SUGAR_ON_MAP = 350;

// Centralized Combat Balance Configuration
export const COMBAT_CONFIG = {
  respawnInvincibility: 1500, // ms (1.5 seconds)

  preferredCombatDistance: {
    cookie: 180,
    candy: 160,
    pudding: 80,
    donut: 220,
  },

  characters: {
    cookie: {
      maxHp: 180,
      attackInterval: 400, // ms
      attackDamage: 15,
    },
    candy: {
      maxHp: 140,
      attackInterval: 240, // ms (fast continuous shooting)
      attackDamage: 9,
    },
    pudding: {
      maxHp: 270,
      attackInterval: 280, // ms (combo swing interval)
      attackDamage: 24, // base melee swing damage
    },
    donut: {
      maxHp: 190,
      attackInterval: 500, // ms
      attackDamage: 22, // base uncharged damage (scales up to 2.5x = 55+)
    },
  },

  powerUps: {
    heal: { maxCount: 5, hpPercent: 0.30 },
    shield: { maxCount: 3, duration: 5.0, hpPercent: 0.25 },
    speed: { maxCount: 3, duration: 4.0, boostPercent: 0.30 },
    damage: { maxCount: 3, duration: 5.0, boostPercent: 0.25 },
  },
};

// Centralized Dynamic Map & Special Sugar Configuration
export const DYNAMIC_MAP_CONFIG = {
  hotZoneDuration: 30, // seconds
  hotZoneWarningDuration: 5, // seconds
  hotZoneRadius: 380,
  hotZoneDamagePerSec: 5, // HP / sec drain

  specialSugars: {
    golden: { sugar: 100, score: 150, bounty: 10 },
    rainbow: { sugar: 20, score: 50, bounty: 15, duration: 8.0, multiplier: 1.5, sugarMultiplier: 1.5 },
    toxic: { sugar: 200, score: 250, bounty: 15, hpPenaltyPercent: 0.15, hpLossPercent: 0.15 },
  },

  bountyTiers: {
    wanted: 100,      // ⭐ WANTED badge
    highValue: 300,   // 🔥 HIGH VALUE badge
    king: 500,        // 👑 KING OF SUGAR badge
  },

  bountyRewards: {
    normalKill: 30,
    wantedKill: 100,
    highValueKill: 200,
    kingKill: 400,
  }
};

export function getBountyTier(bounty: number): 'NORMAL' | 'WANTED' | 'HIGH_VALUE' | 'KING' {
  if (bounty >= DYNAMIC_MAP_CONFIG.bountyTiers.king) return 'KING';
  if (bounty >= DYNAMIC_MAP_CONFIG.bountyTiers.highValue) return 'HIGH_VALUE';
  if (bounty >= DYNAMIC_MAP_CONFIG.bountyTiers.wanted) return 'WANTED';
  return 'NORMAL';
}

// Character Definitions
export const CHARACTERS: Record<string, CharacterStats> = {
  cookie: {
    id: 'cookie',
    name: 'Cookie',
    nameKo: '쿠키',
    role: 'Balanced / Beginner Friendly',
    maxHp: COMBAT_CONFIG.characters.cookie.maxHp,
    speed: 5.2,
    attackDamage: COMBAT_CONFIG.characters.cookie.attackDamage,
    attackInterval: COMBAT_CONFIG.characters.cookie.attackInterval,
    attackSpeed: 1000 / COMBAT_CONFIG.characters.cookie.attackInterval,
    attackRange: 270,
    abilityCooldown: 8.0,
    abilityName: 'Cookie Shield',
    abilityDescription: 'Generates a protective cookie barrier absorbing incoming damage equal to 25% Max HP for 3 seconds.',
    primaryAttackName: 'Chocolate Chip Shot',
    color: '#D97706', // Amber brown
    accentColor: '#78350F',
    icon: '🍪'
  },
  candy: {
    id: 'candy',
    name: 'Candy',
    nameKo: '캔디',
    role: 'Speed / Assassin',
    maxHp: COMBAT_CONFIG.characters.candy.maxHp,
    speed: 6.8,
    attackDamage: COMBAT_CONFIG.characters.candy.attackDamage,
    attackInterval: COMBAT_CONFIG.characters.candy.attackInterval,
    attackSpeed: 1000 / COMBAT_CONFIG.characters.candy.attackInterval,
    attackRange: 230,
    abilityCooldown: 5.0,
    abilityName: 'Sugar Dash',
    abilityDescription: 'Instantly dashes 140px forward with 0.15s invulnerability to weave through combat.',
    primaryAttackName: 'Candy Shot',
    color: '#EC4899', // Pink
    accentColor: '#BE185D',
    icon: '🍬'
  },
  pudding: {
    id: 'pudding',
    name: 'Pudding',
    nameKo: '푸딩',
    role: 'Tank / Melee Brawler',
    maxHp: COMBAT_CONFIG.characters.pudding.maxHp,
    speed: 3.8,
    attackDamage: COMBAT_CONFIG.characters.pudding.attackDamage,
    attackInterval: COMBAT_CONFIG.characters.pudding.attackInterval,
    attackSpeed: 1000 / COMBAT_CONFIG.characters.pudding.attackInterval,
    attackRange: 120, // Melee arc reach
    abilityCooldown: 8.0,
    abilityName: 'Pudding Slam',
    abilityDescription: 'Slams a giant spoon into the ground, dealing 1.5x damage in a full circle with strong knockback.',
    primaryAttackName: 'Spoon Smash (3-Hit Combo)',
    color: '#F59E0B', // Golden yellow
    accentColor: '#B45309',
    icon: '🍮'
  },
  donut: {
    id: 'donut',
    name: 'Donut',
    nameKo: '도넛',
    role: 'Charged Sniper / Burst',
    maxHp: COMBAT_CONFIG.characters.donut.maxHp,
    speed: 4.8,
    attackDamage: COMBAT_CONFIG.characters.donut.attackDamage,
    attackInterval: COMBAT_CONFIG.characters.donut.attackInterval,
    attackSpeed: 1000 / COMBAT_CONFIG.characters.donut.attackInterval,
    attackRange: 340,
    abilityCooldown: 7.0,
    abilityName: 'Sugar Hole Blast',
    abilityDescription: 'Releases a radial sugary shockwave knocking back nearby enemies and dealing area damage.',
    primaryAttackName: 'Charged Sugar Shot',
    color: '#F43F5E', // Rose/Orange pink
    accentColor: '#9F1239',
    icon: '🍩'
  }
};

// Growth Formulas
export function calculateScaleFactor(sugar: number): number {
  if (sugar <= 0) return 1.0;
  return 1.0 + 0.8 * (Math.log10(1 + sugar / 100) / Math.log10(51)); // log scale up to 1.8x
}

export function calculateMaxHp(characterId: CharacterId, baseHp: number, sugar: number): number {
  if (sugar <= 0) return baseHp;

  const maxBonusMap: Record<CharacterId, number> = {
    cookie: 120, // 180 -> 300
    candy: 80,   // 140 -> 220
    pudding: 115, // 260 -> 375
    donut: 100,  // 200 -> 300
  };

  const maxBonus = maxBonusMap[characterId] ?? 100;
  const factor = Math.min(1.0, Math.log10(1 + sugar / 50) / Math.log10(101));
  return Math.round(baseHp + maxBonus * factor);
}

export function calculateAttackDamage(baseDamage: number, sugar: number): number {
  // Moderate scaling: max +35% at 5000 sugar
  const bonusFactor = 0.35 * (Math.log10(1 + sugar / 100) / Math.log10(51));
  return Math.round(baseDamage * (1 + bonusFactor));
}

export function calculateSugarDecayRate(sugar: number): number {
  // Sugar < 500: No decay
  // 500 ~ 1000: 0.5% / sec
  // 1000 ~ 2000: 1.0% / sec
  // 2000+: 1.5% / sec
  if (sugar < 500) return 0;
  if (sugar < 1000) return sugar * 0.005;
  if (sugar < 2000) return sugar * 0.010;
  return sugar * 0.015;
}

export function calculateDangerLevel(sugar: number) {
  if (sugar < 500) return 'LOW';
  if (sugar < 1000) return 'MEDIUM';
  if (sugar < 2000) return 'HIGH';
  return 'DANGER';
}

export function calculateBounty(sugar: number, kills: number): number {
  const baseBounty = 200;
  return Math.round(baseBounty + sugar * 0.7 + kills * 150);
}

// Generate procedurally fixed map obstacles for tactical gameplay
export function generateMapObstacles(): MapObstacle[] {
  const obstacles: MapObstacle[] = [];
  const obstacleTypes: ('candy_block' | 'marshmallow' | 'jelly_wall')[] = ['candy_block', 'marshmallow', 'jelly_wall'];
  const colors = ['#F472B6', '#FBBF24', '#A78BFA', '#34D399'];
  
  // Outer perimeter padding
  const padding = 200;
  const areaWidth = WORLD_SIZE - padding * 2;
  const areaHeight = WORLD_SIZE - padding * 2;

  // Symmetric clusters + scattered blocks
  const clusterCenters = [
    { x: WORLD_SIZE * 0.25, y: WORLD_SIZE * 0.25 },
    { x: WORLD_SIZE * 0.75, y: WORLD_SIZE * 0.25 },
    { x: WORLD_SIZE * 0.25, y: WORLD_SIZE * 0.75 },
    { x: WORLD_SIZE * 0.75, y: WORLD_SIZE * 0.75 },
    { x: WORLD_SIZE * 0.5, y: WORLD_SIZE * 0.5 },
    { x: WORLD_SIZE * 0.5, y: WORLD_SIZE * 0.2 },
    { x: WORLD_SIZE * 0.5, y: WORLD_SIZE * 0.8 },
    { x: WORLD_SIZE * 0.2, y: WORLD_SIZE * 0.5 },
    { x: WORLD_SIZE * 0.8, y: WORLD_SIZE * 0.5 }
  ];

  let idCounter = 1;

  clusterCenters.forEach((center) => {
    // 3-4 blocks per cluster
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const dist = 90;
      const w = 80 + (i % 2) * 40;
      const h = 80 + ((i + 1) % 2) * 40;
      obstacles.push({
        id: `obs_${idCounter++}`,
        x: center.x + Math.cos(angle) * dist - w / 2,
        y: center.y + Math.sin(angle) * dist - h / 2,
        width: w,
        height: h,
        type: obstacleTypes[i % obstacleTypes.length],
        color: colors[i % colors.length]
      });
    }
  });

  return obstacles;
}

export const BOT_NAMES = [
  'SugarKing', 'SweetDestroyer', 'CandyCrusher', 'DonutMaster',
  'PuddingBoss', 'CookieMonster', 'JellyNinja', 'SyrupSamurai',
  'FrostingFiend', 'GummyGladiator', 'SprinkleKnight', 'CaramelChaos',
  'ChocoChampion', 'BerryBlaster', 'WaffleWarrior'
];
