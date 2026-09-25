(function () {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const hud = {
    wave: document.getElementById("wave"),
    score: document.getElementById("score"),
    baseHp: document.getElementById("base-hp"),
    kills: document.getElementById("kills"),
    killsNext: document.getElementById("kills-next"),
  };

  const overlayStart = document.getElementById("overlay-start");
  const overlayUpgrade = document.getElementById("overlay-upgrade");
  const overlayGameover = document.getElementById("overlay-gameover");
  const upgradeOptions = document.getElementById("upgrade-options");
  const btnStart = document.getElementById("btn-start");
  const btnRestart = document.getElementById("btn-restart");
  const btnFire = document.getElementById("btn-fire");
  const goWave = document.getElementById("go-wave");
  const goScore = document.getElementById("go-score");

  const KILLS_PER_UPGRADE = 10;

  const UPGRADE_POOL = [
    {
      id: "damage",
      name: "火力强化",
      desc: "子弹伤害 +25%",
      apply(s) {
        s.damage *= 1.25;
      },
    },
    {
      id: "firerate",
      name: "速射模块",
      desc: "射速 +18%",
      apply(s) {
        s.fireInterval *= 0.82;
      },
    },
    {
      id: "pierce",
      name: "穿甲弹头",
      desc: "穿透 +1 个目标",
      apply(s) {
        s.pierce += 1;
      },
    },
    {
      id: "slow",
      name: "冰冻涂层",
      desc: "命中减速 35%，持续 2 秒",
      apply(s) {
        s.slowStrength = Math.min(0.55, s.slowStrength + 0.35);
        s.slowDuration = Math.max(s.slowDuration, 2);
      },
    },
    {
      id: "spread",
      name: "双管改装",
      desc: "每次射击额外 +1 发（小散射）",
      apply(s) {
        s.extraShots += 1;
      },
    },
    {
      id: "heal",
      name: "加固防线",
      desc: "基地回复 30 点生命，上限 +15",
      apply(s) {
        s.baseMax += 15;
        s.baseHp = Math.min(s.baseMax, s.baseHp + 30);
      },
    },
    {
      id: "splash",
      name: "爆裂弹",
      desc: "命中造成小范围溅射",
      apply(s) {
        s.splashRadius += 28;
      },
    },
    {
      id: "aim",
      name: "辅助瞄准",
      desc: "自动微调炮口朝向最近威胁",
      apply(s) {
        s.autoAim = Math.min(0.45, s.autoAim + 0.18);
      },
    },
  ];

  let w = 0;
  let h = 0;
  let dpr = 1;
  let lastTs = 0;
  let aimX = 0;
  let aimY = 0;
  let firing = false;
  let fireCooldown = 0;

  const state = freshState();

  function freshState() {
    return {
      running: false,
      paused: false,
      wave: 1,
      score: 0,
      kills: 0,
      killsSinceUpgrade: 0,
      baseHp: 100,
      baseMax: 100,
      damage: 12,
      fireInterval: 0.22,
      pierce: 0,
      slowStrength: 0,
      slowDuration: 0,
      extraShots: 0,
      splashRadius: 0,
      autoAim: 0.08,
      cannonAngle: -Math.PI / 2,
      zombies: [],
      bullets: [],
      particles: [],
      waveRemaining: 0,
      waveTimer: 0,
      spawnGap: 0.85,
      gameOver: false,
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (aimX === 0 && aimY === 0) {
      aimX = w / 2;
      aimY = h * 0.35;
    }
  }

  function cannonPos() {
    return { x: w / 2, y: h - 56 };
  }

  function updateHud() {
    hud.wave.textContent = String(state.wave);
    hud.score.textContent = String(state.score);
    hud.baseHp.textContent = String(Math.max(0, Math.ceil(state.baseHp)));
    hud.kills.textContent = String(state.killsSinceUpgrade);
    hud.killsNext.textContent = String(KILLS_PER_UPGRADE);
  }

  function waveParams() {
    const wave = state.wave;
    return {
      count: 6 + wave * 3,
      hp: 22 + wave * 10,
      speed: 38 + wave * 4.5,
      reward: 8 + wave * 2,
    };
  }

  function startWave() {
    const p = waveParams();
    state.waveRemaining = p.count;
    state.waveTimer = 0.3;
  }

  function spawnZombie() {
    const p = waveParams();
    const margin = 36;
    const x = margin + Math.random() * (w - margin * 2);
    const scale = 0.85 + Math.random() * 0.35;
    state.zombies.push({
      x,
      y: -40 - Math.random() * 60,
      r: 18 * scale,
      hp: p.hp * scale,
      maxHp: p.hp * scale,
      speed: p.speed * (0.9 + Math.random() * 0.2),
      reward: Math.round(p.reward * scale),
      slowUntil: 0,
      wobble: Math.random() * Math.PI * 2,
    });
    state.waveRemaining -= 1;
  }

  function pickUpgrades(n) {
    const pool = [...UPGRADE_POOL];
    const picks = [];
    while (picks.length < n && pool.length) {
      const i = Math.floor(Math.random() * pool.length);
      picks.push(pool.splice(i, 1)[0]);
    }
    return picks;
  }

  function showUpgradePicker() {
    state.paused = true;
    overlayUpgrade.classList.remove("hidden");
    upgradeOptions.innerHTML = "";
    const choices = pickUpgrades(3);
    choices.forEach((up) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "upgrade-card";
      btn.innerHTML = `<strong>${up.name}</strong><span>${up.desc}</span>`;
      btn.addEventListener("click", () => {
        up.apply(state);
        overlayUpgrade.classList.add("hidden");
        state.paused = false;
        state.killsSinceUpgrade = 0;
        updateHud();
        if (state.waveRemaining <= 0 && state.zombies.length === 0) {
          state.wave += 1;
          startWave();
        }
      });
      upgradeOptions.appendChild(btn);
    });
  }

  function onKill() {
    state.kills += 1;
    state.killsSinceUpgrade += 1;
    if (state.killsSinceUpgrade >= KILLS_PER_UPGRADE) {
      showUpgradePicker();
    }
    updateHud();
  }

  function nearestZombie(from) {
    let best = null;
    let bestD = Infinity;
    for (const z of state.zombies) {
      const dx = z.x - from.x;
      const dy = z.y - from.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = z;
      }
    }
    return best;
  }

  function desiredAngle() {
    const c = cannonPos();
    let tx = aimX;
    let ty = aimY;
    const target = nearestZombie(c);
    if (target && state.autoAim > 0) {
      tx = tx * (1 - state.autoAim) + target.x * state.autoAim;
      ty = ty * (1 - state.autoAim) + target.y * state.autoAim;
    }
    return Math.atan2(ty - c.y, tx - c.x);
  }

  function shoot() {
    const c = cannonPos();
    const baseAngle = desiredAngle();
    const shots = 1 + state.extraShots;
    for (let i = 0; i < shots; i++) {
      const spread = shots === 1 ? 0 : (i - (shots - 1) / 2) * 0.12;
      const ang = baseAngle + spread;
      state.bullets.push({
        x: c.x + Math.cos(ang) * 28,
        y: c.y + Math.sin(ang) * 28,
        vx: Math.cos(ang) * 520,
        vy: Math.sin(ang) * 520,
        damage: state.damage,
        pierceLeft: state.pierce,
        splash: state.splashRadius,
        life: 1.8,
      });
    }
  }

  function damageZombie(z, dmg, now) {
    z.hp -= dmg;
    if (state.slowStrength > 0) {
      z.slowUntil = now + state.slowDuration;
    }
    spawnParticles(z.x, z.y, 6, "#aed581");
    if (z.hp <= 0) {
      state.score += z.reward;
      onKill();
      return true;
    }
    return false;
  }

  function spawnParticles(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 120;
      state.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.25,
        color,
      });
    }
  }

  function explode(x, y, radius, damage, now) {
    if (radius <= 0) return;
    spawnParticles(x, y, 10, "#ffab40");
    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const z = state.zombies[i];
      const dx = z.x - x;
      const dy = z.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        if (damageZombie(z, damage * 0.55, now)) {
          state.zombies.splice(i, 1);
        }
      }
    }
  }

  function update(dt, now) {
    if (!state.running || state.paused || state.gameOver) return;

    const turnSpeed = 8;
    const targetAng = desiredAngle();
    let da = targetAng - state.cannonAngle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    state.cannonAngle += da * Math.min(1, turnSpeed * dt);

    fireCooldown -= dt;
    if (firing && fireCooldown <= 0) {
      shoot();
      fireCooldown = state.fireInterval;
    }

    if (state.waveRemaining > 0) {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        spawnZombie();
        state.waveTimer = state.spawnGap / (1 + state.wave * 0.04);
      }
    } else if (state.zombies.length === 0 && !state.paused) {
      state.wave += 1;
      state.score += 20 + state.wave * 5;
      startWave();
      updateHud();
    }

    const baseY = h - 8;
    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const z = state.zombies[i];
      const slow = z.slowUntil > now ? 1 - state.slowStrength : 1;
      z.wobble += dt * 3;
      z.y += z.speed * slow * dt;
      z.x += Math.sin(z.wobble) * 12 * dt;
      if (z.y - z.r > baseY) {
        state.zombies.splice(i, 1);
        state.baseHp -= 8 + Math.floor(state.wave * 0.8);
        spawnParticles(z.x, baseY, 8, "#ef5350");
        if (navigator.vibrate) navigator.vibrate(80);
        updateHud();
        if (state.baseHp <= 0) {
          endGame();
        }
      }
    }

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > w + 20 || b.y < -80) {
        state.bullets.splice(i, 1);
        continue;
      }
      for (let j = state.zombies.length - 1; j >= 0; j--) {
        const z = state.zombies[j];
        const dx = z.x - b.x;
        const dy = z.y - b.y;
        const hitR = z.r + 8;
        if (dx * dx + dy * dy <= hitR * hitR) {
          const dead = damageZombie(z, b.damage, now);
          if (dead) state.zombies.splice(j, 1);
          if (b.splash > 0) explode(b.x, b.y, b.splash, b.damage, now);
          if (b.pierceLeft > 0) {
            b.pierceLeft -= 1;
          } else {
            state.bullets.splice(i, 1);
          }
          break;
        }
      }
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#263238");
    g.addColorStop(0.55, "#37474f");
    g.addColorStop(1, "#1b5e20");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(46, 125, 50, 0.35)";
    for (let i = 0; i < 8; i++) {
      const x = ((i * 97) % w) + (i % 2) * 40;
      ctx.beginPath();
      ctx.ellipse(x, h - 20, 30 + (i % 3) * 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#33691e";
    ctx.fillRect(0, h - 48, w, 48);
    ctx.strokeStyle = "#689f38";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, h - 48);
    ctx.lineTo(w, h - 48);
    ctx.stroke();
  }

  function drawZombie(z) {
    ctx.save();
    ctx.translate(z.x, z.y);
    ctx.fillStyle = "#7cb342";
    ctx.beginPath();
    ctx.arc(0, 0, z.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#33691e";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(-z.r * 0.35, -z.r * 0.15, z.r * 0.22, 0, Math.PI * 2);
    ctx.arc(z.r * 0.35, -z.r * 0.15, z.r * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b5e20";
    ctx.beginPath();
    ctx.arc(-z.r * 0.35, -z.r * 0.12, z.r * 0.1, 0, Math.PI * 2);
    ctx.arc(z.r * 0.35, -z.r * 0.12, z.r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    const barW = z.r * 1.6;
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(-barW / 2, -z.r - 10, barW, 5);
    ctx.fillStyle = z.slowUntil > performance.now() / 1000 ? "#4fc3f7" : "#ff7043";
    ctx.fillRect(-barW / 2, -z.r - 10, barW * (z.hp / z.maxHp), 5);
    ctx.restore();
  }

  function drawCannon() {
    const c = cannonPos();
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(state.cannonAngle);

    ctx.fillStyle = "#546e7a";
    ctx.fillRect(-22, -12, 44, 24);
    ctx.fillStyle = "#455a64";
    ctx.fillRect(0, -8, 36, 16);

    ctx.fillStyle = "#37474f";
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#78909c";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = "rgba(255, 235, 59, 0.35)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(aimX, aimY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawBullets() {
    ctx.fillStyle = "#ffee58";
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawParticles() {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    drawBackground();
    for (const z of state.zombies) drawZombie(z);
    drawBullets();
    drawParticles();
    drawCannon();
  }

  function loop(ts) {
    const t = ts / 1000;
    const dt = Math.min(0.05, lastTs ? t - lastTs : 0.016);
    lastTs = t;
    update(dt, t);
    render();
    requestAnimationFrame(loop);
  }

  function endGame() {
    state.gameOver = true;
    state.running = false;
    goWave.textContent = String(state.wave);
    goScore.textContent = String(state.score);
    overlayGameover.classList.remove("hidden");
    btnFire.classList.add("hidden");
  }

  function startGame() {
    Object.assign(state, freshState());
    state.running = true;
    overlayStart.classList.add("hidden");
    overlayGameover.classList.add("hidden");
    btnFire.classList.remove("hidden");
    startWave();
    updateHud();
  }

  function pointerAim(clientX, clientY) {
    aimX = clientX;
    aimY = clientY;
  }

  canvas.addEventListener(
    "pointerdown",
    (e) => {
      if (!state.running || state.paused) return;
      if (e.target === btnFire) return;
      pointerAim(e.clientX, e.clientY);
      canvas.setPointerCapture(e.pointerId);
    },
    { passive: true }
  );
  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (!state.running || state.paused) return;
      pointerAim(e.clientX, e.clientY);
    },
    { passive: true }
  );

  btnFire.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    if (!state.running || state.paused) return;
    firing = true;
    btnFire.classList.add("firing");
  });
  const stopFire = () => {
    firing = false;
    btnFire.classList.remove("firing");
  };
  btnFire.addEventListener("pointerup", stopFire);
  btnFire.addEventListener("pointercancel", stopFire);
  btnFire.addEventListener("pointerleave", stopFire);

  btnStart.addEventListener("click", startGame);
  btnRestart.addEventListener("click", startGame);

  window.addEventListener("resize", resize);
  resize();
  updateHud();
  requestAnimationFrame(loop);
})();
