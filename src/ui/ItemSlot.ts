import {
  _decorator,
  Color,
  Component,
  EventTouch,
  Label,
  Node,
  Sprite,
  UITransform,
  Vec3,
  tween,
} from "cc";
import { Item } from "../player/Player";

const { ccclass } = _decorator;

@ccclass("ItemSlot")
export class ItemSlot extends Component {
  private slotIndex = 0;
  private item: Item | null = null;
  private iconLabel: Label | null = null;
  private qtyLabel: Label | null = null;
  private dropHandler: ((fromIndex: number, worldX: number, worldY: number) => void) | null =
    null;

  onLoad(): void {
    this.ensureSlotVisual();
    this.bindDragEvents();
    this.refresh();
  }

  public setSlotIndex(index: number): void {
    this.slotIndex = index;
  }

  public getSlotIndex(): number {
    return this.slotIndex;
  }

  public setItem(item: Item | null): void {
    this.item = item
      ? {
          id: item.id,
          name: item.name,
          type: item.type,
          qty: item.qty,
          meta: item.meta ? { ...item.meta } : undefined,
        }
      : null;
    this.refresh();
  }

  public getItem(): Item | null {
    if (!this.item) {
      return null;
    }
    return {
      id: this.item.id,
      name: this.item.name,
      type: this.item.type,
      qty: this.item.qty,
      meta: this.item.meta ? { ...this.item.meta } : undefined,
    };
  }

  public setDropHandler(
    handler: (fromIndex: number, worldX: number, worldY: number) => void
  ): void {
    this.dropHandler = handler;
  }

  public containsWorldPoint(worldX: number, worldY: number): boolean {
    const transform = this.node.getComponent(UITransform);
    if (!transform) {
      return false;
    }

    const rect = transform.getBoundingBoxToWorld();
    return (
      worldX >= rect.x &&
      worldX <= rect.x + rect.width &&
      worldY >= rect.y &&
      worldY <= rect.y + rect.height
    );
  }

  private ensureSlotVisual(): void {
    let transform = this.node.getComponent(UITransform);
    if (!transform) {
      transform = this.node.addComponent(UITransform);
    }
    transform.setContentSize(72, 72);

    let sprite = this.node.getComponent(Sprite);
    if (!sprite) {
      sprite = this.node.addComponent(Sprite);
    }
    sprite.color = new Color(60, 62, 72, 220);

    const iconNode = new Node("IconLabel");
    iconNode.setPosition(new Vec3(0, 4, 0));
    const iconLabel = iconNode.addComponent(Label);
    iconLabel.fontSize = 17;
    iconLabel.lineHeight = 18;
    iconLabel.color = Color.WHITE;
    iconLabel.string = "";
    this.node.addChild(iconNode);
    this.iconLabel = iconLabel;

    const qtyNode = new Node("QtyLabel");
    qtyNode.setPosition(new Vec3(20, -24, 0));
    const qtyLabel = qtyNode.addComponent(Label);
    qtyLabel.fontSize = 14;
    qtyLabel.lineHeight = 15;
    qtyLabel.color = new Color(240, 240, 120);
    qtyLabel.string = "";
    this.node.addChild(qtyNode);
    this.qtyLabel = qtyLabel;
  }

  private bindDragEvents(): void {
    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchFinished, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchFinished, this);
  }

  private onTouchStart(): void {
    tween(this.node)
      .stop()
      .to(0.06, { scale: new Vec3(0.92, 0.92, 1) })
      .start();
  }

  private onTouchFinished(event: EventTouch): void {
    tween(this.node)
      .stop()
      .to(0.08, { scale: new Vec3(1, 1, 1) })
      .start();

    if (!this.dropHandler || !this.item) {
      return;
    }

    const uiPos = event.getUILocation();
    this.dropHandler(this.slotIndex, uiPos.x, uiPos.y);
  }

  private refresh(): void {
    if (!this.iconLabel || !this.qtyLabel) {
      return;
    }

    if (!this.item) {
      this.iconLabel.string = "";
      this.qtyLabel.string = "";
      return;
    }

    const token = this.item.name.trim();
    this.iconLabel.string = token.length > 0 ? token.slice(0, 2) : this.item.id.slice(0, 2);
    this.qtyLabel.string = this.item.qty > 1 ? `x${this.item.qty}` : "";
  }
}
