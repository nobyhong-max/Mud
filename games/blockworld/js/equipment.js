import { Item, ITEM_META } from "./constants.js";

export class Equipment {
  constructor() {
    this.slots = {
      head: null,
      chest: null,
      legs: null,
      tool: null,
    };
  }

  equip(itemId) {
    const meta = ITEM_META[itemId];
    if (!meta?.slot && meta?.tool) {
      this.slots.tool = itemId;
      return true;
    }
    if (meta?.slot) {
      this.slots[meta.slot] = itemId;
      return true;
    }
    return false;
  }

  unequip(slot) {
    const prev = this.slots[slot];
    this.slots[slot] = null;
    return prev;
  }

  mineMultiplier(hotbarItem) {
    let mul = 1;
    const tool = this.slots.tool || (hotbarItem && ITEM_META[hotbarItem]?.tool ? hotbarItem : null);
    if (tool && ITEM_META[tool]?.mineMul) mul *= ITEM_META[tool].mineMul;
    return mul;
  }

  toJSON() {
    return { slots: { ...this.slots } };
  }

  static fromJSON(data) {
    const eq = new Equipment();
    if (data?.slots) eq.slots = { ...eq.slots, ...data.slots };
    return eq;
  }
}
