import { Item } from "../player/Player";
import { ContextAction, Interactable } from "./Interactable";

type CollectResult = { success: boolean; message: string };

export class Chest extends Interactable {
  public isOpen: boolean;
  public readonly contents: Item[];
  private readonly collectItem: (item: Item) => CollectResult;

  constructor(params: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    contents: Item[];
    collectItem: (item: Item) => CollectResult;
    isOpen?: boolean;
  }) {
    super({
      id: params.id,
      type: "container",
      x: params.x,
      y: params.y,
      width: params.width,
      height: params.height,
    });
    this.isOpen = params.isOpen ?? false;
    this.contents = params.contents.map((item) => this.cloneItem(item));
    this.collectItem = params.collectItem;
  }

  public getContextAction(): ContextAction {
    return {
      label: this.isOpen ? "查看宝箱" : "打开宝箱",
      handler: async () => this.open(),
    };
  }

  public open(): string {
    if (this.isOpen) {
      return "宝箱已经打开过了。";
    }
    if (this.contents.length === 0) {
      this.isOpen = true;
      return "宝箱里空空如也。";
    }

    const pickedNames: string[] = [];
    let failedCount = 0;
    for (const item of this.contents) {
      const result = this.collectItem(this.cloneItem(item));
      if (result.success) {
        pickedNames.push(`${item.name} x${item.qty}`);
      } else {
        failedCount += 1;
      }
    }
    this.isOpen = true;

    if (pickedNames.length === 0) {
      return "你打开宝箱，但背包已满，什么也没拿到。";
    }
    if (failedCount > 0) {
      return `你打开宝箱，获得 ${pickedNames.join("、")}，其余物品未能拾取。`;
    }
    return `你打开宝箱，获得 ${pickedNames.join("、")}。`;
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
