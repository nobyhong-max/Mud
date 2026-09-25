/**
 * 燃动闯关 — 跟练计次 MVP（点按 / 上滑计次，可选 devicemotion 摇一摇加分）
 */
(function () {
  const STORAGE_KEY = "randong-progress-v1";

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
    {
      id: 1,
      title: "热身觉醒",
      sets: ["squat", "jack", "squat"],
      restSec: 12,
    },
    {
      id: 2,
      title: "燃脂加速",
      sets: ["jack", "squat", "plank"],
      restSec: 14,
    },
    {
      id: 3,
      title: "核心挑战",
      sets: ["plank", "jack", "plank"],
      restSec: 15,
    },
    {
      id: 4,
      title: "极限闯关",
      sets: ["squat", "jack", "plank", "jack"],
      restSec: 12,
    },
  ];

  const DAILY_SET = ["jack", "squat"];

  const ENCOURAGE = [
    "漂亮！",
    "节奏稳！",
    "燃起来了！",
    "继续保持！",
    "太强了！",
    "汗水是勋章！",
  ];

  const defaultProgress = () => ({
    totalScore: 0,
    totalKcal: 0,
    streak: 0,
    lastPlayDate: "",
    unlockedLevel: 1,
    dailyDoneDate: "",
  });

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultProgress();
      return { ...defaultProgress(), ...JSON.parse(raw) };
    } catch {
      return defaultProgress();
    }
  }

  function saveProgress(p) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
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
    workout: $("screen-workout"),
    rest: $("screen-rest"),
    result: $("screen-result"),
  };

  let progress = loadProgress();
  let session = null;
  let timers = { main: null, rest: null };
  let motionEnabled = false;
  let lastShakeAt = 0;

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      el.classList.toggle("active", k === name);
      el.classList.toggle("hidden", k !== name);
    });
    $("top-bar").classList.toggle("hidden", name !== "home");
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

  function renderHome() {
    progress = loadProgress();
    $("streak").textContent = String(progress.streak);
    $("total-score").textContent = String(Math.floor(progress.totalScore));
    $("total-kcal").textContent = progress.totalKcal.toFixed(1);
    $("unlocked-level").textContent = String(progress.unlockedLevel);

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
      btn.innerHTML = `
        <span class="meta">
          <span class="title">第 ${lv.id} 关 · ${lv.title}</span>
          <span class="sub">${lv.sets.length} 组 · 组间休息 ${lv.restSec} 秒</span>
        </span>
        <span>${locked ? "🔒" : "▶"}</span>`;
      btn.addEventListener("click", () => startSession({ mode: "level", levelId: lv.id }));
      list.appendChild(btn);
    });

    const hour = new Date().getHours();
    let greet = "动起来，今天也要燃一点！";
    if (hour < 11) greet = "早安！先来一组唤醒身体吧～";
    else if (hour >= 21) greet = "夜练也超赞，注意拉伸放松哦！";
    $("greeting").textContent = greet;
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
      kcal: 0,
      maxCombo: 1,
      combo: 1,
      lastTapAt: 0,
      reps: 0,
      timeLeft: 0,
      totalTime: 0,
      running: true,
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

    if (now - session.lastTapAt < minGap * 0.55) {
      session.combo = Math.max(1, session.combo - 0.3);
      $("combo-msg").textContent = "慢一点，跟上节奏～";
    } else if (session.lastTapAt && now - session.lastTapAt <= minGap * 1.35) {
      session.combo = Math.min(3, session.combo + 0.25);
      $("combo-msg").textContent = ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)];
    } else {
      session.combo = Math.max(1, session.combo - 0.15);
    }

    session.lastTapAt = now;
    session.reps += 1;
    const mult = session.combo;
    session.maxCombo = Math.max(session.maxCombo, mult);
    const points = Math.round(10 * mult);
    session.score += points;
    session.kcal += ex.kcalPerRep * mult;

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
    const bonus = session.reps >= ex.targetReps ? 50 : 10;
    session.score += bonus;
    session.setIndex += 1;

    if (session.setIndex >= session.level.sets.length) {
      endSession(true);
      return;
    }
    startRest();
  }

  function startRest() {
    showScreen("rest");
    let left = session.level.restSec;
    $("rest-timer").textContent = String(left);
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
    progress = bumpStreak(progress);
    progress.totalScore += session.score;
    progress.totalKcal = Math.round((progress.totalKcal + session.kcal) * 10) / 10;

    if (session.mode === "daily" && completed) {
      progress.dailyDoneDate = todayKey();
    }
    if (session.mode === "level" && completed && session.level.id === progress.unlockedLevel) {
      progress.unlockedLevel = Math.min(LEVELS.length, progress.unlockedLevel + 1);
    }
    saveProgress(progress);

    $("result-title").textContent = completed ? "闯关成功！" : "训练结束";
    $("result-sub").textContent = completed ? "你比昨天更强了 💪" : "下次继续燃动吧";
    $("result-score").textContent = String(session.score);
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
    const attach = () => {
      motionEnabled = true;
      window.addEventListener("devicemotion", handler);
    };
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      attach();
    } else {
      attach();
    }
  }

  $("btn-daily").addEventListener("click", () => startSession({ mode: "daily" }));
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

  setupTapZone();
  setupMotion();
  renderHome();
  showScreen("home");
})();
