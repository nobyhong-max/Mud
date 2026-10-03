import { Block, Item } from "./constants.js";

/** Recipe: inputs map id->count, outputs [{ id, count }] */
export const RECIPES = [
  {
    id: "crafting_table",
    name: "工作台",
    inputs: { [Block.WOOD]: 4 },
    outputs: [{ id: Block.CRAFTING_TABLE, count: 1 }],
  },
  {
    id: "wood_pick",
    name: "木镐",
    inputs: { [Block.WOOD]: 3, [Block.STONE]: 2 },
    outputs: [{ id: Item.WOOD_PICK, count: 1 }],
  },
  {
    id: "stone_pick",
    name: "石镐",
    inputs: { [Block.STONE]: 3, [Block.WOOD]: 2 },
    outputs: [{ id: Item.STONE_PICK, count: 1 }],
  },
  {
    id: "flint_steel",
    name: "打火石",
    inputs: { [Block.STONE]: 1, [Block.WOOD]: 1 },
    outputs: [{ id: Item.FLINT_STEEL, count: 1 }],
  },
  {
    id: "leather_set",
    name: "皮革帽",
    inputs: { [Block.DIRT]: 4 },
    outputs: [{ id: Item.LEATHER_HELM, count: 1 }],
  },
  {
    id: "leather_chest",
    name: "皮革胸甲",
    inputs: { [Block.DIRT]: 6 },
    outputs: [{ id: Item.LEATHER_CHEST, count: 1 }],
  },
  {
    id: "leather_legs",
    name: "皮革护腿",
    inputs: { [Block.DIRT]: 5 },
    outputs: [{ id: Item.LEATHER_LEGS, count: 1 }],
  },
  {
    id: "obsidian_pack",
    name: "黑曜石×4",
    inputs: { [Block.STONE]: 8 },
    outputs: [{ id: Block.OBSIDIAN, count: 4 }],
  },
  {
    id: "nether_brick",
    name: "下界砖×4",
    inputs: { [Block.NETHERRACK]: 4 },
    outputs: [{ id: Block.NETHER_BRICK, count: 4 }],
  },
];

export function canCraft(recipe, counts) {
  for (const [id, need] of Object.entries(recipe.inputs)) {
    if ((counts[Number(id)] || 0) < need) return false;
  }
  return true;
}

export function applyCraft(recipe, inventory) {
  if (!canCraft(recipe, inventory.counts)) return false;
  for (const [id, need] of Object.entries(recipe.inputs)) {
    inventory.counts[Number(id)] -= need;
  }
  for (const out of recipe.outputs) {
    inventory.add(out.id, out.count);
  }
  return true;
}
