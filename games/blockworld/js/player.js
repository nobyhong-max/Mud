import { FLY_SPEED, GRAVITY, JUMP_V, MAX_FALL, MOVE_SPEED, TILE, WORLD_H, WORLD_W } from "./constants.js";

export class Player {
  constructor(x, y) {
    this.w = TILE * 0.55;
    this.h = TILE * 1.75;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.flying = false;
  }

  center() {
    return { x: this.x + this.w * 0.5, y: this.y + this.h * 0.5 };
  }

  footTileY() {
    return Math.floor((this.y + this.h - 1) / TILE);
  }

  update(world, input, opts = {}) {
    const { creative = false, flyToggle = false } = opts;
    let move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;
    if (move !== 0) this.facing = move;

    if (creative) {
      if (flyToggle) this.flying = !this.flying;
      if (this.flying) {
        this.vx = move * FLY_SPEED;
        let vy = 0;
        if (input.jump || input.flyUp) vy -= FLY_SPEED;
        if (input.flyDown) vy += FLY_SPEED;
        this.vy = vy;
        this.x += this.vx;
        this.y += this.vy;
        this.clampWorld();
        return;
      }
    }

    this.vx = move * MOVE_SPEED;
    if (input.jump && this.onGround) {
      this.vy = JUMP_V;
      this.onGround = false;
    }

    this.vy = Math.min(this.vy + GRAVITY, MAX_FALL);
    this.moveAxis(world, "x", this.vx);
    this.moveAxis(world, "y", this.vy);
    this.clampWorld();
  }

  clampWorld() {
    const maxX = WORLD_W * TILE - this.w;
    const maxY = WORLD_H * TILE - this.h;
    this.x = Math.max(0, Math.min(this.x, maxX));
    this.y = Math.max(0, Math.min(this.y, maxY));
  }

  moveAxis(world, axis, delta) {
    if (delta === 0) return;
    if (axis === "x") this.x += delta;
    else this.y += delta;

    for (const { tx, ty } of this.overlappingSolidTiles(world)) {
      if (axis === "x") {
        if (delta > 0) this.x = tx * TILE - this.w - 0.01;
        else this.x = (tx + 1) * TILE + 0.01;
        this.vx = 0;
      } else {
        if (delta > 0) {
          this.y = ty * TILE - this.h - 0.01;
          this.vy = 0;
        } else {
          this.y = (ty + 1) * TILE + 0.01;
          this.vy = 0;
          this.onGround = true;
        }
      }
    }
    if (axis === "y" && delta !== 0) {
      this.onGround = false;
      const footY = this.y + this.h + 1;
      const midX = this.x + this.w * 0.5;
      const tx = Math.floor(midX / TILE);
      const ty = Math.floor(footY / TILE);
      if (world.isSolid(tx, ty)) this.onGround = true;
    }
  }

  overlappingSolidTiles(world) {
    const x0 = Math.floor(this.x / TILE);
    const x1 = Math.floor((this.x + this.w - 0.001) / TILE);
    const y0 = Math.floor(this.y / TILE);
    const y1 = Math.floor((this.y + this.h - 0.001) / TILE);
    const out = [];
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (world.isSolid(tx, ty)) out.push({ tx, ty });
      }
    }
    return out;
  }

  /** Placement collision — allows block directly under feet / adjacent. */
  blocksPlacement(tx, ty) {
    const bx = tx * TILE;
    const by = ty * TILE;
    const bodyBottom = this.y + this.h - 8;
    const margin = 1;
    return (
      bx + TILE > this.x + margin &&
      bx < this.x + this.w - margin &&
      by + TILE > this.y + margin &&
      by < bodyBottom
    );
  }
}
