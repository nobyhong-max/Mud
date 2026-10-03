import { WORLD_H } from "./constants.js";

/** Seeded RNG + cheap 1D/2D noise for terrain */
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

export function hash2(x, y, seed) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function surfaceHeight(x, seed) {
  const base = 52;
  const wave =
    Math.sin(x * 0.06) * 6 +
    Math.sin(x * 0.015 + seed * 0.001) * 10 +
    Math.sin(x * 0.11 + 2) * 3;
  const jitter = (hash2(x, 0, seed) - 0.5) * 4;
  return Math.floor(base + wave + jitter);
}

export function isCave(x, y, seed) {
  if (y < 8) return false;
  const n =
    hash2(x, y, seed + 9001) * 0.6 +
    hash2(x >> 1, y >> 1, seed + 42) * 0.3 +
    hash2(x * 3, y * 3, seed + 7) * 0.1;
  const depth = y / WORLD_H;
  const threshold = 0.58 + depth * 0.12;
  return n > threshold;
}
