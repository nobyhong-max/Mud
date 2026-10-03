const WIDTH = 0.55;
const HEIGHT = 1.72;
const EYE = 1.62;

export class Player {
  constructor(x, y, z) {
    this.pos = { x, y, z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.thirdPerson = false;
  }

  eyePosition() {
    return {
      x: this.pos.x,
      y: this.pos.y + EYE,
      z: this.pos.z,
    };
  }

  aabbAt(px, py, pz) {
    return {
      minX: px - WIDTH / 2,
      maxX: px + WIDTH / 2,
      minY: py,
      maxY: py + HEIGHT,
      minZ: pz - WIDTH / 2,
      maxZ: pz + WIDTH / 2,
    };
  }

  blocksPlacement(world, bx, by, bz) {
    const box = this.aabbAt(this.pos.x, this.pos.y, this.pos.z);
    return (
      bx + 1 > box.minX &&
      bx < box.maxX &&
      by + 1 > box.minY &&
      by < box.maxY &&
      bz + 1 > box.minZ &&
      bz < box.maxZ
    );
  }

  update(world, input, opts) {
    const { creative, dt } = opts;
    const speed = this.flying ? 9 : creative ? 7 : 5.2;
    const yaw = this.yaw;
    const forward = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
    const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };

    let mx = 0;
    let mz = 0;
    if (input.move.y) {
      mx += forward.x * input.move.y;
      mz += forward.z * input.move.y;
    }
    if (input.move.x) {
      mx += right.x * input.move.x;
      mz += right.z * input.move.x;
    }
    const len = Math.hypot(mx, mz) || 1;
    mx = (mx / len) * speed * dt;
    mz = (mz / len) * speed * dt;

    if (this.flying) {
      let vy = 0;
      if (input.jump) vy += speed * dt;
      if (input.sneak) vy -= speed * dt;
      this.moveAxis(world, mx, 0, mz);
      this.pos.y += vy;
      this.vel.y = 0;
      this.onGround = false;
      return;
    }

    if (!creative) {
      this.vel.y -= 28 * dt;
      if (this.vel.y < -40) this.vel.y = -40;
    } else if (!this.flying) {
      this.vel.y -= 28 * dt;
    }

    if (input.jump && (this.onGround || creative) && !this.flying) {
      this.vel.y = 9.2;
      this.onGround = false;
    }

    this.moveAxis(world, mx, 0, mz);
    this.moveAxis(world, 0, this.vel.y * dt, 0);
  }

  moveAxis(world, dx, dy, dz) {
    if (dx) {
      this.pos.x += dx;
      if (this.collides(world)) {
        this.pos.x -= dx;
        while (Math.abs(dx) > 0.001) {
          this.pos.x += Math.sign(dx) * 0.02;
          if (this.collides(world)) {
            this.pos.x -= Math.sign(dx) * 0.02;
            break;
          }
          dx -= Math.sign(dx) * 0.02;
        }
      }
    }
    if (dz) {
      this.pos.z += dz;
      if (this.collides(world)) {
        this.pos.z -= dz;
        while (Math.abs(dz) > 0.001) {
          this.pos.z += Math.sign(dz) * 0.02;
          if (this.collides(world)) {
            this.pos.z -= Math.sign(dz) * 0.02;
            break;
          }
          dz -= Math.sign(dz) * 0.02;
        }
      }
    }
    if (dy) {
      this.pos.y += dy;
      if (this.collides(world)) {
        this.pos.y -= dy;
        if (dy < 0) this.onGround = true;
        this.vel.y = 0;
        while (Math.abs(dy) > 0.001) {
          this.pos.y += Math.sign(dy) * 0.02;
          if (this.collides(world)) {
            this.pos.y -= Math.sign(dy) * 0.02;
            break;
          }
          dy -= Math.sign(dy) * 0.02;
        }
      } else if (dy > 0) {
        this.onGround = false;
      }
    }
  }

  collides(world) {
    const box = this.aabbAt(this.pos.x, this.pos.y, this.pos.z);
    const x0 = Math.floor(box.minX);
    const x1 = Math.floor(box.maxX);
    const y0 = Math.floor(box.minY);
    const y1 = Math.floor(box.maxY);
    const z0 = Math.floor(box.minZ);
    const z1 = Math.floor(box.maxZ);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) {
          if (world.isSolid(x, y, z)) return true;
        }
      }
    }
    return false;
  }
}
