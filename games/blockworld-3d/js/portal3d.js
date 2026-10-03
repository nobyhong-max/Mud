import { Block, PORTAL_INNER_MIN_H, PORTAL_INNER_MIN_W } from "./constants.js";

/** Portal frame in Y-Z plane (fixed X) or X-Y plane (fixed Z). */

export function findPortalInner3D(world, bx, by, bz) {
  for (let ox = -6; ox <= 6; ox++) {
    for (let oy = -6; oy <= 6; oy++) {
      for (let oz = -6; oz <= 6; oz++) {
        const inner = tryFrameAt(world, bx + ox, by + oy, bz + oz, "x");
        if (inner && frameContains(inner, bx, by, bz, "x")) return inner;
        const innerZ = tryFrameAt(world, bx + ox, by + oy, bz + oz, "z");
        if (innerZ && frameContains(innerZ, bx, by, bz, "z")) return innerZ;
      }
    }
  }
  return null;
}

function frameContains(r, bx, by, bz, axis) {
  if (axis === "x") {
    return (
      (bx === r.frameX && by >= r.frameBottom && by <= r.frameTop && bz >= r.frameNear && bz <= r.frameFar) ||
      (bx === r.frameX && by >= r.innerBottom && by <= r.innerTop && bz >= r.innerNear && bz <= r.innerFar)
    );
  }
  return (
    (bz === r.frameZ && by >= r.frameBottom && by <= r.frameTop && bx >= r.frameNear && bx <= r.frameFar) ||
    (bz === r.frameZ && by >= r.innerBottom && by <= r.innerTop && bx >= r.innerNear && bx <= r.innerFar)
  );
}

function tryFrameAt(world, ix, ib, iz, axis) {
  for (let w = PORTAL_INNER_MIN_W; w <= 6; w++) {
    for (let h = PORTAL_INNER_MIN_H; h <= 8; h++) {
      if (axis === "x") {
        const inner = validateFrameX(world, ix, ib, iz, w, h);
        if (inner) return inner;
      } else {
        const inner = validateFrameZ(world, ix, ib, iz, w, h);
        if (inner) return inner;
      }
    }
  }
  return null;
}

function validateFrameX(world, innerNear, innerBottom, frameX, w, h) {
  const innerFar = innerNear + w - 1;
  const innerTop = innerBottom + h - 1;
  for (let z = innerNear; z <= innerFar; z++) {
    for (let y = innerBottom; y <= innerTop; y++) {
      const b = world.getBlock(frameX, y, z);
      if (b !== Block.AIR && b !== Block.PORTAL) return null;
    }
  }
  const fn = innerNear - 1;
  const ff = innerFar + 1;
  const fb = innerBottom - 1;
  const ft = innerTop + 1;
  for (let z = fn; z <= ff; z++) {
    if (world.getBlock(frameX, fb, z) !== Block.OBSIDIAN) return null;
    if (world.getBlock(frameX, ft, z) !== Block.OBSIDIAN) return null;
  }
  for (let y = fb; y <= ft; y++) {
    if (world.getBlock(frameX, y, fn) !== Block.OBSIDIAN) return null;
    if (world.getBlock(frameX, y, ff) !== Block.OBSIDIAN) return null;
  }
  return {
    axis: "x",
    frameX,
    innerNear,
    innerFar,
    innerBottom,
    innerTop,
    frameNear: fn,
    frameFar: ff,
    frameBottom: fb,
    frameTop: ft,
  };
}

function validateFrameZ(world, innerNear, innerBottom, frameZ, w, h) {
  const innerFar = innerNear + w - 1;
  const innerTop = innerBottom + h - 1;
  for (let x = innerNear; x <= innerFar; x++) {
    for (let y = innerBottom; y <= innerTop; y++) {
      const b = world.getBlock(x, y, frameZ);
      if (b !== Block.AIR && b !== Block.PORTAL) return null;
    }
  }
  const fn = innerNear - 1;
  const ff = innerFar + 1;
  const fb = innerBottom - 1;
  const ft = innerTop + 1;
  for (let x = fn; x <= ff; x++) {
    if (world.getBlock(x, fb, frameZ) !== Block.OBSIDIAN) return null;
    if (world.getBlock(x, ft, frameZ) !== Block.OBSIDIAN) return null;
  }
  for (let y = fb; y <= ft; y++) {
    if (world.getBlock(fn, y, frameZ) !== Block.OBSIDIAN) return null;
    if (world.getBlock(ff, y, frameZ) !== Block.OBSIDIAN) return null;
  }
  return {
    axis: "z",
    frameZ,
    innerNear,
    innerFar,
    innerBottom,
    innerTop,
    frameNear: fn,
    frameFar: ff,
    frameBottom: fb,
    frameTop: ft,
  };
}

export function activatePortal3D(world, inner) {
  if (inner.axis === "x") {
    for (let z = inner.innerNear; z <= inner.innerFar; z++) {
      for (let y = inner.innerBottom; y <= inner.innerTop; y++) {
        world.setBlock(inner.frameX, y, z, Block.PORTAL);
      }
    }
    return {
      x: inner.frameX + 0.5,
      y: (inner.innerBottom + inner.innerTop + 1) / 2,
      z: (inner.innerNear + inner.innerFar + 1) / 2,
    };
  }
  for (let x = inner.innerNear; x <= inner.innerFar; x++) {
    for (let y = inner.innerBottom; y <= inner.innerTop; y++) {
      world.setBlock(x, y, inner.frameZ, Block.PORTAL);
    }
  }
  return {
    x: (inner.innerNear + inner.innerFar + 1) / 2,
    y: (inner.innerBottom + inner.innerTop + 1) / 2,
    z: inner.frameZ + 0.5,
  };
}

export function playerInPortal3D(world, px, py, pz) {
  const bx = Math.floor(px);
  const by = Math.floor(py);
  const bz = Math.floor(pz);
  return world.getBlock(bx, by, bz) === Block.PORTAL;
}
