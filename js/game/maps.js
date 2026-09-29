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
    nameCn: "庭院",
    blurb: "开阔场地，木箱掩体多，适合中远枪战。",
    accent: "#c4a574",
  },
  {
    id: "corridors",
    name: "CORRIDORS",
    nameCn: "走廊",
    blurb: "狭长通道，转角多，适合近距离对枪。",
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

function decoCylinder(r, h, x, y, z, color, group, emissive = null) {
  const matOpts = { color, roughness: 0.7, metalness: 0.15 };
  if (emissive != null) {
    matOpts.emissive = emissive;
    matOpts.emissiveIntensity = 0.5;
  }
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, h, 10), new THREE.MeshStandardMaterial(matOpts));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  group.add(mesh);
  return mesh;
}

function buildYard() {
  const group = new THREE.Group();
  const colliders = [];
  const visuals = [];
  const size = 56;

  floor(size, 0xb8a07a, group);
  // Checker patches for visual variety
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      if ((i + j) % 2 !== 0) continue;
      const pad = new THREE.Mesh(
        new THREE.PlaneGeometry(6, 6),
        new THREE.MeshStandardMaterial({ color: 0xa89070, roughness: 0.95 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(i * 8, 0.01, j * 8);
      group.add(pad);
    }
  }
  wallRing(size, 6, 1.2, 0x8a7355, colliders, visuals);

  const crates = [
    [3, 2, 3, -8, 1, -6, 0x6b5344],
    [2.5, 1.5, 2.5, 10, 0.75, 4, 0x5c4636],
    [4, 2.2, 2, 0, 1.1, 12, 0x7a6248],
    [2, 3, 2, -14, 1.5, 8, 0x4e3b2c],
    [5, 1.2, 1.5, 6, 0.6, -14, 0x6e5640],
    [2, 2, 6, 16, 1, -2, 0x5a4634],
    [3, 1.8, 3, -4, 0.9, 0, 0x74583e],
    [2.2, 2.5, 2.2, 12, 1.25, 14, 0x4a3828],
    [1.6, 1.2, 1.6, -18, 0.6, -8, 0x8a6a48],
    [1.8, 2.8, 1.8, 18, 1.4, 10, 0x5a4030],
    [3.5, 0.9, 2, -6, 0.45, 16, 0x7a6048],
    [2, 1.4, 4, 4, 0.7, -18, 0x6a5040],
    [1.2, 2.2, 1.2, -12, 1.1, -14, 0x9a7850],
    [2.8, 1.6, 1.4, 14, 0.8, -10, 0x4a3828],
  ];
  for (const c of crates) colliders.push(box(...c, visuals));

  // Stacked crate piles (asymmetric)
  colliders.push(box(2, 1, 2, -16, 0.5, 2, 0x6b5344, visuals));
  colliders.push(box(1.6, 1, 1.6, -16, 1.5, 2, 0x5c4636, visuals));
  colliders.push(box(2.2, 1.1, 2.2, 9, 0.55, 18, 0x7a6248, visuals));
  colliders.push(box(1.5, 1.1, 1.5, 9, 1.65, 18, 0x4e3b2c, visuals));

  // Corner pylons + mid barriers
  for (const [x, z] of [
    [-20, -20],
    [20, -20],
    [-20, 20],
    [20, 20],
    [-22, 0],
    [22, 0],
  ]) {
    colliders.push(box(1.5, 8, 1.5, x, 4, z, 0x9a8060, visuals));
  }
  colliders.push(box(10, 3, 1, -10, 1.5, 5, 0x7d6548, visuals));
  colliders.push(box(1, 3, 10, 8, 1.5, -8, 0x7d6548, visuals));
  colliders.push(box(6, 2.2, 1, 2, 1.1, -4, 0x8a7055, visuals));
  colliders.push(box(1, 2.5, 5, -2, 1.25, 8, 0x6a553f, visuals));

  // Low sandbags / ramps
  colliders.push(box(4, 0.7, 1.2, -14, 0.35, -4, 0xa08060, visuals));
  colliders.push(box(1.2, 0.7, 4, 12, 0.35, 6, 0xa08060, visuals));

  for (const m of visuals) group.add(m.mesh ?? m);

  // Non-colliding detail: drums, lamps, banners
  decoCylinder(0.55, 1.2, -5, 0.6, -12, 0x556070, group);
  decoCylinder(0.55, 1.2, -3.7, 0.6, -12.4, 0x445060, group);
  decoCylinder(0.4, 1.0, 15, 0.5, -16, 0x667788, group);
  decoCylinder(0.35, 3.2, 0, 1.6, 0, 0xc4a060, group, 0x553311);
  decoCylinder(0.25, 2.4, -18, 1.2, 14, 0xb08040, group);

  for (const [x, z] of [
    [-10, 18],
    [10, -18],
    [-18, -16],
  ]) {
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0xffe0a0, emissive: 0xaa6622, emissiveIntensity: 0.8 })
    );
    lamp.position.set(x, 3.2, z);
    group.add(lamp);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x333028 })
    );
    pole.position.set(x, 1.6, z);
    group.add(pole);
  }

  // Market awning slabs
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.15, 3),
    new THREE.MeshStandardMaterial({ color: 0xc45a3a, roughness: 0.8 })
  );
  awning.position.set(-8, 3.2, 12);
  awning.rotation.z = -0.08;
  group.add(awning);

  const lightPad = new THREE.Mesh(
    new THREE.CircleGeometry(3.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xe8d4a8, transparent: true, opacity: 0.25 })
  );
  lightPad.rotation.x = -Math.PI / 2;
  lightPad.position.y = 0.02;
  group.add(lightPad);

  // Scattered rubble bits (no collision)
  for (let i = 0; i < 18; i++) {
    const bit = new THREE.Mesh(
      new THREE.BoxGeometry(0.4 + Math.random() * 0.6, 0.2, 0.3 + Math.random() * 0.5),
      new THREE.MeshStandardMaterial({ color: 0x8a7055, roughness: 1 })
    );
    bit.position.set((Math.random() - 0.5) * 40, 0.1, (Math.random() - 0.5) * 40);
    bit.rotation.y = Math.random() * Math.PI;
    group.add(bit);
  }

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
      pvp: [new THREE.Vector3(0, 1.7, 20), new THREE.Vector3(0, 1.7, -18)],
    },
    bounds: size / 2 - 2,
    fogColor: 0xd4c4a0,
    fogNear: 40,
    fogFar: 90,
    sunColor: 0xffe2b0,
    hemiSky: 0xffe8c8,
    hemiGround: 0x6a5840,
    clearColor: 0x9ab4c4,
  };
}

