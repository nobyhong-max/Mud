import * as THREE from "three";

/** Procedural first-person weapon viewmodel */
export function createViewWeapon() {
  const root = new THREE.Group();
  root.name = "viewWeapon";

  const metal = new THREE.MeshStandardMaterial({
    color: 0x2a3238,
    metalness: 0.65,
    roughness: 0.35,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x2ee6a6,
    metalness: 0.4,
    roughness: 0.4,
    emissive: 0x0a3d2a,
    emissiveIntensity: 0.35,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x14181c,
    metalness: 0.5,
    roughness: 0.5,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.55), metal);
  body.position.set(0.22, -0.18, -0.45);

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.55, 10), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.22, -0.14, -0.85);

  const barrelTip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10), accent);
  barrelTip.rotation.x = Math.PI / 2;
  barrelTip.position.set(0.22, -0.14, -1.12);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.14), dark);
  grip.position.set(0.22, -0.38, -0.32);
  grip.rotation.x = 0.25;

  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.12), metal);
  mag.position.set(0.22, -0.42, -0.48);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.12), accent);
  sight.position.set(0.22, -0.04, -0.55);

  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.35), dark);
  rail.position.set(0.22, -0.06, -0.7);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.22), metal);
  stock.position.set(0.22, -0.2, -0.18);

  root.add(body, barrel, barrelTip, grip, mag, sight, rail, stock);

  // Rest pose offset (bottom-right of view)
  root.position.set(0, 0, 0);
  root.rotation.set(0.04, 0.08, 0.02);

  let kick = 0;
  return {
    root,
    kick() {
      kick = 1;
    },
    update(dt) {
      kick = Math.max(0, kick - dt * 8);
      root.position.x = 0.28;
      root.position.y = -0.32 - kick * 0.04;
      root.position.z = -0.55 - kick * 0.08;
      root.rotation.x = 0.06 + kick * 0.12;
      root.rotation.y = -0.12;
      root.rotation.z = 0.04;
    },
  };
}
