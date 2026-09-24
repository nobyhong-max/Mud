import { formatCards, rankLabel } from "./cards.js";
import { beats, describePlay, patternLabel, validateSelection } from "./rules.js";
import { formatPercent, remainingDistribution, suggestPlays, summarizeSuggestion } from "./suggest.js";
import { BUCKET, GameState, PLAYER, PLAYER_LABELS, ROLE, loadExampleGame } from "./tracker.js";
import { createVisionBridge, ingestVisionPayload, recognizeImage } from "./vision.js";

const undoStack = [];
let state = new GameState();
let clickMode = "hand";
let lastSuggest = null;

const $ = (id) => document.getElementById(id);

function pushUndo() {
  undoStack.push(state.snapshot());
  if (undoStack.length > 60) undoStack.shift();
}

function restoreLast() {
  const snap = undoStack.pop();
  if (!snap) return;
  state.restore(snap);
  lastSuggest = null;
  render();
}

function setMode(mode) {
  clickMode = mode;
  render();
}

function onCardClick(id) {
  if (clickMode === "select") {
    state.toggleSelect(id);
    render();
    return;
  }
  pushUndo();
  state.setCardBucket(id, clickMode);
  render();
}

function onRankClick(rank) {
  if (clickMode === "select") return;
  pushUndo();
  const bucket = clickMode;
  if (bucket === BUCKET.UNKNOWN) {
    const card = [...state.myHand(), ...state.playedCards()].find((c) => c.rank === rank);
    if (card) state.setCardBucket(card.id, BUCKET.UNKNOWN);
  } else {
    state.takeNextUnknownOfRank(rank, bucket);
  }
  render();
}

function renderPills() {
  const s = state.summary();
  const integ = state.integrity();
  $("pills").innerHTML = `
    <span class="pill">手牌 <b>${s.hand}</b> / 开局 ${state.expectedMyStartCount()}</span>
    <span class="pill">已出 <b>${s.played}</b></span>
    <span class="pill">未知 <b>${s.unknown}</b></span>
    <span class="pill">${integ.ok ? (integ.hints?.[0] ? `<span class="warn">${integ.hints[0]}</span>` : '<span class="ok">记牌闭合 54</span>') : `<span class="err">${integ.issues[0]}</span>`}</span>
  `;
}

function cardButton(card) {
  const selected = state.selection.includes(card.id);
  const bucket = state.bucket[card.id];
  const color = card.color === "red" || card.color === "joker-b" ? "red" : card.isJoker ? card.color : "black";
  return `<button type="button" class="card ${color}" data-id="${card.id}" data-bucket="${bucket}" data-selected="${selected}">
      <span class="suit">${card.symbol}</span>
      <span class="pt">${card.label}</span>
    </button>`;
}

function renderBoard() {
  const rows = state.rankRows();
  const normal = rows.filter((r) => r.rank <= 15);
  const jokers = rows.filter((r) => r.rank >= 16);
  let html = "";
  for (const row of normal) {
    html += `<div class="rank-row">
      <button type="button" class="rank-lab" data-rank="${row.rank}">${row.label}</button>
      ${row.cards.map(cardButton).join("")}
      <div class="mini"><span>我${row.hand}</span><span>出${row.played}</span><span>？${row.unknown}</span></div>
    </div>`;
  }
  html += `<div class="rank-row joker-row">
    <button type="button" class="rank-lab" data-rank="16">王</button>
    ${jokers.flatMap((r) => r.cards).map(cardButton).join("")}
    <div class="mini"><span>我${jokers.reduce((a, r) => a + r.hand, 0)}</span><span>出${jokers.reduce((a, r) => a + r.played, 0)}</span><span>？${jokers.reduce((a, r) => a + r.unknown, 0)}</span></div>
  </div>`;
  $("board").innerHTML = html;
}

function renderDist() {
  const rows = remainingDistribution(state);
  $("dist").querySelector("tbody").innerHTML = rows
    .map(
      (r) => `<tr>
      <td>${r.label}</td>
      <td>${r.hand}</td>
      <td>${r.played}</td>
      <td>${r.unknown}</td>
      <td>${formatPercent(r.pNext1)}</td>
      <td>${formatPercent(r.pNext2)}</td>
      <td>${r.rank <= 15 ? formatPercent(r.pNextBomb) : "—"}</td>
      <td>${formatPercent(r.pPrev1)}</td>
    </tr>`,
    )
    .join("");
}

