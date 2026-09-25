const SAVE_KEY = "jianshen-dayheng-v1";
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
const TICK_MS = 100;

const STAT_IDS = ["power", "stamina", "speed"];
const STAT_LABELS = { power: "力量", stamina: "耐力", speed: "速度" };
const STAT_ICONS = { power: "💪", stamina: "❤️", speed: "⚡" };

const TRAININGS = [
  {
    id: "run",
    name: "跑步机",
    icon: "🏃",
    unlockLevel: 1,
    durationMs: 4000,
    energyCost: 12,
    baseCoins: 8,
    baseExp: 14,
    statGain: { stamina: 0.15, speed: 0.2 },
  },
  {
    id: "lift",
    name: "举铁",
    icon: "🏋️",
    unlockLevel: 1,
    durationMs: 5000,
    energyCost: 18,
    baseCoins: 12,
    baseExp: 18,
    statGain: { power: 0.25, stamina: 0.08 },
  },
  {
    id: "pushup",
    name: "俯卧撑",
    icon: "🤸",
    unlockLevel: 2,
    durationMs: 3500,
    energyCost: 10,
    baseCoins: 7,
    baseExp: 12,
    statGain: { power: 0.12, stamina: 0.12 },
  },
  {
    id: "yoga",
    name: "拉伸课",
    icon: "🧘",
    unlockLevel: 4,
    durationMs: 6000,
    energyCost: 6,
    baseCoins: 10,
    baseExp: 16,
    statGain: { stamina: 0.22, speed: 0.05 },
    energyRegen: 8,
  },
];

const UPGRADES = [
  {
    id: "coach",
    name: "私人教练",
    desc: "训练金币 +12%/级",
    max: 10,
    baseCost: 40,
    costScale: 1.55,
  },
  {
    id: "gear",
    name: "专业器械",
    desc: "属性成长 +10%/级",
    max: 10,
    baseCost: 55,
    costScale: 1.6,
  },
  {
    id: "snack",
    name: "蛋白吧",
    desc: "体力上限 +8、恢复加快",
    max: 8,
    baseCost: 35,
    costScale: 1.45,
  },
  {
    id: "ads",
    name: "小镇宣传",
    desc: "解锁后离线收益 +15%/级",
    max: 5,
    baseCost: 80,
    costScale: 1.7,
  },
];

function defaultState() {
  return {
    heroName: "阿强",
    coins: 0,
    level: 1,
    exp: 0,
    expToLevel: 100,
    energy: 100,
    energyMax: 100,
    stats: { power: 5, stamina: 5, speed: 5 },
    upgrades: { coach: 0, gear: 0, snack: 0, ads: 0 },
    trainingId: null,
    trainingProgress: 0,
    trainingStartedAt: null,
    lastTickAt: Date.now(),
    totalSessions: 0,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed, stats: { ...defaultState().stats, ...parsed.stats }, upgrades: { ...defaultState().upgrades, ...parsed.upgrades } };
  } catch {
    return defaultState();
  }
}

let state = loadState();

const els = {
  coins: document.getElementById("coins"),
  heroLevel: document.getElementById("hero-level"),
  heroName: document.getElementById("hero-name"),
  statusLine: document.getElementById("status-line"),
  energyText: document.getElementById("energy-text"),
  energyBar: document.getElementById("energy-bar"),
  expText: document.getElementById("exp-text"),
  expBar: document.getElementById("exp-bar"),
  statsPanel: document.getElementById("stats-panel"),
  trainGrid: document.getElementById("train-grid"),
  shopDialog: document.getElementById("shop-dialog"),
  shopCoins: document.getElementById("shop-coins"),
  upgradeList: document.getElementById("upgrade-list"),
  canvas: document.getElementById("gym-canvas"),
};

const ctx = els.canvas.getContext("2d");
let animPhase = 0;
let toastTimer = 0;
let toastText = "";

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

function coachMult() {
  return 1 + state.upgrades.coach * 0.12;
}

function gearMult() {
  return 1 + state.upgrades.gear * 0.1;
}

function offlineMult() {
  return 1 + state.upgrades.ads * 0.15;
}

function energyRegenPerSec() {
  return 4 + state.upgrades.snack * 0.8 + state.stats.stamina * 0.05;
}

