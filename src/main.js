import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';

const canvas = document.getElementById('c');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start');
const hud = document.getElementById('hud');
const hpEl = document.querySelector('#hp span');
const ammoEl = document.querySelector('#ammo span');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e1620);
scene.fog = new THREE.Fog(0x0e1620, 25, 70);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const controls = new PointerLockControls(camera, document.body);
scene.add(controls.getObject());

startBtn.addEventListener('click', () => {
  overlay.style.display = 'none';
  hud.classList.remove('hidden');
  controls.lock();
});
controls.addEventListener('unlock', () => {
  if (player.alive) {
    overlay.style.display = 'flex';
    overlay.querySelector('p').textContent = '按「点击开始」继续';
    hud.classList.add('hidden');
  }
});

scene.add(new THREE.HemisphereLight(0xb0c4d8, 0x1a1e24, 1));
const sun = new THREE.DirectionalLight(0xfff2dd, 0.9);
sun.position.set(10, 20, 8);
scene.add(sun);

const walls = [];
function box(w, h, d, x, y, z, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  );
  m.position.set(x, y, z);
  scene.add(m);
  walls.push({ min: new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2), max: new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2) });
  return m;
}

box(40, 0.4, 40, 0, -0.2, 0, 0x1a222c); // floor
box(40, 4, 0.6, 0, 2, -20, 0x2a3644);
box(40, 4, 0.6, 0, 2, 20, 0x2a3644);
box(0.6, 4, 40, -20, 2, 0, 0x2a3644);
box(0.6, 4, 40, 20, 2, 0, 0x2a3644);
box(3, 2, 3, -6, 1, -4, 0x3a4654);
box(3, 2, 3, 5, 1, 3, 0x3a4654);
box(6, 2.5, 1.5, 0, 1.25, -8, 0x3a4654);

const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; if (e.code === 'KeyR') reload(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousedown', (e) => { if (e.button === 0 && controls.isLocked) shooting = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) shooting = false; });
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const player = {
  velY: 0,
  onGround: true,
  hp: 100,
  alive: true,
  mag: 30,
  reserve: 90,
  reloading: false,
  reloadT: 0,
  fireCd: 0,
};
let shooting = false;

const bots = [];
function spawnBot(x, z) {
  const body = new THREE.Group();
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 1.1, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xff4655 })
  );
  torso.position.y = 1.05;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.45, 0.45),
    new THREE.MeshStandardMaterial({ color: 0xffccaa })
  );
  head.position.y = 1.85;
  body.add(torso, head);
  body.position.set(x, 0, z);
  scene.add(body);
  bots.push({ mesh: body, hp: 80, alive: true, t: Math.random() * Math.PI * 2, speed: 1.5 + Math.random() });
}
spawnBot(-8, -10);
spawnBot(8, -6);
spawnBot(0, -14);
spawnBot(10, 8);

const raycaster = new THREE.Raycaster();
const muzzleFlash = new THREE.PointLight(0xffaa55, 0, 8);
camera.add(muzzleFlash);
scene.add(camera);

function reload() {
  if (player.reloading || player.mag === 30 || player.reserve <= 0) return;
  player.reloading = true;
  player.reloadT = 1.4;
}

function tryShoot() {
  if (!player.alive || player.reloading || player.fireCd > 0 || player.mag <= 0) {
    if (player.mag <= 0) reload();
    return;
  }
  player.mag--;
  player.fireCd = 0.11;
  muzzleFlash.intensity = 2.5;
  ammoEl.textContent = String(player.mag);

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const targets = [];
  for (const b of bots) {
    if (!b.alive) continue;
    b.mesh.traverse((c) => { if (c.isMesh) targets.push(c); });
  }
  const hits = raycaster.intersectObjects(targets, false);
  if (hits.length) {
    const hit = hits[0];
    const bot = bots.find((b) => hit.object.parent === b.mesh || b.mesh.children.includes(hit.object));
    if (bot && bot.alive) {
      const isHead = hit.object.position.y > 1.5;
      bot.hp -= isHead ? 80 : 28;
      flashHit(hit.point, isHead);
      if (bot.hp <= 0) {
        bot.alive = false;
        bot.mesh.traverse((c) => {
          if (c.isMesh) c.material = new THREE.MeshStandardMaterial({ color: 0x333333 });
        });
        bot.mesh.position.y = -0.4;
      }
    }
  }
}

