import { Block, Dimension, WORLD_H, WORLD_W } from "./constants.js";
import { isCave, mulberry32, surfaceHeight } from "./noise.js";

export class World {
  constructor(seed, dimension = Dimension.OVERWORLD) {
    this.seed = seed >>> 0;
    this.dimension = dimension;
    this.blocks = new Uint8Array(WORLD_W * WORLD_H);
    if (dimension === Dimension.NETHER) this.generateNether();
    else this.generateOverworld();
  }

  idx(x, y) {
    return y * WORLD_W + x;
  }

  inBounds(x, y) {
    return x >= 0 && x < WORLD_W && y >= 0 && y < WORLD_H;
  }

  getBlock(x, y) {
    if (!this.inBounds(x, y)) return Block.STONE;
    return this.blocks[this.idx(x, y)];
  }

  setBlock(x, y, id) {
    if (!this.inBounds(x, y)) return;
    this.blocks[this.idx(x, y)] = id;
  }

  isSolid(x, y) {
    const id = this.getBlock(x, y);
    const meta = id === Block.PORTAL ? false : id !== Block.AIR;
    return meta;
  }

  generateOverworld() {
    this.blocks.fill(Block.AIR);
    const rand = mulberry32(this.seed);

    for (let x = 0; x < WORLD_W; x++) {
      const surface = surfaceHeight(x, this.seed);
      for (let y = 0; y < WORLD_H; y++) {
        let id = Block.AIR;
        if (y >= surface) {
          if (y === surface) id = Block.GRASS;
          else if (y < surface + 5) id = Block.DIRT;
          else id = Block.STONE;
        }
        if (id === Block.STONE && isCave(x, y, this.seed)) id = Block.AIR;
        this.setBlock(x, y, id);
      }
    }

    for (let x = 8; x < WORLD_W - 8; x++) {
      for (let y = 70; y < WORLD_H - 4; y++) {
        if (rand() > 0.9975) this.setBlock(x, y, Block.OBSIDIAN);
      }
    }

    for (let x = 4; x < WORLD_W - 4; x++) {
      if (rand() > 0.988) {
        const surface = surfaceHeight(x, this.seed);
        const trunkH = 4 + Math.floor(rand() * 3);
        for (let ty = 0; ty < trunkH; ty++) {
          const y = surface - 1 - ty;
          if (y > 2) this.setBlock(x, y, Block.WOOD);
        }
        const top = surface - trunkH;
        for (let lx = -2; lx <= 2; lx++) {
          for (let ly = -2; ly <= 1; ly++) {
            if (Math.abs(lx) + Math.abs(ly) > 3) continue;
            if (lx === 0 && ly >= 0) continue;
            const bx = x + lx;
            const by = top + ly;
            if (this.getBlock(bx, by) === Block.AIR) this.setBlock(bx, by, Block.LEAVES);
          }
        }
      }
    }

    const spawnX = Math.floor(WORLD_W * 0.25);
    const spawnSurface = surfaceHeight(spawnX, this.seed);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = 0; dy <= 6; dy++) {
        const bx = spawnX + dx;
        const by = spawnSurface + dy;
        if (by >= spawnSurface && by < spawnSurface + 4) this.setBlock(bx, by, Block.AIR);
      }
    }
  }

  generateNether() {
    this.blocks.fill(Block.AIR);
    const rand = mulberry32(this.seed ^ 0xdeadbeef);
    const floor = 58;
    for (let x = 0; x < WORLD_W; x++) {
      const h = floor + Math.floor(Math.sin(x * 0.04) * 4 + rand() * 3);
      for (let y = h; y < WORLD_H; y++) {
        this.setBlock(x, y, Block.NETHERRACK);
      }
      for (let y = 8; y < h - 6; y++) {
        if (rand() > 0.992) this.setBlock(x, y, Block.GLOWSTONE);
      }
    }
    const hubX = 64;
    const hubY = floor - 1;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = 0; dy <= 8; dy++) {
        this.setBlock(hubX + dx, hubY + dy, Block.AIR);
      }
    }
  }

  applyEdits(edits) {
    if (!edits) return;
    for (const [x, y, id] of edits) {
      if (this.inBounds(x, y)) this.setBlock(x, y, id);
    }
  }

  collectEdits(baseline) {
    const out = [];
    for (let i = 0; i < this.blocks.length; i++) {
      if (this.blocks[i] !== baseline[i]) {
        const x = i % WORLD_W;
        const y = (i / WORLD_W) | 0;
        out.push([x, y, this.blocks[i]]);
      }
    }
    return out;
  }

  static baseline(seed, dimension = Dimension.OVERWORLD) {
    const w = new World(seed, dimension);
    return w.blocks.slice();
  }
}

export function worldToTile(wx, wy, tileSize) {
  return {
    tx: Math.floor(wx / tileSize),
    ty: Math.floor(wy / tileSize),
  };
}

/** Tile pick with bias toward block under finger (mobile-friendly). */
export function pickTileFromWorld(wx, wy, tileSize) {
  const tx = Math.floor(wx / tileSize);
  const ty = Math.floor(wy / tileSize);
  const lx = wx / tileSize - tx;
  const ly = wy / tileSize - ty;
  if (lx > 0.65) return { tx: tx + 1, ty };
  if (lx < 0.35) return { tx: tx - 1, ty };
  if (ly > 0.65) return { tx, ty: ty + 1 };
  if (ly < 0.35) return { tx, ty: ty - 1 };
  return { tx, ty };
}