function applyOfflineProgress() {
  const now = Date.now();
  const elapsed = Math.min(now - state.lastTickAt, OFFLINE_CAP_MS);
  if (elapsed < 1000) {
    state.lastTickAt = now;
    return;
  }

  if (state.trainingId && state.trainingStartedAt) {
    const training = TRAININGS.find((t) => t.id === state.trainingId);
    if (training) {
      const offlineMs = elapsed * 0.35 * offlineMult();
      simulateTraining(training, offlineMs, true);
      toastText = `离线期间主角仍在练「${training.name}」`;
      toastTimer = 2800;
    }
  } else {
    const regen = (elapsed / 1000) * energyRegenPerSec();
    state.energy = Math.min(state.energyMax, state.energy + regen);
  }
  state.lastTickAt = now;
}

function expForLevel(lv) {
  return Math.floor(80 + lv * lv * 22);
}

function addExp(amount) {
  state.exp += amount;
  while (state.exp >= state.expToLevel) {
    state.exp -= state.expToLevel;
    state.level += 1;
    state.expToLevel = expForLevel(state.level);
    state.energyMax = 100 + state.upgrades.snack * 8 + (state.level - 1) * 2;
    toastText = `主角升到 Lv.${state.level}！`;
    toastTimer = 2200;
  }
}

function trainingUnlocked(t) {
  return state.level >= t.unlockLevel;
}

function upgradeCost(def, level) {
  return Math.floor(def.baseCost * Math.pow(def.costScale, level));
}

function startTraining(id) {
  const t = TRAININGS.find((x) => x.id === id);
  if (!t || !trainingUnlocked(t)) return;
  if (state.energy < t.energyCost) {
    toastText = "体力不足，休息一下～";
    toastTimer = 1600;
    return;
  }
  if (state.trainingId === id) {
    stopTraining();
    renderUI();
    return;
  }
  state.trainingId = id;
  state.trainingProgress = 0;
  state.trainingStartedAt = Date.now();
  saveState();
  renderUI();
}

function stopTraining() {
  state.trainingId = null;
  state.trainingProgress = 0;
  state.trainingStartedAt = null;
  saveState();
}

function simulateTraining(training, deltaMs, isOffline) {
  const rate = isOffline ? 0.55 : 1;
  let remaining = deltaMs * rate;
  while (remaining > 0 && state.trainingId === training.id) {
    const step = Math.min(remaining, training.durationMs * (1 - state.trainingProgress));
    const frac = step / training.durationMs;
    remaining -= step;
    state.trainingProgress += frac;

    if (state.trainingProgress >= 1) {
      completeSession(training, isOffline);
      state.trainingProgress = 0;
      if (state.energy < training.energyCost) {
        stopTraining();
        break;
      }
    }
  }
}

function completeSession(training, isOffline) {
  const coinGain = Math.floor(training.baseCoins * coachMult() * (1 + state.stats.power * 0.02));
  const expGain = Math.floor(training.baseExp * (1 + state.level * 0.04));
  state.coins += coinGain;
  addExp(expGain);
  state.totalSessions += 1;

  const regen = training.energyRegen || 0;
  state.energy = Math.max(0, Math.min(state.energyMax, state.energy - training.energyCost + regen));

  for (const [k, v] of Object.entries(training.statGain)) {
    state.stats[k] = +(state.stats[k] + v * gearMult()).toFixed(2);
  }

  if (!isOffline) {
    toastText = `完成一组${training.name} +${coinGain}🪙`;
    toastTimer = 1400;
  }
}

function tick(now) {
  const dt = Math.min(now - state.lastTickAt, 500);
  state.lastTickAt = now;

  if (!state.trainingId) {
    state.energy = Math.min(state.energyMax, state.energy + (dt / 1000) * energyRegenPerSec());
  } else {
    const training = TRAININGS.find((t) => t.id === state.trainingId);
    if (training) simulateTraining(training, dt, false);
  }

  if (toastTimer > 0) toastTimer -= TICK_MS;
  saveState();
  renderUI();
  drawScene();
}

function renderStats() {
  els.statsPanel.innerHTML = STAT_IDS.map(
    (id) => `
    <div class="stat-card">
      <div class="icon">${STAT_ICONS[id]}</div>
      <div class="label">${STAT_LABELS[id]}</div>
      <div class="value">${state.stats[id].toFixed(1)}</div>
    </div>`
  ).join("");
}

