import {
  getMap,
  MONSTER_DEFS,
  statsForLevel,
  petStatsForLevel,
  xpForLevel,
} from './maps.js';

const TICK_MS = 50;
const SPAWN_INTERVAL_MS = 3500;
const MAX_MONSTERS_PER_MAP = 12;
const PLAYER_SPEED = 180;
const ENGAGE_RANGE = 52;
const AGGRO_BATTLE_RANGE = 110;
const BATTLE_PLAYER_COOLDOWN_MS = 550;
const BATTLE_ENEMY_INTERVAL_MS = 1100;
const BATTLE_PET_INTERVAL_MS = 750;

let nextEntityId = 1;
function uid(prefix) {
  return `${prefix}_${nextEntityId++}`;
}

/** @param {string} mapId */
export function createMapInstance(mapId) {
  const def = getMap(mapId);
  return {
    mapId,
    monsters: new Map(),
    eggs: new Map(),
    bossSpawned: false,
    bossDefeated: false,
    lastSpawn: 0,
    width: def.width,
    height: def.height,
  };
}

export class GameServer {
  constructor() {
    /** @type {Map<string, import('./gameState.js').MapInstance>} */
    this.maps = new Map();
    /** @type {Map<string, Player>} */
    this.players = new Map();
    for (const m of ['meadow', 'forest', 'lava']) {
      this.maps.set(m, createMapInstance(m));
    }
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  destroy() {
    clearInterval(this.interval);
  }

  /** @param {string} socketId */
  addPlayer(socketId, nickname) {
    const spawn = getMap('meadow').spawn;
    const level = 1;
    const stats = statsForLevel(level);
    const player = {
      id: socketId,
      nickname: nickname.slice(0, 16) || '冒险者',
      mapId: 'meadow',
      x: spawn.x,
      y: spawn.y,
      vx: 0,
      vy: 0,
      level,
      xp: 0,
      hp: stats.maxHp,
      maxHp: stats.maxHp,
      attack: stats.attack,
      unlockedMaps: ['meadow'],
      inputs: { up: false, down: false, left: false, right: false },
      pet: null,
      eggInventory: 0,
      battle: null,
    };
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    const p = this.players.get(socketId);
    if (p?.battle) {
      this.endBattle(p, 'flee');
    }
    this.players.delete(socketId);
  }

  /** @param {string} socketId @param {Partial<Player['inputs']>} inputs */
  setInputs(socketId, inputs) {
    const p = this.players.get(socketId);
    if (!p || p.battle) return;
    Object.assign(p.inputs, inputs);
  }

  /** @param {string} socketId @param {{ dx?: number, dy?: number }} dir */
  movePlayer(socketId, dir) {
    const p = this.players.get(socketId);
    if (!p || p.hp <= 0 || p.battle) return;
    const len = Math.hypot(dir.dx ?? 0, dir.dy ?? 0) || 1;
    p.vx = ((dir.dx ?? 0) / len) * PLAYER_SPEED;
    p.vy = ((dir.dy ?? 0) / len) * PLAYER_SPEED;
  }

  stopMove(socketId) {
    const p = this.players.get(socketId);
    if (!p) return;
    p.vx = 0;
    p.vy = 0;
  }

  /** @param {string} socketId @param {string} monsterId */
  tryEngage(socketId, monsterId) {
    const p = this.players.get(socketId);
    const map = p && this.maps.get(p.mapId);
    if (!p || !map || p.battle || p.hp <= 0) return { ok: false };
    const m = map.monsters.get(monsterId);
    if (!m) return { ok: false };
    const mdef = MONSTER_DEFS[m.typeId];
    const d = Math.hypot(m.x - p.x, m.y - p.y);
    if (d > ENGAGE_RANGE + (mdef?.radius ?? 14)) return { ok: false, reason: '距离太远' };
    return this.startBattle(p, map, m);
  }

  /** @param {Player} p @param {MapInstance} map @param {object} m */
  startBattle(p, map, m) {
    if (p.battle) return { ok: false };
    const mdef = MONSTER_DEFS[m.typeId];
    map.monsters.delete(m.id);
    p.vx = 0;
    p.vy = 0;
    p.battle = {
      monsterId: m.id,
      typeId: m.typeId,
      name: mdef.name,
      hp: m.hp,
      maxHp: m.maxHp,
      attack: mdef.attack,
      isBoss: !!mdef.isBoss,
      color: mdef.color,
      radius: mdef.radius,
      overworldX: m.x,
      overworldY: m.y,
      lastPlayerAttack: 0,
      lastEnemyAttack: Date.now(),
      lastPetAttack: 0,
      log: [`遭遇了 ${mdef.name}！`],
    };
    return { ok: true };
  }

  /** @param {string} socketId */
  battleAttack(socketId) {
    const p = this.players.get(socketId);
    if (!p?.battle || p.hp <= 0) return;
    const now = Date.now();
    if (now - p.battle.lastPlayerAttack < BATTLE_PLAYER_COOLDOWN_MS) return;
    p.battle.lastPlayerAttack = now;
    const dmg = p.attack + Math.floor(Math.random() * 5);
    p.battle.hp -= dmg;
    p.battle.log.push(`你对 ${p.battle.name} 造成 ${dmg} 点伤害`);
    if (p.battle.log.length > 8) p.battle.log.shift();
    if (p.battle.hp <= 0) {
      this.winBattle(p);
    }
  }

  /** @param {string} socketId */
  battleFlee(socketId) {
    const p = this.players.get(socketId);
    if (!p?.battle || p.battle.isBoss) {
      if (p?.battle?.isBoss) return { ok: false, reason: '首领战无法逃跑' };
      return { ok: false };
    }
    this.endBattle(p, 'flee');
    return { ok: true };
  }

  /** @param {Player} p */
  winBattle(p) {
    const b = p.battle;
    if (!b) return;
    const map = this.maps.get(p.mapId);
    if (!map) return;
    const fakeMonster = {
      id: b.monsterId,
      typeId: b.typeId,
      x: b.overworldX,
      y: b.overworldY,
      hp: 0,
    };
    this.onMonsterKilled(map, fakeMonster, p, b.overworldX, b.overworldY);
    p.battle.log.push(`${b.name} 被击败！`);
    p.battle = null;
  }

  /** @param {Player} p @param {'flee'|'defeat'} reason */
  endBattle(p, reason) {
    const b = p.battle;
    if (!b) return;
    const map = this.maps.get(p.mapId);
    if (map && reason === 'flee' && b.hp > 0) {
      map.monsters.set(b.monsterId, {
        id: b.monsterId,
        typeId: b.typeId,
        x: b.overworldX,
        y: b.overworldY,
        hp: b.hp,
        maxHp: b.maxHp,
        aggroTarget: null,
      });
    }
    p.battle = null;
  }

  /** @param {string} socketId @param {string} eggId */
  pickupEgg(socketId, eggId) {
    const p = this.players.get(socketId);
    const map = p && this.maps.get(p.mapId);
    if (!p || !map || p.battle) return false;
    const egg = map.eggs.get(eggId);
    if (!egg) return false;
    const d = Math.hypot(egg.x - p.x, egg.y - p.y);
    if (d > 48) return false;
    map.eggs.delete(eggId);
    if (p.pet) {
      p.eggInventory += 1;
    } else {
      this.hatchPet(p);
    }
    return true;
  }

  /** @param {Player} p */
  hatchPet(p) {
    const names = ['小火龙', '灵狐', '石灵', '风羽'];
    const name = names[Math.floor(Math.random() * names.length)];
    p.pet = {
      name,
      level: p.level,
      xp: 0,
      ...petStatsForLevel(p.level),
      hp: petStatsForLevel(p.level).maxHp,
      lastAttack: 0,
    };
    p.pet.hp = p.pet.maxHp;
  }

  /** @param {string} socketId @param {string} mapId */
  tryEnterMap(socketId, mapId) {
    const p = this.players.get(socketId);
    if (!p) return { ok: false, reason: '无玩家' };
    if (p.battle) return { ok: false, reason: '战斗中无法传送' };
    if (!p.unlockedMaps.includes(mapId)) {
      return { ok: false, reason: '地图未解锁，请先击败当前地图首领' };
    }
    const def = getMap(mapId);
    p.mapId = mapId;
    p.x = def.spawn.x;
    p.y = def.spawn.y;
    p.vx = 0;
    p.vy = 0;
    return { ok: true, mapId };
  }

  /** @param {MapInstance} map @param {Monster} monster @param {Player} killer @param {number} x @param {number} y */
  onMonsterKilled(map, monster, killer, x, y) {
    const def = MONSTER_DEFS[monster.typeId];
    this.grantXp(killer, def.xp);
    if (killer.pet) {
      this.grantPetXp(killer, Math.floor(def.xp * 0.5));
    }
    if (def.isBoss) {
      map.bossDefeated = true;
      for (const pl of this.players.values()) {
        if (pl.mapId === map.mapId) {
          const mdef = getMap(map.mapId);
          if (mdef.nextMapId && !pl.unlockedMaps.includes(mdef.nextMapId)) {
            pl.unlockedMaps.push(mdef.nextMapId);
          }
        }
      }
    } else if (def.eggDropChance && Math.random() < def.eggDropChance) {
      const eggId = uid('egg');
      map.eggs.set(eggId, { id: eggId, x: x ?? monster.x, y: y ?? monster.y });
    }
  }

  /** @param {Player} p @param {number} amount */
  grantXp(p, amount) {
    if (p.hp <= 0) return;
    p.xp += amount;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level += 1;
      const st = statsForLevel(p.level);
      const ratio = p.hp / p.maxHp;
      p.maxHp = st.maxHp;
      p.attack = st.attack;
      p.hp = Math.min(p.maxHp, Math.max(1, Math.floor(p.maxHp * ratio)));
      if (p.pet) {
        p.pet.level = p.level;
        const ps = petStatsForLevel(p.pet.level);
        p.pet.maxHp = ps.maxHp;
        p.pet.attack = ps.attack;
        p.pet.hp = p.pet.maxHp;
      }
    }
  }

