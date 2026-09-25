import * as THREE from "three";
import { CHARACTERS, getCharacter } from "./characters.js";
import { MAPS, buildMap, getMapMeta } from "./maps.js";
import { Player } from "./player.js";
import { createEnemies } from "./enemies.js";
import {
  hitscan,
  hitscanPlayer,
  spawnMuzzleFlash,
  spawnTracer,
  spawnImpact,
  SmokeCloud,
  createFlashBurst,
} from "./combat.js";
import { SFX, unlockAudio } from "./audio.js";
import {
  BIND_ACTIONS,
  loadBinds,
  saveBinds,
  resetBinds,
  codeLabel,
  prettyBindsHelp,
} from "./binds.js";

const WINS_NEEDED = 3;

const el = {
  menu: document.getElementById("screen-menu"),
  game: document.getElementById("screen-game"),
  result: document.getElementById("screen-result"),
  charGrid: document.getElementById("char-grid"),
  mapGrid: document.getElementById("map-grid"),
  btnStart: document.getElementById("btn-start"),
  canvas: document.getElementById("game-canvas"),
  hpFill: document.getElementById("hp-fill"),
  hpText: document.getElementById("hp-text"),
  ammo: document.getElementById("ammo-text"),
  reserve: document.getElementById("reserve-text"),
  abilityName: document.getElementById("ability-name"),
  abilityTag: document.getElementById("ability-tag"),
  abilityCd: document.getElementById("ability-cd"),
  abilityKeyLabel: document.getElementById("ability-key-label"),
  bindsHint: document.getElementById("binds-hint"),
  scoreYou: document.getElementById("score-you"),
  scoreEnemy: document.getElementById("score-enemy"),
  roundLabel: document.getElementById("round-label"),
  minimap: document.getElementById("minimap"),
  flash: document.getElementById("flash-overlay"),
  vignette: document.getElementById("damage-vignette"),
  killFeed: document.getElementById("kill-feed"),
  centerMsg: document.getElementById("center-msg"),
  pause: document.getElementById("pause-menu"),
  btnResume: document.getElementById("btn-resume"),
  btnQuit: document.getElementById("btn-quit"),
  resultTitle: document.getElementById("result-title"),
  resultDetail: document.getElementById("result-detail"),
  btnRematch: document.getElementById("btn-rematch"),
  btnMenu: document.getElementById("btn-menu"),
  objHint: document.getElementById("obj-hint"),
  settings: document.getElementById("settings-panel"),
  bindsList: document.getElementById("binds-list"),
  btnSettingsMenu: document.getElementById("btn-settings-menu"),
  btnSettingsPause: document.getElementById("btn-settings-pause"),
  btnSettingsClose: document.getElementById("btn-settings-close"),
  btnBindsReset: document.getElementById("btn-binds-reset"),
  desktopHint: document.querySelector(".desktop-hint"),
};

let binds = loadBinds();
let listeningAction = null;
let settingsOpen = false;

let selectedChar = null;
let selectedMap = null;

function showScreen(name) {
  el.menu.classList.toggle("active", name === "menu");
  el.game.classList.toggle("active", name === "game");
  el.result.classList.toggle("active", name === "result");
}

function buildSelectUI() {
  el.charGrid.innerHTML = "";
  for (const c of CHARACTERS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-opt";
    btn.dataset.id = c.id;
    btn.innerHTML = `<h3>${c.name} <span class="effect-tag">${c.effectTag}</span></h3><div class="role">${c.role} · ${c.abilityName}</div><p>${c.description}</p>`;
    btn.addEventListener("click", () => {
      unlockAudio();
      SFX.ui();
      selectedChar = c.id;
      [...el.charGrid.children].forEach((n) => n.classList.toggle("selected", n.dataset.id === c.id));
      refreshStart();
    });
    el.charGrid.appendChild(btn);
  }

  el.mapGrid.innerHTML = "";
  for (const m of MAPS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-opt";
    btn.dataset.id = m.id;
    btn.innerHTML = `<h3>${m.name}</h3><div class="role" style="color:${m.accent}">地图</div><p>${m.blurb}</p>`;
    btn.addEventListener("click", () => {
      unlockAudio();
      SFX.ui();
      selectedMap = m.id;
      [...el.mapGrid.children].forEach((n) => n.classList.toggle("selected", n.dataset.id === m.id));
      refreshStart();
    });
    el.mapGrid.appendChild(btn);
  }
  refreshBindsHelp();
}