function renderTrainGrid() {
  els.trainGrid.innerHTML = TRAININGS.map((t) => {
    const locked = !trainingUnlocked(t);
    const active = state.trainingId === t.id;
    const prog = active ? Math.floor(state.trainingProgress * 100) : 0;
    return `
      <button type="button" class="train-btn ${active ? "active" : ""} ${locked ? "locked" : ""}" data-id="${t.id}">
        <span class="title">${t.icon} ${t.name}</span>
        <span class="meta">${locked ? `Lv.${t.unlockLevel} 解锁` : `-${t.energyCost}体力 · +${Math.floor(t.baseCoins * coachMult())}🪙/组`}</span>
        <span class="progress" style="width:${prog}%"></span>
      </button>`;
  }).join("");

  els.trainGrid.querySelectorAll(".train-btn").forEach((btn) => {
    btn.addEventListener("click", () => startTraining(btn.dataset.id));
  });
}

function renderShop() {
  els.shopCoins.textContent = String(state.coins);
  els.upgradeList.innerHTML = UPGRADES.map((u) => {
    const lv = state.upgrades[u.id];
    const maxed = lv >= u.max;
    const cost = upgradeCost(u, lv);
    const canBuy = !maxed && state.coins >= cost;
    return `
      <div class="upgrade-row">
        <div class="info">
          <div class="name">${u.name} Lv.${lv}/${u.max}</div>
          <div class="desc">${u.desc}</div>
        </div>
        <button type="button" class="btn primary buy" data-up="${u.id}" ${canBuy ? "" : "disabled"}>
          ${maxed ? "已满" : `${cost}🪙`}
        </button>
      </div>`;
  }).join("");

  els.upgradeList.querySelectorAll(".buy").forEach((btn) => {
    btn.addEventListener("click", () => buyUpgrade(btn.dataset.up));
  });
}

function buyUpgrade(id) {
  const def = UPGRADES.find((u) => u.id === id);
  if (!def) return;
  const lv = state.upgrades[id];
  if (lv >= def.max) return;
  const cost = upgradeCost(def, lv);
  if (state.coins < cost) return;
  state.coins -= cost;
  state.upgrades[id] = lv + 1;
  if (id === "snack") {
    state.energyMax = 100 + state.upgrades.snack * 8 + (state.level - 1) * 2;
    state.energy = Math.min(state.energyMax, state.energy + 8);
  }
  toastText = `已升级 ${def.name}`;
  toastTimer = 1500;
  saveState();
  renderShop();
  renderUI();
}

function renderUI() {
  els.coins.textContent = String(state.coins);
  els.heroLevel.textContent = String(state.level);
  els.heroName.textContent = `主角 · ${state.heroName}`;
  els.energyText.textContent = `${Math.floor(state.energy)}/${state.energyMax}`;
  els.expText.textContent = `${Math.floor(state.exp)}/${state.expToLevel}`;
  els.energyBar.style.width = `${(state.energy / state.energyMax) * 100}%`;
  els.expBar.style.width = `${(state.exp / state.expToLevel) * 100}%`;

  const active = TRAININGS.find((t) => t.id === state.trainingId);
  if (toastTimer > 0 && toastText) {
    els.statusLine.textContent = toastText;
  } else if (active) {
    els.statusLine.textContent = `${state.heroName} 正在${active.name}… (${Math.floor(state.trainingProgress * 100)}%)`;
  } else {
    els.statusLine.textContent = "选择训练项目，让主角开始锻炼！";
  }

  renderStats();
  renderTrainGrid();
}