  grantPetXp(p, amount) {
    if (!p.pet) return;
    p.pet.xp = (p.pet.xp || 0) + amount;
    const need = Math.floor(30 + p.pet.level * 15);
    if (p.pet.xp >= need) {
      p.pet.xp -= need;
      p.pet.level += 1;
      const ps = petStatsForLevel(p.pet.level);
      p.pet.maxHp = ps.maxHp;
      p.pet.attack = ps.attack;
      p.pet.hp = p.pet.maxHp;
    }
  }

  tick() {
    const dt = TICK_MS / 1000;
    const now = Date.now();
    for (const map of this.maps.values()) {
      this.spawnLogic(map);
      this.monsterWander(map, dt);
      this.checkOverworldEngage(map);
    }
    for (const p of this.players.values()) {
      if (p.battle) {
        this.battleTick(p, now);
        continue;
      }
      if (p.hp <= 0) continue;
      const map = this.maps.get(p.mapId);
      if (!map) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.x = Math.max(20, Math.min(map.width - 20, p.x));
      p.y = Math.max(20, Math.min(map.height - 20, p.y));
    }
  }

  /** @param {MapInstance} map */
  checkOverworldEngage(map) {
    for (const p of this.players.values()) {
      if (p.mapId !== map.mapId || p.battle || p.hp <= 0) continue;
      for (const m of map.monsters.values()) {
        const mdef = MONSTER_DEFS[m.typeId];
        const d = Math.hypot(m.x - p.x, m.y - p.y);
        const touch = ENGAGE_RANGE + (mdef.radius ?? 14) + 18;
        const aggro = AGGRO_BATTLE_RANGE;
        if (d <= touch || d <= aggro) {
          this.startBattle(p, map, m);
          break;
        }
      }
    }
  }

