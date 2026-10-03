import { Dimension, SAVE_KEY } from "./constants.js";
import { Equipment } from "./equipment.js";
import { Inventory } from "./inventory.js";

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeSave(payload) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function buildSave(game) {
  game.cacheEditsBeforeSwitch();
  return {
    v: 1,
    seed: game.overworldSeed,
    gameMode: game.gameMode,
    dimension: game.dimension,
    overworldEdits: game.editsCache.overworld,
    netherEdits: game.editsCache.nether,
    player: {
      x: game.player.pos.x,
      y: game.player.pos.y,
      z: game.player.pos.z,
      yaw: game.player.yaw,
      pitch: game.player.pitch,
    },
    inventory: game.inventory.toJSON(),
    equipment: game.equipment.toJSON(),
    interactMode: game.controls.mode,
    thirdPerson: game.player.thirdPerson,
    savedAt: Date.now(),
  };
}

export function hydrateFromSave(game, data) {
  game.gameMode = data.gameMode || game.gameMode;
  game.overworldSeed = data.seed;
  game.editsCache = {
    overworld: data.overworldEdits || [],
    nether: data.netherEdits || [],
  };
  game.dimension = data.dimension || Dimension.OVERWORLD;
  game.inventory = Inventory.fromJSON(data.inventory);
  game.equipment = Equipment.fromJSON(data.equipment);
  game.controls.setMode(data.interactMode || "mine");
  if (data.player) {
    game.player.pos.x = data.player.x;
    game.player.pos.y = data.player.y;
    game.player.pos.z = data.player.z ?? 0;
    game.player.yaw = data.player.yaw ?? 0;
    game.player.pitch = data.player.pitch ?? 0;
  }
  game.player.thirdPerson = !!data.thirdPerson;
  if (game.gameMode === "creative") game.player.flying = true;
  game.loadDimension(game.dimension);
  game.world.updateAround(game.player.pos.x, game.player.pos.z);
}
