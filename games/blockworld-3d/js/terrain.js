import { Block, CHUNK_SIZE, Dimension, WORLD_HEIGHT } from "./constants.js";
import { biomeAt, isCave3, mulberry32, surfaceHeightAt, treeChance } from "./noise.js";

export function generateChunkBlocks(cx, cz, seed, dimension) {
  const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
  if (dimension === Dimension.NETHER) fillNether(blocks, cx, cz, seed);
  else fillOverworld(blocks, cx, cz, seed);
  return blocks;
}

function idx(lx, y, lz) {
  return y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
}

function wx(cx, lx) {
  return cx * CHUNK_SIZE + lx;
}

function wz(cz, lz) {
  return cz * CHUNK_SIZE + lz;
}

function fillOverworld(blocks, cx, cz, seed) {
  const rand = mulberry32((seed ^ (cx * 734287 ^ cz * 912271)) >>> 0);

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const x = wx(cx, lx);
      const z = wz(cz, lz);
      const surface = surfaceHeightAt(x, z, seed);
      const biome = biomeAt(x, z, seed);

      for (let y = 0; y < WORLD_HEIGHT; y++) {
        let id = Block.AIR;
        if (y <= surface) {
          if (y === surface) {
            id = biome === "desert" ? Block.SAND : Block.GRASS;
          } else if (y > surface - 4) {
            id = biome === "desert" ? Block.SAND : Block.DIRT;
          } else {
            id = Block.STONE;
          }
        }
        if (id === Block.STONE && isCave3(x, y, z, seed)) id = Block.AIR;
        if (y < 5) id = Block.STONE;
        blocks[idx(lx, y, lz)] = id;
      }

      if (biome === "forest" && treeChance(x, z, seed) > 0.992) {
        placeTree(blocks, lx, surface, lz, rand);
      }
      if (yDeepObsidian(x, z, seed, rand)) {
        const y = 8 + Math.floor(rand() * 24);
        if (blocks[idx(lx, y, lz)] === Block.STONE) blocks[idx(lx, y, lz)] = Block.OBSIDIAN;
      }
    }
  }
}

function yDeepObsidian(x, z, seed, rand) {
  return rand() > 0.9985 && (x * 17 + z * 31 + seed) % 97 === 0;
}

function placeTree(blocks, lx, surface, lz, rand) {
  const trunkH = 4 + Math.floor(rand() * 3);
  for (let ty = 1; ty <= trunkH; ty++) {
    const y = surface + ty;
    if (y >= WORLD_HEIGHT - 1) break;
    blocks[idx(lx, y, lz)] = Block.WOOD;
  }
  const top = surface + trunkH;
  for (let ox = -2; ox <= 2; ox++) {
    for (let oz = -2; oz <= 2; oz++) {
      for (let oy = -2; oy <= 1; oy++) {
        if (Math.abs(ox) + Math.abs(oz) + Math.abs(oy) > 4) continue;
        const nl = lx + ox;
        const nlz = lz + oz;
        const ny = top + oy;
        if (nl < 0 || nl >= CHUNK_SIZE || nlz < 0 || nlz >= CHUNK_SIZE) continue;
        if (ny <= surface || ny >= WORLD_HEIGHT) continue;
        if (blocks[idx(nl, ny, nlz)] === Block.AIR) blocks[idx(nl, ny, nlz)] = Block.LEAVES;
      }
    }
  }
}

function fillNether(blocks, cx, cz, seed) {
  const rand = mulberry32((seed ^ 0xdeadbeef ^ cx ^ (cz << 4)) >>> 0);
  const floorBase = 48;
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const x = wx(cx, lx);
      const z = wz(cz, lz);
      const floor = floorBase + Math.floor(Math.sin(x * 0.07) * 3 + Math.cos(z * 0.05) * 2 + rand() * 2);
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        let id = Block.AIR;
        if (y <= floor && y >= 8) id = Block.NETHERRACK;
        if (y < 8) id = Block.NETHERRACK;
        if (id === Block.NETHERRACK && isCave3(x, y, z, seed ^ 0xbeef)) id = Block.AIR;
        blocks[idx(lx, y, lz)] = id;
      }
      for (let y = 12; y < floor - 4; y++) {
        if (rand() > 0.994) blocks[idx(lx, y, lz)] = Block.GLOWSTONE;
      }
    }
  }
  if (cx === 0 && cz === 0) {
    for (let lx = 6; lx < 10; lx++) {
      for (let lz = 6; lz < 10; lz++) {
        for (let y = floorBase + 1; y < floorBase + 10; y++) {
          blocks[idx(lx, y, lz)] = Block.AIR;
        }
      }
    }
  }
}