function renderHistory() {
  if (!state.history.length) {
    $("history").innerHTML = "<div class='hint'>还没有记录出牌。</div>";
    return;
  }
  $("history").innerHTML = state.history
    .map((h, i) => `<div>${i + 1}. ${PLAYER_LABELS[h.player]} ${h.pass ? "过" : h.note}</div>`)
    .join("");
}

function renderSelection() {
  const cards = state.selectedCards();
  if (!cards.length) {
    $("selection-info").textContent = "未选牌（先把点选模式改成「多选」）";
    return;
  }
  const check = validateSelection(cards);
  $("selection-info").innerHTML = `已选 ${formatCards(cards)}<br>${check.ok ? `<span class="ok">${check.message}</span>` : `<span class="err">${check.message}</span>`}`;
}

function renderTablePlay() {
  const last = state.lastNonPass();
  const need = state.tablePlayForMe();
  if (!last) {
    $("table-play").innerHTML = "<b>当前轮到领出</b><div class='hint'>桌上没有要压的牌，建议里会列出所有可领出牌型。</div>";
    return;
  }
  const mine = last.player === PLAYER.ME;
  $("table-play").innerHTML = `
    <div>上一手：<b>${PLAYER_LABELS[last.player]}</b> ${describePlay(last.play)}</div>
    <div class="hint">${mine ? "另外两家都没压过你，你继续领出。" : `你需要压 ${patternLabel(need.type)}，或选择过。`}</div>
  `;
}

function renderSuggest() {
  const box = $("suggest");
  if (!lastSuggest) {
    box.innerHTML = "<p class='hint'>点上方按钮后，这里列出可出牌组、评分和参考胜率。</p>";
    return;
  }
  const { options, passAllowed, samples, leading } = lastSuggest;
  const head = `<p class="hint">${leading ? "领出" : "跟牌"} · 共 ${options.length} 种不重复牌型 · 模拟 ${samples} 次</p>`;
  const pass = passAllowed
    ? `<button class="suggest-item" data-pass-now="1"><div class="suggest-top"><span>过</span><span>保留牌力</span></div><p class="hint" style="margin:6px 0 0">桌上有人出牌时可以过。不计算胜率。</p></button>`
    : "";
  box.innerHTML =
    head +
    pass +
    options
      .slice(0, 24)
      .map((item, i) => {
        const title = summarizeSuggestion(item);
        return `<button class="suggest-item" data-opt="${i}" type="button">
          <div class="suggest-top"><span>${title}</span><span>${item.score} 分</span></div>
          <div class="meters">
            <div>参考胜率 ${formatPercent(item.winRate)}<div class="bar"><i style="width:${Math.round(item.winRate * 100)}%"></i></div></div>
            <div>不易被压 ${formatPercent(item.safeRate)}<div class="bar"><i style="width:${Math.round(item.safeRate * 100)}%"></i></div></div>
          </div>
          <ul class="reasons">${item.reasons.map((r) => `<li>${r}</li>`).join("")}</ul>
        </button>`;
      })
      .join("");
}

function renderControls() {
  $("sel-role").value = state.role;
  $("sel-landlord").value = state.landlordPos;
  $("inp-prev").value = String(state.prevRemain);
  $("inp-next").value = String(state.nextRemain);
  $("remain-hint").textContent = state.autoRemain
    ? "剩余张数按出牌历史自动估；改数字会改为手动锁定。"
    : "剩余张数已手动锁定。点「清空」或载入示例可恢复自动。";
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.dataset.active = String(btn.dataset.mode === clickMode);
  });
}

function render() {
  renderControls();
  renderPills();
  renderBoard();
  renderDist();
  renderHistory();
  renderSelection();
  renderTablePlay();
  renderSuggest();
}

function applyPlay(player) {
  const ids = state.selection;
  if (!ids.length) {
    $("play-msg").innerHTML = '<span class="err">请先用「多选」选牌</span>';
    return;
  }
  pushUndo();
  const result = state.applyPlay(player, ids);
  $("play-msg").innerHTML = result.ok ? `<span class="ok">${result.message}</span>` : `<span class="err">${result.message}</span>`;
  lastSuggest = null;
  render();
}