function refreshBindsHelp() {
  const help = prettyBindsHelp(binds);
  if (el.desktopHint) el.desktopHint.textContent = help;
  if (el.bindsHint) el.bindsHint.textContent = help;
  if (el.abilityKeyLabel) el.abilityKeyLabel.textContent = codeLabel(binds.ability);
  const touchAb = document.getElementById("btn-touch-ability");
  if (touchAb) touchAb.textContent = "技能";
}

function renderBindsList() {
  if (!el.bindsList) return;
  el.bindsList.innerHTML = "";
  for (const action of BIND_ACTIONS) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "bind-row" + (listeningAction === action.id ? " listening" : "");
    row.innerHTML = `<span>${action.label}</span><kbd>${codeLabel(binds[action.id])}</kbd>`;
    row.addEventListener("click", (e) => {
      e.preventDefault();
      listeningAction = action.id;
      renderBindsList();
    });
    el.bindsList.appendChild(row);
  }
}

function openSettings() {
  unlockAudio();
  settingsOpen = true;
  listeningAction = null;
  el.settings.classList.remove("hidden");
  renderBindsList();
  if (document.pointerLockElement) document.exitPointerLock();
}

function closeSettings() {
  settingsOpen = false;
  listeningAction = null;
  el.settings.classList.add("hidden");
  refreshBindsHelp();
  saveBinds(binds);
}

function refreshStart() {
  el.btnStart.disabled = !(selectedChar && selectedMap);
}

buildSelectUI();
// Defaults for faster demo
selectedChar = "blitz";
selectedMap = "yard";
el.charGrid.querySelector('[data-id="blitz"]')?.classList.add("selected");
el.mapGrid.querySelector('[data-id="yard"]')?.classList.add("selected");
refreshStart();

el.btnStart.addEventListener("click", (e) => {
  e.preventDefault();
  unlockAudio();
  SFX.ui();
  if (!selectedChar) selectedChar = "blitz";
  if (!selectedMap) selectedMap = "yard";
  startMatch(false);
});
el.btnRematch.addEventListener("click", () => {
  unlockAudio();
  startMatch(false);
});
el.btnMenu.addEventListener("click", () => {
  showScreen("menu");
});
el.btnSettingsMenu?.addEventListener("click", () => openSettings());
el.btnSettingsPause?.addEventListener("click", () => openSettings());
el.btnSettingsClose?.addEventListener("click", () => closeSettings());
el.btnBindsReset?.addEventListener("click", () => {
  binds = resetBinds();
  SFX.ui();
  renderBindsList();
  refreshBindsHelp();
});
/** —— Runtime match state —— */
let renderer, scene, camera, clock;
let player, mapData, enemies, smokes;
let scoreYou = 0;
let scoreEnemy = 0;
let round = 1;
let running = false;
let paused = false;
let pointerLocked = false;
let roundEnding = false;
let animId = 0;
const isTouch =
  window.matchMedia("(pointer: coarse)").matches ||
  "ontouchstart" in window ||
  navigator.maxTouchPoints > 0;

const minimapCtx = el.minimap.getContext("2d");
const touchUI = {
  root: document.getElementById("touch-controls"),
  joyZone: document.getElementById("joy-zone"),
  joyKnob: document.getElementById("joy-knob"),
  fire: document.getElementById("btn-touch-fire"),
  ability: document.getElementById("btn-touch-ability"),
  reload: document.getElementById("btn-touch-reload"),
  pause: document.getElementById("btn-touch-pause"),
};

function disposeMatch() {
  if (animId) cancelAnimationFrame(animId);
  animId = 0;
  running = false;
  setTouchControlsVisible(false);
  if (renderer) {
    renderer.dispose();
    renderer = null;
  }
  scene = null;
  enemies = [];
  smokes = [];
  if (document.pointerLockElement) document.exitPointerLock();
}

