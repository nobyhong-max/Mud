import * as THREE from "three";

/**
 * Build collision boxes (AABB) and visual geometry for each arena.
 * Returns { group, colliders, spawns: { player, enemies }, bounds, theme }
 */

function box(w, h, d, x, y, z, color, mats) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.85,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mats.push(mesh);
  return {
    mesh,
    min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
    max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
  };
}

function floor(size, color, group) {
  const geo = new THREE.PlaneGeometry(size, size);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.95,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function wallRing(size, height, thickness, color, colliders, visuals) {
  const half = size / 2;
  const pieces = [
    [size, height, thickness, 0, height / 2, -half],
    [size, height, thickness, 0, height / 2, half],
    [thickness, height, size, -half, height / 2, 0],
    [thickness, height, size, half, height / 2, 0],
  ];
  for (const p of pieces) {
    const c = box(...p, color, visuals);
    colliders.push(c);
  }
}

export const MAPS = [
  {
    id: "yard",
    name: "YARD",
    blurb: "开阔庭院 · 掩体散落 · 暖色调",
    accent: "#c4a574",
  },
  {
    id: "corridors",
    name: "CORRIDORS",
    blurb: "工业走廊 · 狭道交火 · 冷色调",
    accent: "#4a7a8c",
  },
];

export function getMapMeta(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

export function buildMap(id) {
  if (id === "corridors") return buildCorridors();
  return buildYard();
}

function buildYard() {
  const group = new THREE.Group();
  const colliders = [];
  const visuals = [];
  const size = 56;

  floor(size, 0xb8a07a, group);
  wallRing(size, 6, 1.2, 0x8a7355, colliders, visuals);

  // Center plaza ring
  const crates = [
    [3, 2, 3, -8, 1, -6, 0x6b5344],
    [2.5, 1.5, 2.5, 10, 0.75, 4, 0x5c4636],
    [4, 2.2, 2, 0, 1.1, 12, 0x7a6248],
    [2, 3, 2, -14, 1.5, 8, 0x4e3b2c],
    [5, 1.2, 1.5, 6, 0.6, -14, 0x6e5640],
    [2, 2, 6, 16, 1, -2, 0x5a4634],
    [3, 1.8, 3, -4, 0.9, 0, 0x74583e],
    [2.2, 2.5, 2.2, 12, 1.25, 14, 0x4a3828],
  ];
  for (const c of crates) {
    colliders.push(box(...c, visuals));
  }

  // Decorative pylons
  for (const [x, z] of [
    [-20, -20],
    [20, -20],
    [-20, 20],
    [20, 20],
  ]) {
    colliders.push(box(1.5, 8, 1.5, x, 4, z, 0x9a8060, visuals));
  }

  // Mid walls / sight blockers
  colliders.push(box(10, 3, 1, -10, 1.5, 5, 0x7d6548, visuals));
  colliders.push(box(1, 3, 10, 8, 1.5, -8, 0x7d6548, visuals));

  for (const m of visuals) group.add(m.mesh ?? m);

  // Soft ambient props (non-colliding markers)
  const lightPad = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8d4a8, transparent: true, opacity: 0.25 })
  );
  lightPad.rotation.x = -Math.PI / 2;
  lightPad.position.y = 0.02;
  group.add(lightPad);

  return {
    id: "yard",
    group,
    colliders,
    spawns: {
      player: new THREE.Vector3(0, 1.7, 22),
      enemies: [
        new THREE.Vector3(-10, 1.7, -18),
        new THREE.Vector3(8, 1.7, -20),
        new THREE.Vector3(0, 1.7, -16),
      ],
    },
    bounds: size / 2 - 2,
    fogColor: 0xc9b896,
    fogNear: 28,
    fogFar: 70,
    sunColor: 0xffe2b0,
    hemiSky: 0xffe8c8,
    hemiGround: 0x6a5840,
    clearColor: 0x87a0b0,
  };
}