function bind() {
  $("btn-reset").onclick = () => {
    pushUndo();
    state = new GameState();
    lastSuggest = null;
    render();
  };
  $("btn-example").onclick = () => {
    pushUndo();
    state = loadExampleGame();
    lastSuggest = null;
    render();
  };
  $("btn-undo").onclick = restoreLast;
  $("sel-role").onchange = (e) => {
    pushUndo();
    state.setRole(e.target.value);
    render();
  };
  $("sel-landlord").onchange = (e) => {
    pushUndo();
    state.setLandlordPos(e.target.value);
    render();
  };
  $("inp-prev").onchange = (e) => {
    pushUndo();
    state.autoRemain = false;
    state.prevRemain = Number(e.target.value) || 0;
    render();
  };
  $("inp-next").onchange = (e) => {
    pushUndo();
    state.autoRemain = false;
    state.nextRemain = Number(e.target.value) || 0;
    render();
  };
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.onclick = () => setMode(btn.dataset.mode);
  });
  $("btn-clear-sel").onclick = () => {
    state.clearSelection();
    render();
  };
  $("btn-sel-to-hand").onclick = () => {
    if (!state.selection.length) return;
    pushUndo();
    state.moveMany(state.selection, BUCKET.HAND);
    state.clearSelection();
    render();
  };
  $("btn-sel-to-played").onclick = () => {
    if (!state.selection.length) return;
    pushUndo();
    state.moveMany(state.selection, BUCKET.PLAYED);
    state.clearSelection();
    render();
  };
  document.querySelectorAll("[data-play]").forEach((btn) => {
    btn.onclick = () => applyPlay(btn.dataset.play);
  });
  document.querySelectorAll("[data-pass]").forEach((btn) => {
    btn.onclick = () => {
      pushUndo();
      state.applyPass(btn.dataset.pass);
      lastSuggest = null;
      render();
    };
  });
  $("board").addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (card) {
      onCardClick(card.dataset.id);
      return;
    }
    const rank = e.target.closest("[data-rank]");
    if (rank) onRankClick(Number(rank.dataset.rank));
  });
  $("btn-suggest").onclick = () => {
    $("btn-suggest").disabled = true;
    $("btn-suggest").textContent = "计算中…";
    requestAnimationFrame(() => {
      lastSuggest = suggestPlays(state, { samples: 120 });
      $("btn-suggest").disabled = false;
      $("btn-suggest").textContent = "计算可出牌与参考胜率";
      render();
    });
  };
  $("suggest").addEventListener("click", (e) => {
    const pass = e.target.closest("[data-pass-now]");
    if (pass) {
      pushUndo();
      state.applyPass(PLAYER.ME);
      lastSuggest = null;
      render();
      return;
    }
    const btn = e.target.closest("[data-opt]");
    if (!btn || !lastSuggest) return;
    const item = lastSuggest.options[Number(btn.dataset.opt)];
    if (!item) return;
    state.clearSelection();
    for (const card of item.play.cards) state.selection.push(card.id);
    render();
    $("play-msg").innerHTML = `<span class="ok">已选中建议「${summarizeSuggestion(item)}」，确认后点「我出这些」</span>`;
  });
  $("btn-yolo").onclick = async () => {
    try {
      await recognizeImage(null);
    } catch (err) {
      $("vision-msg").innerHTML = `<span class="warn">${err.message}</span>`;
    }
  };
  $("btn-import-example").onclick = async () => {
    try {
      const payload = await (await fetch("./vision/example-detections.json")).json();
      pushUndo();
      const result = ingestVisionPayload(state, payload);
      $("vision-msg").innerHTML = `<span class="ok">${result.message}</span>`;
      lastSuggest = null;
      render();
    } catch (err) {
      $("vision-msg").innerHTML = `<span class="err">${err.message}</span>`;
    }
  };
  $("btn-import-json").onclick = () => $("file-json").click();
  $("file-json").onchange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      pushUndo();
      const result = ingestVisionPayload(state, payload);
      $("vision-msg").innerHTML = `<span class="ok">${result.message}</span>`;
      lastSuggest = null;
      render();
    } catch (err) {
      $("vision-msg").innerHTML = `<span class="err">${err.message}</span>`;
    }
  };
}

window.__WEILE_VISION_BRIDGE__ = createVisionBridge(() => state);
window.__WEILE_GAME__ = {
  getState: () => state,
  suggest: () => suggestPlays(state),
  beats,
};

bind();
render();