function initRenderer() {
  renderer = new THREE.WebGLRenderer({
    canvas: el.canvas,
    antialias: true,
    powerPreference: "high-performance",
    alpha: false,
  });
  // Software / SwiftShader WebGL struggles with shadows — keep them off for reliability.
  const softGL = /SwiftShader|llvmpipe|software/i.test(
    renderer.getContext()?.getParameter?.(renderer.getContext().RENDERER) || ""
  );
  renderer.setPixelRatio(softGL ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = !softGL;
  if (!softGL) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  el.canvas.style.width = "100%";
  el.canvas.style.height = "100%";
}

function startMatch(rematch = false) {
  disposeMatch();
  if (!rematch) {
    scoreYou = 0;
    scoreEnemy = 0;
    round = 1;
  }
  showScreen("game");
  el.pause.classList.add("hidden");
  paused = false;
  roundEnding = false;

  initRenderer();
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  mapData = buildMap(selectedMap);
  scene.add(mapData.group);
  scene.background = new THREE.Color(mapData.clearColor);
  scene.fog = new THREE.Fog(mapData.fogColor, mapData.fogNear, mapData.fogFar);

  const hemi = new THREE.HemisphereLight(mapData.hemiSky, mapData.hemiGround, 1.15);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(mapData.sunColor, 1.25);
  sun.position.set(20, 35, 12);
  if (renderer.shadowMap.enabled) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
  }
  scene.add(sun);
  renderer.setClearColor(mapData.clearColor, 1);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 120);
  const character = getCharacter(selectedChar);
  player = new Player(camera, character);
  player.setSpawn(mapData.spawns.player);

  enemies = createEnemies(mapData.spawns.enemies);
  for (const e of enemies) scene.add(e.mesh);

  smokes = [];
  el.abilityName.textContent = character.abilityName;
  if (el.abilityTag) el.abilityTag.textContent = character.effectTag;
  refreshBindsHelp();
  updateScoreUI();
  el.roundLabel.textContent = `第 ${round} 回合 · ${getMapMeta(selectedMap).name}`;
  el.objHint.textContent = `歼灭全部敌人 · 先赢 ${WINS_NEEDED} 回合`;

  running = true;
  showCenter(`回合 ${round}`, 1.4);
  bindGameInput();
  setTouchControlsVisible(true);
  // Desktop: request pointer lock after click; mobile uses touch look
  if (!isTouch) el.canvas.requestPointerLock?.();
  loop();
}

function updateScoreUI() {
  el.scoreYou.textContent = String(scoreYou);
  el.scoreEnemy.textContent = String(scoreEnemy);
}

function showCenter(text, seconds = 1.5) {
  el.centerMsg.textContent = text;
  el.centerMsg.classList.remove("hidden");
  clearTimeout(showCenter._t);
  showCenter._t = setTimeout(() => el.centerMsg.classList.add("hidden"), seconds * 1000);
}

function pushFeed(text) {
  const d = document.createElement("div");
  d.textContent = text;
  el.killFeed.prepend(d);
  setTimeout(() => d.remove(), 3500);
  while (el.killFeed.children.length > 5) el.killFeed.lastChild.remove();
}

function bindGameInput() {
  // Rebind via named handlers stored once
}

window.addEventListener("resize", () => {
  if (!renderer || !camera) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === el.canvas;
});

function actionForCode(code) {
  for (const [action, c] of Object.entries(binds)) {
    if (c === code) return action;
  }
  return null;
}

