import * as THREE from "three";
import { resolveCollision } from "./maps.js";

const COLORS = [0xff5533, 0xff8844, 0xff3355];

export class Enemy {
  constructor(spawn, index) {
    this.index = index;
    this.name = `BOT-${index + 1}`;
    this.health = 100;
    this.maxHealth = 100;
    this.alive = true;
    this.radius = 0.5;
    this.speed = 4.2 + Math.random() * 1.2;
    this.shootCd = 3.5 + Math.random();
    this.thinkTimer = 0;
    this.strafe = Math.random() > 0.5 ? 1 : -1;
    this.flashUntil = 0;

    const body = new THREE.Group();
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.2, 0.45),
      new THREE.MeshStandardMaterial({ color: COLORS[index % COLORS.length], roughness: 0.6 })
    );
    torso.position.y = 1.05;
    torso.castShadow = true;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf0d0b0, roughness: 0.7 })
    );
    head.position.y = 1.85;
    head.castShadow = true;
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.1),
      new THREE.MeshStandardMaterial({
        color: 0xff3344,
        emissive: 0x661111,
        roughness: 0.3,
      })
    );
    visor.position.set(0, 1.88, 0.22);
    body.add(torso, head, visor);
    body.position.copy(spawn);
    body.position.y = 0;
    this.mesh = body;
    this.position = body.position;
  }

  getAimPoint() {
    return new THREE.Vector3(this.position.x, 1.4, this.position.z);
  }

  update(dt, player, colliders, bounds, now) {
    if (!this.alive || !player.alive) return null;

    const blinded = now < this.flashUntil;
    this.thinkTimer -= dt;
    this.shootCd -= dt;

    const toPlayer = new THREE.Vector3().subVectors(player.position, this.position);
    toPlayer.y = 0;
    const dist = toPlayer.length();
    const dir = dist > 0.01 ? toPlayer.clone().normalize() : new THREE.Vector3(0, 0, 1);

    // Face player
    this.mesh.rotation.y = Math.atan2(dir.x, dir.z);

    if (blinded) {
      // Stumble randomly when flashed
      this.position.x += (Math.random() - 0.5) * 2 * dt;
      this.position.z += (Math.random() - 0.5) * 2 * dt;
    } else {
      const desired = dist > 14 ? 1 : dist < 7 ? -0.4 : 0.15;
      const strafe = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.strafe);
      if (this.thinkTimer <= 0) {
        this.strafe *= -1;
        this.thinkTimer = 1.2 + Math.random() * 1.5;
      }
      const move = dir.clone().multiplyScalar(desired).add(strafe.multiplyScalar(0.55));
      if (move.lengthSq() > 0) move.normalize();
      this.position.addScaledVector(move, this.speed * dt);
    }

    const resolved = resolveCollision(
      new THREE.Vector3(this.position.x, 1.0, this.position.z),
      this.radius,
      colliders,
      1.0
    );
    this.position.x = THREE.MathUtils.clamp(resolved.x, -bounds, bounds);
    this.position.z = THREE.MathUtils.clamp(resolved.z, -bounds, bounds);
    this.position.y = 0;

    // LOS check: simple distance + not too close walls — bots can shoot if in range
    if (!blinded && this.shootCd <= 0 && dist < 26 && dist > 2.5) {
      this.shootCd = 0.9 + Math.random() * 0.7;
      // Accuracy drops with distance / movement
      const spread = 0.08 + dist * 0.0035;
      const aim = player.position.clone();
      aim.y = 1.5;
      aim.x += (Math.random() - 0.5) * spread * dist;
      aim.y += (Math.random() - 0.5) * spread * dist * 0.5;
      aim.z += (Math.random() - 0.5) * spread * dist;
      const origin = this.getAimPoint();
      const shotDir = aim.sub(origin).normalize();
      return { origin, dir: shotDir, damage: 9 + Math.floor(Math.random() * 5), from: this };
    }
    return null;
  }

  takeDamage(amount) {
    if (!this.alive) return false;
    this.health -= amount;
    // Hit flash
    this.mesh.traverse((o) => {
      if (o.isMesh && o.material && o.material.emissive) {
        o.material.emissive.setHex(0x442200);
        setTimeout(() => {
          if (o.material) o.material.emissive.setHex(o.material.color.getHex() === 0xff3344 ? 0x661111 : 0x000000);
        }, 80);
      }
    });
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.mesh.visible = false;
      return true;
    }
    return false;
  }

  applyFlash(duration, now) {
    this.flashUntil = now + duration;
  }

  respawn(pos) {
    this.position.copy(pos);
    this.position.y = 0;
    this.health = this.maxHealth;
    this.alive = true;
    this.mesh.visible = true;
    this.shootCd = 3.0;
    this.flashUntil = 0;
  }
}

export function createEnemies(spawns) {
  return spawns.map((s, i) => new Enemy(s.clone(), i));
}
