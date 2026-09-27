/**
 * 燃动闯关 — 锻炼 → 赚钱 → 升级数值
 */
(function () {
  const STORAGE_KEY = "randong-progress-v2";
  const STORAGE_LEGACY = "randong-progress-v1";
  const MAX_UPGRADE_LV = 10;

  const EXERCISES = {
    squat: {
      id: "squat",
      name: "深蹲",
      icon: "🦵",
      tip: "下蹲时点按，保持节奏，膝盖别超过脚尖",
      targetReps: 10,
      durationSec: 22,
      kcalPerRep: 0.35,
      swipe: false,
    },
    jack: {
      id: "jack",
      name: "开合跳",
      icon: "⭐",
      tip: "跳起分腿时点按或上滑，跟着节拍燃起来",
      targetReps: 12,
      durationSec: 24,
      kcalPerRep: 0.4,
      swipe: true,
    },
    plank: {
      id: "plank",
      name: "平板支撑",
      icon: "🧘",
      tip: "保持核心收紧，每 2 秒点按一次稳住姿势",
      targetReps: 8,
      durationSec: 20,
      kcalPerRep: 0.25,
      swipe: false,
      rhythmMs: 1800,
    },
  };

  const LEVELS = [
    { id: 1, title: "热身觉醒", sets: ["squat", "jack", "squat"], restSec: 12 },
    { id: 2, title: "燃脂加速", sets: ["jack", "squat", "plank"], restSec: 14 },
    { id: 3, title: "核心挑战", sets: ["plank", "jack", "plank"], restSec: 15 },
    { id: 4, title: "极限闯关", sets: ["squat", "jack", "plank", "jack"], restSec: 12 },
  ];

  const DAILY_SET = ["jack", "squat"];

  const UPGRADE_DEFS = [
    {
      id: "power",
      name: "力量",
      icon: "💪",
      desc: "每次计次得分更高",
      baseCost: 35,
      costGrowth: 1.42,
    },
    {
      id: "stamina",
      name: "耐力",
      icon: "❤️",
      desc: "连击上限更高、掉连击更慢",
      baseCost: 40,
      costGrowth: 1.45,
    },
    {
      id: "gold",
      name: "赚钱倍率",
      icon: "🪙",
      desc: "训练获得的金币更多",
      baseCost: 45,
      costGrowth: 1.48,
    },
    {
      id: "recovery",
      name: "恢复",
      icon: "🍃",
      desc: "组间休息时间缩短",
      baseCost: 38,
      costGrowth: 1.43,
    },
    {
      id: "focus",
      name: "专注",
      icon: "🎯",
      desc: "达标完成一组额外金币",
      baseCost: 42,
      costGrowth: 1.46,
    },
  ];

  const ENCOURAGE = [
    "漂亮！",
    "节奏稳！",
    "燃起来了！",
    "继续保持！",
    "太强了！",
    "汗水是勋章！",
  ];

  const defaultUpgrades = () =>
    Object.fromEntries(UPGRADE_DEFS.map((u) => [u.id, 0]));

  const defaultProgress = () => ({
    totalScore: 0,
    totalKcal: 0,
    coins: 0,
    upgrades: defaultUpgrades(),
    streak: 0,
    lastPlayDate: "",
    unlockedLevel: 1,
    dailyDoneDate: "",
  });

  function migrateLegacy() {
    try {
      const raw = localStorage.getItem(STORAGE_LEGACY);
      if (!raw) return null;
      const old = JSON.parse(raw);
      const p = defaultProgress();
      p.totalScore = old.totalScore || 0;
      p.totalKcal = old.totalKcal || 0;
      p.streak = old.streak || 0;
      p.lastPlayDate = old.lastPlayDate || "";
      p.unlockedLevel = old.unlockedLevel || 1;
      p.dailyDoneDate = old.dailyDoneDate || "";
      return p;
    } catch {
      return null;
    }
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const migrated = migrateLegacy();
        if (migrated) {
          saveProgress(migrated);
          return migrated;
        }
        return defaultProgress();
      }
      const parsed = JSON.parse(raw);
      return {
        ...defaultProgress(),
        ...parsed,
        upgrades: { ...defaultUpgrades(), ...(parsed.upgrades || {}) },
      };
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress(p) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  }

  function upgradeCost(def, currentLv) {
    if (currentLv >= MAX_UPGRADE_LV) return null;
    return Math.round(def.baseCost * Math.pow(def.costGrowth, currentLv));
  }

  function statPower(lv) {
    return 1 + lv * 0.08;
  }

  function statComboMax(lv) {
    return 3 + lv * 0.2;
  }

  function statComboDecay(lv) {
    return Math.max(0.55, 1 - lv * 0.04);
  }

  function statGoldMult(lv) {
    return 1 + lv * 0.1;
  }

  function statRestFactor(lv) {
    return Math.max(0.45, 1 - lv * 0.06);
  }

  function statFocusBonus(lv) {
    return 8 + lv * 4;
  }

  function getStats(upgrades) {
    const u = upgrades || defaultUpgrades();
    return {
      power: statPower(u.power),
      comboMax: statComboMax(u.stamina),
      comboDecay: statComboDecay(u.stamina),
      goldMult: statGoldMult(u.gold),
      restFactor: statRestFactor(u.recovery),
      focusBonus: statFocusBonus(u.focus),
      levels: u,
    };
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function bumpStreak(progress) {
    const t = todayKey();
    if (progress.lastPlayDate === t) return progress;
    if (progress.lastPlayDate === yesterdayKey()) progress.streak += 1;
    else progress.streak = 1;
    progress.lastPlayDate = t;
    return progress;
  }

  const $ = (id) => document.getElementById(id);

  const screens = {
    home: $("screen-home"),
    shop: $("screen-shop"),
    workout: $("screen-workout"),
    rest: $("screen-rest"),
    result: $("screen-result"),
  };

  let progress = loadProgress();
  let session = null;
  let timers = { main: null, rest: null };
  let lastShakeAt = 0;

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      el.classList.toggle("active", k === name);
      el.classList.toggle("hidden", k !== name);
    });
    $("top-bar").classList.toggle("hidden", name !== "home" && name !== "shop");
  }

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("hidden");
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
      el.classList.add("hidden");
      el.classList.remove("show");
    }, 1600);
  }

  function renderPlayerStats() {
    const stats = getStats(progress.upgrades);
    const u = stats.levels;
    const el = $("player-stats");
    el.innerHTML = UPGRADE_DEFS.map(
      (def) =>
        `<div class="pstat"><span>${def.icon} ${def.name}</span><strong>Lv.${u[def.id]}</strong></div>`
    ).join("");
    el.title = `力量×${stats.power.toFixed(2)} · 连击上限×${stats.comboMax.toFixed(1)} · 金币×${stats.goldMult.toFixed(2)}`;
  }

  function renderHome() {
    progress = loadProgress();
    $("streak").textContent = String(progress.streak);
    $("total-score").textContent = String(Math.floor(progress.totalScore));
    $("total-coins").textContent = String(progress.coins);
    $("total-kcal").textContent = progress.totalKcal.toFixed(1);
    $("unlocked-level").textContent = String(progress.unlockedLevel);
    renderPlayerStats();

    const done = progress.dailyDoneDate === todayKey();
    $("daily-done").classList.toggle("hidden", !done);
    $("btn-daily").disabled = done;

    const list = $("level-list");
    list.innerHTML = "";
    LEVELS.forEach((lv) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "level-item";
      const locked = lv.id > progress.unlockedLevel;
      btn.disabled = locked;
      const stats = getStats(progress.upgrades);
      const estCoins = Math.round(40 * lv.id * stats.goldMult + lv.sets.length * 25);
      btn.innerHTML = `
        <span class="meta">
          <span class="title">第 ${lv.id} 关 · ${lv.title}</span>
          <span class="sub">${lv.sets.length} 组 · 约 ${estCoins} 🪙</span>
        </span>
        <span>${locked ? "🔒" : "▶"}</span>`;
      btn.addEventListener("click", () => startSession({ mode: "level", levelId: lv.id }));
      list.appendChild(btn);
    });

    const hour = new Date().getHours();
    let greet = "动起来，练完就能攒金币升级！";
    if (hour < 11) greet = "早安！练一组，金币和体力一起涨～";
    else if (hour >= 21) greet = "夜练也超赞，金币记得去商店升级！";
    $("greeting").textContent = greet;
  }

  function renderShop() {
    progress = loadProgress();
    $("shop-coins").textContent = String(progress.coins);
    const stats = getStats(progress.upgrades);
    const list = $("upgrade-list");
    list.innerHTML = "";

    UPGRADE_DEFS.forEach((def) => {
      const lv = progress.upgrades[def.id] || 0;
      const cost = upgradeCost(def, lv);
      const maxed = lv >= MAX_UPGRADE_LV;
      const card = document.createElement("div");
      card.className = "upgrade-card";
      const effectLine = describeEffect(def.id, lv, stats);
      card.innerHTML = `
        <div class="upgrade-top">
          <span class="upgrade-icon">${def.icon}</span>
          <div>
            <div class="upgrade-name">${def.name} <span class="lv-tag">Lv.${lv}/${MAX_UPGRADE_LV}</span></div>
            <div class="upgrade-desc">${def.desc}</div>
            <div class="upgrade-effect">${effectLine}</div>
          </div>
        </div>
        <button type="button" class="btn buy-btn ${maxed ? "maxed" : ""}" data-id="${def.id}" ${maxed ? "disabled" : ""}>
          ${maxed ? "已满级" : `升级 · ${cost} 🪙`}
        </button>`;
      list.appendChild(card);
    });

    list.querySelectorAll(".buy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        tryPurchaseUpgrade(id);
      });
    });
  }

  function describeEffect(id, lv, stats) {
    switch (id) {
      case "power":
        return `得分倍率 ×${statPower(lv).toFixed(2)} → ×${statPower(Math.min(MAX_UPGRADE_LV, lv + 1)).toFixed(2)}`;
      case "stamina":
        return `连击上限 ${statComboMax(lv).toFixed(1)} → ${statComboMax(Math.min(MAX_UPGRADE_LV, lv + 1)).toFixed(1)}`;
      case "gold":
        return `金币倍率 ×${statGoldMult(lv).toFixed(2)} → ×${statGoldMult(Math.min(MAX_UPGRADE_LV, lv + 1)).toFixed(2)}`;
      case "recovery":
        return `休息时长 ×${statRestFactor(lv).toFixed(2)} → ×${statRestFactor(Math.min(MAX_UPGRADE_LV, lv + 1)).toFixed(2)}`;
      case "focus":
        return `达标奖励 +${statFocusBonus(lv)} → +${statFocusBonus(Math.min(MAX_UPGRADE_LV, lv + 1))} 币/组`;
      default:
        return "";
    }
  }

  function tryPurchaseUpgrade(id) {
    progress = loadProgress();
    const def = UPGRADE_DEFS.find((u) => u.id === id);
    if (!def) return;
    const lv = progress.upgrades[id] || 0;
    const cost = upgradeCost(def, lv);
    if (cost == null) {
      toast("已满级啦！");
      return;
    }
    if (progress.coins < cost) {
      toast(`金币不足，还差 ${cost - progress.coins} 🪙`);
      return;
    }
    progress.coins -= cost;
    progress.upgrades[id] = lv + 1;
    saveProgress(progress);
    toast(`${def.name} 升到 Lv.${lv + 1}！`);
    renderShop();
    $("total-coins").textContent = String(progress.coins);
  }

  function startSession(opts) {
    clearTimers();
    const level =
      opts.mode === "daily"
        ? { id: 0, title: "今日挑战", sets: DAILY_SET, restSec: 10 }
        : LEVELS.find((l) => l.id === opts.levelId);

    session = {
      mode: opts.mode,
      level,
      setIndex: 0,
      score: 0,
      coins: 0,
      kcal: 0,
      maxCombo: 1,
      combo: 1,
      lastTapAt: 0,
      reps: 0,
      timeLeft: 0,
      totalTime: 0,
      running: true,
      stats: getStats(progress.upgrades),
    };
    beginSet();
  }

  function clearTimers() {
    if (timers.main) clearInterval(timers.main);
    if (timers.rest) clearInterval(timers.rest);
    timers.main = null;
    timers.rest = null;
  }

  function currentExercise() {
    const id = session.level.sets[session.setIndex];
    return EXERCISES[id];
  }

  function addCoins(amount) {
    if (!session || amount <= 0) return;
    session.coins += amount;
    $("session-coins").textContent = String(session.coins);
  }

  function beginSet() {
    showScreen("workout");
    const ex = currentExercise();
    session.reps = 0;
    session.combo = 1;
    session.lastTapAt = 0;
    session.timeLeft = ex.durationSec;
    session.totalTime = ex.durationSec;

    $("workout-level-tag").textContent =
      session.mode === "daily" ? "今日挑战" : `第 ${session.level.id} 关`;
    $("workout-set-tag").textContent = `第 ${session.setIndex + 1} / ${session.level.sets.length} 组`;
    $("session-coins").textContent = String(session.coins);
    $("exercise-icon").textContent = ex.icon;
    $("exercise-name").textContent = ex.name;
    $("exercise-tip").textContent = ex.tip;
    $("rep-count").textContent = "0";
    $("rep-target").textContent = String(ex.targetReps);
    $("combo-mult").textContent = "1.0";
    $("combo-msg").textContent = "";
    $("tap-hint").classList.toggle("hidden", !ex.swipe);
    $("tap-label").textContent = ex.id === "plank" ? "点按稳住" : "点按跟练";

    updateTimerUi();
    if (timers.main) clearInterval(timers.main);
    timers.main = setInterval(tickWorkout, 1000);
  }

  function updateTimerUi() {
    $("timer-text").textContent = String(session.timeLeft);
    const circ = 2 * Math.PI * 52;
    const ratio = session.timeLeft / session.totalTime;
    $("timer-ring").style.strokeDashoffset = String(circ * (1 - ratio));
  }

  function tickWorkout() {
    if (!session?.running) return;
    session.timeLeft -= 1;
    updateTimerUi();
    if (session.timeLeft <= 0) finishSet();
  }

  function registerRep(source) {
    if (!session?.running) return;
    const ex = currentExercise();
    const now = Date.now();
    const minGap = ex.rhythmMs || 320;
    const { comboMax, comboDecay } = session.stats;

    if (now - session.lastTapAt < minGap * 0.55) {
      session.combo = Math.max(1, session.combo - 0.3 * comboDecay);
      $("combo-msg").textContent = "慢一点，跟上节奏～";
    } else if (session.lastTapAt && now - session.lastTapAt <= minGap * 1.35) {
      session.combo = Math.min(comboMax, session.combo + 0.25);
      $("combo-msg").textContent = ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)];
    } else {
      session.combo = Math.max(1, session.combo - 0.15 * comboDecay);
    }

    session.lastTapAt = now;
    session.reps += 1;
    const mult = session.combo;
    session.maxCombo = Math.max(session.maxCombo, mult);
    const points = Math.round(10 * mult * session.stats.power);
    session.score += points;
    session.kcal += ex.kcalPerRep * mult;

    const coinPerRep = Math.max(1, Math.round(2 * mult * session.stats.goldMult));
    addCoins(coinPerRep);
    if (mult >= 2.2 && session.stats.levels.focus > 0) {
      addCoins(Math.round(1 + session.stats.levels.focus * 0.6));
    }

    $("rep-count").textContent = String(session.reps);
    $("combo-mult").textContent = mult.toFixed(1);

    if (navigator.vibrate) navigator.vibrate(12);

    if (session.reps >= ex.targetReps) {
      toast(source === "shake" ? "摇一摇加分！" : "本组目标达成！");
    }
  }

  function finishSet() {
    clearInterval(timers.main);
    timers.main = null;
    const ex = currentExercise();
    const hitTarget = session.reps >= ex.targetReps;
    const scoreBonus = hitTarget ? 50 : 10;
    session.score += Math.round(scoreBonus * session.stats.power);

    if (hitTarget) {
      addCoins(Math.round(session.stats.focusBonus * session.stats.goldMult));
    } else {
      addCoins(5);
    }

    session.setIndex += 1;

    if (session.setIndex >= session.level.sets.length) {
      endSession(true);
      return;
    }
    startRest();
  }

  function effectiveRestSec(base) {
    if (!session) return base;
    return Math.max(5, Math.round(base * session.stats.restFactor));
  }

  function startRest() {
    showScreen("rest");
    const base = session.level.restSec;
    const rest = effectiveRestSec(base);
    let left = rest;
    $("rest-timer").textContent = String(left);
    $("rest-bonus").classList.toggle("hidden", rest >= base);
    $("rest-copy").textContent =
      session.setIndex === session.level.sets.length
        ? "最后一组，冲！"
        : "深呼吸，喝口水，下一组更燃";

    if (timers.rest) clearInterval(timers.rest);
    timers.rest = setInterval(() => {
      left -= 1;
      $("rest-timer").textContent = String(Math.max(0, left));
      if (left <= 0) {
        clearInterval(timers.rest);
        timers.rest = null;
        beginSet();
      }
    }, 1000);
  }

  function endSession(completed) {
    clearTimers();
    session.running = false;
    progress = loadProgress();

    if (completed) {
      if (session.mode === "level") {
        addCoins(Math.round(40 * session.level.id * session.stats.goldMult));
      } else if (session.mode === "daily") {
        addCoins(Math.round(30 * session.stats.goldMult));
      }
    }

    progress = bumpStreak(progress);
    progress.totalScore += session.score;
    progress.totalKcal = Math.round((progress.totalKcal + session.kcal) * 10) / 10;
    progress.coins += session.coins;

    if (session.mode === "daily" && completed) {
      progress.dailyDoneDate = todayKey();
    }
    if (session.mode === "level" && completed && session.level.id === progress.unlockedLevel) {
      progress.unlockedLevel = Math.min(LEVELS.length, progress.unlockedLevel + 1);
    }
    saveProgress(progress);

    $("result-title").textContent = completed ? "闯关成功！" : "训练结束";
    $("result-sub").textContent = completed
      ? `到账 ${session.coins} 金币，去商店升级吧 🪙`
      : "下次继续燃动吧";
    $("result-score").textContent = String(session.score);
    $("result-coins").textContent = String(session.coins);
    $("result-kcal").textContent = session.kcal.toFixed(1);
    $("result-combo").textContent = session.maxCombo.toFixed(1);

    const nextBtn = $("btn-next-level");
    const canNext =
      completed &&
      session.mode === "level" &&
      session.level.id < LEVELS.length &&
      session.level.id < progress.unlockedLevel;
    nextBtn.classList.toggle("hidden", !canNext);
    nextBtn.onclick = () => startSession({ mode: "level", levelId: session.level.id + 1 });

    showScreen("result");
  }

  function setupTapZone() {
    const zone = $("tap-zone");
    zone.addEventListener("click", () => registerRep("tap"));

    let touchStartY = 0;
    zone.addEventListener(
      "touchstart",
      (e) => {
        touchStartY = e.changedTouches[0].clientY;
      },
      { passive: true }
    );
    zone.addEventListener(
      "touchend",
      (e) => {
        const dy = touchStartY - e.changedTouches[0].clientY;
        const ex = session && currentExercise();
        if (ex?.swipe && dy > 40) registerRep("swipe");
      },
      { passive: true }
    );
  }

  function setupMotion() {
    if (typeof DeviceMotionEvent === "undefined") return;
    const handler = (e) => {
      if (!session?.running) return;
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
      const now = Date.now();
      if (mag > 16 && now - lastShakeAt > 900) {
        lastShakeAt = now;
        registerRep("shake");
      }
    };
    window.addEventListener("devicemotion", handler);
  }

  $("btn-daily").addEventListener("click", () => startSession({ mode: "daily" }));
  $("btn-shop").addEventListener("click", () => {
    renderShop();
    showScreen("shop");
  });
  $("btn-shop-back").addEventListener("click", () => {
    renderHome();
    showScreen("home");
  });
  $("btn-quit-workout").addEventListener("click", () => {
    if (session) endSession(false);
  });
  $("btn-skip-rest").addEventListener("click", () => {
    if (timers.rest) clearInterval(timers.rest);
    timers.rest = null;
    beginSet();
  });
  $("btn-result-home").addEventListener("click", () => {
    renderHome();
    showScreen("home");
  });
  $("btn-result-shop").addEventListener("click", () => {
    renderShop();
    showScreen("shop");
  });

  setupTapZone();
  setupMotion();
  renderHome();
  showScreen("home");
})();
