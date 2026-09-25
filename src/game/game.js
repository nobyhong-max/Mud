import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { AGENTS, ARMOR, ECONOMY, MATCH, WEAPONS } from './config.js';
import { Sfx } from './audio.js';
import { buildMap, resolveCollision } from './map.js';
import { mobilePerfProfile } from './device.js';
import { MobileControls } from './mobile.js';
import { WeaponViewModel } from './viewmodel.js';

const EYE = 1.6;
const RADIUS = 0.38;

export class Game {
  constructor() {
    this.sfx = new Sfx();
    this.keys = {};
    this.shooting = false;
    this.holdingF = false;
    this.selectedAgent = 'flashwind';
    this.playerSide = 'attack';
    this.phase = 'menu'; // menu | buy | action | end
    this.effects = [];
    this.bots = [];
    this.spike = null;
    this.lossStreak = 0;
    this.score = { attack: 0, defend: 0 };
    this.round = 1;
    this.phaseT = 0;
    this.holdT = 0;
    this.holdMax = 0;
    this.toastT = 0;
    this.perf = mobilePerfProfile();
    this.mobileMode = this.perf.mobile;
    this.touchPlaying = false;
    this.touchMove = { x: 0, y: 0 };
    this.touchSprint = false;
    this.touchJump = false;

    this._bindDom();
    this._initThree();
    this.map = buildMap(this.scene, { shadows: this.perf.shadows });
    this._bindInput();
    this._buildShop();
    this.clock = new THREE.Clock();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);

