const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const battleCanvas = document.getElementById('battleCanvas');
const bctx = battleCanvas.getContext('2d');

const overlay = document.getElementById('overlay');
const joinBtn = document.getElementById('joinBtn');
const nicknameInput = document.getElementById('nickname');
const battleScreen = document.getElementById('battleScreen');
const sidebar = document.getElementById('sidebar');

let socket = null;
let state = null;
let playerId = null;
let cam = { x: 0, y: 0 };
const keys = { w: false, a: false, s: false, d: false };

const MAP_COLORS = {
  meadow: '#14532d',
  forest: '#052e16',
  lava: '#431407',
};

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add('hidden'), 2500);
}

joinBtn.addEventListener('click', () => {
  const nickname = nicknameInput.value.trim() || '冒险者';
  socket = io();
  socket.on('connect', () => {
    socket.emit('join', { nickname });
  });
  socket.on('welcome', (data) => {
    playerId = data.playerId;
    overlay.classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    sidebar.classList.remove('hidden');
    buildMapList(data.maps);
  });
  socket.on('state', (s) => {
    state = s;
    applyMode(s);
    updateHud(s);
  });
  socket.on('toast', ({ message }) => showToast(message));
});

document.getElementById('battleAttackBtn').addEventListener('click', () => {
  socket?.emit('battleAttack');
});

document.getElementById('battleFleeBtn').addEventListener('click', () => {
  socket?.emit('battleFlee');
});

function buildMapList(maps) {
  const ul = document.getElementById('mapList');
  ul.innerHTML = '';
  for (const m of maps) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.textContent = m.name;
    btn.dataset.mapId = m.id;
    btn.addEventListener('click', () => {
      socket.emit('enterMap', { mapId: m.id });
    });
    li.appendChild(btn);
    ul.appendChild(li);
  }
}

function applyMode(s) {
  const inBattle = s.mode === 'battle';
  battleScreen.classList.toggle('hidden', !inBattle);
  canvas.classList.toggle('dimmed', inBattle);
  sidebar.classList.toggle('hidden-battle', inBattle);
  document.getElementById('modeLabel').textContent = inBattle ? '战斗模式' : '探索模式';
  document.getElementById('modeLabel').style.color = inBattle ? '#f87171' : '#4ade80';

  if (inBattle && s.battle) {
    document.getElementById('battleTitle').textContent = s.battle.enemy.isBoss ? '首领战' : '遭遇战';
    document.getElementById('battleMapName').textContent = s.map.name;
    document.getElementById('battleFleeBtn').disabled = !s.battle.canFlee;
  }
}