  /** @param {Player} p @param {number} now */
  battleTick(p, now) {
    const b = p.battle;
    if (!b) return;

    if (p.pet && now - b.lastPetAttack >= BATTLE_PET_INTERVAL_MS) {
      b.lastPetAttack = now;
      const dmg = p.pet.attack;
      b.hp -= dmg;
      b.log.push(`${p.pet.name} 攻击，造成 ${dmg} 点伤害`);
      if (b.log.length > 8) b.log.shift();
      if (b.hp <= 0) {
        this.winBattle(p);
        return;
      }
    }

    if (now - b.lastEnemyAttack >= BATTLE_ENEMY_INTERVAL_MS) {
      b.lastEnemyAttack = now;
      const dmg = b.attack + Math.floor(Math.random() * 4);
      p.hp -= dmg;
      b.log.push(`${b.name} 反击，你受到 ${dmg} 点伤害`);
      if (b.log.length > 8) b.log.shift();
      if (p.hp <= 0) {
        p.hp = 0;
        b.log.push('你倒下了……');
        const map = this.maps.get(p.mapId);
        const sp = getMap(p.mapId).spawn;
        p.x = sp.x;
        p.y = sp.y;
        p.hp = p.maxHp;
        if (map && b.hp > 0) {
          map.monsters.set(b.monsterId, {
            id: b.monsterId,
            typeId: b.typeId,
            x: b.overworldX,
            y: b.overworldY,
            hp: b.hp,
            maxHp: b.maxHp,
            aggroTarget: null,
          });
        }
        p.battle = null;
      }
    }
  }

