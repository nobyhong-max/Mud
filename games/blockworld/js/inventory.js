import { Block, HOTBAR_DEFAULT, Item, isBlock } from "./constants.js";

export class Inventory {
  constructor() {
    this.counts = {
      [Block.DIRT]: 16,
      [Block.STONE]: 8,
      [Block.WOOD]: 8,
      [Block.GRASS]: 4,
      [Block.OBSIDIAN]: 0,
      [Block.CRAFTING_TABLE]: 0,
      [Item.FLINT_STEEL]: 0,
      [Item.WOOD_PICK]: 1,
    };
    this.hotbar = HOTBAR_DEFAULT.map((t) => t);
    this.selected = 0;
  }

  add(id, n = 1) {
    if (!id) return;
    this.counts[id] = (this.counts[id] || 0) + n;
  }

  has(id, n = 1) {
    return (this.counts[id] || 0) >= n;
  }

  canPlace(id, creative) {
    if (creative && isBlock(id)) return true;
    return (this.counts[id] || 0) > 0;
  }

  use(id, creative) {
    if (creative && isBlock(id)) return true;
    if (!this.canPlace(id, false)) return false;
    this.counts[id]--;
    return true;
  }

  selectedStack() {
    return this.hotbar[this.selected] || Block.DIRT;
  }

  select(index) {
    if (index >= 0 && index < this.hotbar.length) this.selected = index;
  }

  assignHotbar(index, id) {
    if (index >= 0 && index < this.hotbar.length && id) {
      this.hotbar[index] = id;
    }
  }

  toJSON() {
    return { counts: { ...this.counts }, hotbar: [...this.hotbar], selected: this.selected };
  }

  static fromJSON(data) {
    const inv = new Inventory();
    if (!data) return inv;
    if (data.counts) inv.counts = { ...inv.counts, ...data.counts };
    if (data.hotbar?.length) inv.hotbar = data.hotbar.slice(0, 5);
    if (typeof data.selected === "number") inv.selected = data.selected;
    return inv;
  }
}