const MOVE_KEY = { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD" };

function mouseCode(button) {
  if (button === 0) return "Mouse0";
  if (button === 2) return "Mouse2";
  if (button === 1) return "Mouse1";
  return `Mouse${button}`;
}

document.addEventListener("mousemove", (e) => {
  if (!running || paused || !pointerLocked || !player || settingsOpen) return;
  player.onMouseMove(e.movementX, e.movementY);
});

document.addEventListener("keydown", (e) => {
  if (settingsOpen && listeningAction) {
    e.preventDefault();
    if (e.code === "Escape") {
      listeningAction = null;
      renderBindsList();
      return;
    }
    // Avoid binding bare modifiers alone
    if (["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight"].includes(e.code)) return;
    binds[listeningAction] = e.code;
    // Deduplicate: clear other actions using same code
    for (const id of Object.keys(binds)) {
      if (id !== listeningAction && binds[id] === e.code) binds[id] = "";
    }
    listeningAction = null;
    saveBinds(binds);
    SFX.ui();
    renderBindsList();
    refreshBindsHelp();
    return;
  }

  if (settingsOpen) return;
  if (!running || !player) return;

  const action = actionForCode(e.code);
  if (action === "pause" || e.code === "Escape") {
    e.preventDefault();
    togglePause();
    return;
  }
  if (paused) return;

  if (action && MOVE_KEY[action]) {
    player.keys[MOVE_KEY[action]] = true;
  }
  if (action === "reload" && !e.repeat) {
    player.tryReload();
    SFX.reload();
  }
  if (action === "ability" && !e.repeat) tryAbility();
  if (action === "shoot") player.wantsShoot = true;
});

document.addEventListener("keyup", (e) => {
  if (!player) return;
  const action = actionForCode(e.code);
  if (action && MOVE_KEY[action]) player.keys[MOVE_KEY[action]] = false;
  if (action === "shoot") player.wantsShoot = false;
});

document.addEventListener("mousedown", (e) => {
  if (settingsOpen && listeningAction) {
    e.preventDefault();
    const code = mouseCode(e.button);
    binds[listeningAction] = code;
    for (const id of Object.keys(binds)) {
      if (id !== listeningAction && binds[id] === code) binds[id] = "";
    }
    listeningAction = null;
    saveBinds(binds);
    SFX.ui();
    renderBindsList();
    refreshBindsHelp();
    return;
  }
  if (settingsOpen) return;
  if (!running || paused || !player) return;
  const code = mouseCode(e.button);
  if (code === binds.shoot || (binds.shoot === "Mouse0" && e.button === 0)) {
    if (!isTouch && !pointerLocked && e.button === 0) {
      el.canvas.requestPointerLock?.();
      // still allow shoot after lock request on next frame
    }
    if (pointerLocked || isTouch || e.button === 0) player.wantsShoot = true;
  }
});

document.addEventListener("mouseup", (e) => {
  if (!player) return;
  const code = mouseCode(e.button);
  if (code === binds.shoot || (binds.shoot === "Mouse0" && e.button === 0)) {
    player.wantsShoot = false;
  }
});

document.addEventListener("contextmenu", (e) => {
  if (running || settingsOpen) e.preventDefault();
});

el.abilityCd?.addEventListener("click", (e) => {
  e.preventDefault();
  if (running && !paused) tryAbility();
});
function setTouchControlsVisible(on) {
  if (!touchUI.root) return;
  const show = on && isTouch && running;
  touchUI.root.classList.toggle("hidden", !show);
  touchUI.root.setAttribute("aria-hidden", show ? "false" : "true");
}

function bindTouchControls() {
  if (!isTouch || !touchUI.root || bindTouchControls._done) return;
  bindTouchControls._done = true;

  let lookId = null;
  let lastLook = null;
  let joyId = null;
  let joyOrigin = null;

  const resetJoy = () => {
    if (!player) return;
    player.keys.KeyW = false;
    player.keys.KeyS = false;
    player.keys.KeyA = false;
    player.keys.KeyD = false;
    if (touchUI.joyKnob) {
      touchUI.joyKnob.style.transform = "translate(0, 0)";
    }
  };

  const applyJoy = (clientX, clientY) => {
    if (!joyOrigin || !player) return;
    const dx = clientX - joyOrigin.x;
    const dy = clientY - joyOrigin.y;
    const maxR = 40;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (dx / len) * Math.min(len, maxR);
    const ny = (dy / len) * Math.min(len, maxR);
    touchUI.joyKnob.style.transform = `translate(${nx}px, ${ny}px)`;
    const dead = 10;
    player.keys.KeyW = ny < -dead;
    player.keys.KeyS = ny > dead;
    player.keys.KeyA = nx < -dead;
    player.keys.KeyD = nx > dead;
  };

  touchUI.joyZone.addEventListener(
    "touchstart",
    (e) => {
      if (!running || paused) return;
      const t = e.changedTouches[0];
      joyId = t.identifier;
      joyOrigin = { x: t.clientX, y: t.clientY };
      applyJoy(t.clientX, t.clientY);
      e.preventDefault();
    },
    { passive: false }
  );

  el.canvas.addEventListener(
    "touchstart",
    (e) => {
      if (!running || paused || !player) return;
      for (const t of e.changedTouches) {
        // Right half = look; left half handled by joy zone when over it
        if (t.clientX > window.innerWidth * 0.42 && lookId === null) {
          lookId = t.identifier;
          lastLook = { x: t.clientX, y: t.clientY };
        }
      }
    },
    { passive: true }
  );

  window.addEventListener(
    "touchmove",
    (e) => {
      if (!running || paused || !player) return;
      for (const t of e.changedTouches) {
        if (t.identifier === joyId) {
          applyJoy(t.clientX, t.clientY);
          e.preventDefault();
        } else if (t.identifier === lookId && lastLook) {
          const dx = t.clientX - lastLook.x;
          const dy = t.clientY - lastLook.y;
          lastLook = { x: t.clientX, y: t.clientY };
          player.onMouseMove(dx * 1.6, dy * 1.6);
          e.preventDefault();
        }
      }
    },
    { passive: false }
  );

  const endTouch = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null;
        joyOrigin = null;
        resetJoy();
      }
      if (t.identifier === lookId) {
        lookId = null;
        lastLook = null;
      }
    }
  };
  window.addEventListener("touchend", endTouch);
  window.addEventListener("touchcancel", endTouch);

  const hold = (btn, on, off) => {
    const start = (ev) => {
      ev.preventDefault();
      on();
    };
    const stop = (ev) => {
      ev.preventDefault();
      off();
    };
    btn.addEventListener("touchstart", start, { passive: false });
    btn.addEventListener("touchend", stop, { passive: false });
    btn.addEventListener("touchcancel", stop, { passive: false });
    btn.addEventListener("mousedown", start);
    btn.addEventListener("mouseup", stop);
    btn.addEventListener("mouseleave", stop);
  };

  hold(
    touchUI.fire,
    () => {
      if (player) player.wantsShoot = true;
    },
    () => {
      if (player) player.wantsShoot = false;
    }
  );
  touchUI.ability.addEventListener("click", (e) => {
    e.preventDefault();
    tryAbility();
  });
  touchUI.reload.addEventListener("click", (e) => {
    e.preventDefault();
    player?.tryReload();
  });
  touchUI.pause.addEventListener("click", (e) => {
    e.preventDefault();
    togglePause();
  });
}