function drawScene() {
  animPhase += 0.08;
  const w = els.canvas.width;
  const h = els.canvas.height;
  ctx.clearRect(0, 0, w, h);

  // floor
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#1b2a45");
  grd.addColorStop(1, "#0e1628");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#24324f";
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // treadmill
  ctx.fillStyle = "#3d4f73";
  ctx.fillRect(24, h * 0.52, 100, 36);
  ctx.fillStyle = "#111827";
  ctx.fillRect(30, h * 0.56, 88, 18);
  const beltOffset = (animPhase * 12) % 16;
  ctx.strokeStyle = "#64748b";
  ctx.lineWidth = 2;
  for (let x = 32 + beltOffset; x < 118; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, h * 0.56);
    ctx.lineTo(x - 8, h * 0.74);
    ctx.stroke();
  }

  // rack
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(w - 90, h * 0.38, 12, h * 0.34);
  ctx.fillRect(w - 118, h * 0.42, 40, 8);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(w - 115, h * 0.44, 34, 6);

  const action = state.trainingId || "idle";
  drawHero(w * 0.42, h * 0.68, action, animPhase);

  if (toastTimer <= 0 && state.trainingId) {
    const t = TRAININGS.find((x) => x.id === state.trainingId);
    ctx.fillStyle = "rgba(255, 179, 71, 0.15)";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#ffe6b3";
    ctx.font = "600 13px PingFang SC, sans-serif";
    ctx.fillText(`${t?.icon || ""} 训练中`, 14, 22);
  }
}

function drawHero(x, y, action, phase) {
  const bounce = Math.sin(phase) * (action === "run" ? 5 : 2);
  const armSwing = Math.sin(phase * 1.6) * (action === "lift" ? 0.5 : 1);
  const bodyY = y + bounce;

  ctx.fillStyle = "#ffb347";
  ctx.beginPath();
  ctx.arc(x, bodyY - 48, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";

  // body
  ctx.beginPath();
  ctx.moveTo(x, bodyY - 34);
  ctx.lineTo(x, bodyY - 4);
  ctx.stroke();

  // legs
  const legSpread = action === "run" ? Math.sin(phase * 1.8) * 10 : action === "pushup" ? 18 : 8;
  ctx.beginPath();
  ctx.moveTo(x, bodyY - 4);
  ctx.lineTo(x - legSpread, bodyY + 22);
  ctx.moveTo(x, bodyY - 4);
  ctx.lineTo(x + legSpread, bodyY + 22);
  ctx.stroke();

  // arms
  if action === "pushup") {
    ctx.beginPath();
    ctx.moveTo(x, bodyY - 20);
    ctx.lineTo(x - 22, bodyY - 2);
    ctx.moveTo(x, bodyY - 20);
    ctx.lineTo(x + 22, bodyY - 2);
    ctx.stroke();
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x - 30, bodyY + 2, 60, 8);
  } else if (action === "lift") {
    ctx.beginPath();
    ctx.moveTo(x, bodyY - 28);
    ctx.lineTo(x - 18, bodyY - 38 - armSwing * 8);
    ctx.moveTo(x, bodyY - 28);
    ctx.lineTo(x + 18, bodyY - 38 + armSwing * 8);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.fillRect(x - 28, bodyY - 46 - armSwing * 8, 56, 8);
  } else if (action === "run") {
    ctx.beginPath();
    ctx.moveTo(x, bodyY - 28);
    ctx.lineTo(x - 14 + armSwing * 10, bodyY - 12);
    ctx.moveTo(x, bodyY - 28);
    ctx.lineTo(x + 14 - armSwing * 10, bodyY - 12);
    ctx.stroke();
  } else if (action === "yoga") {
    ctx.beginPath();
    ctx.moveTo(x, bodyY - 28);
    ctx.lineTo(x - 26, bodyY - 18);
    ctx.moveTo(x, bodyY - 28);
    ctx.lineTo(x + 26, bodyY - 18);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, bodyY - 28);
    ctx.lineTo(x - 16, bodyY - 10);
    ctx.moveTo(x, bodyY - 28);
    ctx.lineTo(x + 16, bodyY - 10);
    ctx.stroke();
  }
}

document.getElementById("btn-shop").addEventListener("click", () => {
  renderShop();
  els.shopDialog.showModal();
});

document.getElementById("btn-rename").addEventListener("click", () => {
  const name = prompt("给主角起个名字", state.heroName);
  if (name && name.trim()) {
    state.heroName = name.trim().slice(0, 8);
    saveState();
    renderUI();
  }
});

els.shopDialog.addEventListener("close", renderUI);

applyOfflineProgress();
state.energyMax = 100 + state.upgrades.snack * 8 + (state.level - 1) * 2;
renderUI();
drawScene();
setInterval(() => tick(Date.now()), TICK_MS);
