/** 掘地建造 3D — shared constants */
export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const SEA_LEVEL = 62;
export const RENDER_DISTANCE = 4;
export const REACH = 5.5;
export const MINE_TIME_MS = 420;
export const GRAVITY = 0.45;
export const MAX_FALL = 14;
export const MOVE_SPEED = 3.2;
export const FLY_SPEED = 4.5;
export const JUMP_V = -9.2;
export const GameMode = {
  SURVIVAL: "survival",
  CREATIVE: "creative",
};

export const Dimension = {
  OVERWORLD: "overworld",
  NETHER: "nether",
};

export const Block = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  OBSIDIAN: 6,
  CRAFTING_TABLE: 7,
  PORTAL: 8,
  NETHERRACK: 9,
  NETHER_BRICK: 10,
  GLOWSTONE: 11,
  SAND: 12,
};

/** Non-block items (hotbar / craft) */
export const Item = {
  FLINT_STEEL: 101,
  WOOD_PICK: 102,
  STONE_PICK: 103,
  WOOD_SWORD: 104,
  LEATHER_HELM: 110,
  LEATHER_CHEST: 111,
  LEATHER_LEGS: 112,
};

export const BLOCK_META = {
  [Block.AIR]: { name: "空气", solid: false, mineable: false, hardness: 0 },
  [Block.GRASS]: { name: "草方块", solid: true, mineable: true, color: "#5a9e4a", top: "#6bc04e", drop: Block.DIRT, hardness: 0.6 },
  [Block.DIRT]: { name: "泥土", solid: true, mineable: true, color: "#8b5a3c", drop: Block.DIRT, hardness: 0.55 },
  [Block.STONE]: { name: "石头", solid: true, mineable: true, color: "#7a7a82", drop: Block.STONE, hardness: 1.2 },
  [Block.WOOD]: { name: "原木", solid: true, mineable: true, color: "#6b4f2a", drop: Block.WOOD, hardness: 0.85 },
  [Block.LEAVES]: { name: "树叶", solid: true, mineable: true, color: "#3d8b40", drop: Block.LEAVES, hardness: 0.25 },
  [Block.OBSIDIAN]: { name: "黑曜石", solid: true, mineable: true, color: "#1a1028", drop: Block.OBSIDIAN, hardness: 2.8 },
  [Block.CRAFTING_TABLE]: { name: "工作台", solid: true, mineable: true, color: "#9a6b3a", drop: Block.CRAFTING_TABLE, hardness: 0.9 },
  [Block.PORTAL]: { name: "下界门", solid: false, mineable: false, color: "#6a1fb0", portal: true, hardness: 0 },
  [Block.NETHERRACK]: { name: "下界岩", solid: true, mineable: true, color: "#6b2d2d", drop: Block.NETHERRACK, hardness: 0.7 },
  [Block.NETHER_BRICK]: { name: "下界砖", solid: true, mineable: true, color: "#3a2020", drop: Block.NETHER_BRICK, hardness: 1 },
  [Block.GLOWSTONE]: { name: "萤石", solid: true, mineable: true, color: "#e8c870", drop: Block.GLOWSTONE, hardness: 0.5 },
  [Block.SAND]: { name: "沙子", solid: true, mineable: true, color: "#dbc87a", drop: Block.SAND, hardness: 0.45 },
};

export const ITEM_META = {
  [Item.FLINT_STEEL]: { name: "打火石", icon: "🔥", tool: "ignite", mineMul: 1 },
  [Item.WOOD_PICK]: { name: "木镐", icon: "⛏", tool: "pick", mineMul: 1.35, tier: 1 },
  [Item.STONE_PICK]: { name: "石镐", icon: "⛏", tool: "pick", mineMul: 1.85, tier: 2 },
  [Item.WOOD_SWORD]: { name: "木剑", icon: "🗡", tool: "sword", mineMul: 1.1 },
  [Item.LEATHER_HELM]: { name: "皮革帽", icon: "🎩", slot: "head", color: "#8d6e63" },
  [Item.LEATHER_CHEST]: { name: "皮革胸甲", icon: "🦺", slot: "chest", color: "#795548" },
  [Item.LEATHER_LEGS]: { name: "皮革护腿", icon: "👖", slot: "legs", color: "#6d4c41" },
};

export const HOTBAR_DEFAULT = [Block.DIRT, Block.STONE, Block.WOOD, Item.WOOD_PICK, Item.FLINT_STEEL];

export const SAVE_KEY = "laoer-juedi-3d-v1";
export const PORTAL_INNER_MIN_W = 4;
export const PORTAL_INNER_MIN_H = 5;

export function isBlock(id) {
  return id > 0 && id < 100;
}

export function isItem(id) {
  return id >= 100;
}

export function stackName(id) {
  if (isBlock(id)) return BLOCK_META[id]?.name || "?";
  return ITEM_META[id]?.name || "?";
}

export function stackColor(id) {
  if (isBlock(id)) return BLOCK_META[id]?.color || "#444";
  return ITEM_META[id]?.color || "#5a4a3a";
}
