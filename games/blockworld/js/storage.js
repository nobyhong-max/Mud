import { Dimension, SAVE_KEY } from "./constants.js";
import { Equipment } from "./equipment.js";
import { Inventory } from "./inventory.js";
import { World } from "./world.js";

const LEGACY_KEY = "laoer-juedi-v1";

export function loadSave() {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) raw = localStorage.getItem(LEGACY_KEY);
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
  const dim = game.dimension;
  const baseline = game.baselines[dim] || World.baseline(game.world.seed, dim);
  return {
    v: 2,
    seed: game.overworldSeed,
    gameMode: game.gameMode,
    dimension: dim,
    overworldEdits: dim === Dimension.OVERWORLD ? game.world.collectEdits(baseline) : game.editsCache.overworld,
    netherEdits: dim === Dimension.NETHER ? game.world.collectEdits(baseline) : game.editsCache.nether,
    player: { x: game.player.x, y: game.player.y },
    inventory: game.inventory.toJSON(),
    equipment: game.equipment.toJSON(),
    interactMode: game.input.mode,
    portalLinks: game.portalLinks,
    savedAt: Date.now(),
  };
}

export function hydrateFromSave(game, data) {
  game.gameMode = data.gameMode || game.gameMode;
  game.overworldSeed = data.seed;
  game.portalLinks = data.portalLinks || {};
  game.editsCache = {
    overworld: data.overworldEdits || [],
    nether: data.netherEdits || [],
  };
  game.baselines = {
    [Dimension.OVERWORLD]: World.baseline(data.seed, Dimension.OVERWORLD),
    [Dimension.NETHER]: World.baseline(data.seed, Dimension.NETHER),
  };
  game.dimension = data.dimension || Dimension.OVERWORLD;
  game.world = new World(data.seed, game.dimension);
  game.world.applyEdits(game.editsCache[game.dimension]);
  game.inventory = Inventory.fromJSON(data.inventory);
  game.equipment = Equipment.fromJSON(data.equipment);
  game.input.mode = data.interactMode || "mine";
  game.player.x = data.player?.x ?? game.player.x;
  game.player.y = data.player?.y ?? game.player.y;
}
