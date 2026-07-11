import {
  _decorator,
  Color,
  Component,
  Label,
  Node,
  Sprite,
  UITransform,
  Vec3,
  tween,
} from "cc";
import { Crafting } from "../core/Crafting";
import { Item, Player } from "../player/Player";
import { ItemSlot } from "./ItemSlot";

const { ccclass } = _decorator;

@ccclass("InventoryPanel")
export class InventoryPanel extends Component {
  public static readonly EVENT_MESSAGE = "inventory-message";

  private static readonly COLUMNS = 3;
  private static readonly ROWS = 4;
  private static readonly SLOT_SIZE = 72;
  private static readonly SLOT_GAP = 8;

  private player: Player | null = null;
  private slots: ItemSlot[] = [];
  private shownPosition = new Vec3();
  private hiddenPosition = new Vec3();
  private isShown = false;

  onLoad(): void {
    this.ensurePanelVisual();
    this.createSlots();

    this.shownPosition = this.node.position.clone();
    this.hiddenPosition = new Vec3(
      this.shownPosition.x + 250,
      this.shownPosition.y,
      this.shownPosition.z
    );
    this.node.setPosition(this.hiddenPosition);
  }

  public bindPlayer(player: Player): void {
    this.player = player;
    this.refresh();
  }

  public show(): void {
    this.isShown = true;
    tween(this.node)
      .stop()
      .to(0.2, { position: this.shownPosition })
      .start();
  }

  public hide(): void {
    this.isShown = false;
    tween(this.node)
      .stop()
      .to(0.2, { position: this.hiddenPosition })
      .start();
  }

  public toggle(): void {
    if (this.isShown) {
      this.hide();
      return;
    }
    this.show();
  }

  public refresh(): void {
    if (!this.player) {
      return;
    }

    for (let index = 0; index < this.slots.length; index += 1) {
      this.slots[index].setItem(this.player.getItemAt(index));
    }
  }

  private ensurePanelVisual(): void {
    let transform = this.node.getComponent(UITransform);
    if (!transform) {
      transform = this.node.addComponent(UITransform);
    }

    const panelWidth = 240;
    const panelHeight = 360;
    transform.setContentSize(panelWidth, panelHeight);

    let sprite = this.node.getComponent(Sprite);
    if (!sprite) {
      sprite = this.node.addComponent(Sprite);
    }
    sprite.color = new Color(26, 30, 40, 230);

    const titleNode = new Node("InventoryTitle");
    titleNode.setPosition(new Vec3(0, panelHeight * 0.5 - 22, 0));
    const titleLabel = titleNode.addComponent(Label);
    titleLabel.fontSize = 20;
    titleLabel.lineHeight = 21;
    titleLabel.color = Color.WHITE;
    titleLabel.string = "背包 3x4";
    this.node.addChild(titleNode);
  }

  private createSlots(): void {
    const gridWidth =
      InventoryPanel.COLUMNS * InventoryPanel.SLOT_SIZE +
      (InventoryPanel.COLUMNS - 1) * InventoryPanel.SLOT_GAP;
    const gridHeight =
      InventoryPanel.ROWS * InventoryPanel.SLOT_SIZE +
      (InventoryPanel.ROWS - 1) * InventoryPanel.SLOT_GAP;
    const startX = -gridWidth * 0.5 + InventoryPanel.SLOT_SIZE * 0.5;
    const startY = gridHeight * 0.5 - InventoryPanel.SLOT_SIZE * 0.5 + 28;

    for (let row = 0; row < InventoryPanel.ROWS; row += 1) {
      for (let col = 0; col < InventoryPanel.COLUMNS; col += 1) {
        const index = row * InventoryPanel.COLUMNS + col;
        const slotNode = new Node(`Slot_${index}`);
        slotNode.setPosition(
          new Vec3(
            startX + col * (InventoryPanel.SLOT_SIZE + InventoryPanel.SLOT_GAP),
            startY - row * (InventoryPanel.SLOT_SIZE + InventoryPanel.SLOT_GAP),
            0
          )
        );
        this.node.addChild(slotNode);

        const slot = slotNode.addComponent(ItemSlot);
        slot.setSlotIndex(index);
        slot.setDropHandler((fromIndex, worldX, worldY) => {
          this.handleDrop(fromIndex, worldX, worldY);
        });
        this.slots.push(slot);
      }
    }
  }

  private handleDrop(fromIndex: number, worldX: number, worldY: number): void {
    if (!this.player) {
      return;
    }

    const targetSlot = this.slots.find((slot) => slot.containsWorldPoint(worldX, worldY));
    if (!targetSlot) {
      this.refresh();
      return;
    }

    const toIndex = targetSlot.getSlotIndex();
    if (toIndex === fromIndex) {
      this.refresh();
      return;
    }

    const fromItem = this.player.getItemAt(fromIndex);
    const toItem = this.player.getItemAt(toIndex);
    if (!fromItem) {
      this.refresh();
      return;
    }

    if (toItem && toItem.id !== fromItem.id) {
      const craftResult = Crafting.tryCraftByItems(fromItem, toItem);
      if (craftResult.success && craftResult.resultItem) {
        this.consumeOne(fromIndex, fromItem);
        this.consumeOne(toIndex, toItem);
        const addResult = this.player.addItem(craftResult.resultItem);
        const message = addResult.success
          ? craftResult.message
          : `${craftResult.message}，但背包已满`;
        this.node.emit(InventoryPanel.EVENT_MESSAGE, message);
      } else {
        this.player.moveItem(fromIndex, toIndex);
        this.node.emit(InventoryPanel.EVENT_MESSAGE, "无法合成，已交换位置。");
      }
    } else {
      this.player.moveItem(fromIndex, toIndex);
    }

    this.refresh();
  }

  private consumeOne(slotIndex: number, item: Item): void {
    if (item.qty <= 1) {
      this.player?.setItemAt(slotIndex, null);
      return;
    }

    this.player?.setItemAt(slotIndex, {
      id: item.id,
      name: item.name,
      type: item.type,
      qty: item.qty - 1,
      meta: item.meta ? { ...item.meta } : undefined,
    });
  }
}