  /** @param {MapInstance} map */
  spawnLogic(map) {
    const now = Date.now();
    const def = getMap(map.mapId);
    if (!map.bossSpawned && map.monsters.size === 0 && now - map.lastSpawn > 2000) {
      this.spawnMonster(map, def.bossId, map.width - 180, def.height / 2);
      map.bossSpawned = true;
      return;
    }
    if (map.bossDefeated || map.monsters.size >= MAX_MONSTERS_PER_MAP) return;
    if (now - map.lastSpawn < SPAWN_INTERVAL_MS) return;
    map.lastSpawn = now;
    const typeId = def.monsterTypes[Math.floor(Math.random() * def.monsterTypes.length)];
    const x = 400 + Math.random() * (map.width - 500);
    const y = 80 + Math.random() * (map.height - 160);
    this.spawnMonster(map, typeId, x, y);
  }

  /** @param {MapInstance} map */
  spawnMonster(map, typeId, x, y) {
    const def = MONSTER_DEFS[typeId];
    if (!def) return;
    const id = uid('m');
    map.monsters.set(id, {
      id,
      typeId,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      aggroTarget: null,
    });
  }

  /** @param {MapInstance} map */
  monsterWander(map, dt) {
    for (const m of map.monsters.values()) {
      const mdef = MONSTER_DEFS[m.typeId];
      m.x += (Math.random() - 0.5) * mdef.speed * dt * 0.8;
      m.y += (Math.random() - 0.5) * mdef.speed * dt * 0.8;
      m.x = Math.max(20, Math.min(map.width - 20, m.x));
      m.y = Math.max(20, Math.min(map.height - 20, m.y));
    }
  }

  snapshotForPlayer(playerId) {
    const p = this.players.get(playerId);
    if (!p) return null;
    const map = this.maps.get(p.mapId);
    const playersOnMap = [];
    for (const op of this.players.values()) {
      if (op.mapId === p.mapId && !op.battle) {
        playersOnMap.push(this.serializePlayer(op));
      }
    }
    const base = {
      mode: p.battle ? 'battle' : 'overworld',
      you: this.serializePlayer(p),
      map: {
        id: map.mapId,
        name: getMap(map.mapId).name,
        width: map.width,
        height: map.height,
        bossDefeated: map.bossDefeated,
      },
    };
    if (p.battle) {
      return {
        ...base,
        battle: {
          enemy: {
            name: p.battle.name,
            hp: p.battle.hp,
            maxHp: p.battle.maxHp,
            isBoss: p.battle.isBoss,
            color: p.battle.color,
            radius: p.battle.radius,
          },
          log: [...p.battle.log],
          canFlee: !p.battle.isBoss,
        },
      };
    }
    return {
      ...base,
      players: playersOnMap,
      monsters: [...map.monsters.values()].map((m) => ({
        id: m.id,
        typeId: m.typeId,
        name: MONSTER_DEFS[m.typeId].name,
        x: m.x,
        y: m.y,
        isBoss: !!MONSTER_DEFS[m.typeId].isBoss,
        color: MONSTER_DEFS[m.typeId].color,
        radius: MONSTER_DEFS[m.typeId].radius,
      })),
      eggs: [...map.eggs.values()],
    };
  }

  serializePlayer(p) {
    return {
      id: p.id,
      nickname: p.nickname,
      x: p.x,
      y: p.y,
      level: p.level,
      xp: p.xp,
      xpNeed: xpForLevel(p.level),
      hp: p.hp,
      maxHp: p.maxHp,
      attack: p.attack,
      unlockedMaps: p.unlockedMaps,
      mapId: p.mapId,
      eggInventory: p.eggInventory,
      inBattle: !!p.battle,
      pet: p.pet
        ? {
            name: p.pet.name,
            level: p.pet.level,
            hp: p.pet.hp,
            maxHp: p.pet.maxHp,
            attack: p.pet.attack,
          }
        : null,
    };
  }
}
