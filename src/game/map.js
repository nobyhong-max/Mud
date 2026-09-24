import * as THREE from 'three';

/** 裂港 Rift Dock — A/B sites, mid, attack/defend spawns */

export function buildMap(scene) {
  const colliders = [];

  const add = (w, h, d, x, y, z, color, opts = {}) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.82,
        metalness: 0.06,
        transparent: !!opts.alpha,
        opacity: opts.alpha ?? 1,
      })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = !opts.noShadow;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (!opts.noCol) {
      colliders.push({
        min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
        max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
        top: y + h / 2,
      });
    }
    return mesh;
  };

  // Floor & bounds
  add(90, 0.4, 110, 0, -0.2, 0, 0x171e27, { noShadow: true });
  add(90, 7, 1.4, 0, 3.5, -55, 0x2a3440);
  add(90, 7, 1.4, 0, 3.5, 55, 0x2a3440);
  add(1.4, 7, 110, -45, 3.5, 0, 0x2a3440);
  add(1.4, 7, 110, 45, 3.5, 0, 0x2a3440);

  // Mid choke
  add(16, 3.2, 2, -20, 1.6, 0, 0x3a4654);
  add(16, 3.2, 2, 20, 1.6, 0, 0x3a4654);
  add(5, 2.8, 10, 0, 1.4, -10, 0x3a4654);
  add(5, 2.8, 10, 0, 1.4, 10, 0x3a4654);
  add(2.5, 2, 2.5, -8, 1, 4, 0x455262);
  add(2.5, 2, 2.5, 8, 1, -4, 0x455262);

  // A site (NW platform)
  add(24, 0.55, 20, -22, 0.28, -32, 0x24352c);
  add(2.2, 2.4, 12, -33, 1.5, -32, 0x3a4654);
  add(10, 2.2, 2, -16, 1.4, -41, 0x3a4654);
  add(3.2, 2, 3.2, -14, 1.3, -28, 0x455262);
  add(3.2, 2, 3.2, -26, 1.3, -26, 0x455262);
  add(4, 1.8, 1.5, -22, 1.2, -36, 0x455262);

  // B site (NE)
  add(20, 0.55, 18, 24, 0.28, -30, 0x24302f);
  add(2.2, 2.6, 14, 33, 1.5, -30, 0x3a4654);
  add(12, 2.2, 2, 22, 1.4, -38, 0x3a4654);
  add(3, 2, 3, 18, 1.3, -26, 0x455262);
  add(3, 2, 3, 28, 1.3, -24, 0x455262);
  add(6, 2, 2, 24, 1.2, -18, 0x3a4654);

  // Attack / defend spawn pads
  add(22, 0.45, 10, 0, 0.22, 44, 0x3d1f24);
  add(22, 0.45, 10, 0, 0.22, -48, 0x1a2d3d);

  // Side lanes cover
  add(2, 2.5, 14, -34, 1.25, 12, 0x3a4654);
  add(2, 2.5, 14, 34, 1.25, 12, 0x3a4654);
  add(8, 2, 2, -28, 1, 22, 0x455262);
  add(8, 2, 2, 28, 1, 22, 0x455262);

  const siteA = new THREE.Vector3(-22, 0.6, -32);
  const siteB = new THREE.Vector3(24, 0.6, -30);
  ring(scene, siteA, 0x0fdda3, 'A 包点');
  ring(scene, siteB, 0x0fdda3, 'B 包点');

  scene.add(new THREE.HemisphereLight(0xb8c8d8, 0x1a1e24, 0.9));
  const sun = new THREE.DirectionalLight(0xfff0e0, 1.0);
  sun.position.set(18, 42, 12);
  sun.castShadow = true;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x405060, 0.32));
  scene.background = new THREE.Color(0x0c141d);
  scene.fog = new THREE.Fog(0x0c141d, 40, 120);

  return {
    colliders,
    siteA,
    siteB,
    attackSpawn: new THREE.Vector3(0, 1.6, 46),
    defendSpawn: new THREE.Vector3(0, 1.6, -50),
    botAttackSpawns: [
      new THREE.Vector3(-7, 0, 42),
      new THREE.Vector3(7, 0, 40),
      new THREE.Vector3(0, 0, 38),
    ],
    botDefendSpawns: [
      new THREE.Vector3(-20, 0.55, -30),
      new THREE.Vector3(22, 0.55, -28),
      new THREE.Vector3(0, 0, -20),
    ],
  };
}

function ring(scene, pos, color, label) {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.0, 40),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.75 })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.copy(pos);
  scene.add(mesh);

  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#0fdda3';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, 128, 42);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
  spr.position.set(pos.x, 3.4, pos.z);
  spr.scale.set(6, 1.5, 1);
  scene.add(spr);
}

export function resolveCollision(pos, radius, eyeH, colliders) {
  let grounded = pos.y <= eyeH + 0.02;
  const feet = pos.y - eyeH;

  for (const c of colliders) {
    // stand on top
    const onTop =
      feet <= c.top + 0.2 &&
      feet >= c.top - 0.35 &&
      pos.x > c.min.x - radius && pos.x < c.max.x + radius &&
      pos.z > c.min.z - radius && pos.z < c.max.z + radius &&
      pos.y >= c.top;
    if (onTop && pos.y - eyeH < c.top + 0.05) {
      pos.y = c.top + eyeH;
      grounded = true;
      continue;
    }

    if (pos.y + 0.3 < c.min.y || feet > c.max.y) continue;
    const nx = Math.max(c.min.x - radius, Math.min(pos.x, c.max.x + radius));
    const nz = Math.max(c.min.z - radius, Math.min(pos.z, c.max.z + radius));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= radius * radius) continue;
    if (d2 < 1e-8) {
      const pens = [
        pos.x - (c.min.x - radius),
        c.max.x + radius - pos.x,
        pos.z - (c.min.z - radius),
        c.max.z + radius - pos.z,
      ];
      const m = Math.min(...pens);
      const i = pens.indexOf(m);
      if (i === 0) pos.x = c.min.x - radius;
      else if (i === 1) pos.x = c.max.x + radius;
      else if (i === 2) pos.z = c.min.z - radius;
      else pos.z = c.max.z + radius;
    } else {
      const d = Math.sqrt(d2);
      pos.x += (dx / d) * (radius - d);
      pos.z += (dz / d) * (radius - d);
    }
  }

  if (pos.y < eyeH) {
    pos.y = eyeH;
    grounded = true;
  }
  pos.x = THREE.MathUtils.clamp(pos.x, -43.5, 43.5);
  pos.z = THREE.MathUtils.clamp(pos.z, -53.5, 53.5);
  return grounded;
}
