export type ItemType = "consumable" | "material" | "key" | "equipment";

export type Item = {
  id: string;
  name: string;
  type: ItemType;
  qty: number;
  meta?: Record<string, unknown>;
};

export class Player {
  public readonly id: string;
  public name: string;
  public x: number;
  public y: number;
  public hp: number;
  public stamina: number;
  public level: number;
  public inventory: Array<Item | null>;
  public equipped: Record<string, Item | null>;
  public readonly inventorySize: number;

  private targetX: number;
  private targetY: number;
  private moving = false;
  private running = false;

  private readonly walkSpeed: number;
  private readonly runSpeed: number;
  private readonly maxStamina: number;
  private readonly staminaRecoverPerSecond: number;
  private readonly staminaCostPerSecondWhenRunning: number;

  constructor(params: {
    id: string;
    name: string;
    x: number;
    y: number;
    hp?: number;
    stamina?: number;
    level?: number;
    inventory?: Item[];
    inventorySize?: number;
    walkSpeed?: number;
    runSpeed?: number;
    maxStamina?: number;
    staminaRecoverPerSecond?: number;
    staminaCostPerSecondWhenRunning?: number;
  }) {
    this.id = params.id;
    this.name = params.name;
    this.x = params.x;
    this.y = params.y;
    this.targetX = params.x;
    this.targetY = params.y;
    this.hp = params.hp ?? 100;
    this.maxStamina = params.maxStamina ?? 100;
    this.stamina = Math.min(params.stamina ?? this.maxStamina, this.maxStamina);
    this.level = params.level ?? 1;
    this.inventorySize = Math.max(1, params.inventorySize ?? 12);
    this.inventory = new Array<Item | null>(this.inventorySize).fill(null);
    this.equipped = {
      weapon: null,
      armor: null,
      accessory: null,
    };
    this.walkSpeed = params.walkSpeed ?? 55;
    this.runSpeed = params.runSpeed ?? 95;
    this.staminaRecoverPerSecond = params.staminaRecoverPerSecond ?? 5;
    this.staminaCostPerSecondWhenRunning = params.staminaCostPerSecondWhenRunning ?? 20;

    for (const item of params.inventory ?? []) {
      this.addItem(item);
    }
  }

  public addItem(item: Item): { success: boolean; slot: number; message: string } {
    if (item.qty <= 0) {
      return { success: false, slot: -1, message: "数量必须大于 0" };
    }

    const nextItem = this.cloneItem(item);
    if (nextItem.type !== "equipment") {
      const stackSlot = this.inventory.findIndex((entry) => entry?.id === nextItem.id);
      if (stackSlot >= 0) {
        const stack = this.inventory[stackSlot];
        if (stack) {
          stack.qty += nextItem.qty;
          return { success: true, slot: stackSlot, message: `已叠加 ${nextItem.name}` };
        }
      }
    }

    const emptySlot = this.findEmptySlot();
    if (emptySlot < 0) {
      return { success: false, slot: -1, message: "背包已满" };
    }

    this.inventory[emptySlot] = nextItem;
    return { success: true, slot: emptySlot, message: `获得 ${nextItem.name}` };
  }

  public removeItem(itemId: string, qty = 1): boolean {
    if (qty <= 0) {
      return true;
    }

    const total = this.getTotalItemCount(itemId);
    if (total < qty) {
      return false;
    }

    let remaining = qty;
    for (let index = 0; index < this.inventory.length && remaining > 0; index += 1) {
      const entry = this.inventory[index];
      if (!entry || entry.id !== itemId) {
        continue;
      }

      const used = Math.min(entry.qty, remaining);
      entry.qty -= used;
      remaining -= used;
      if (entry.qty <= 0) {
        this.inventory[index] = null;
      }
    }

    return true;
  }

  public moveItem(fromIndex: number, toIndex: number): boolean {
    if (!this.isValidSlotIndex(fromIndex) || !this.isValidSlotIndex(toIndex)) {
      return false;
    }

    if (fromIndex === toIndex) {
      return true;
    }

    const fromItem = this.inventory[fromIndex];
    const toItem = this.inventory[toIndex];
    if (!fromItem) {
      return false;
    }

    if (
      toItem &&
      fromItem.id === toItem.id &&
      fromItem.type !== "equipment" &&
      toItem.type !== "equipment"
    ) {
      toItem.qty += fromItem.qty;
      this.inventory[fromIndex] = null;
      return true;
    }

    this.inventory[fromIndex] = toItem ? this.cloneItem(toItem) : null;
    this.inventory[toIndex] = this.cloneItem(fromItem);
    return true;
  }

