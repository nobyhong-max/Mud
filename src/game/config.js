/** SpikeTactics config — aligned with GDD */

export const MATCH = {
  winScore: 5, // shortened for prototype (GDD full: 13)
  buySeconds: 15,
  actionSeconds: 90,
  plantHold: 3.5,
  defuseHold: 5,
  explodeSeconds: 25,
  plantRadius: 3.2,
  defuseRadius: 2.8,
};

export const ECONOMY = {
  start: 800,
  max: 9000,
  win: 3000,
  loss: 1900,
  lossStreak: 200,
  kill: 200,
  plant: 300,
  defuse: 300,
};

export const WEAPONS = {
  sidearm: {
    id: 'sidearm', name: '短焰', price: 0,
    damage: 30, headMult: 2.0, fireRate: 6.5,
    magSize: 12, reserve: 36, reloadTime: 1.5,
    bloomBase: 0.008, bloomShot: 0.007, bloomDecay: 0.88, bloomMax: 0.05,
    moveBloom: 3.0, recoil: 0.02,
  },
  smg: {
    id: 'smg', name: '迅蝎', price: 950,
    damage: 22, headMult: 2.0, fireRate: 11,
    magSize: 25, reserve: 75, reloadTime: 1.9,
    bloomBase: 0.01, bloomShot: 0.005, bloomDecay: 0.9, bloomMax: 0.055,
    moveBloom: 2.2, recoil: 0.014,
  },
  rifle: {
    id: 'rifle', name: '弧光', price: 2900,
    damage: 28, headMult: 2.2, fireRate: 9.5,
    magSize: 30, reserve: 90, reloadTime: 2.1,
    bloomBase: 0.0055, bloomShot: 0.0042, bloomDecay: 0.93, bloomMax: 0.042,
    moveBloom: 3.6, recoil: 0.017,
  },
  shotgun: {
    id: 'shotgun', name: '近狩', price: 1600,
    damage: 14, pellets: 8, headMult: 1.4, fireRate: 1.1,
    magSize: 5, reserve: 20, reloadTime: 2.4,
    bloomBase: 0.035, bloomShot: 0.01, bloomDecay: 0.8, bloomMax: 0.08,
    moveBloom: 1.4, recoil: 0.035,
  },
};

export const ARMOR = {
  none: { id: 'none', name: '无护甲', price: 0, value: 0 },
  light: { id: 'light', name: '轻甲', price: 400, value: 25 },
  heavy: { id: 'heavy', name: '重甲', price: 1000, value: 50 },
};

export const AGENTS = {
  flashwind: {
    id: 'flashwind', name: '闪风', role: '决斗', color: 0x2ad4ff,
    q: { id: 'dash', name: '疾闪', cd: 8 },
    e: { id: 'flash', name: '耀光', cd: 12 },
    c: { id: 'updraft', name: '踏风', cd: 10 },
    x: { id: 'breakthrough', name: '破锋', cost: 6 },
  },
  mistveil: {
    id: 'mistveil', name: '雾隐', role: '控场', color: 0x9b6bff,
    q: { id: 'fogwall', name: '雾墙', cd: 16 },
    e: { id: 'flame', name: '焰障', cd: 18 },
    c: { id: 'haze', name: '霾团', cd: 14 },
    x: { id: 'canopy', name: '天幕', cost: 7 },
  },
};