bindTouchControls();

function togglePause() {
  if (!running || roundEnding) return;
  paused = !paused;
  el.pause.classList.toggle("hidden", !paused);
  if (paused) {
    if (document.pointerLockElement) document.exitPointerLock();
    if (player) player.wantsShoot = false;
    clock.getDelta();
  } else {
    if (!isTouch) el.canvas.requestPointerLock?.();
    clock.getDelta();
  }
}

el.btnResume.addEventListener("click", () => {
  if (paused) togglePause();
});

el.btnQuit.addEventListener("click", () => {
  disposeMatch();
  setTouchControlsVisible(false);
  showScreen("menu");
});

function tryAbility() {
  if (!player || !player.alive || !player.abilityReady) return false;
  const type = player.character.ability;
  const now = performance.now() / 1000;
  unlockAudio();

  if (type === "flash") {
    const origin = camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const dest = origin.clone().addScaledVector(dir, 14);
    dest.y = Math.max(1.2, dest.y);
    createFlashBurst(scene, dest);
    SFX.flash();
    for (const e of enemies) {
      if (!e.alive) continue;
      const d = e.position.distanceTo(new THREE.Vector3(dest.x, 0, dest.z));
      if (d < 12) {
        const toFlash = dest.clone().sub(e.getAimPoint()).normalize();
        const facing = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), e.mesh.rotation.y);
        const facingFlash = facing.dot(toFlash) > -0.2;
        if (facingFlash || d < 5) e.applyFlash(2.5, now);
      }
    }
    const toF = dest.clone().sub(camera.position).normalize();
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    if (look.dot(toF) > 0.55 && camera.position.distanceTo(dest) < 16) {
      player.flashUntil = now + 1.2;
    }
  } else if (type === "smoke") {
    const origin = camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const hit = hitscan(origin, dir, [], mapData.colliders, 35);
    const pos = hit.point.clone();
    if (hit.type === "none") pos.copy(origin).addScaledVector(dir, 18);
    pos.y = 2;
    smokes.push(new SmokeCloud(scene, pos, 8));
    SFX.smoke();
  } else if (type === "dash") {
    player.startDash();
    SFX.dash();
  } else {
    return false;
  }

  player.startAbilityCooldown();
  return true;
}

