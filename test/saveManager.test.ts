import { SaveData, SaveManager } from "../src/core/SaveManager";

function createSaveData(): SaveData {
  return {
    version: "1.0",
    player: {
      id: "p-save",
      x: 12,
      y: -8,
      hp: 88,
      stamina: 45,
      level: 3,
      inventory: [
        { id: "mud", name: "泥", type: "material", qty: 2 },
        { id: "water", name: "水", type: "material", qty: 1 },
      ],
      equipped: {
        weapon: { id: "stick", name: "木棍", type: "equipment", qty: 1 },
        armor: null,
        accessory: null,
      },
    },
    scene: {
      currentSceneId: "sample-room",
      discoveredRooms: ["sample-room"],
    },
    timestamp: Date.now(),
  };
}

describe("SaveManager local save/load", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves then loads identical data", async () => {
    const manager = new SaveManager();
    const data = createSaveData();

    const saved = await manager.saveLocal(data);
    expect(saved).toBe(true);

    const loaded = await manager.loadLocal();
    expect(loaded).toEqual(data);
  });

  it("returns parse error for corrupted save data", async () => {
    const manager = new SaveManager();
    localStorage.setItem("mud.save.local.v1", "{broken-json}");

    const loaded = await manager.loadLocal();
    expect(loaded).toBeNull();
    expect(manager.getLastResult().code).toBe("DESERIALIZE_ERROR");
  });
});
