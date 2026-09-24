import * as THREE from "three";
import { resolveCollision } from "./maps.js";

const EYE = 1.7;
const SPEED = 11;
const SPRINT = 15;
const RADIUS = 0.45;

export class Player {
  constructor(camera, character) {
    this.camera = camera;
    this.character = character;
    this.yaw = 0;
    this.pitch = 0;
    this.velocity = new THREE.Vector3();
    this.position = new THREE.Vector3(0, EYE, 0);
    this.health = 100;
    this.maxHealth = 100;
    this.ammo = 30;
    this.reserve = 90;
    this.magSize = 30;
    this.reloading = false;
    this.reloadTimer = 0;
    this.shootCooldown = 0;
    this.abilityCd = 0;
    this.alive = true;
    this.flashUntil = 0;
    this.keys = Object.create(null);
    this.wantsShoot = false;
    this.wantsAbility = false;
    this.dashVel = null;
    this.dashTimer = 0;
  }

  setSpawn(pos) {
    this.position.copy(pos);
    this.position.y = EYE;
    this.camera.position.copy(this.position);
    this.yaw = Math.PI; // face -Z / toward enemies typically
    this.pitch = 0;
    this.health = this.maxHealth;
    this.ammo = this.magSize;
    this.reserve = 90;
    this.reloading = false;
    this.alive = true;
    this.abilityCd = 0;
    this.flashUntil = 0;
    this.dashVel = null;
    this.applyLook();
  }

  applyLook() {
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, "YXZ");
    this.camera.quaternion.setFromEuler(euler);
    this.camera.position.copy(this.position);
  }

  onMouseMove(dx, dy, sens = 0.0022) {
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch));
  }

  getForward() {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    f.y = 0;
    return f.normalize();
  }

  getRight() {
    const r = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    r.y = 0;
    return r.normalize();
  }

  update(dt, colliders, bounds) {
    if (!this.alive) return;

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = this.magSize - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        this.reloading = false;
      }
    }

    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.abilityCd = Math.max(0, this.abilityCd - dt);

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.position.addScaledVector(this.dashVel, dt);
      if (this.dashTimer <= 0) this.dashVel = null;
    } else {
      const forward = this.getForward();
      const right = this.getRight();
      const wish = new THREE.Vector3();
      if (this.keys["KeyW"] || this.keys["ArrowUp"]) wish.add(forward);
      if (this.keys["KeyS"] || this.keys["ArrowDown"]) wish.sub(forward);
      if (this.keys["KeyD"] || this.keys["ArrowRight"]) wish.add(right);
      if (this.keys["KeyA"] || this.keys["ArrowLeft"]) wish.sub(right);
      if (wish.lengthSq() > 0) wish.normalize();

      const speed = this.keys["ShiftLeft"] || this.keys["ShiftRight"] ? SPRINT : SPEED;
      this.position.addScaledVector(wish, speed * dt);
    }

    this.position = resolveCollision(this.position, RADIUS, colliders, EYE);
    this.position.y = EYE;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -bounds, bounds);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -bounds, bounds);
    this.applyLook();
  }

  tryReload() {
    if (this.reloading || this.ammo >= this.magSize || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = 1.4;
  }

  tryShoot() {
    if (!this.alive || this.reloading || this.shootCooldown > 0) return null;
    if (this.ammo <= 0) {
      this.tryReload();
      return null;
    }
    this.ammo -= 1;
    this.shootCooldown = 0.11;
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    return { origin, dir, damage: 28 };
  }

  takeDamage(amount, now) {
    if (!this.alive) return false;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      return true;
    }
    return false;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  startDash() {
    const f = this.getForward();
    this.dashVel = f.multiplyScalar(32);
    this.dashTimer = 0.22;
    this.heal(12);
  }
}
