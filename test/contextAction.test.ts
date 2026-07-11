import { Crafting } from "../src/core/Crafting";
import { ContextAction, Interactable } from "../src/entities/Interactable";
import { Player } from "../src/player/Player";

class TestInteractable extends Interactable {
  private readonly text: string;

  constructor(text: string) {
    super({
      id: "test-target",
      type: "object",
      x: 0,
      y: 0,
      width: 16,
      height: 16,
    });
    this.text = text;
  }

  public getContextAction(): ContextAction {
    return {
      label: "检查",
      handler: async () => this.text,
    };
  }
}

describe("ContextAction & Crafting", () => {
  it("runs interactable context action handler", async () => {
    const target = new TestInteractable("你检查了测试对象。");
    const action = target.getContextAction();
    expect(action.label).toBe("检查");
    await expect(action.handler()).resolves.toBe("你检查了测试对象。");
  });

  it("matches mud + water recipe", () => {
    const result = Crafting.tryCraft([
      { id: "mud", qty: 1 },
      { id: "water", qty: 1 },
    ]);
    expect(result.success).toBe(true);
    expect(result.resultItem?.id).toBe("mud-ball");
  });

  it("fails crafting for non recipe ingredients", () => {
    const result = Crafting.tryCraft([
      { id: "mud", qty: 1 },
      { id: "stone", qty: 1 },
    ]);
    expect(result.success).toBe(false);
  });

  it("supports player inventory add/remove/equip flow", () => {
    const player = new Player({
      id: "p1",
      name: "tester",
      x: 0,
      y: 0,
      inventory: [],
    });

    player.addItem({ id: "mud", name: "泥", type: "material", qty: 2 });
    player.addItem({ id: "knife", name: "小刀", type: "equipment", qty: 1 });

    expect(player.getTotalItemCount("mud")).toBe(2);
    expect(player.removeItem("mud", 1)).toBe(true);
    expect(player.getTotalItemCount("mud")).toBe(1);

    const equipSlot = player.inventory.findIndex((item) => item?.id === "knife");
    expect(equipSlot).toBeGreaterThanOrEqual(0);
    expect(player.equip(equipSlot, "weapon")).toBe(true);
    expect(player.equipped.weapon?.id).toBe("knife");
  });
});