function flashHit(point, head) {
  const s = new THREE.Mesh(
    new THREE.SphereGeometry(0.08),
    new THREE.MeshBasicMaterial({ color: head ? 0xffe566 : 0xffffff })
  );
  s.position.copy(point);
  scene.add(s);
  setTimeout(() => scene.remove(s), 120);
}

function collide(pos) {
  const r = 0.35;
  for (const w of walls) {
    if (pos.y > w.max.y + 0.2 || pos.y + 1.6 < w.min.y) continue;
    const nx = Math.max(w.min.x - r, Math.min(pos.x, w.max.x + r));
    const nz = Math.max(w.min.z - r, Math.min(pos.z, w.max.z + r));
    const dx = pos.x - nx;
    const dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-8) {
      const d = Math.sqrt(d2);
      pos.x += (dx / d) * (r - d);
      pos.z += (dz / d) * (r - d);
    }
  }
  pos.x = Math.max(-19, Math.min(19, pos.x));
  pos.z = Math.max(-19, Math.min(19, pos.z));
}

const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const obj = controls.getObject();

  if (controls.isLocked && player.alive) {
    const speed = keys.ShiftLeft ? 9 : 6;
    const forward = Number(keys.KeyW) - Number(keys.KeyS);
    const strafe = Number(keys.KeyD) - Number(keys.KeyA);
    const dir = new THREE.Vector3();
    controls.getDirection(dir);
    dir.y = 0;
    dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).negate();
    const move = new THREE.Vector3()
      .addScaledVector(dir, forward)
      .addScaledVector(right, strafe);
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(speed * dt);
    obj.position.add(move);

    if (keys.Space && player.onGround) {
      player.velY = 7;
      player.onGround = false;
    }
    player.velY -= 18 * dt;
    obj.position.y += player.velY * dt;
    if (obj.position.y <= 1.6) {
      obj.position.y = 1.6;
      player.velY = 0;
      player.onGround = true;
    }
    collide(obj.position);

    if (player.reloading) {
      player.reloadT -= dt;
      if (player.reloadT <= 0) {
        const need = 30 - player.mag;
        const take = Math.min(need, player.reserve);
        player.mag += take;
        player.reserve -= take;
        player.reloading = false;
        ammoEl.textContent = String(player.mag);
      }
    }
    player.fireCd = Math.max(0, player.fireCd - dt);
    if (shooting) tryShoot();
    muzzleFlash.intensity = Math.max(0, muzzleFlash.intensity - dt * 12);

    // bots wander + weak shoot-back
    for (const b of bots) {
      if (!b.alive) continue;
      b.t += dt;
      b.mesh.position.x += Math.cos(b.t * b.speed) * 1.2 * dt;
      b.mesh.position.z += Math.sin(b.t * 0.7) * 1.2 * dt;
      b.mesh.position.x = Math.max(-18, Math.min(18, b.mesh.position.x));
      b.mesh.position.z = Math.max(-18, Math.min(18, b.mesh.position.z));
      b.mesh.lookAt(obj.position.x, 1, obj.position.z);
      if (Math.random() < 0.008) {
        const toP = obj.position.clone().sub(b.mesh.position);
        if (toP.length() < 18) {
          player.hp = Math.max(0, player.hp - 4);
          hpEl.textContent = String(player.hp);
          if (player.hp <= 0) {
            player.alive = false;
            overlay.style.display = 'flex';
            overlay.querySelector('h1').textContent = '你被击败了';
            overlay.querySelector('p').textContent = '刷新页面重来';
            startBtn.style.display = 'none';
            controls.unlock();
          }
        }
      }
    }
  }

  renderer.render(scene, camera);
}
tick();