function buildCorridors() {
  const group = new THREE.Group();
  const colliders = [];
  const visuals = [];
  const size = 48;

  floor(size, 0x2a343c, group);
  wallRing(size, 5, 1, 0x1e2a32, colliders, visuals);

  // Cross-shaped main halls with rooms
  const walls = [
    // North block
    [18, 4, 2, 0, 2, -14, 0x314450],
    // South block
    [18, 4, 2, 0, 2, 14, 0x314450],
    // West rooms
    [2, 4, 12, -14, 2, 0, 0x2c3c48],
    [2, 4, 8, -8, 2, -8, 0x354858],
    [2, 4, 8, -8, 2, 8, 0x354858],
    // East rooms
    [2, 4, 12, 14, 2, 0, 0x2c3c48],
    [2, 4, 8, 8, 2, -8, 0x354858],
    [2, 4, 8, 8, 2, 8, 0x354858],
    // Mid cover
    [4, 2, 1.2, 0, 1, 0, 0x3d5566],
    [1.2, 2.5, 4, -4, 1.25, 4, 0x3d5566],
    [1.2, 2.5, 4, 4, 1.25, -4, 0x3d5566],
    // Doorway lips
    [6, 4, 1, -11, 2, -6, 0x243038],
    [6, 4, 1, 11, 2, 6, 0x243038],
  ];
  for (const w of walls) {
    colliders.push(box(...w, visuals));
  }

  // Ceiling strips (visual only)
  for (let i = -2; i <= 2; i++) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(2, 0.15, 40),
      new THREE.MeshStandardMaterial({
        color: 0x4ec9ff,
        emissive: 0x123848,
        roughness: 0.4,
      })
    );
    strip.position.set(i * 6, 4.7, 0);
    group.add(strip);
  }

  for (const m of visuals) group.add(m.mesh ?? m);

  return {
    id: "corridors",
    group,
    colliders,
    spawns: {
      player: new THREE.Vector3(0, 1.7, 18),
      enemies: [
        new THREE.Vector3(-12, 1.7, -10),
        new THREE.Vector3(12, 1.7, -10),
        new THREE.Vector3(0, 1.7, -16),
      ],
    },
    bounds: size / 2 - 2,
    fogColor: 0x1a2830,
    fogNear: 12,
    fogFar: 48,
    sunColor: 0xa8c8d8,
    hemiSky: 0x6a8898,
    hemiGround: 0x1a2228,
    clearColor: 0x0e181e,
  };
}

/** AABB collision for a point with radius (horizontal cylinder approx) */
export function resolveCollision(pos, radius, colliders, eyeHeight = 1.7) {
  const p = pos.clone();
  for (const c of colliders) {
    const nearest = new THREE.Vector3(
      THREE.MathUtils.clamp(p.x, c.min.x, c.max.x),
      THREE.MathUtils.clamp(p.y, c.min.y, c.max.y),
      THREE.MathUtils.clamp(p.z, c.min.z, c.max.z)
    );
    // Only collide if overlapping body height band
    const bodyY = eyeHeight * 0.5;
    if (Math.abs(nearest.y - bodyY) > eyeHeight) continue;

    const dx = p.x - nearest.x;
    const dz = p.z - nearest.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < radius * radius && distSq > 0) {
      const dist = Math.sqrt(distSq);
      const push = (radius - dist) / dist;
      p.x += dx * push;
      p.z += dz * push;
    } else if (distSq === 0 && p.x >= c.min.x && p.x <= c.max.x && p.z >= c.min.z && p.z <= c.max.z) {
      // Deep inside — push out via shortest axis
      const left = p.x - c.min.x;
      const right = c.max.x - p.x;
      const near = p.z - c.min.z;
      const far = c.max.z - p.z;
      const m = Math.min(left, right, near, far);
      if (m === left) p.x = c.min.x - radius;
      else if (m === right) p.x = c.max.x + radius;
      else if (m === near) p.z = c.min.z - radius;
      else p.z = c.max.z + radius;
    }
  }
  return p;
}
