import * as THREE from "three";

const _v = new THREE.Vector3();

/** Ray vs AABB */
function rayAABB(origin, dir, box, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  for (const axis of ["x", "y", "z"]) {
    const inv = 1 / (dir[axis] || 1e-8);
    let t0 = (box.min[axis] - origin[axis]) * inv;
    let t1 = (box.max[axis] - origin[axis]) * inv;
    if (inv < 0) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmax < tmin) return null;
  }
  return tmin;
}

/** Ray vs vertical capsule (enemy) */
function rayEnemy(origin, dir, enemy, maxDist) {
  if (!enemy.alive) return null;
  const center = enemy.getAimPoint();
  // Approximate as sphere at torso
  const oc = _v.subVectors(origin, center);
  const a = dir.dot(dir);
  const b = 2 * oc.dot(dir);
  const r = 0.55;
  const c = oc.dot(oc) - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  if (t < 0 || t > maxDist) return null;
  return t;
}

export function hitscan(origin, dir, enemies, colliders, maxDist = 80) {
  let bestT = maxDist;
  let hit = { type: "none", point: origin.clone().addScaledVector(dir, maxDist) };

  for (const c of colliders) {
    const t = rayAABB(origin, dir, c, bestT);
    if (t !== null && t < bestT) {
      bestT = t;
      hit = {
        type: "world",
        point: origin.clone().addScaledVector(dir, t),
        collider: c,
      };
    }
  }

  for (const e of enemies) {
    const t = rayEnemy(origin, dir, e, bestT);
    if (t !== null && t < bestT) {
      bestT = t;
      hit = {
        type: "enemy",
        point: origin.clone().addScaledVector(dir, t),
        enemy: e,
      };
    }
  }

  return hit;
}

export function hitscanPlayer(origin, dir, player, colliders, maxDist = 80) {
  let bestT = maxDist;
  let hitWorld = false;

  for (const c of colliders) {
    const t = rayAABB(origin, dir, c, bestT);
    if (t !== null && t < bestT) {
      bestT = t;
      hitWorld = true;
    }
  }

  // Player as sphere at camera
  const center = player.position.clone();
  const oc = _v.subVectors(origin, center);
  const a = 1;
  const b = 2 * oc.dot(dir);
  const r = 0.5;
  const c = oc.dot(oc) - r * r;
  const disc = b * b - 4 * a * c;
  if (disc >= 0) {
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t > 0 && t < bestT) {
      return { hit: true, point: origin.clone().addScaledVector(dir, t) };
    }
  }
  return { hit: false, blocked: hitWorld };
}

export function spawnMuzzleFlash(scene, origin, dir) {
  const light = new THREE.PointLight(0xffaa55, 2, 8);
  light.position.copy(origin).addScaledVector(dir, 0.4);
  scene.add(light);
  setTimeout(() => scene.remove(light), 40);
}

export function spawnTracer(scene, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const line = new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.85 })
  );
  scene.add(line);
  setTimeout(() => {
    scene.remove(line);
    geo.dispose();
    line.material.dispose();
  }, 50);
}

export function spawnImpact(scene, point) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffcc66 })
  );
  m.position.copy(point);
  scene.add(m);
  setTimeout(() => {
    scene.remove(m);
    m.geometry.dispose();
    m.material.dispose();
  }, 120);
}

export class SmokeCloud {
  constructor(scene, position, duration = 8) {
    this.scene = scene;
    this.life = duration;
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0x8899aa,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );
    this.mesh.position.copy(position);
    this.mesh.position.y = Math.max(1.5, position.y);
    scene.add(this.mesh);
    this.collider = {
      min: new THREE.Vector3(position.x - 3, 0, position.z - 3),
      max: new THREE.Vector3(position.x + 3, 4, position.z + 3),
      isSmoke: true,
    };
  }

  update(dt) {
    this.life -= dt;
    this.mesh.scale.setScalar(1 + (8 - this.life) * 0.02);
    this.mesh.material.opacity = Math.min(0.75, this.life / 3);
    return this.life > 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export function createFlashBurst(scene, position) {
  const light = new THREE.PointLight(0xffffff, 8, 20);
  light.position.copy(position);
  scene.add(light);
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffee })
  );
  ball.position.copy(position);
  scene.add(ball);
  setTimeout(() => {
    scene.remove(light);
    scene.remove(ball);
    ball.geometry.dispose();
    ball.material.dispose();
  }, 200);
}