function firePlayer() {
  const shot = player.tryShoot();
  if (!shot) return;
  SFX.shoot();
  spawnMuzzleFlash(scene, shot.origin, shot.dir);
  const solid = mapData.colliders;
  const hit = hitscan(shot.origin, shot.dir, enemies, solid, 90);
  spawnTracer(scene, shot.origin.clone().addScaledVector(shot.dir, 0.5), hit.point);
  spawnImpact(scene, hit.point);
  if (hit.type === "enemy") {
    SFX.hit();
    const killed = hit.enemy.takeDamage(shot.damage);
    if (killed) {
      pushFeed(`你 淘汰了 ${hit.enemy.name}`);
      checkRoundWin();
    }
  }
}

function checkRoundWin() {
  if (roundEnding) return;
  if (enemies.every((e) => !e.alive)) {
    endRound(true);
  }
}

function endRound(playerWon) {
  if (roundEnding) return;
  roundEnding = true;
  if (playerWon) {
    scoreYou += 1;
    showCenter("回合胜利", 2);
    pushFeed("回合胜利 — 全歼敌人");
  } else {
    scoreEnemy += 1;
    showCenter("回合失败", 2);
    pushFeed("你被淘汰了");
  }
  updateScoreUI();

  setTimeout(() => {
    if (scoreYou >= WINS_NEEDED || scoreEnemy >= WINS_NEEDED) {
      endMatch(scoreYou >= WINS_NEEDED);
      return;
    }
    round += 1;
    beginNextRound();
  }, 2200);
}

function beginNextRound() {
  roundEnding = false;
  el.roundLabel.textContent = `第 ${round} 回合 · ${getMapMeta(selectedMap).name}`;
  for (const s of smokes) s.dispose();
  smokes = [];
  player.setSpawn(mapData.spawns.player);
  enemies.forEach((e, i) => e.respawn(mapData.spawns.enemies[i].clone()));
  showCenter(`回合 ${round}`, 1.2);
  if (!isTouch) el.canvas.requestPointerLock?.();
}

function endMatch(won) {
  disposeMatch();
  showScreen("result");
  el.resultTitle.textContent = won ? "胜利" : "失败";
  el.resultDetail.textContent = won
    ? `比分 ${scoreYou} : ${scoreEnemy} · 特工 ${getCharacter(selectedChar).name} · ${getMapMeta(selectedMap).name}`
    : `比分 ${scoreYou} : ${scoreEnemy} · 再试一次？`;
}

function updateHud(now) {
  const hpPct = Math.max(0, player.health / player.maxHealth);
  el.hpFill.style.transform = `scaleX(${hpPct})`;
  el.hpText.textContent = String(Math.ceil(player.health));
  el.ammo.textContent = player.reloading ? "…" : String(player.ammo);
  el.reserve.textContent = String(player.reserve);

  const cd = player.abilityCdLeft;
  const maxCd = player.character.cooldown || 1;
  const keyLabel = codeLabel(binds.ability);
  if (cd > 0.05) {
    el.abilityCd.classList.add("cooling");
    // Fill grows as cooldown progresses toward ready
    const progress = ((maxCd - cd) / maxCd) * 100;
    el.abilityCd.style.setProperty("--cd", `${progress}%`);
    el.abilityKeyLabel.textContent = String(Math.ceil(cd));
  } else {
    if (!player._abilityWasReady) {
      player._abilityWasReady = true;
      SFX.ready();
    }
    el.abilityCd.classList.remove("cooling");
    el.abilityCd.style.setProperty("--cd", "100%");
    el.abilityKeyLabel.textContent = keyLabel;
  }

  // Flash overlay
  const flashLeft = player.flashUntil - now;
  el.flash.style.opacity = flashLeft > 0 ? Math.min(1, flashLeft / 0.4) * 0.92 : "0";

  // Damage vignette
  const hurt = 1 - hpPct;
  el.vignette.style.boxShadow = `inset 0 0 ${40 + hurt * 80}px rgba(255, 40, 40, ${hurt * 0.55})`;
}

