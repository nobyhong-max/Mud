import {
  SCENES,
  ENDING_COPY,
  INITIAL_STATS,
  SAVE_KEY,
  ENDINGS_KEY,
} from "./story.js";

const MAX_STAT = 100;
const MIN_STAT = 0;

/** @type {{ sceneId: string, stats: typeof INITIAL_STATS }} */
let state = {
  sceneId: "start",
  stats: { ...INITIAL_STATS },
};

function allEndingIds() {
  return Object.values(SCENES)
    .filter((s) => s.ending)
    .map((s) => s.ending.id);
}

function loadEndingsSet() {
  try {
    const raw = localStorage.getItem(ENDINGS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

function saveEnding(id) {
  const set = loadEndingsSet();
  set.add(id);
  localStorage.setItem(ENDINGS_KEY, JSON.stringify([...set]));
  return set;
}

function clampStat(n) {
  return Math.max(MIN_STAT, Math.min(MAX_STAT, n));
}

function applyEffects(effects) {
  if (!effects) return;
  for (const key of ["sanity", "stamina", "charm"]) {
    if (effects[key] != null) {
      state.stats[key] = clampStat(state.stats[key] + effects[key]);
    }
  }
}

function checkCollapse() {
  if (state.stats.stamina <= 0 && state.sceneId !== "ending_collapse") {
    state.sceneId = "ending_collapse";
  }
}

function meetsRequires(requires) {
  if (!requires) return true;
  return Object.entries(requires).every(([k, v]) => state.stats[k] >= v);
}

function renderHud() {
  const map = [
    ["sanity", "bar-sanity", "val-sanity"],
    ["stamina", "bar-stamina", "val-stamina"],
    ["charm", "bar-charm", "val-charm"],
  ];
  for (const [key, barId, valId] of map) {
    const v = state.stats[key];
    document.getElementById(barId).style.width = `${v}%`;
    document.getElementById(valId).textContent = String(v);
  }
  const endings = loadEndingsSet();
  const total = allEndingIds().length;
  document.getElementById("score-pill").textContent = `结局 ${endings.size}/${total}`;
}

function renderScene() {
  checkCollapse();
  const scene = SCENES[state.sceneId];
  if (!scene) {
    document.getElementById("story").innerHTML = "<p>场景走丢了……请重新开始。</p>";
    document.getElementById("choices").innerHTML = "";
    return;
  }

  renderHud();
  const storyEl = document.getElementById("story");
  const choicesEl = document.getElementById("choices");
  choicesEl.innerHTML = "";

  if (scene.ending) {
    const { id, title, score } = scene.ending;
    const lines = ENDING_COPY[id] || ["故事在此收束。"];
    saveEnding(id);
    renderHud();
    storyEl.innerHTML = [
      `<p class="ending-title">${title}</p>`,
      `<p class="dim">本局得分：${score}</p>`,
      ...lines.map((p) => `<p>${p}</p>`),
    ].join("");
    const again = document.createElement("button");
    again.type = "button";
    again.className = "choice";
    again.textContent = "再玩一局（保留已解锁结局记录）";
    again.addEventListener("click", () => restart(false));
    choicesEl.appendChild(again);
    return;
  }

  storyEl.innerHTML = scene.body.map((p) => `<p>${p}</p>`).join("");

  for (const choice of scene.choices || []) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "choice";
    const ok = meetsRequires(choice.requires);
    btn.disabled = !ok;
    let label = choice.text;
    if (choice.requires) {
      const parts = Object.entries(choice.requires).map(([k, v]) => {
        const names = { sanity: "理智", stamina: "体力", charm: "人缘" };
        return `${names[k]}≥${v}`;
      });
      label += `<span class="req">${ok ? "条件已满足" : `需要：${parts.join("、")}`}</span>`;
    }
    btn.innerHTML = label;
    btn.addEventListener("click", () => {
      applyEffects(choice.effects);
      state.sceneId = choice.next;
      renderScene();
      persistSaveQuiet();
    });
    choicesEl.appendChild(btn);
  }
}

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    el.hidden = true;
  }, 2200);
}

function persistSaveQuiet() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function saveGame() {
  persistSaveQuiet();
  showToast("进度已存入本机浏览器");
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      showToast("没有找到存档");
      return;
    }
    const parsed = JSON.parse(raw);
    if (parsed?.sceneId && parsed?.stats) {
      state = parsed;
      renderScene();
      showToast("读档成功");
    }
  } catch {
    showToast("读档失败");
  }
}

function restart(clearSave = true) {
  state = { sceneId: "start", stats: { ...INITIAL_STATS } };
  if (clearSave) {
    localStorage.removeItem(SAVE_KEY);
  }
  renderScene();
}

function tryAutoLoad() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.sceneId && parsed?.stats && !SCENES[parsed.sceneId]?.ending) {
      state = parsed;
    }
  } catch {
    /* ignore */
  }
}

document.getElementById("btn-save").addEventListener("click", saveGame);
document.getElementById("btn-load").addEventListener("click", loadGame);
document.getElementById("btn-restart").addEventListener("click", () => restart(true));

tryAutoLoad();
renderScene();
