/** Seeded value noise + FBM for 3D terrain */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z, seed) {
  let h = seed + x * 374761393 + y * 668265263 + z * 1442695041;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hash2(x, z, seed) {
  return hash3(x, 0, z, seed);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function valueNoise2(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fz = smooth(z - z0);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}

export function valueNoise3(x, y, z, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const fz = smooth(z - z0);
  const n000 = hash3(x0, y0, z0, seed);
  const n100 = hash3(x0 + 1, y0, z0, seed);
  const n010 = hash3(x0, y0 + 1, z0, seed);
  const n110 = hash3(x0 + 1, y0 + 1, z0, seed);
  const n001 = hash3(x0, y0, z0 + 1, seed);
  const n101 = hash3(x0 + 1, y0, z0 + 1, seed);
  const n011 = hash3(x0, y0 + 1, z0 + 1, seed);
  const n111 = hash3(x0 + 1, y0 + 1, z0 + 1, seed);
  const nx00 = lerp(n000, n100, fx);
  const nx10 = lerp(n010, n110, fx);
  const nx01 = lerp(n001, n101, fx);
  const nx11 = lerp(n011, n111, fx);
  const nxy0 = lerp(nx00, nx10, fy);
  const nxy1 = lerp(nx01, nx11, fy);
  return lerp(nxy0, nxy1, fz);
}

export function fbm2(x, z, seed, octaves = 5) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise2(x * freq, z * freq, seed + i * 991) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum / norm;
}

export function fbm3(x, y, z, seed, octaves = 4) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise3(x * freq, y * freq, z * freq, seed + i * 313) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

/** Surface height at world X/Z (overworld) */
export function surfaceHeightAt(x, z, seed) {
  const continental = fbm2(x * 0.002, z * 0.002, seed, 4);
  const hills = fbm2(x * 0.012, z * 0.012, seed + 77, 5);
  const detail = fbm2(x * 0.05, z * 0.05, seed + 133, 3);
  const h = SEA + continental * 18 + hills * 22 + detail * 6;
  return Math.floor(h);
}

const SEA = 62;

export function biomeAt(x, z, seed) {
  const temp = fbm2(x * 0.003 + 100, z * 0.003, seed + 5000, 3);
  const moist = fbm2(x * 0.003, z * 0.003 + 100, seed + 6000, 3);
  if (temp > 0.62 && moist < 0.42) return "desert";
  if (moist > 0.55 && temp > 0.35) return "forest";
  if (hillsAt(x, z, seed) > 0.68) return "hills";
  return "plains";
}

function hillsAt(x, z, seed) {
  return fbm2(x * 0.008, z * 0.008, seed + 900, 4);
}

export function isCave3(x, y, z, seed) {
  if (y < 4 || y > 118) return false;
  const worm = fbm3(x * 0.06, y * 0.06, z * 0.06, seed + 9001, 3);
  const cavern = fbm3(x * 0.02, y * 0.02, z * 0.02, seed + 42, 4);
  const depth = y / 128;
  const threshold = 0.52 + depth * 0.08;
  return worm > threshold + 0.06 || cavern > threshold + 0.12;
}

export function treeChance(x, z, seed) {
  return hash2(x, z, seed + 7777);
}
