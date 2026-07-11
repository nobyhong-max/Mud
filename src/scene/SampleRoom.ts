import { Interactable } from "../entities/Interactable";
import { Chest } from "../entities/Chest";
import { Npc } from "../entities/Npc";
import { Item } from "../player/Player";

export class SampleRoom {
  public static readonly ROOM_ID = "sample-room";

  public readonly sceneId = SampleRoom.ROOM_ID;
  public readonly questTip = "任务目标：拾取泥 + 水 -> 合成泥球";

  public createInteractables(params: {
    collectItem: (item: Item) => { success: boolean; message: string };
  }): Interactable[] {
    const npc = new Npc({
      id: "npc-guide",
      name: "阿土",
      x: -108,
      y: 38,
      width: 30,
      height: 44,
      dialogueLines: [
        "欢迎来到泥巴小屋！",
        "先去打开宝箱，拿到泥和水。",
        "把泥和水拖到一起就能合成泥球。",
      ],
    });

    const chest = new Chest({
      id: "chest-starter",
      x: 118,
      y: 32,
      width: 32,
      height: 26,
      contents: [
        { id: "mud", name: "泥", type: "material", qty: 1 },
        { id: "water", name: "水", type: "material", qty: 1 },
      ],
      collectItem: params.collectItem,
    });

    return [npc, chest];
  }
}
