import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/** First-person offsets per weapon id (shared tactical rifle mesh, scaled). */
const WEAPON_PROFILE = {
  sidearm: { scale: 0.62, pos: [0.16, -0.14, -0.22], recoil: 0.012 },
  smg: { scale: 0.82, pos: [0.2, -0.17, -0.34], recoil: 0.016 },
  rifle: { scale: 1, pos: [0.22, -0.19, -0.4], recoil: 0.022 },
  shotgun: { scale: 0.92, pos: [0.21, -0.18, -0.36], recoil: 0.028 },
};

const MODEL_URL = '/models/tactical-rifle.glb';

export class WeaponViewModel {
  constructor(camera) {
    this.camera = camera;
    this.holder = new THREE.Group();
    this.holder.name = 'fpsWeaponHolder';
    camera.add(this.holder);
    this.mesh = null;
    this.loadError = null;
    this.swayPhase = 0;
    this.kick = 0;
    this.currentId = 'rifle';
  }

  async load(url = MODEL_URL) {
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      this.mesh = gltf.scene;
      this.mesh.name = 'tacticalRifleViewModel';
      // GLB built with muzzle toward +Z; FPS view along -Z
      this.mesh.rotation.set(0, Math.PI, 0);
      this.holder.add(this.mesh);
      this.applyWeapon(this.currentId);
      return this.mesh;
    } catch (err) {
      this.loadError = err;
      console.warn('[WeaponViewModel] GLB load failed, using placeholder', err);
      this.mesh = this._placeholderMesh();
      this.holder.add(this.mesh);
      this.applyWeapon(this.currentId);
      return this.mesh;
    }
  }

  _placeholderMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.1, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x2a3238, metalness: 0.4, roughness: 0.5 })
    );
    body.position.z = 0.1;
    g.add(body);
    return g;
  }

  applyWeapon(weaponId) {
    this.currentId = weaponId in WEAPON_PROFILE ? weaponId : 'rifle';
    const p = WEAPON_PROFILE[this.currentId];
    if (!this.mesh) return;
    this.mesh.scale.setScalar(p.scale);
    this.holder.position.set(p.pos[0], p.pos[1], p.pos[2]);
  }

  onFire() {
    const p = WEAPON_PROFILE[this.currentId] || WEAPON_PROFILE.rifle;
    this.kick = p.recoil;
  }

  update(dt, { moving = false, speedXZ = 0 } = {}) {
    if (!this.mesh) return;
    const bob = moving ? Math.min(1, speedXZ / 7) : 0;
    this.swayPhase += dt * (4 + bob * 8);
    const swayX = Math.sin(this.swayPhase) * 0.006 * bob;
    const swayY = Math.abs(Math.cos(this.swayPhase * 0.5)) * 0.004 * bob;
    this.kick = THREE.MathUtils.lerp(this.kick, 0, 1 - Math.pow(0.001, dt));
    this.holder.rotation.x = swayY - this.kick * 2.2;
    this.holder.rotation.z = -swayX;
    this.holder.position.y =
      (WEAPON_PROFILE[this.currentId]?.pos[1] ?? -0.19) + swayY * 0.5;
  }
}

export { MODEL_URL, WEAPON_PROFILE };
