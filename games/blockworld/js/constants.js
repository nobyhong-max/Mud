/** 掘地建造 — shared constants */
export const TILE = 16;
export const WORLD_W = 512;
export const WORLD_H = 96;
export const GRAVITY = 0.45;
export const MAX_FALL = 14;
export const MOVE_SPEED = 3.2;
export const JUMP_V = -9.2;
export const REACH = 5.5;
export const MINE_TIME_MS = 420;

export const Block = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
};

export const BLOCK_META = {
  [Block.AIR]: { name: "空气", solid: false, mineable: false, color: null },
  [Block.GRASS]: { name: "草方块", solid: true, mineable: true, color: "#5a9e4a", top: "#6bc04e", drop: Block.DIRT },
  [Block.DIRT]: { name: "泥土", solid: true, mineable: true, color: "#8b5a3c", drop: Block.DIRT },
  [Block.STONE]: { name: "石头", solid: true, mineable: true, color: "#7a7a82", drop: Block.STONE },
  [Block.WOOD]: { name: "原木", solid: true, mineable: true, color: "#6b4f2a", drop: Block.WOOD },
  [Block.LEAVES]: { name: "树叶", solid: true, mineable: true, color: "#3d8b40", drop: Block.LEAVES },
};

export const HOTBAR_TYPES = [Block.DIRT, Block.STONE, Block.WOOD, Block.GRASS, Block.LEAVES];

export const SAVE_KEY = "laoer-juedi-v1";
