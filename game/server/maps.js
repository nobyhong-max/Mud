/** @typedef {{ id: string, name: string, width: number, height: number, spawn: { x: number, y: number }, monsterTypes: string[], bossId: string, nextMapId: string | null }} MapDef */

/** @type {Record<string, { name: string, hp: number, attack: number, xp: number, speed: number, radius: number, color: string, isBoss?: boolean, eggDropChance?: number }>} */
export const MONSTER_DEFS = {
  slime: { name: '史莱姆', hp: 30, attack: 5, xp: 15, speed: 40, radius: 14, color: '#4ade80', eggDropChance: 0.08 },
  wolf: { name: '野狼', hp: 55, attack: 10, xp: 28, speed: 55, radius: 16, color: '#94a3b8', eggDropChance: 0.1 },
  bat: { name: '蝙蝠', hp: 40, attack: 8, xp: 22, speed: 70, radius: 12, color: '#a78bfa', eggDropChance: 0.09 },
  golem: { name: '石怪', hp: 90, attack: 14, xp: 45, speed: 30, radius: 20, color: '#78716c', eggDropChance: 0.12 },
  imp: { name: '小火魔', hp: 65, attack: 12, xp: 35, speed: 50, radius: 15, color: '#f97316', eggDropChance: 0.11 },
  boss_boar: { name: '野猪王', hp: 400, attack: 18, xp: 200, speed: 45, radius: 28, color: '#b45309', isBoss: true },
  boss_spider: { name: '森林巨蛛', hp: 650, attack: 24, xp: 350, speed: 55, radius: 32, color: '#581c87', isBoss: true },
  boss_flame: { name: '炎魔领主', hp: 900, attack: 32, xp: 500, speed: 40, radius: 36, color: '#dc2626', isBoss: true },
};

/** @type {MapDef[]} */
export const MAPS = [
  {
    id: 'meadow',
    name: '新手草原',
    width: 1600,
    height: 900,
    spawn: { x: 120, y: 450 },
    monsterTypes: ['slime', 'wolf'],
    bossId: 'boss_boar',
    nextMapId: 'forest',
  },
  {
    id: 'forest',
    name: '幽暗森林',
    width: 1800,
    height: 900,
    spawn: { x: 100, y: 450 },
    monsterTypes: ['wolf', 'bat'],
    bossId: 'boss_spider',
    nextMapId: 'lava',
  },
  {
    id: 'lava',
    name: '熔岩洞窟',
    width: 2000,
    height: 900,
    spawn: { x: 100, y: 450 },
    monsterTypes: ['golem', 'imp'],
    bossId: 'boss_flame',
    nextMapId: null,
  },
];

export function getMap(mapId) {
  return MAPS.find((m) => m.id === mapId) ?? MAPS[0];
}

export function xpForLevel(level) {
  return Math.floor(50 + level * 35 + level * level * 8);
}

export function statsForLevel(level) {
  return {
    maxHp: 100 + (level - 1) * 25,
    attack: 12 + (level - 1) * 4,
  };
}

export function petStatsForLevel(level) {
  return {
    maxHp: 40 + (level - 1) * 12,
    attack: 6 + (level - 1) * 2,
  };
}
