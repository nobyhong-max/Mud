import { Block, PORTAL_INNER_MIN_H, PORTAL_INNER_MIN_W } from "./constants.js";

/** Find inner air rect of obsidian portal frame if (tx,ty) touches frame or interior. */
export function findPortalInner(world, tx, ty) {
  if (!world.inBounds(tx, ty)) return null;
  const id = world.getBlock(tx, ty);
  if (id !== Block.OBSIDIAN && id !== Block.AIR && id !== Block.PORTAL) return null;

  for (let sx = tx - 8; sx <= tx + 2; sx++) {
    for (let sy = ty - 8; sy <= ty + 2; sy++) {
      const inner = tryRectAt(world, sx, sy);
      if (inner && rectContains(inner, tx, ty)) return inner;
    }
  }
  return null;
}

function rectContains(r, tx, ty) {
  return (
    (tx >= r.frameLeft && tx <= r.frameRight && ty >= r.frameTop && ty <= r.frameBottom) ||
    (tx >= r.innerLeft && tx <= r.innerRight && ty >= r.innerTop && ty <= r.innerBottom)
  );
}

function tryRectAt(world, innerLeft, innerTop) {
  for (let w = PORTAL_INNER_MIN_W; w <= 6; w++) {
    for (let h = PORTAL_INNER_MIN_H; h <= 8; h++) {
      const innerRight = innerLeft + w - 1;
      const innerBottom = innerTop + h - 1;
      if (!world.inBounds(innerLeft, innerTop) || !world.inBounds(innerRight, innerBottom)) continue;
      if (!isValidFrame(world, innerLeft, innerTop, innerRight, innerBottom)) continue;
      return {
        innerLeft,
        innerTop,
        innerRight,
        innerBottom,
        frameLeft: innerLeft - 1,
        frameRight: innerRight + 1,
        frameTop: innerTop - 1,
        frameBottom: innerBottom + 1,
        w,
        h,
      };
    }
  }
  return null;
}

function isValidFrame(world, il, it, ir, ib) {
  for (let x = il; x <= ir; x++) {
    for (let y = it; y <= ib; y++) {
      const b = world.getBlock(x, y);
      if (b !== Block.AIR && b !== Block.PORTAL) return false;
    }
  }
  const fl = il - 1;
  const fr = ir + 1;
  const ft = it - 1;
  const fb = ib + 1;
  for (let x = fl; x <= fr; x++) {
    if (world.getBlock(x, ft) !== Block.OBSIDIAN) return false;
    if (world.getBlock(x, fb) !== Block.OBSIDIAN) return false;
  }
  for (let y = ft; y <= fb; y++) {
    if (world.getBlock(fl, y) !== Block.OBSIDIAN) return false;
    if (world.getBlock(fr, y) !== Block.OBSIDIAN) return false;
  }
  return true;
}

export function activatePortal(world, inner) {
  for (let x = inner.innerLeft; x <= inner.innerRight; x++) {
    for (let y = inner.innerTop; y <= inner.innerBottom; y++) {
      world.setBlock(x, y, Block.PORTAL);
    }
  }
  return {
    cx: (inner.innerLeft + inner.innerRight + 1) / 2,
    cy: (inner.innerTop + inner.innerBottom + 1) / 2,
  };
}

export function playerInPortal(world, player, tileSize) {
  const cx = player.x + player.w * 0.5;
  const cy = player.y + player.h * 0.5;
  const tx = Math.floor(cx / tileSize);
  const ty = Math.floor(cy / tileSize);
  return world.getBlock(tx, ty) === Block.PORTAL;
}