function drawMinimap() {
  const ctx = minimapCtx;
  const w = el.minimap.width;
  const h = el.minimap.height;
  const scale = (w * 0.42) / mapData.bounds;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(8,20,28,0.9)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(46,230,166,0.35)";
  ctx.strokeRect(1, 1, w - 2, h - 2);

  const cx = w / 2;
  const cy = h / 2;
  const toM = (x, z) => [cx + x * scale, cy + z * scale];

  // Walls rough
  ctx.fillStyle = "rgba(100,130,140,0.35)";
  for (const c of mapData.colliders) {
    const [x0, y0] = toM(c.min.x, c.min.z);
    const [x1, y1] = toM(c.max.x, c.max.z);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  for (const e of enemies) {
    if (!e.alive) continue;
    const [ex, ey] = toM(e.position.x, e.position.z);
    ctx.fillStyle = "#ff6b4a";
    ctx.beginPath();
    ctx.arc(ex, ey, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const [px, py] = toM(player.position.x, player.position.z);
  ctx.fillStyle = "#2ee6a6";
  ctx.beginPath();
  ctx.arc(px, py, 5, 0, Math.PI * 2);
  ctx.fill();
  // facing
  const f = player.getForward();
  ctx.strokeStyle = "#2ee6a6";
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + f.x * 12, py + f.z * 12);
  ctx.stroke();
}

function loop() {
  if (!running) return;
  animId = requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  if (paused) {
    renderer.render(scene, camera);
    return;
  }

  const now = performance.now() / 1000;
  player.update(dt, mapData.colliders, mapData.bounds);

  if (player.wantsShoot && (pointerLocked || isTouch)) firePlayer();

  for (const e of enemies) {
    const shot = e.update(dt, player, mapData.colliders, mapData.bounds, now);
    if (shot && !roundEnding) {
      // Smoke blocks bot vision simply by distance through smoke centers
      let blockedBySmoke = false;
      for (const s of smokes) {
        const mid = s.mesh.position;
        const d1 = shot.origin.distanceTo(mid);
        const d2 = player.position.distanceTo(mid);
        if (d1 < 4 || d2 < 4) {
          // If line passes near smoke, reduce chance
          if (Math.random() < 0.85) blockedBySmoke = true;
        }
      }
      if (blockedBySmoke) continue;
      const result = hitscanPlayer(shot.origin, shot.dir, player, mapData.colliders, 90);
      spawnTracer(scene, shot.origin, result.hit ? result.point : shot.origin.clone().addScaledVector(shot.dir, 40));
      if (result.hit) {
        const dead = player.takeDamage(shot.damage, now);
        if (dead) endRound(false);
      }
    }
  }

  smokes = smokes.filter((s) => {
    const alive = s.update(dt);
    if (!alive) s.dispose();
    return alive;
  });

  updateHud(now);
  drawMinimap();
  renderer.render(scene, camera);
}

// Expose for debugging / automated demos
window.__PULSE_STRIKE__ = {
  startMatch,
  select: (c, m) => {
    selectedChar = c;
    selectedMap = m;
  },
  getState: () => ({
    selectedChar,
    selectedMap,
    scoreYou,
    scoreEnemy,
    running,
    health: player?.health,
  }),
};

// ?autostart=blitz,yard  — skip menu for screenshots / demos
const params = new URLSearchParams(location.search);
const auto = params.get("autostart");
if (auto) {
  const [c, m] = auto.split(",");
  if (c) selectedChar = c;
  if (m) selectedMap = m;
  refreshStart();
  requestAnimationFrame(() => startMatch(false));
}
if (params.get("settings") === "1") {
  requestAnimationFrame(() => openSettings());
}
