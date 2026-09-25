/** @typedef {'hidden'|'revealed'|'flagged'} CellState */

const PRESETS = {
  beginner: { label: "初级", cols: 9, rows: 9, mines: 10 },
  intermediate: { label: "中级", cols: 16, rows: 16, mines: 40 },
  expert: { label: "高级", cols: 30, rows: 16, mines: 99 },
};

const LIMITS = {
  minDim: 5,
  maxCols: 40,
  maxRows: 30,
};

const COPY = {
  winTitle: "恭喜通关！",
  winMsg: "再点笑脸开新局",
  loseTitle: "踩雷了",
  loseMsg: "再点笑脸重来",
  flagOn: "插旗模式：已开启",
  flagOff: "插旗模式：已关闭",
  errWidth: "宽度请在 5–40 之间",
  errHeight: "高度请在 5–30 之间",
  errMines: "雷数不能大于或等于格子总数",
  errInvalid: "请输入有效的数字",
  errMinesMin: "地雷数至少为 1",
};

/** @type {number} */
let cols = PRESETS.beginner.cols;
/** @type {number} */
let rows = PRESETS.beginner.rows;
/** @type {number} */
let mineCount = PRESETS.beginner.mines;
/** @type {string} */
let presetId = "beginner";

/** @type {boolean[]} */
let mines = [];
/** @type {number[]} */
let counts = [];
/** @type {CellState[]} */
let states = [];
/** @type {number} */
let flagsPlaced = 0;
/** @type {'idle'|'playing'|'won'|'lost'} */
let phase = "idle";
/** @type {number} */
let revealedSafe = 0;
/** @type {number | null} */
let timerId = null;
/** @type {number} */
let seconds = 0;
/** @type {boolean} */
let flagMode = false;
/** @type {boolean} */
let firstClickPending = true;

const boardEl = /** @type {HTMLElement} */ (document.getElementById("board"));
const minesEl = document.getElementById("mines-left");
const timerEl = document.getElementById("timer");
const faceBtn = /** @type {HTMLButtonElement} */ (document.getElementById("btn-face"));
const sizeBadge = document.getElementById("size-badge");
const presetCurrent = document.getElementById("preset-current");
const customError = document.getElementById("custom-error");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg = document.getElementById("overlay-msg");
const btnOverlay = /** @type {HTMLButtonElement} */ (document.getElementById("btn-overlay-ok"));
const btnFlagMode = /** @type {HTMLButtonElement} */ (document.getElementById("btn-flag-mode"));

const inpW = /** @type {HTMLInputElement} */ (document.getElementById("inp-width"));
const inpH = /** @type {HTMLInputElement} */ (document.getElementById("inp-height"));
const inpM = /** @type {HTMLInputElement} */ (document.getElementById("inp-mines"));

function idx(c, r) {
  return r * cols + c;
}

function inBounds(c, r) {
  return c >= 0 && c < cols && r >= 0 && r < rows;
}

function neighbors(c, r) {
  const list = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dc === 0 && dr === 0) continue;
      const nc = c + dc;
      const nr = r + dr;
      if (inBounds(nc, nr)) list.push([nc, nr]);
    }
  }
  return list;
}

function formatTime(s) {
  return String(Math.min(999, s)).padStart(3, "0");
}

function updateSizeBadge() {
  sizeBadge.textContent = `局面：${cols} × ${rows} · ${mineCount} 颗雷`;
  if (presetCurrent) {
    const preset = PRESETS[presetId];
    const matches =
      preset && preset.cols === cols && preset.rows === rows && preset.mines === mineCount;
    presetCurrent.textContent = matches ? `当前：${preset.label}` : "当前：自定义";
  }
  inpW.value = String(cols);
  inpH.value = String(rows);
  inpM.value = String(mineCount);
}

function validateCustom(w, h, m) {
  if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(m)) {
    return COPY.errInvalid;
  }
  if (w < LIMITS.minDim || w > LIMITS.maxCols) return COPY.errWidth;
  if (h < LIMITS.minDim || h > LIMITS.maxRows) return COPY.errHeight;
  const cells = w * h;
  if (m < 1) return COPY.errMinesMin;
  if (m >= cells) return COPY.errMines;
  return null;
}

function showCustomError(msg) {
  if (!customError) return;
  if (msg) {
    customError.textContent = msg;
    customError.hidden = false;
  } else {
    customError.textContent = "";
    customError.hidden = true;
  }
}

