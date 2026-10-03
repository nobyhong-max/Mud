import { SAVE_KEY } from "./constants.js";
import { World } from "./world.js";
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
  const baseline = game.baselineBlocks || World.baseline(game.world.seed);
  return {
    v: 1,
    seed: game.world.seed,
    edits: game.world.collectEdits(baseline),
    player: { x: game.player.x, y: game.player.y },
    inventory: game.inventory.toJSON(),
    mode: game.input.mode,
    savedAt: Date.now(),
  };
}

export function applySave(game, data) {
  game.world = new World(data.seed);
  game.baselineBlocks = World.baseline(data.seed);
  game.world.applyEdits(data.edits);
  game.player.x = data.player?.x ?? game.player.x;
  game.player.y = data.player?.y ?? game.player.y;
  game.inventory = Inventory.fromJSON(data.inventory);
  if (data.mode) game.input.mode = data.mode;
}