function buildCorridors() {
  const group = new THREE.Group();
  const colliders = [];
  const visuals = [];
  const size = 48;

  floor(size, 0x3a4850, group);
  // Floor stripe tiles
  for (let z = -20; z <= 20; z += 4) {
    const tile = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.2),
      new THREE.MeshStandardMaterial({ color: z % 8 === 0 ? 0x2ee6a6 : 0x2a3840, roughness: 0.9 })
    );
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(0, 0.02, z);
    group.add(tile);
  }
  wallRing(size, 5, 1, 0x243038, colliders, visuals);

  const walls = [
    [14, 4, 2, -14, 2, -12, 0x4a6270],
    [14, 4, 2, 14, 2, -12, 0x4a6270],
    [14, 4, 2, -14, 2, 12, 0x4a6270],
    [14, 4, 2, 14, 2, 12, 0x4a6270],
    [2, 4, 10, -12, 2, -8, 0x3d5564],
    [2, 4, 10, -12, 2, 8, 0x3d5564],
    [2, 4, 10, 12, 2, -8, 0x3d5564],
    [2, 4, 10, 12, 2, 8, 0x3d5564],
    [3.5, 2, 1.4, -3, 1, 0, 0x5a7484],
    [3.5, 2, 1.4, 3, 1, 0, 0x5a7484],
    [1.4, 2.4, 3.5, 0, 1.2, -6, 0x5a7484],
    [1.4, 2.4, 3.5, 0, 1.2, 6, 0x5a7484],
    [2, 1.5, 2, -8, 0.75, 0, 0x6a8494],
    [2, 1.5, 2, 8, 0.75, 0, 0x6a8494],
    // Extra room clutter / pillars
    [1.2, 4, 1.2, -6, 2, -16, 0x2c3c48],
    [1.2, 4, 1.2, 6, 2, -16, 0x2c3c48],
    [1.2, 4, 1.2, -6, 2, 16, 0x2c3c48],
    [1.2, 4, 1.2, 6, 2, 16, 0x2c3c48],
    [3, 1.2, 1, -16, 0.6, -4, 0x4a6070],
    [3, 1.2, 1, 16, 0.6, 4, 0x4a6070],
    [1, 1.8, 3, -4, 0.9, -10, 0x556878],
    [1, 1.8, 3, 4, 0.9, 10, 0x556878],
    [2.5, 2, 1.2, -18, 1, 10, 0x3a4a58],
    [2.5, 2, 1.2, 18, 1, -10, 0x3a4a58],
  ];
  for (const w of walls) colliders.push(box(...w, visuals));

  for (let i = -2; i <= 2; i++) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.12, 36),
      new THREE.MeshStandardMaterial({
        color: 0x7ad4ff,
        emissive: 0x1a5068,
        emissiveIntensity: 0.8,
        roughness: 0.4,
      })
    );
    strip.position.set(i * 5, 4.7, 0);
    group.add(strip);
  }

  // Side duct pipes
  for (const x of [-10, 10]) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 28, 8),
      new THREE.MeshStandardMaterial({ color: 0x6a7a88, metalness: 0.6, roughness: 0.4 })
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(0, 3.6, x === -10 ? -18 : 18);
    group.add(pipe);
  }

  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 40),
    new THREE.MeshStandardMaterial({ color: 0x2ee6a6, transparent: true, opacity: 0.12 })
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.y = 0.03;
  group.add(lane);

  // Wall panels / warning stripes (visual)
  for (const z of [-8, 8]) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 1.2, 6),
      new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0x442200, emissiveIntensity: 0.3 })
    );
    stripe.position.set(-11.4, 1.2, z);
    group.add(stripe);
  }

  // Server racks / crates in side alcoves
  decoCylinder(0.5, 1.4, -16, 0.7, 0, 0x334455, group);
  decoCylinder(0.5, 1.8, 16, 0.9, 2, 0x445566, group);
  for (let i = 0; i < 6; i++) {
    const rack = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 2.2, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x1e2830, metalness: 0.4, roughness: 0.5 })
    );
    rack.position.set(-18 + (i % 2) * 1.4, 1.1, -14 + Math.floor(i / 2) * 1.2);
    group.add(rack);
  }

  for (const m of visuals) group.add(m.mesh ?? m);

  return {
    id: "corridors",
    group,
    colliders,
    spawns: {
      player: new THREE.Vector3(0, 1.7, 18),
      enemies: [
        new THREE.Vector3(-10, 1.7, -14),
        new THREE.Vector3(10, 1.7, -14),
        new THREE.Vector3(0, 1.7, -16),
      ],
      pvp: [new THREE.Vector3(0, 1.7, 18), new THREE.Vector3(0, 1.7, -16)],
    },
    bounds: size / 2 - 2,
    fogColor: 0x3a5060,
    fogNear: 35,
    fogFar: 75,
    sunColor: 0xd0e8f8,
    hemiSky: 0xa0c0d0,
    hemiGround: 0x3a4850,
    clearColor: 0x2a4050,
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
