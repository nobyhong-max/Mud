export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
};

export class Player {
  public readonly id: string;
  public name: string;
  public x: number;
  public y: number;
  public hp: number;
  public stamina: number;
  public level: number;
  public inventory: InventoryItem[];

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
    inventory?: InventoryItem[];
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
    this.inventory = params.inventory ?? [];
    this.walkSpeed = params.walkSpeed ?? 55;
    this.runSpeed = params.runSpeed ?? 95;
    this.staminaRecoverPerSecond = params.staminaRecoverPerSecond ?? 5;
    this.staminaCostPerSecondWhenRunning = params.staminaCostPerSecondWhenRunning ?? 20;
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
}