function stopTimer() {
  if (timerId != null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  stopTimer();
  seconds = 0;
  timerEl.textContent = formatTime(0);
  timerId = window.setInterval(() => {
    seconds += 1;
    timerEl.textContent = formatTime(seconds);
  }, 1000);
}

function resetArrays() {
  const n = cols * rows;
  mines = new Array(n).fill(false);
  counts = new Array(n).fill(0);
  states = new Array(n).fill("hidden");
  flagsPlaced = 0;
  revealedSafe = 0;
  firstClickPending = true;
}

function placeMines(safeIndex) {
  const n = cols * rows;
  const pool = [];
  for (let i = 0; i < n; i++) {
    if (i !== safeIndex) pool.push(i);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  for (let k = 0; k < mineCount; k++) {
    mines[pool[k]] = true;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = idx(c, r);
      if (mines[i]) continue;
      let nbr = 0;
      for (const [nc, nr] of neighbors(c, r)) {
        if (mines[idx(nc, nr)]) nbr++;
      }
      counts[i] = nbr;
    }
  }
}

function updateCounters() {
  const left = Math.max(0, mineCount - flagsPlaced);
  minesEl.textContent = String(left).padStart(3, "0");
}

function cellSizeForGrid() {
  const maxDim = Math.max(cols, rows);
  if (maxDim <= 9) return 36;
  if (maxDim <= 16) return 28;
  if (maxDim <= 24) return 24;
  return 20;
}

function renderBoard() {
  boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  document.documentElement.style.setProperty("--cell-size", `${cellSizeForGrid()}px`);
  boardEl.innerHTML = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = idx(c, r);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ms-cell";
      btn.dataset.i = String(i);
      btn.setAttribute("aria-label", `格子 ${c + 1},${r + 1}`);
      paintCell(btn, i);
      boardEl.appendChild(btn);
    }
  }
}

function paintCell(btn, i) {
  btn.className = "ms-cell";
  btn.textContent = "";
  const st = states[i];
  if (st === "hidden") return;
  if (st === "flagged") {
    btn.classList.add("flagged");
    btn.textContent = "🚩";
    return;
  }
  btn.classList.add("revealed");
  if (phase === "lost" && mines[i]) {
    btn.classList.add("mine-hit");
    btn.textContent = "💣";
    return;
  }
  if (mines[i]) {
    btn.textContent = "💣";
    return;
  }
  const n = counts[i];
  if (n > 0) {
    btn.textContent = String(n);
    btn.classList.add(`n${n}`);
  }
}

function refreshAllCells() {
  const cells = boardEl.querySelectorAll(".ms-cell");
  cells.forEach((el) => {
    const i = Number(/** @type {HTMLElement} */ (el).dataset.i);
    paintCell(/** @type {HTMLButtonElement} */ (el), i);
  });
}

function revealCell(c, r) {
  if (!inBounds(c, r)) return;
  const i = idx(c, r);
  if (states[i] !== "hidden") return;
  if (mines[i]) {
    states[i] = "revealed";
    phase = "lost";
    stopTimer();
    faceBtn.textContent = "😵";
    showAllMines(i);
    showOverlay(COPY.loseTitle, COPY.loseMsg);
    return;
  }
  floodReveal(c, r);
  checkWin();
}

function floodReveal(c, r) {
  const stack = [[c, r]];
  while (stack.length) {
    const [cc, rr] = /** @type {[number, number]} */ (stack.pop());
    const i = idx(cc, rr);
    if (states[i] !== "hidden") continue;
    states[i] = "revealed";
    revealedSafe += 1;
    if (counts[i] === 0) {
      for (const [nc, nr] of neighbors(cc, rr)) {
        if (states[idx(nc, nr)] === "hidden") stack.push([nc, nr]);
      }
    }
  }
}

function toggleFlag(c, r) {
  if (phase !== "playing" && phase !== "idle") return;
  const i = idx(c, r);
  if (states[i] === "revealed") return;
  if (states[i] === "hidden") {
    states[i] = "flagged";
    flagsPlaced += 1;
  } else {
    states[i] = "hidden";
    flagsPlaced -= 1;
  }
  updateCounters();
  refreshAllCells();
}

function chord(c, r) {
  if (phase !== "playing") return;
  const i = idx(c, r);
  if (states[i] !== "revealed" || counts[i] === 0) return;
  let flags = 0;
  for (const [nc, nr] of neighbors(c, r)) {
    if (states[idx(nc, nr)] === "flagged") flags++;
  }
  if (flags !== counts[i]) return;
  for (const [nc, nr] of neighbors(c, r)) {
    const ni = idx(nc, nr);
    if (states[ni] === "hidden") revealCell(nc, nr);
  }
}

function showAllMines(hitIndex) {
  for (let i = 0; i < mines.length; i++) {
    if (mines[i]) states[i] = "revealed";
  }
  refreshAllCells();
  const hitBtn = boardEl.querySelector(`[data-i="${hitIndex}"]`);
  if (hitBtn) hitBtn.classList.add("mine-hit");
}

function checkWin() {
  const safeTotal = cols * rows - mineCount;
  if (revealedSafe >= safeTotal) {
    phase = "won";
    stopTimer();
    faceBtn.textContent = "😎";
    showOverlay(COPY.winTitle, COPY.winMsg);
  }
}

