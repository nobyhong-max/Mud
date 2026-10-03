import * as THREE from "three";
import { BLOCK_META, Block, CHUNK_SIZE, WORLD_HEIGHT } from "./constants.js";

const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { dir: [-1, 0, 0], corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [0, 0, 1], corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { dir: [0, 0, -1], corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];

function blockColor(id, face) {
  const meta = BLOCK_META[id];
  if (!meta) return new THREE.Color("#444");
  if (id === Block.GRASS && face === 1) return new THREE.Color(meta.top || meta.color);
  if (id === Block.GRASS && face !== 1 && face !== 4) return new THREE.Color(meta.color);
  if (id === Block.PORTAL) return new THREE.Color("#8b30d8");
  return new THREE.Color(meta.color);
}

export function buildChunkGeometry(blocks, getNeighbor) {
  const positions = [];
  const normals = [];
  const colors = [];

  for (let y = 0; y < WORLD_HEIGHT; y++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = blocks[lx + lz * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE];
        if (!id || id === Block.AIR) continue;
        const solid = id !== Block.PORTAL;
        if (!solid && id !== Block.PORTAL) continue;

        for (let fi = 0; fi < FACES.length; fi++) {
          const f = FACES[fi];
          const nx = lx + f.dir[0];
          const ny = y + f.dir[1];
          const nz = lz + f.dir[2];
          const neighbor = getNeighbor(nx, ny, nz);
          const nMeta = BLOCK_META[neighbor];
          const neighborSolid = neighbor && neighbor !== Block.AIR && neighbor !== Block.PORTAL;
          const neighborPortal = neighbor === Block.PORTAL;
          if (id === Block.PORTAL) {
            if (neighbor !== Block.AIR && !neighborPortal) continue;
          } else if (neighborSolid) continue;

          const col = blockColor(id, fi);
          for (const c of f.corners) {
            positions.push(lx + c[0], y + c[1], lz + c[2]);
            normals.push(f.dir[0], f.dir[1], f.dir[2]);
            colors.push(col.r, col.g, col.b);
          }
        }
      }
    }
  }

  if (positions.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}
