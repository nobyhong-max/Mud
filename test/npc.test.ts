import { Npc } from "../src/entities/Npc";

describe("Npc dialogue", () => {
  it("shows dialogue lines one by one in order", async () => {
    const npc = new Npc({
      id: "npc-1",
      name: "阿土",
      x: 0,
      y: 0,
      width: 30,
      height: 44,
      dialogueLines: ["第一句", "第二句", "第三句"],
    });

    const action = npc.getContextAction();
    await expect(action.handler()).resolves.toBe("阿土：第一句");
    await expect(action.handler()).resolves.toBe("阿土：第二句");
    await expect(action.handler()).resolves.toBe("阿土：第三句");
  });

  it("loops dialogue when reaching the end", async () => {
    const npc = new Npc({
      id: "npc-2",
      name: "村民",
      x: 0,
      y: 0,
      width: 30,
      height: 44,
      dialogueLines: ["你好"],
    });

    const action = npc.getContextAction();
    await expect(action.handler()).resolves.toBe("村民：你好");
    await expect(action.handler()).resolves.toBe("村民：你好");
  });
});