  public equip(slotIndex: number, equipSlot = "weapon"): boolean {
    if (!this.isValidSlotIndex(slotIndex)) {
      return false;
    }

    const targetItem = this.inventory[slotIndex];
    if (!targetItem || targetItem.type !== "equipment") {
      return false;
    }

    const previousEquipped = this.equipped[equipSlot];
    this.equipped[equipSlot] = this.cloneItem(targetItem);
    this.inventory[slotIndex] = null;

    if (!previousEquipped) {
      return true;
    }

    const emptySlot = this.findEmptySlot();
    if (emptySlot < 0) {
      this.inventory[slotIndex] = this.cloneItem(targetItem);
      this.equipped[equipSlot] = this.cloneItem(previousEquipped);
      return false;
    }

    this.inventory[emptySlot] = this.cloneItem(previousEquipped);
    return true;
  }

  public unequip(equipSlot = "weapon"): boolean {
    const equippedItem = this.equipped[equipSlot];
    if (!equippedItem) {
      return false;
    }

    const emptySlot = this.findEmptySlot();
    if (emptySlot < 0) {
      return false;
    }

    this.inventory[emptySlot] = this.cloneItem(equippedItem);
    this.equipped[equipSlot] = null;
    return true;
  }

  public getItemAt(slotIndex: number): Item | null {
    if (!this.isValidSlotIndex(slotIndex)) {
      return null;
    }
    const item = this.inventory[slotIndex];
    return item ? this.cloneItem(item) : null;
  }

  public setItemAt(slotIndex: number, item: Item | null): boolean {
    if (!this.isValidSlotIndex(slotIndex)) {
      return false;
    }
    this.inventory[slotIndex] = item ? this.cloneItem(item) : null;
    return true;
  }

  public getTotalItemCount(itemId: string): number {
    return this.inventory.reduce((sum, entry) => {
      if (!entry || entry.id !== itemId) {
        return sum;
      }
      return sum + entry.qty;
    }, 0);
  }

  public moveTo(x: number, y: number, wantsRun = false): void {
    this.targetX = x;
    this.targetY = y;
    this.running = wantsRun && this.stamina > 0;
    this.moving = true;
  }

  public update(deltaSeconds: number): void {
    if (deltaSeconds <= 0) {
      return;
    }

    this.recoverStamina(deltaSeconds);

    if (!this.moving) {
      return;
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.001) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.moving = false;
      this.running = false;
      return;
    }

    if (this.running && this.stamina <= 0) {
      this.running = false;
    }

    const speed = this.running ? this.runSpeed : this.walkSpeed;
    const step = speed * deltaSeconds;

    if (step >= distance) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.moving = false;
      this.running = false;
    } else {
      this.x += (dx / distance) * step;
      this.y += (dy / distance) * step;
    }

    if (this.running) {
      this.consumeStamina(deltaSeconds * this.staminaCostPerSecondWhenRunning);
      if (this.stamina <= 0) {
        this.stamina = 0;
        this.running = false;
      }
    }
  }

  public isMoving(): boolean {
    return this.moving;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public canRun(): boolean {
    return this.stamina > 0;
  }

  public getMoveSpeed(): number {
    return this.running ? this.runSpeed : this.walkSpeed;
  }

  private recoverStamina(deltaSeconds: number): void {
    this.stamina = Math.min(
      this.maxStamina,
      this.stamina + this.staminaRecoverPerSecond * deltaSeconds
    );
  }

  private consumeStamina(amount: number): void {
    this.stamina = Math.max(0, this.stamina - amount);
  }

  private isValidSlotIndex(index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < this.inventory.length;
  }

  private findEmptySlot(): number {
    return this.inventory.findIndex((entry) => entry === null);
  }

  private cloneItem(item: Item): Item {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      qty: item.qty,
      meta: item.meta ? { ...item.meta } : undefined,
    };
  }
}
