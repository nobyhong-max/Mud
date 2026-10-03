import { Block, REACH } from "./constants.js";

/** DDA voxel raycast from origin along dir (normalized). Returns hit block + adjacent place cell. */
export function voxelRaycast(world, origin, dir, maxDist = REACH) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;
  const tDeltaX = dir.x === 0 ? Infinity : Math.abs(1 / dir.x);
  const tDeltaY = dir.y === 0 ? Infinity : Math.abs(1 / dir.y);
  const tDeltaZ = dir.z === 0 ? Infinity : Math.abs(1 / dir.z);
  let tMaxX = dir.x === 0 ? Infinity : ((dir.x > 0 ? x + 1 : x) - origin.x) / dir.x;
  let tMaxY = dir.y === 0 ? Infinity : ((dir.y > 0 ? y + 1 : y) - origin.y) / dir.y;
  let tMaxZ = dir.z === 0 ? Infinity : ((dir.z > 0 ? z + 1 : z) - origin.z) / dir.z;
  let dist = 0;
  let prev = { x, y, z };

  while (dist <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id !== Block.AIR) {
      return {
        hit: { x, y, z, id },
        place: prev,
        dist,
      };
    }
    prev = { x, y, z };
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX;
        dist = tMaxX;
        tMaxX += tDeltaX;
      } else {
        z += stepZ;
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
      }
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      dist = tMaxY;
      tMaxY += tDeltaY;
    } else {
      z += stepZ;
      dist = tMaxZ;
      tMaxZ += tDeltaZ;
    }
  }
  return null;
}
