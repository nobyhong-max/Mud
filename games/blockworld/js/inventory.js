import { Block, HOTBAR_TYPES } from "./constants.js";

export class Inventory {
  constructor() {
    this.counts = {
      [Block.DIRT]: 16,
      [Block.STONE]: 8,
      [Block.WOOD]: 8,
      [Block.GRASS]: 4,
      [Block.LEAVES]: 4,
    };
    this.hotbar = HOTBAR_TYPES.map((t) => t);
    this.selected = 0;
  }

  add(blockId, n = 1) {
    if (!blockId || blockId === Block.AIR) return;
    this.counts[blockId] = (this.counts[blockId] || 0) + n;
  }

  canPlace(blockId) {
    return (this.counts[blockId] || 0) > 0;
  }

  use(blockId) {
    if (!this.canPlace(blockId)) return false;
    this.counts[blockId]--;
    return true;
  }

  selectedBlock() {
    return this.hotbar[this.selected] || Block.DIRT;
  }

  select(index) {
    if (index >= 0 && index < this.hotbar.length) this.selected = index;
  }

  cycle(delta) {
    const n = this.hotbar.length;
    this.selected = (this.selected + delta + n) % n;
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