function showOverlay(title, msg) {
  overlayTitle.textContent = title;
  overlayMsg.textContent = msg;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function newGame() {
  hideOverlay();
  stopTimer();
  phase = "idle";
  faceBtn.textContent = "🙂";
  timerEl.textContent = "000";
  resetArrays();
  updateCounters();
  updateSizeBadge();
  renderBoard();
}

function applyConfig(w, h, m, preset) {
  cols = w;
  rows = h;
  mineCount = m;
  presetId = preset;
  newGame();
}

function handleFirstClick(c, r) {
  if (phase === "idle") {
    phase = "playing";
    startTimer();
  }
  if (firstClickPending) {
    firstClickPending = false;
    const safe = idx(c, r);
    resetArrays();
    placeMines(safe);
    phase = "playing";
  }
}

function onPrimaryAction(c, r) {
  if (phase === "won" || phase === "lost") return;
  if (flagMode) {
    toggleFlag(c, r);
    return;
  }
  const i = idx(c, r);
  if (states[i] === "flagged") return;
  handleFirstClick(c, r);
  if (states[i] === "hidden") revealCell(c, r);
  refreshAllCells();
}

function bindBoardEvents() {
  boardEl.oncontextmenu = (e) => e.preventDefault();

  let longPressTimer = null;
  let longPressFired = false;

  boardEl.addEventListener("pointerdown", (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.classList.contains("ms-cell")) return;
    longPressFired = false;
    const i = Number(t.dataset.i);
    const c = i % cols;
    const r = Math.floor(i / cols);
    if (e.button === 2) {
      e.preventDefault();
      toggleFlag(c, r);
      refreshAllCells();
      return;
    }
    if (e.pointerType === "touch") {
      longPressTimer = window.setTimeout(() => {
        longPressFired = true;
        toggleFlag(c, r);
        refreshAllCells();
      }, 450);
    }
  });

  boardEl.addEventListener("pointerup", () => {
    if (longPressTimer != null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  boardEl.addEventListener("pointercancel", () => {
    if (longPressTimer != null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  });

  boardEl.addEventListener("click", (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.classList.contains("ms-cell")) return;
    if (longPressFired) {
      longPressFired = false;
      e.preventDefault();
      return;
    }
    const i = Number(t.dataset.i);
    const c = i % cols;
    const r = Math.floor(i / cols);
    onPrimaryAction(c, r);
  });

  boardEl.addEventListener("contextmenu", (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.classList.contains("ms-cell")) return;
    e.preventDefault();
    const i = Number(t.dataset.i);
    const c = i % cols;
    const r = Math.floor(i / cols);
    toggleFlag(c, r);
    refreshAllCells();
  });

  boardEl.addEventListener("dblclick", (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    if (!t.classList.contains("ms-cell")) return;
    e.preventDefault();
    const i = Number(t.dataset.i);
    const c = i % cols;
    const r = Math.floor(i / cols);
    chord(c, r);
    refreshAllCells();
  });
}

function setPresetActive(id) {
  document.querySelectorAll("[data-preset]").forEach((el) => {
    el.classList.toggle("active", /** @type {HTMLElement} */ (el).dataset.preset === id);
  });
}

function initControls() {
  document.querySelectorAll("[data-preset]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = /** @type {HTMLElement} */ (el).dataset.preset;
      if (!id || !PRESETS[id]) return;
      const p = PRESETS[id];
      applyConfig(p.cols, p.rows, p.mines, id);
      setPresetActive(id);
      showCustomError("");
    });
  });

  document.getElementById("btn-custom-apply")?.addEventListener("click", () => {
    const w = parseInt(inpW.value, 10);
    const h = parseInt(inpH.value, 10);
    const m = parseInt(inpM.value, 10);
    const err = validateCustom(w, h, m);
    if (err) {
      showCustomError(err);
      return;
    }
    showCustomError("");
    applyConfig(w, h, m, "custom");
    setPresetActive("");
  });

  faceBtn.addEventListener("click", () => newGame());

  btnOverlay.addEventListener("click", () => {
    hideOverlay();
    if (phase === "won" || phase === "lost") newGame();
  });

  btnFlagMode.addEventListener("click", () => {
    flagMode = !flagMode;
    btnFlagMode.classList.toggle("flag-mode-on", flagMode);
    btnFlagMode.setAttribute("aria-pressed", flagMode ? "true" : "false");
    btnFlagMode.textContent = flagMode ? COPY.flagOn : COPY.flagOff;
  });
}

function syncFlagModeLabel() {
  btnFlagMode.textContent = flagMode ? COPY.flagOn : COPY.flagOff;
}

setPresetActive("beginner");
syncFlagModeLabel();
bindBoardEvents();
initControls();
newGame();