    document.documentElement.classList.toggle('mobile-ui', this.mobileMode);
    const hint = document.getElementById('menu-controls-hint');
    if (hint && this.mobileMode) {
      hint.innerHTML =
        '左摇杆移动 · 右侧滑动瞄准 · 开火 / 换弹 / 跳 / 冲刺<br />技能与「互动」安放拆除 · 可「添加到主屏幕」全屏游玩';
    }
    const buyHelp = document.getElementById('buy-help');
    if (buyHelp && this.mobileMode) {
      buyHelp.innerHTML = '信用点 <b id="buy-cr">800</b> · 点选购买，倒计时结束自动锁定';
      this.el.buyCr = document.getElementById('buy-cr');
    }
  }

  _bindDom() {
    this.el = {
      menu: document.getElementById('menu'),
      buy: document.getElementById('buy'),
      roundEnd: document.getElementById('round-end'),
      hud: document.getElementById('hud'),
      cross: document.getElementById('crosshair'),
      pause: document.getElementById('pause-hint'),
      hitmark: document.getElementById('hitmark'),
      hpFill: document.getElementById('hp-fill'),
      arFill: document.getElementById('ar-fill'),
      hpText: document.getElementById('hp-text'),
      arText: document.getElementById('ar-text'),
      ammo: document.getElementById('ammo-text'),
      gun: document.getElementById('gun-name'),
      cr: document.getElementById('cr-text'),
      buyCr: document.getElementById('buy-cr'),
      buyTimer: document.getElementById('buy-timer'),
      scoreAtk: document.getElementById('score-atk'),
      scoreDef: document.getElementById('score-def'),
      roundN: document.getElementById('round-n'),
      phase: document.getElementById('phase'),
      timer: document.getElementById('timer'),
      obj: document.getElementById('obj-hint'),
      toast: document.getElementById('toast'),
      feed: document.getElementById('killfeed'),
      hold: document.getElementById('hold-bar'),
      holdFill: document.getElementById('hold-fill'),
      holdLabel: document.getElementById('hold-label'),
      abQ: document.getElementById('ab-q'),
      abE: document.getElementById('ab-e'),
      abC: document.getElementById('ab-c'),
      abX: document.getElementById('ab-x'),
      cdQ: document.getElementById('cd-q'),
      cdE: document.getElementById('cd-e'),
      cdC: document.getElementById('cd-c'),
      ultFill: document.getElementById('ult-fill'),
      reTitle: document.getElementById('re-title'),
      reDetail: document.getElementById('re-detail'),
    };

    document.querySelectorAll('.agent').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.agent').forEach((b) => b.classList.remove('on'));
        btn.classList.add('on');
        this.selectedAgent = btn.dataset.id;
      });
    });
    document.getElementById('btn-play').addEventListener('click', () => {
      this.playerSide = document.querySelector('input[name="side"]:checked').value;
      this.startMatch();
    });
    document.getElementById('btn-lock').addEventListener('click', () => this.endBuy());
    document.getElementById('btn-next').addEventListener('click', () => this.nextRound());
    document.getElementById('btn-menu').addEventListener('click', () => this.toMenu());
  }

  _initThree() {
    this.canvas = document.getElementById('c');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(78, innerWidth / innerHeight, 0.08, 160);
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: this.perf.antialias,
      powerPreference: this.mobileMode ? 'low-power' : 'high-performance',
    });
    this._applyRendererSize();
    this.renderer.shadowMap.enabled = this.perf.shadows;
    this.controls = new PointerLockControls(this.camera, document.body);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.playerObject());
    this.muzzle = new THREE.PointLight(0xffaa55, 0, 10);
    this.muzzle.position.set(0.05, -0.05, -0.55);
    this.camera.add(this.muzzle);
    this.viewModel = new WeaponViewModel(this.camera);
    void this.viewModel.load();
    this.scene.add(this.camera);
    this.ray = new THREE.Raycaster();
    this.spikeMesh = null;
    this.plantedMesh = null;

    this.controls.addEventListener('unlock', () => {
      if (this.mobileMode) return;
      if (this.phase === 'action' && this.player?.alive) {
        this.el.pause.classList.remove('hidden');
      }
    });
    this.controls.addEventListener('lock', () => {
      this.el.pause.classList.add('hidden');
    });
    addEventListener('resize', () => this._applyRendererSize());
    addEventListener('orientationchange', () => setTimeout(() => this._applyRendererSize(), 120));
  }

  _applyRendererSize() {
    const w = innerWidth;
    const h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.perf.pixelRatioCap));
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
  }

  playerObject() {
    return this.controls.object ?? this.controls.getObject();
  }

  /** Desktop pointer-lock OR mobile touch session */
  isControlActive() {
    if (this.mobileMode) return this.touchPlaying && this.phase === 'action';
    return this.controls.isLocked;
  }

  engageControls() {
    if (this.mobileMode) {
      this.touchPlaying = true;
      this.mobile?.setVisible(true);
      this.el.pause.classList.add('hidden');
      return;
    }
    this.controls.lock();
  }

  releaseControls() {
    this.touchPlaying = false;
    this.mobile?.setVisible(false);
    this.shooting = false;
    this.holdingF = false;
    this.touchSprint = false;
    this.touchJump = false;
    this.touchMove = { x: 0, y: 0 };
    try { this.controls.unlock(); } catch { /* noop */ }
  }

  applyLook(dx, dy) {
    const cam = this.camera;
    cam.rotation.order = 'YXZ';
    cam.rotation.y -= dx;
    cam.rotation.x -= dy;
    const lim = Math.PI / 2 - 0.02;
    cam.rotation.x = Math.max(-lim, Math.min(lim, cam.rotation.x));
  }

  _bindInput() {
    this.mobile = new MobileControls({
      onLook: (dx, dy) => {
        if (this.isControlActive()) this.applyLook(dx, dy);
      },
      onFire: (on) => {
        if (!this.isControlActive()) return;
        this.shooting = on;
      },
      onReload: () => {
        if (this.phase === 'action' && this.isControlActive()) this.reload();
      },
      onJump: (down) => {
        this.touchJump = down;
        this.keys.Space = down;
      },
      onSprint: (down) => {
        this.touchSprint = down;
        this.keys.ShiftLeft = down;
      },
      onAbility: (slot) => {
        if (this.phase === 'action' && this.isControlActive()) this.cast(slot);
      },
      onInteract: (down) => {
        this.holdingF = down;
        if (!down) {
          this.holdT = 0;
          this.el.hold.classList.add('hidden');
        }
      },
      onBuy: () => {
        if (this.phase === 'buy') this.toggleBuyPanel();
      },
    });
    this.mobile.setVisible(false);

    // Sync joystick axes into movement each frame via touchMove
    const syncMove = () => {
      if (this.mobileMode && this.mobile) {
        this.touchMove.x = this.mobile.move.x;
        this.touchMove.y = this.mobile.move.y;
      }
      requestAnimationFrame(syncMove);
    };
    requestAnimationFrame(syncMove);

    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code === 'KeyR' && this.phase === 'action') this.reload();
      if (e.code === 'KeyB' && this.phase === 'buy') this.toggleBuyPanel();
      if (e.code === 'KeyQ' && this.phase === 'action') this.cast('q');
      if (e.code === 'KeyE' && this.phase === 'action') this.cast('e');
      if (e.code === 'KeyC' && this.phase === 'action') this.cast('c');
      if (e.code === 'KeyX' && this.phase === 'action') this.cast('x');
      if (e.code === 'KeyF') this.holdingF = true;
    });
    addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyF') {
        this.holdingF = false;
        this.holdT = 0;
        this.el.hold.classList.add('hidden');
      }
    });
    addEventListener('mousedown', (e) => {
      if (this.mobileMode) return;
      if (e.button === 0) {
        if (!this.controls.isLocked && this.phase === 'action') {
          this.controls.lock();
          return;
        }
        if (this.controls.isLocked) this.shooting = true;
      }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.shooting = false;
    });

    // Mobile: tap canvas / resume hint to resume
    const resume = () => {
      if (this.mobileMode && this.phase === 'action' && this.player?.alive && !this.touchPlaying) {
        this.engageControls();
      }
    };
    this.el.pause?.addEventListener('click', resume);
    this.el.pause?.addEventListener('touchend', (e) => {
      e.preventDefault();
      resume();
    }, { passive: false });

    // Prevent pull-to-refresh / page scroll during play
    document.body.addEventListener('touchmove', (e) => {
      if (this.phase === 'action' && this.touchPlaying) e.preventDefault();
    }, { passive: false });
  }

  _buildShop() {
    const guns = document.getElementById('shop-guns');
    const armor = document.getElementById('shop-armor');
    guns.innerHTML = '';
    armor.innerHTML = '';
    for (const w of Object.values(WEAPONS)) {
      const b = document.createElement('button');
      b.className = 'shop-item';
      b.dataset.gun = w.id;
      b.innerHTML = `<strong>${w.name}</strong><div class="price">${w.price ? w.price + ' CR' : '免费'}</div>`;
      b.addEventListener('click', () => this.buyGun(w.id));
      guns.appendChild(b);
    }
    for (const a of Object.values(ARMOR)) {
      if (a.id === 'none') continue;
      const b = document.createElement('button');
      b.className = 'shop-item';
      b.dataset.armor = a.id;
      b.innerHTML = `<strong>${a.name}</strong><div class="price">${a.price} CR · ${a.value} 护甲</div>`;
      b.addEventListener('click', () => this.buyArmor(a.id));
      armor.appendChild(b);
    }
  }

  toMenu() {
    this.phase = 'menu';
    this.el.roundEnd.classList.add('hidden');
    this.el.buy.classList.add('hidden');
    this.el.hud.classList.add('hidden');
    this.el.cross.classList.add('hidden');
    this.el.menu.classList.remove('hidden');
    this.releaseControls();
  }

  startMatch() {
    this.score = { attack: 0, defend: 0 };
    this.round = 1;
    this.lossStreak = 0;
    this.credits = ECONOMY.start;
    this.el.menu.classList.add('hidden');
    this.beginBuy();
  }

  beginBuy() {
    this.phase = 'buy';
    this.phaseT = MATCH.buySeconds;
    this.clearCombatEntities();
    this.setupPlayerLoadout();
    this.spawnActors();
    this.resetSpike();
    this.el.buy.classList.remove('hidden');
    this.el.roundEnd.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
    this.el.cross.classList.add('hidden');
    this.el.pause.classList.add('hidden');
    this.refreshShop();
    this.showToast('购买阶段');
    this.updateHud();
    this.mobile?.setVisible(false);
    this.touchPlaying = false;
  }

  toggleBuyPanel() {
    this.el.buy.classList.toggle('hidden');
  }

  endBuy() {
    if (this.phase !== 'buy') return;
    this.el.buy.classList.add('hidden');
    this.startAction();
  }

  startAction() {
    this.phase = 'action';
    this.phaseT = MATCH.actionSeconds;
    this.el.cross.classList.remove('hidden');
    this.el.hud.classList.remove('hidden');
    this.showToast(this.playerSide === 'attack' ? '进攻开始' : '防守开始');
    this.engageControls();
    if (this.mobileMode) {
      this.el.pause.textContent = '点按继续操作';
    }
    this.updateHud();
  }

  setupPlayerLoadout() {
    const agent = AGENTS[this.selectedAgent];
    const gun = WEAPONS.sidearm;
    this.player = {
      alive: true,
      hp: 100,
      armor: 0,
      armorId: 'none',
      weaponId: 'sidearm',
      weapon: { ...gun },
      mag: gun.magSize,
      reserve: gun.reserve,
      bloom: gun.bloomBase,
      reloading: false,
      reloadT: 0,
      fireCd: 0,
      velY: 0,
      onGround: true,
      moving: false,
      speedXZ: 0,
      agentId: agent.id,
      cds: { q: 0, e: 0, c: 0 },
      ult: 0,
      ultNeed: agent.x.cost,
      dmgBuff: 0,
      blind: 0,
      hasSpike: this.playerSide === 'attack',
      side: this.playerSide,
      stepT: 0,
    };
    this.applyAgentLabels();
    this.viewModel?.applyWeapon(this.player.weaponId);
    const spawn = this.playerSide === 'attack' ? this.map.attackSpawn : this.map.defendSpawn;
    this.playerObject().position.copy(spawn);
  }

  applyAgentLabels() {
    const a = AGENTS[this.player.agentId];
    this.el.abQ.textContent = a.q.name;
    this.el.abE.textContent = a.e.name;
    this.el.abC.textContent = a.c.name;
    this.el.abX.textContent = a.x.name;
    const mq = document.getElementById('mc-q');
    const me = document.getElementById('mc-e');
    const mc = document.getElementById('mc-c');
    const mx = document.getElementById('mc-x');
    if (mq) mq.textContent = a.q.name;
    if (me) me.textContent = a.e.name;
    if (mc) mc.textContent = a.c.name;
    if (mx) mx.textContent = a.x.name;
  }

  buyGun(id) {
    const w = WEAPONS[id];
    if (!w || this.phase !== 'buy') return;
    if (this.player.weaponId === id) return;
    const cost = w.price;
    // refund previous paid weapon partially (full refund for simplicity in buy phase)
    const prev = WEAPONS[this.player.weaponId];
    let cr = this.credits + (prev?.price || 0);
    if (cr < cost) return;
    this.credits = cr - cost;
    this.player.weaponId = id;
    this.player.weapon = { ...w };
    this.player.mag = w.magSize;
    this.player.reserve = w.reserve;
    this.viewModel?.applyWeapon(id);
    this.sfx.buy();
    this.refreshShop();
    this.updateHud();
  }

  buyArmor(id) {
    const a = ARMOR[id];
    if (!a || this.phase !== 'buy') return;
    const prev = ARMOR[this.player.armorId] || ARMOR.none;
    let cr = this.credits + prev.price;
    if (cr < a.price) return;
    this.credits = cr - a.price;
    this.player.armorId = id;
    this.player.armor = a.value;
    this.sfx.buy();
    this.refreshShop();
    this.updateHud();
  }

  refreshShop() {
    this.el.buyCr.textContent = String(this.credits);
    document.querySelectorAll('#shop-guns .shop-item').forEach((b) => {
      const w = WEAPONS[b.dataset.gun];
      const prev = WEAPONS[this.player.weaponId];
      const afford = this.credits + (prev?.price || 0) >= w.price;
      b.classList.toggle('owned', this.player.weaponId === w.id);
      b.classList.toggle('disabled', !afford && this.player.weaponId !== w.id);
    });
    document.querySelectorAll('#shop-armor .shop-item').forEach((b) => {
      const a = ARMOR[b.dataset.armor];
      const prev = ARMOR[this.player.armorId] || ARMOR.none;
      const afford = this.credits + prev.price >= a.price;
      b.classList.toggle('owned', this.player.armorId === a.id);
      b.classList.toggle('disabled', !afford && this.player.armorId !== a.id);
    });
  }

  clearCombatEntities() {
    for (const b of this.bots) this.scene.remove(b.mesh);
    this.bots = [];
    for (const e of this.effects) if (e.mesh) this.scene.remove(e.mesh);
    this.effects = [];
    if (this.spikeMesh) { this.scene.remove(this.spikeMesh); this.spikeMesh = null; }
    if (this.plantedMesh) { this.scene.remove(this.plantedMesh); this.plantedMesh = null; }
  }

  spawnActors() {
    const enemySide = this.playerSide === 'attack' ? 'defend' : 'attack';
    const spawns = enemySide === 'attack' ? this.map.botAttackSpawns : this.map.botDefendSpawns;
    const color = enemySide === 'attack' ? 0xff4655 : 0x1c9eff;
    const n = 3;
    for (let i = 0; i < n; i++) {
      const p = spawns[i % spawns.length].clone();
      p.x += (Math.random() - 0.5) * 2;
      this.bots.push(this._makeBot(p, enemySide, color, i));
    }
  }

  _makeBot(pos, side, color, idx) {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.15, 0.45),
      new THREE.MeshStandardMaterial({ color })
    );
    torso.position.y = 1.05;
    torso.castShadow = this.perf.shadows;
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.42, 0.42),
      new THREE.MeshStandardMaterial({ color: 0xffd2b3 })
    );
    head.position.y = 1.82;
    head.name = 'head';
    g.add(torso, head);
    g.position.copy(pos);
    this.scene.add(g);
    const sites = [this.map.siteA, this.map.siteB];
    return {
      mesh: g,
      torso,
      head,
      side,
      hp: 100,
      armor: 25,
      alive: true,
      fireCd: 0.5 + Math.random(),
      think: Math.random() * 2,
      targetSite: sites[idx % 2].clone(),
      blind: 0,
      hasSpike: side === 'attack' && idx === 0 && this.playerSide === 'defend',
      plantT: 0,
      defuseT: 0,
      name: side === 'attack' ? `进攻机甲${idx + 1}` : `防守机甲${idx + 1}`,
    };
  }

  resetSpike() {
    this.spike = {
      state: 'carried', // carried | dropped | planted | exploded | defused
      holder: this.playerSide === 'attack' ? 'player' : null,
      pos: new THREE.Vector3(),
      timer: 0,
    };
    // If player defends, first attack bot carries
    if (this.playerSide === 'defend') {
      const carrier = this.bots.find((b) => b.hasSpike);
      if (carrier) {
        this.spike.holder = carrier;
      }
    }
    this._syncSpikeMesh();
  }

  _syncSpikeMesh() {
    if (this.spikeMesh) { this.scene.remove(this.spikeMesh); this.spikeMesh = null; }
    if (this.plantedMesh) { this.scene.remove(this.plantedMesh); this.plantedMesh = null; }
    if (this.spike.state === 'dropped') {
      this.spikeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.35, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xff4655, emissive: 0x661010 })
      );
      this.spikeMesh.position.copy(this.spike.pos);
      this.spikeMesh.position.y = 0.25;
      this.scene.add(this.spikeMesh);
    }
    if (this.spike.state === 'planted') {
      this.plantedMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.45, 0.5, 10),
        new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0xaa0000 })
      );
      this.plantedMesh.position.copy(this.spike.pos);
      this.plantedMesh.position.y = 0.35;
      this.scene.add(this.plantedMesh);
    }
  }

  // ——— Abilities ———
  cast(slot) {
    if (!this.player?.alive || !this.isControlActive()) return;
    const a = AGENTS[this.player.agentId];
    if (slot === 'x') {
      if (this.player.ult < this.player.ultNeed) return;
      this.player.ult = 0;
      this.sfx.ability();
      if (a.id === 'flashwind') {
        this._dash(14);
        this.player.dmgBuff = 3;
        this.showToast('破锋！');
      } else {
        this._spawnHaze(this._aimPoint(18), 8, 14);
        this.showToast('天幕！');
      }
      this.updateHud();
      return;
    }
    const def = a[slot];
    if (!def || this.player.cds[slot] > 0) return;
    this.player.cds[slot] = def.cd;
    this.sfx.ability();
    if (a.id === 'flashwind') {
      if (slot === 'q') this._dash(8);
      if (slot === 'e') this._flash();
      if (slot === 'c') {
        this.player.velY = 9;
        this.player.onGround = false;
      }
    } else {
      if (slot === 'q') this._fogWall();
      if (slot === 'e') this._flame();
      if (slot === 'c') this._spawnHaze(this._aimPoint(16), 4.5, 12);
    }
    this.updateHud();
  }

  _dash(dist) {
    const dir = new THREE.Vector3();
    this.controls.getDirection(dir);
    dir.y = 0; dir.normalize();
    const obj = this.playerObject();
    obj.position.addScaledVector(dir, dist);
    resolveCollision(obj.position, RADIUS, EYE, this.map.colliders);
  }

  _flash() {
    const dir = new THREE.Vector3();
    this.controls.getDirection(dir);
    const origin = this.playerObject().position.clone();
    for (const b of this.bots) {
      if (!b.alive) continue;
      const to = b.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(origin);
      if (to.length() > 16) continue;
      to.normalize();
      if (dir.dot(to) > 0.55) {
        b.blind = 1.8;
        this.feed(`${AGENTS[this.player.agentId].name} 耀光致盲 ${b.name}`);
      }
    }
    // visual burst
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.4),
      new THREE.MeshBasicMaterial({ color: 0xffffee })
    );
    s.position.copy(origin).addScaledVector(dir, 2);
    this.scene.add(s);
    this.effects.push({ mesh: s, life: 0.25, kind: 'flash' });
  }

  _fogWall() {
    const dir = new THREE.Vector3();
    this.controls.getDirection(dir);
    dir.y = 0; dir.normalize();
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const base = this.playerObject().position.clone().addScaledVector(dir, 6);
    base.y = 1.6;
    const g = new THREE.Group();
    g.position.copy(base);
    for (let i = -3; i <= 3; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 3.2, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x8899aa, transparent: true, opacity: 0.72 })
      );
      m.position.copy(right.clone().multiplyScalar(i * 1.35));
      g.add(m);
    }
    this.scene.add(g);
    this.effects.push({ mesh: g, life: 10, kind: 'smoke', blocks: true, radius: 6 });
  }

  _flame() {
    const p = this._aimPoint(14);
    p.y = 0.2;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(5, 2.2, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xff6633, emissive: 0xaa2200, transparent: true, opacity: 0.85 })
    );
    const dir = new THREE.Vector3();
    this.controls.getDirection(dir);
    m.position.copy(p);
    m.position.y = 1.1;
    m.lookAt(p.clone().add(dir));
    this.scene.add(m);
    this.effects.push({ mesh: m, life: 8, kind: 'flame', dps: 22, radius: 3.2 });
  }

  _spawnHaze(pos, radius, life) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x667788, transparent: true, opacity: 0.55 })
    );
    m.position.copy(pos);
    m.position.y = Math.max(1.5, pos.y);
    this.scene.add(m);
    this.effects.push({ mesh: m, life, kind: 'smoke', blocks: true, radius });
  }

  _isViewModelMesh(object) {
    let o = object;
    while (o) {
      if (o === this.camera) return true;
      o = o.parent;
    }
    return false;
  }

  _aimPoint(maxDist) {
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hit = this.ray.intersectObjects(this.scene.children, true).find((h) => {
      return h.object.isMesh && !this._isViewModelMesh(h.object);
    });
    if (hit && hit.distance < maxDist) return hit.point.clone();
    return this.ray.ray.origin.clone().addScaledVector(this.ray.ray.direction, maxDist);
  }

  // ——— Combat ———
  reload() {
    const p = this.player;
    if (!p?.alive || p.reloading || p.mag >= p.weapon.magSize || p.reserve <= 0) return;
    p.reloading = true;
    p.reloadT = p.weapon.reloadTime;
    this.sfx.reload();
  }

  tryShoot() {
    const p = this.player;
    if (!p?.alive || p.reloading || p.fireCd > 0) return;
    if (p.mag <= 0) { this.reload(); return; }
    p.mag--;
    p.fireCd = 1 / p.weapon.fireRate;
    this.sfx.shoot();
    this.muzzle.intensity = 3;
    this.viewModel?.onFire();

    const pellets = p.weapon.pellets || 1;
    let anyHit = false;
    let head = false;
    for (let i = 0; i < pellets; i++) {
      const bloom = p.bloom * (p.moving ? p.weapon.moveBloom : 1);
      const ox = (Math.random() - 0.5) * bloom * 2;
      const oy = (Math.random() - 0.5) * bloom * 2;
      this.ray.setFromCamera(new THREE.Vector2(ox, oy), this.camera);
      // block by smoke approx: shorten if smoke between
      const targets = [];
      for (const b of this.bots) {
        if (!b.alive) continue;
        targets.push(b.torso, b.head);
      }
      const hits = this.ray.intersectObjects(targets, false);
      if (!hits.length) continue;
      const hit = hits[0];
      if (this._blockedBySmoke(this.ray.ray.origin, hit.point)) continue;
      const bot = this.bots.find((b) => b.torso === hit.object || b.head === hit.object);
      if (!bot) continue;
      const isHead = hit.object === bot.head;
      let dmg = p.weapon.damage * (isHead ? p.weapon.headMult : 1);
      if (p.dmgBuff > 0) dmg *= 1.15;
      this.applyDamage(bot, dmg, isHead);
      this.spark(hit.point, isHead);
      anyHit = true;
      head = head || isHead;
    }
    p.bloom = Math.min(p.weapon.bloomMax, p.bloom + p.weapon.bloomShot);
    // recoil kick
    this.camera.rotation.x -= p.weapon.recoil * (0.7 + Math.random() * 0.6);

    if (anyHit) {
      this.sfx[head ? 'head' : 'hit']();
      this.el.hitmark.className = head ? 'on head' : 'on';
      clearTimeout(this._hm);
      this._hm = setTimeout(() => { this.el.hitmark.className = ''; }, 90);
    }
    this.updateHud();
  }

  _blockedBySmoke(from, to) {
    for (const e of this.effects) {
      if (e.kind !== 'smoke' || !e.mesh) continue;
      const r = e.radius || 4.5;
      for (let t = 0.2; t <= 0.9; t += 0.2) {
        const mid = from.clone().lerp(to, t);
        if (e.mesh.position.distanceTo(mid) < r) return true;
      }
    }
    return false;
  }

  applyDamage(bot, dmg, isHead) {
    if (!bot.alive) return;
    let remain = dmg;
    if (bot.armor > 0) {
      const absorbed = Math.min(bot.armor, remain * 0.66);
      bot.armor -= absorbed;
      remain -= absorbed;
      remain *= 0.85;
    }
    bot.hp -= remain;
    if (bot.hp <= 0) {
      bot.alive = false;
      bot.hp = 0;
      bot.mesh.traverse((c) => {
        if (c.isMesh) c.material = new THREE.MeshStandardMaterial({ color: 0x333333 });
      });
      bot.mesh.position.y -= 0.35;
      this.credits = Math.min(ECONOMY.max, this.credits + ECONOMY.kill);
      this.player.ult = Math.min(this.player.ultNeed, this.player.ult + 1);
      this.feed(`你 击杀 ${bot.name}${isHead ? '（爆头）' : ''}`);
      this.sfx.death();
      if (bot.hasSpike && this.spike.state === 'carried') {
        this.spike.state = 'dropped';
        this.spike.holder = null;
        this.spike.pos.copy(bot.mesh.position);
        this.spike.pos.y = 0.25;
        bot.hasSpike = false;
        this._syncSpikeMesh();
        this.showToast('爆弹器已掉落');
      }
      this.checkElim();
    }
  }

  hurtPlayer(dmg) {
    const p = this.player;
    if (!p.alive) return;
    let remain = dmg;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, remain * 0.66);
      p.armor -= absorbed;
      remain -= absorbed * 0.5;
    }
    p.hp = Math.max(0, p.hp - remain);
    this.updateHud();
    if (p.hp <= 0) {
      p.alive = false;
      this.sfx.death();
      this.feed('你 阵亡');
      this.showToast('阵亡 — 观战中');
      if (p.hasSpike) {
        p.hasSpike = false;
        this.spike.state = 'dropped';
        this.spike.holder = null;
        this.spike.pos.copy(this.playerObject().position);
        this.spike.pos.y = 0.25;
        this._syncSpikeMesh();
      }
      this.checkElim();
    }
  }

  spark(point, head) {
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.07),
      new THREE.MeshBasicMaterial({ color: head ? 0xffe566 : 0xffffff })
    );
    s.position.copy(point);
    this.scene.add(s);
    this.effects.push({ mesh: s, life: 0.12, kind: 'spark' });
  }

  checkElim() {
    if (this.phase !== 'action') return;
    if (this.spike.state === 'planted') return; // plant round continues
    const enemiesAlive = this.bots.some((b) => b.alive);
    if (!enemiesAlive) {
      this.endRound(this.playerSide, '全歼敌人');
      return;
    }
    if (!this.player.alive) {
      const alliesPlanting =
        this.playerSide === 'attack' &&
        (this.spike.state === 'planted' || this.bots.some((b) => b.side === 'attack' && b.alive && b.hasSpike));
      if (this.playerSide === 'attack' && this.spike.state !== 'planted' && !alliesPlanting) {
        // Solo attack: player death with no spike plant path ends round
        if (!this.bots.some((b) => b.side === 'attack' && b.alive)) {
          this.endRound('defend', '进攻方全灭');
        } else if (this.spike.state === 'dropped' || this.spike.state === 'carried') {
          // only player was attacker — bots are defenders when player attacks
          this.endRound('defend', '进攻方全灭');
        }
      }
      // When player defends and dies, attack bots continue toward plant
    }
  }

  // ——— Spike interactions ———
  updateSpike(dt) {
    const p = this.player;
    const pos = this.playerObject().position;

    if (this.spike.state === 'planted') {
      this.spike.timer -= dt;
      if (this.spike.timer <= 0) {
        this.sfx.explode();
        this.endRound('attack', '爆弹器爆炸');
        return;
      }
    }

    if (!p?.alive || this.phase !== 'action') {
      this._botSpikeLogic(dt);
      return;
    }

    // pickup
    if (this.spike.state === 'dropped' && p.side === 'attack' && pos.distanceTo(this.spike.pos) < 2.2) {
      if (this.holdingF) {
        p.hasSpike = true;
        this.spike.state = 'carried';
        this.spike.holder = 'player';
        this._syncSpikeMesh();
        this.showToast('已拾取爆弹器');
        this.sfx.plant();
      }
    }

    // plant
    if (p.side === 'attack' && p.hasSpike && this.spike.state === 'carried') {
      const nearA = pos.distanceTo(this.map.siteA) < MATCH.plantRadius;
      const nearB = pos.distanceTo(this.map.siteB) < MATCH.plantRadius;
      if (nearA || nearB) {
        this.el.obj.classList.remove('hidden');
        this.el.obj.textContent = '按住 F 安放爆弹器';
        if (this.holdingF && p.onGround && !p.moving) {
          this.holdMax = MATCH.plantHold;
          this.holdT += dt;
          this.el.hold.classList.remove('hidden');
          this.el.holdLabel.textContent = '安放中…';
          this.el.holdFill.style.width = `${(this.holdT / this.holdMax) * 100}%`;
          if (this.holdT >= this.holdMax) {
            this.plantSpike(nearA ? this.map.siteA : this.map.siteB);
          }
        } else {
          this.holdT = 0;
          this.el.hold.classList.add('hidden');
        }
      } else {
        this.el.obj.classList.remove('hidden');
        this.el.obj.textContent = '前往 A / B 包点安放爆弹器';
      }
    } else if (p.side === 'defend' && this.spike.state === 'planted') {
      if (pos.distanceTo(this.spike.pos) < MATCH.defuseRadius) {
        this.el.obj.classList.remove('hidden');
        this.el.obj.textContent = '按住 F 拆除爆弹器';
        if (this.holdingF && p.onGround) {
          this.holdMax = MATCH.defuseHold;
          this.holdT += dt;
          this.el.hold.classList.remove('hidden');
          this.el.holdLabel.textContent = '拆除中…';
          this.el.holdFill.style.width = `${(this.holdT / this.holdMax) * 100}%`;
          if (this.holdT >= this.holdMax) {
            this.defuseSpike();
          }
        } else {
          this.holdT = 0;
          this.el.hold.classList.add('hidden');
        }
      } else {
        this.el.obj.classList.remove('hidden');
        this.el.obj.textContent = `爆弹器已安放 · 爆炸倒计时 ${Math.ceil(this.spike.timer)}s`;
      }
    } else if (p.side === 'defend') {
      this.el.obj.classList.remove('hidden');
      this.el.obj.textContent = '阻止进攻方在 A / B 安放';
    } else if (this.spike.state === 'planted' && p.side === 'attack') {
      this.el.obj.classList.remove('hidden');
      this.el.obj.textContent = `守护爆弹器 · ${Math.ceil(this.spike.timer)}s`;
    } else if (this.spike.state === 'dropped' && p.side === 'attack') {
      this.el.obj.classList.remove('hidden');
      this.el.obj.textContent = '靠近掉落的爆弹器并按 F 拾取';
    } else {
      this.el.obj.classList.add('hidden');
    }

    this._botSpikeLogic(dt);
  }

  plantSpike(site) {
    this.player.hasSpike = false;
    this.spike.state = 'planted';
    this.spike.holder = null;
    this.spike.pos.copy(site);
    this.spike.timer = MATCH.explodeSeconds;
    this.credits = Math.min(ECONOMY.max, this.credits + ECONOMY.plant);
    this.player.ult = Math.min(this.player.ultNeed, this.player.ult + 1);
    this.holdT = 0;
    this.el.hold.classList.add('hidden');
    this._syncSpikeMesh();
    this.sfx.plant();
    this.showToast('爆弹器已安放！');
    this.feed('爆弹器安放');
  }

  defuseSpike() {
    this.spike.state = 'defused';
    this.credits = Math.min(ECONOMY.max, this.credits + ECONOMY.defuse);
    this.player.ult = Math.min(this.player.ultNeed, this.player.ult + 1);
    this.holdT = 0;
    this.el.hold.classList.add('hidden');
    this._syncSpikeMesh();
    this.sfx.plant();
    this.endRound('defend', '成功拆除爆弹器');
  }

  _botSpikeLogic(dt) {
    for (const b of this.bots) {
      if (!b.alive) continue;
      if (b.side === 'attack' && b.hasSpike && this.spike.state === 'carried') {
        const d = b.mesh.position.distanceTo(b.targetSite);
        if (d < MATCH.plantRadius) {
          b.plantT += dt;
          if (b.plantT >= MATCH.plantHold) {
            b.hasSpike = false;
            this.spike.state = 'planted';
            this.spike.pos.copy(b.targetSite);
            this.spike.timer = MATCH.explodeSeconds;
            this._syncSpikeMesh();
            this.sfx.plant();
            this.showToast('敌方已安放爆弹器！');
          }
        } else b.plantT = 0;
      }
      if (b.side === 'defend' && this.spike.state === 'planted') {
        const d = b.mesh.position.distanceTo(this.spike.pos);
        if (d < MATCH.defuseRadius && (!this.player.alive || this.player.side !== 'defend')) {
          // only auto-defuse if player isn't the defender doing it — actually bots help
          b.defuseT += dt * 0.65;
          if (b.defuseT >= MATCH.defuseHold) {
            this.spike.state = 'defused';
            this._syncSpikeMesh();
            this.endRound('defend', '防守方拆除爆弹器');
          }
        } else b.defuseT = 0;
      }
    }
  }

  // ——— Bots AI ———
  updateBots(dt) {
    const playerPos = this.playerObject().position;
    for (const b of this.bots) {
      if (!b.alive) continue;
      b.blind = Math.max(0, b.blind - dt);
      b.fireCd = Math.max(0, b.fireCd - dt);
      b.think -= dt;

      let goal;
      if (b.side === 'attack') {
        if (this.spike.state === 'planted') goal = this.spike.pos;
        else if (b.hasSpike) goal = b.targetSite;
        else if (this.spike.state === 'dropped') goal = this.spike.pos;
        else goal = b.targetSite;
      } else {
        if (this.spike.state === 'planted') goal = this.spike.pos;
        else goal = this.player.alive && this.player.side === 'attack' ? playerPos : b.targetSite;
      }

      // engage player if visible-ish
      const toP = playerPos.clone().sub(b.mesh.position);
      const dist = toP.length();
      const engage = this.player.alive && dist < 28 && b.blind <= 0;

      if (engage && dist < 18) {
        // strafe fight
        const side = new THREE.Vector3(-toP.z, 0, toP.x).normalize();
        b.mesh.position.addScaledVector(side, Math.sin(performance.now() * 0.003) * 2.2 * dt);
        b.mesh.lookAt(playerPos.x, 1, playerPos.z);
        if (b.fireCd <= 0 && Math.random() < 0.55) {
          b.fireCd = 0.28 + Math.random() * 0.25;
          // line check smoke
          if (!this._blockedBySmoke(b.mesh.position.clone().setY(1.4), playerPos)) {
            const acc = b.blind > 0 ? 0.15 : 0.7;
            if (Math.random() < acc) this.hurtPlayer(8 + Math.random() * 6);
          }
        }
      } else if (goal) {
        const to = goal.clone().sub(b.mesh.position);
        to.y = 0;
        if (to.length() > 1.2) {
          to.normalize();
          b.mesh.position.addScaledVector(to, 3.4 * dt);
          b.mesh.lookAt(b.mesh.position.x + to.x, 1, b.mesh.position.z + to.z);
        }
      }

      // pickup spike
      if (b.side === 'attack' && this.spike.state === 'dropped' && !b.hasSpike) {
        if (b.mesh.position.distanceTo(this.spike.pos) < 1.8) {
          b.hasSpike = true;
          this.spike.state = 'carried';
          this.spike.holder = b;
          this._syncSpikeMesh();
        }
      }

      // collision soft clamp
      b.mesh.position.x = THREE.MathUtils.clamp(b.mesh.position.x, -43, 43);
      b.mesh.position.z = THREE.MathUtils.clamp(b.mesh.position.z, -53, 53);
      // keep feet on site platforms
      if (b.mesh.position.distanceTo(this.map.siteA) < 12 && b.mesh.position.y < 0.55) b.mesh.position.y = 0.55;
      else if (b.mesh.position.distanceTo(this.map.siteB) < 11 && b.mesh.position.y < 0.55) b.mesh.position.y = 0.55;
      else if (b.mesh.position.y < 0) b.mesh.position.y = 0;

      // flame damage
      for (const e of this.effects) {
        if (e.kind === 'flame' && e.mesh.position.distanceTo(b.mesh.position) < e.radius) {
          this.applyDamage(b, e.dps * dt, false);
        }
      }
    }
  }

  // ——— Round end ———
  endRound(winnerSide, reason) {
    if (this.phase === 'end') return;
    this.phase = 'end';
    this.releaseControls();
    this.el.cross.classList.add('hidden');
    this.el.hold.classList.add('hidden');
    this.el.obj.classList.add('hidden');

    if (winnerSide === 'attack') this.score.attack++;
    else this.score.defend++;

    const playerWon = winnerSide === this.playerSide;
    if (playerWon) {
      this.credits = Math.min(ECONOMY.max, this.credits + ECONOMY.win);
      this.lossStreak = 0;
      this.sfx.win();
    } else {
      this.lossStreak++;
      this.credits = Math.min(
        ECONOMY.max,
        this.credits + ECONOMY.loss + Math.min(3, this.lossStreak) * ECONOMY.lossStreak
      );
      this.sfx.lose();
    }

    this.el.reTitle.textContent = playerWon ? '回合胜利' : '回合失败';
    this.el.reDetail.textContent = `${reason} · 比分 ${this.score.attack} : ${this.score.defend}`;
    this.el.roundEnd.classList.remove('hidden');
    this.updateHud();

    if (this.score.attack >= MATCH.winScore || this.score.defend >= MATCH.winScore) {
      this.el.reTitle.textContent = this.score.attack >= MATCH.winScore
        ? (this.playerSide === 'attack' ? '对局胜利！' : '对局失败')
        : (this.playerSide === 'defend' ? '对局胜利！' : '对局失败');
      this.el.reDetail.textContent += ' · 刷新或返回选角再来';
      document.getElementById('btn-next').classList.add('hidden');
    } else {
      document.getElementById('btn-next').classList.remove('hidden');
    }
  }

  nextRound() {
    if (this.score.attack >= MATCH.winScore || this.score.defend >= MATCH.winScore) {
      this.toMenu();
      return;
    }
    this.round++;
    this.beginBuy();
  }

  // ——— UI helpers ———
  showToast(msg) {
    this.el.toast.textContent = msg;
    this.el.toast.classList.add('on');
    this.toastT = 1.6;
  }

  feed(msg) {
    const d = document.createElement('div');
    d.className = 'kf';
    d.textContent = msg;
    this.el.feed.prepend(d);
    setTimeout(() => d.remove(), 4000);
    while (this.el.feed.children.length > 5) this.el.feed.lastChild.remove();
  }

  updateHud() {
    if (!this.player) return;
    const p = this.player;
    this.el.hpFill.style.width = `${p.hp}%`;
    this.el.arFill.style.width = `${(p.armor / 50) * 100}%`;
    this.el.hpText.textContent = String(Math.ceil(p.hp));
    this.el.arText.textContent = String(Math.ceil(p.armor));
    this.el.ammo.innerHTML = `${p.mag} <small>/ ${p.reserve}</small>`;
    this.el.gun.textContent = p.weapon.name;
    this.el.cr.textContent = String(this.credits);
    this.el.scoreAtk.textContent = String(this.score.attack);
    this.el.scoreDef.textContent = String(this.score.defend);
    this.el.roundN.textContent = String(this.round);
    const a = AGENTS[p.agentId];
    for (const s of ['q', 'e', 'c']) {
      const cd = p.cds[s];
      const max = a[s].cd;
      const el = this.el[`cd${s.toUpperCase()}`];
      el.style.height = cd > 0 ? `${(cd / max) * 100}%` : '0%';
      el.parentElement.classList.toggle('ready', cd <= 0);
    }
    this.el.ultFill.style.height = `${(p.ult / p.ultNeed) * 100}%`;
  }

  // ——— Main loop ———
  _loop() {
    requestAnimationFrame(this._loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.el.toast.classList.remove('on');
    }

    // effects
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      if (e.kind === 'smoke' && e.mesh?.material) {
        // group materials
        e.mesh.traverse?.((c) => {
          if (c.material && c.material.opacity != null) c.material.opacity = Math.min(0.75, e.life / 3);
        });
        if (e.mesh.material) e.mesh.material.opacity = Math.min(0.6, e.life / 4);
      }
      if (e.life <= 0) {
        if (e.mesh) this.scene.remove(e.mesh);
        this.effects.splice(i, 1);
      }
    }

    if (this.phase === 'buy') {
      this.phaseT -= dt;
      this.el.buyTimer.textContent = String(Math.ceil(Math.max(0, this.phaseT)));
      this.el.phase.textContent = '购买阶段';
      this.el.timer.textContent = String(Math.ceil(Math.max(0, this.phaseT)));
      if (this.phaseT <= 0) this.endBuy();
    }

    if (this.phase === 'action') {
      this.phaseT -= dt;
      this.el.phase.textContent = this.spike.state === 'planted' ? '爆弹器已安放' : '行动阶段';
      const showT = this.spike.state === 'planted' ? this.spike.timer : this.phaseT;
      this.el.timer.textContent = String(Math.ceil(Math.max(0, showT)));

      if (this.spike.state !== 'planted' && this.phaseT <= 0) {
        this.endRound('defend', '时间耗尽，防守方获胜');
      }

      const p = this.player;
      const obj = this.playerObject();

      if (p.alive && this.isControlActive()) {
        // movement (keyboard + virtual joystick)
        const sprint = !!(this.keys.ShiftLeft || this.touchSprint);
        const base = sprint ? 8.2 : 6.0;
        let forward = Number(!!this.keys.KeyW) - Number(!!this.keys.KeyS);
        let strafe = Number(!!this.keys.KeyD) - Number(!!this.keys.KeyA);
        if (this.mobileMode) {
          forward += this.touchMove.y;
          strafe += this.touchMove.x;
          forward = Math.max(-1, Math.min(1, forward));
          strafe = Math.max(-1, Math.min(1, strafe));
        }
        const dir = new THREE.Vector3();
        this.controls.getDirection(dir);
        dir.y = 0; dir.normalize();
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).negate();
        const wish = new THREE.Vector3().addScaledVector(dir, forward).addScaledVector(right, strafe);
        p.moving = wish.lengthSq() > 0.0025;
        if (p.moving) {
          const mag = Math.min(1, wish.length());
          wish.normalize().multiplyScalar(base * dt * mag);
          obj.position.add(wish);
          p.speedXZ = base * mag;
          p.stepT -= dt;
          if (p.stepT <= 0 && p.onGround) {
            this.sfx.step();
            p.stepT = 0.38;
          }
        } else p.speedXZ = 0;

        if ((this.keys.Space || this.touchJump) && p.onGround) {
          p.velY = 7.2;
          p.onGround = false;
        }
        p.velY -= 20 * dt;
        obj.position.y += p.velY * dt;
        p.onGround = resolveCollision(obj.position, RADIUS, EYE, this.map.colliders);
        if (p.onGround && p.velY < 0) p.velY = 0;

        // bloom decay (counter-strafe feel)
        const decay = p.moving ? 0.98 : p.weapon.bloomDecay;
        p.bloom = THREE.MathUtils.lerp(p.bloom, p.weapon.bloomBase, p.moving ? 0.05 : 1 - Math.pow(decay, dt * 60));

        if (p.reloading) {
          p.reloadT -= dt;
          if (p.reloadT <= 0) {
            const need = p.weapon.magSize - p.mag;
            const take = Math.min(need, p.reserve);
            p.mag += take;
            p.reserve -= take;
            p.reloading = false;
            this.updateHud();
          }
        }
        p.fireCd = Math.max(0, p.fireCd - dt);
        p.dmgBuff = Math.max(0, p.dmgBuff - dt);
        for (const s of ['q', 'e', 'c']) p.cds[s] = Math.max(0, p.cds[s] - dt);
        if (this.shooting) this.tryShoot();
        this.muzzle.intensity = Math.max(0, this.muzzle.intensity - dt * 14);
        this.viewModel?.update(dt, { moving: p.moving, speedXZ: p.speedXZ });

        // flame on player
        for (const e of this.effects) {
          if (e.kind === 'flame' && e.mesh.position.distanceTo(obj.position) < e.radius) {
            this.hurtPlayer(e.dps * dt * 0.5);
          }
        }
      }

      this.updateSpike(dt);
      this.updateBots(dt);
      this.updateHud();

      // crosshair bloom visual
      const spread = 6 + this.player.bloom * 400;
      document.querySelector('#crosshair .arm.h').style.width = `${spread}px`;
      document.querySelector('#crosshair .arm.v').style.height = `${spread}px`;
    }

    this.renderer.render(this.scene, this.camera);
  }
}
