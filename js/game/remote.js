import * as THREE from "three";

/** Opponent avatar for multiplayer */
export function createRemotePlayer(color = 0x4ec9ff, label = "P2") {
  const root = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.15, 0.45),
    new THREE.MeshStandardMaterial({ color, roughness: 0.55 })
  );
  torso.position.y = 1.05;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xf0d0b0, roughness: 0.7 })
  );
  head.position.y = 1.85;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.12, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x2ee6a6, emissive: 0x114422, roughness: 0.3 })
  );
  visor.position.set(0, 1.88, 0.22);
  root.add(torso, head, visor);
  root.userData.label = label;
  return {
    mesh: root,
    position: root.position,
    yaw: 0,
    health: 100,
    alive: true,
    name: label,
    getAimPoint() {
      return new THREE.Vector3(root.position.x, 1.4, root.position.z);
    },
    setPose(x, y, z, yaw) {
      root.position.set(x, 0, z);
      root.rotation.y = yaw;
      this.yaw = yaw;
    },
    takeDamage(amount) {
      if (!this.alive) return false;
      this.health -= amount;
      if (this.health <= 0) {
        this.health = 0;
        this.alive = false;
        root.visible = false;
        return true;
      }
      return false;
    },
    respawn(pos) {
      root.position.copy(pos);
      root.position.y = 0;
      this.health = 100;
      this.alive = true;
      root.visible = true;
    },
  };
}