function updateHud(s) {
  const you = s.you;
  document.getElementById('mapName').textContent = s.map.name;
  document.getElementById('playerLevel').textContent = `Lv.${you.level}`;
  const hpPct = (you.hp / you.maxHp) * 100;
  document.getElementById('hpBar').style.width = `${hpPct}%`;
  document.getElementById('hpText').textContent = `${Math.ceil(you.hp)}/${you.maxHp}`;

  const petHud = document.getElementById('petHud');
  if (you.pet) {
    petHud.classList.remove('hidden');
    document.getElementById('petName').textContent = `${you.pet.name} Lv.${you.pet.level}`;
    document.getElementById('petStats').textContent = ` HP ${Math.ceil(you.pet.hp)}/${you.pet.maxHp} · 攻 ${you.pet.attack}`;
  } else {
    petHud.classList.add('hidden');
  }

  if (s.mode === 'battle' && s.battle) {
    const e = s.battle.enemy;
    document.getElementById('battlePlayerName').textContent = `${you.nickname} Lv.${you.level}`;
    document.getElementById('battleEnemyName').textContent = e.name;
    document.getElementById('battlePlayerHp').style.width = `${(you.hp / you.maxHp) * 100}%`;
    document.getElementById('battleEnemyHp').style.width = `${(e.hp / e.maxHp) * 100}%`;
    const petRow = document.getElementById('battlePetRow');
    if (you.pet) {
      petRow.classList.remove('hidden');
      document.getElementById('battlePetLabel').textContent = `${you.pet.name} Lv.${you.pet.level}`;
      document.getElementById('battlePetHp').style.width = `${(you.pet.hp / you.pet.maxHp) * 100}%`;
    } else {
      petRow.classList.add('hidden');
    }
    const logEl = document.getElementById('battleLog');
    logEl.innerHTML = s.battle.log.map((line) => `<li>${line}</li>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  document.querySelectorAll('#mapList button').forEach((btn) => {
    const id = btn.dataset.mapId;
    const unlocked = you.unlockedMaps.includes(id);
    btn.disabled = !unlocked || s.mode === 'battle';
    btn.style.background = id === you.mapId ? '#059669' : unlocked ? '#2563eb' : '#475569';
  });
}

function sendMove() {
  if (!socket || state?.mode === 'battle') return;
  let dx = 0;
  let dy = 0;
  if (keys.w) dy -= 1;
  if (keys.s) dy += 1;
  if (keys.a) dx -= 1;
  if (keys.d) dx += 1;
  if (dx || dy) socket.emit('input', { move: { dx, dy } });
  else socket.emit('input', { stop: true });
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (state?.mode === 'battle') {
    if (e.code === 'Space') {
      e.preventDefault();
      socket?.emit('battleAttack');
    }
    return;
  }
  if (['w', 'a', 's', 'd'].includes(k)) {
    keys[k] = true;
    sendMove();
  }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (state?.mode === 'battle') return;
  if (['w', 'a', 's', 'd'].includes(k)) {
    keys[k] = false;
    sendMove();
  }
});

canvas.addEventListener('click', (e) => {
  if (!state || state.mode === 'battle') return;
  const rect = canvas.getBoundingClientRect();
  const wx = e.clientX - rect.left + cam.x;
  const wy = e.clientY - rect.top + cam.y;

  for (const egg of state.eggs || []) {
    if (Math.hypot(egg.x - wx, egg.y - wy) < 24) {
      socket.emit('pickupEgg', { eggId: egg.id });
      return;
    }
  }

  for (const m of state.monsters || []) {
    if (Math.hypot(m.x - wx, m.y - wy) < m.radius + 12) {
      socket.emit('engage', { monsterId: m.id });
      return;
    }
  }
});

setInterval(sendMove, 50);

function drawOverworld() {
  const you = state.you;
  cam.x = Math.max(0, Math.min(state.map.width - canvas.width, you.x - canvas.width / 2));
  cam.y = Math.max(0, Math.min(state.map.height - canvas.height, you.y - canvas.height / 2));

  ctx.fillStyle = MAP_COLORS[state.map.id] || '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let x = 0; x < state.map.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, state.map.height);
    ctx.stroke();
  }
  for (let y = 0; y < state.map.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(state.map.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(250,204,21,0.2)';
  ctx.fillRect(state.map.width - 220, 0, 220, state.map.height);
  ctx.fillStyle = '#facc15';
  ctx.font = '14px sans-serif';
  ctx.fillText('首领区域 →', state.map.width - 200, 40);

  for (const egg of state.eggs || []) {
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, 10, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fde68a';
    ctx.fill();
    ctx.strokeStyle = '#ca8a04';
    ctx.stroke();
  }

  for (const m of state.monsters || []) {
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();
    ctx.strokeStyle = m.isBoss ? '#fef08a' : '#0f172a';
    ctx.lineWidth = m.isBoss ? 3 : 1;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.name, m.x, m.y + 4);
    if (m.isBoss) {
      ctx.fillStyle = '#fde68a';
      ctx.fillText('点击或靠近开战', m.x, m.y - m.radius - 8);
    }
  }

  for (const p of state.players || []) {
    const isYou = p.id === playerId;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = isYou ? '#38bdf8' : '#818cf8';
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.nickname, p.x, p.y - 26);
    ctx.fillText(`Lv.${p.level}`, p.x, p.y + 32);
    if (p.pet) {
      ctx.beginPath();
      ctx.arc(p.x - 28, p.y + 8, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#fb923c';
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawBattleScene() {
  if (!state?.battle) return;
  const w = battleCanvas.width;
  const h = battleCanvas.height;
  bctx.clearRect(0, 0, w, h);

  bctx.fillStyle = 'rgba(255,255,255,0.05)';
  bctx.fillRect(0, h - 48, w, 48);

  const you = state.you;
  const e = state.battle.enemy;

  const px = 180;
  const py = h - 90;
  bctx.fillStyle = '#38bdf8';
  bctx.fillRect(px - 24, py - 48, 48, 48);
  bctx.fillStyle = '#fff';
  bctx.font = '13px sans-serif';
  bctx.textAlign = 'center';
  bctx.fillText(you.nickname, px, py + 20);

  if (you.pet) {
    bctx.beginPath();
    bctx.arc(px - 56, py - 16, 14, 0, Math.PI * 2);
    bctx.fillStyle = '#fb923c';
    bctx.fill();
    bctx.fillStyle = '#fff';
    bctx.font = '11px sans-serif';
    bctx.fillText(you.pet.name, px - 56, py + 8);
  }

  const ex = w - 180;
  const ey = h - 90;
  const r = e.radius || 24;
  bctx.beginPath();
  bctx.arc(ex, ey - 24, r, 0, Math.PI * 2);
  bctx.fillStyle = e.color || '#ef4444';
  bctx.fill();
  bctx.strokeStyle = e.isBoss ? '#fef08a' : '#1e293b';
  bctx.lineWidth = e.isBoss ? 4 : 2;
  bctx.stroke();
  bctx.fillStyle = '#fff';
  bctx.font = '14px sans-serif';
  bctx.fillText(e.name, ex, ey + 20);

  bctx.strokeStyle = 'rgba(251,191,36,0.35)';
  bctx.lineWidth = 2;
  bctx.beginPath();
  bctx.moveTo(px + 30, py - 24);
  bctx.lineTo(ex - r - 8, ey - 24);
  bctx.stroke();
}

function draw() {
  requestAnimationFrame(draw);
  if (!state) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  drawOverworld();
  if (state.mode === 'battle') {
    drawBattleScene();
  }
}

draw();
