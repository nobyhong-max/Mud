import * as THREE from "three";
import { Block, CHUNK_SIZE, Dimension, RENDER_DISTANCE, WORLD_HEIGHT } from "./constants.js";
import { buildChunkGeometry } from "./mesher.js";
import { generateChunkBlocks } from "./terrain.js";

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

export class VoxelWorld {
  constructor(seed, dimension, scene) {
    this.seed = seed >>> 0;
    this.dimension = dimension;
    this.scene = scene;
    this.chunks = new Map();
    this.meshes = new Map();
    this.edits = new Map();
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true });
  }

  localIdx(lx, y, lz) {
    return lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  chunkOf(x, z) {
    return [Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)];
  }

  inWorldY(y) {
    return y >= 0 && y < WORLD_HEIGHT;
  }

  getBlock(x, y, z) {
    if (!this.inWorldY(y)) return Block.AIR;
    const [cx, cz] = this.chunkOf(x, z);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return Block.STONE;
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return chunk[this.localIdx(lx, y, lz)] || Block.AIR;
  }

  setBlock(x, y, z, id) {
    if (!this.inWorldY(y)) return;
    const [cx, cz] = this.chunkOf(x, z);
    const key = chunkKey(cx, cz);
    if (!this.chunks.has(key)) this.ensureChunk(cx, cz);
    const chunk = this.chunks.get(key);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const i = this.localIdx(lx, y, lz);
    chunk[i] = id;
    this.edits.set(`${x},${y},${z}`, id);
    this.rebuildMesh(cx, cz);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (lx + dx < 0 || lx + dx >= CHUNK_SIZE || lz + dz < 0 || lz + dz >= CHUNK_SIZE) {
        this.rebuildMesh(cx + dx, cz + dz);
      }
    }
  }

  ensureChunk(cx, cz) {
    const key = chunkKey(cx, cz);
    if (this.chunks.has(key)) return;
    const blocks = generateChunkBlocks(cx, cz, this.seed, this.dimension);
    this.applyEditsToChunk(blocks, cx, cz);
    this.chunks.set(key, blocks);
    this.rebuildMesh(cx, cz);
  }

  applyEditsToChunk(blocks, cx, cz) {
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    for (const [coord, id] of this.edits) {
      const [x, y, z] = coord.split(",").map(Number);
      if (x < baseX || x >= baseX + CHUNK_SIZE || z < baseZ || z >= baseZ + CHUNK_SIZE) continue;
      if (!this.inWorldY(y)) continue;
      const lx = x - baseX;
      const lz = z - baseZ;
      blocks[this.localIdx(lx, y, lz)] = id;
    }
  }

  applyEditsList(list) {
    if (!list) return;
    for (const [x, y, z, id] of list) {
      this.edits.set(`${x},${y},${z}`, id);
    }
  }

  collectEdits() {
    return [...this.edits.entries()].map(([k, id]) => {
      const [x, y, z] = k.split(",").map(Number);
      return [x, y, z, id];
    });
  }

  rebuildMesh(cx, cz) {
    const key = chunkKey(cx, cz);
    const blocks = this.chunks.get(key);
    if (!blocks) return;
    const old = this.meshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
    }
    const getNeighbor = (lx, y, lz) => {
      let wx = cx * CHUNK_SIZE + lx;
      let wz = cz * CHUNK_SIZE + lz;
      return this.getBlock(wx, y, wz);
    };
    const geo = buildChunkGeometry(blocks, (lx, y, lz) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        return this.getBlock(wx, y, wz);
      }
      if (!this.inWorldY(y)) return Block.AIR;
      return blocks[this.localIdx(lx, y, lz)];
    });
    if (!geo) {
      this.meshes.delete(key);
      return;
    }
    const mesh = new THREE.Mesh(geo, this.material);
    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    mesh.userData.chunkKey = key;
    this.scene.add(mesh);
    this.meshes.set(key, mesh);
  }

  updateAround(px, pz) {
    const [pcx, pcz] = this.chunkOf(px, pz);
    const keep = new Set();
    for (let dz = -RENDER_DISTANCE; dz <= RENDER_DISTANCE; dz++) {
      for (let dx = -RENDER_DISTANCE; dx <= RENDER_DISTANCE; dx++) {
        if (dx * dx + dz * dz > RENDER_DISTANCE * RENDER_DISTANCE + 1) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        keep.add(chunkKey(cx, cz));
        this.ensureChunk(cx, cz);
      }
    }
    for (const key of [...this.meshes.keys()]) {
      if (!keep.has(key)) {
        const mesh = this.meshes.get(key);
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.meshes.delete(key);
        this.chunks.delete(key);
      }
    }
  }

  isSolid(x, y, z) {
    const id = this.getBlock(x, y, z);
    return id !== Block.AIR && id !== Block.PORTAL;
  }

  static baselineEdits(seed, dimension) {
    const w = new VoxelWorld(seed, dimension, { add() {} });
    w.updateAround(0, 0);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        w.ensureChunk(dx, dz);
      }
    }
    return w.collectEdits();
  }
}

export function surfaceSpawnY(x, z, seed) {
  for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
    const b = generateChunkBlocks(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE), seed, Dimension.OVERWORLD);
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const idx = lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
    if (b[idx] !== 0) return y + 2;
  }
  return 70;
}
