import {
  _decorator,
  assetManager,
  Button,
  Camera,
  Color,
  Component,
  ImageAsset,
  Label,
  Node,
  Rect,
  Sprite,
  SpriteFrame,
  Texture2D,
  UITransform,
  Vec3,
  game,
  Widget,
} from "cc";
import { PixelCamera } from "../camera/PixelCamera";
import { InputManager } from "../core/InputManager";
import { SaveData, SaveManager } from "../core/SaveManager";
import { Interactable } from "../entities/Interactable";
import { Chest } from "../entities/Chest";
import { Item, Player } from "../player/Player";
import { ContextActionButton } from "../ui/ContextActionButton";
import { InventoryPanel } from "../ui/InventoryPanel";
import { SampleRoom } from "./SampleRoom";

const { ccclass } = _decorator;

@ccclass("GameScene")
export class GameScene extends Component {
  public static readonly SCENE_NAME = "GameScene";
  private static readonly TILE_SIZE = 32;
  private static readonly PLAYER_FRAME_SIZE = 48;
  private static readonly DOUBLE_TAP_GAP_MS = 260;
  private static readonly AUTO_SAVE_INTERVAL_SECONDS = 30;
  private static readonly SAVE_HINT_DURATION_SECONDS = 0.8;
  private static readonly QUEST_ITEM_ID = "mud-ball";

  private readonly inputManager = new InputManager(
    PixelCamera.LOGICAL_WIDTH,
    PixelCamera.LOGICAL_HEIGHT
  );
  private readonly saveManager = new SaveManager();
  private readonly sampleRoom = new SampleRoom();
  private readonly discoveredRooms = new Set<string>([SampleRoom.ROOM_ID]);

  private readonly player = new Player({
    id: "player-1",
    name: "Shaolin Football Hero",
    x: 0,
    y: 0,
    hp: 100,
    stamina: 100,
    level: 1,
    inventory: [{ id: "rusty-dagger", name: "旧匕首", type: "equipment", qty: 1 }],
  });

  private pixelCamera: PixelCamera | null = null;
  private playerNode: Node | null = null;
  private playerSprite: Sprite | null = null;
  private playerFrames: SpriteFrame[] = [];
  private staminaLabel: Label | null = null;
  private actionBubbleNode: Node | null = null;
  private actionBubbleLabel: Label | null = null;
  private actionBubbleRemainSeconds = 0;
  private saveHintNode: Node | null = null;
  private saveHintRemainSeconds = 0;
  private contextActionButton: ContextActionButton | null = null;
  private inventoryPanel: InventoryPanel | null = null;
  private interactables: Interactable[] = [];
  private readonly interactableMarkers = new Map<
    string,
    { sprite: Sprite; baseColor: Color }
  >();
  private currentContextTargetId: string | null = null;

  private animationClock = 0;
  private currentAnimationFrame = 0;
  private lastTapTime = 0;
  private autoSaveElapsedSeconds = 0;
  private saveInProgress = false;
  private questCompleted = false;

  /**
   * 场景脚本启动生命周期。
   * 完成像素地板、角色和输入系统初始化。
   */
  start(): void {
    this.initCamera();
    this.createHud();
    this.createPlayerNode();
    this.createContextActionButton();
    this.createInventoryPanel();
    this.createInventoryToggleButton();
    this.createSampleRoomInteractables();
    this.bindInput();
    void this.restoreFromLocalSave().finally(() => {
      this.updateQuestProgress(false);
      if (!this.questCompleted) {
        this.showActionBubble(this.sampleRoom.questTip, 3);
      }
    });

    this.bootstrapVisuals().catch((error: unknown) => {
      // 资源加载失败时保持场景可运行，便于继续调试。
      // eslint-disable-next-line no-console
      console.warn("[GameScene] Failed to load visual assets:", error);
      this.drawTileFloor(null);
      this.ensurePlayerFallbackSprite();
    });
  }

  update(deltaTime: number): void {
    this.player.update(deltaTime);
    this.syncPlayerNodePosition();
    this.updateActionBubble(deltaTime);
    this.updateSaveHint(deltaTime);
    this.updateContextActionTarget();
    this.updateStaminaHud();
    this.updateRunAnimation(deltaTime);
    this.updateAutoSave(deltaTime);
  }

  onDestroy(): void {
    this.inputManager.destroy();
  }

  private async bootstrapVisuals(): Promise<void> {
    const tileTexture = await this.loadTexture("src/assets/tile.png");
    const tileFrame = this.createTileFrame(tileTexture);
    this.drawTileFloor(tileFrame);

    const footballTexture = await this.loadTexture("src/assets/player_football.png");
    this.playerFrames = this.createPlayerFrames(footballTexture);
    if (this.playerFrames.length > 0 && this.playerSprite) {
      this.playerSprite.spriteFrame = this.playerFrames[0];
    } else {
      this.ensurePlayerFallbackSprite();
    }
  }

  private initCamera(): void {
    const cameraNode = new Node("PixelCamera");
    const camera = cameraNode.addComponent(Camera);
    this.pixelCamera = cameraNode.addComponent(PixelCamera);
    this.pixelCamera.targetCamera = camera;
    this.node.addChild(cameraNode);
    this.pixelCamera.refresh();
  }

  private createHud(): void {
    const hudNode = new Node("HUD_Stamina");
    const transform = hudNode.addComponent(UITransform);
    transform.setContentSize(200, 20);
    hudNode.setPosition(
      new Vec3(
        -PixelCamera.LOGICAL_WIDTH * 0.5 + 100,
        PixelCamera.LOGICAL_HEIGHT * 0.5 - 14,
        0
      )
    );

    const label = hudNode.addComponent(Label);
    label.fontSize = 16;
    label.lineHeight = 18;
    label.color = Color.WHITE;
    label.string = "Stamina: 100";

    this.staminaLabel = label;
    this.node.addChild(hudNode);

    const bubbleNode = new Node("ActionBubble");
    const bubbleTransform = bubbleNode.addComponent(UITransform);
    bubbleTransform.setContentSize(300, 36);
    const bubbleSprite = bubbleNode.addComponent(Sprite);
    bubbleSprite.color = new Color(10, 10, 10, 220);
    bubbleNode.setPosition(new Vec3(this.player.x, this.player.y + 56, 9));
    bubbleNode.active = false;

    const bubbleLabelNode = new Node("ActionBubbleText");
    const bubbleLabel = bubbleLabelNode.addComponent(Label);
    bubbleLabel.fontSize = 16;
    bubbleLabel.lineHeight = 18;
    bubbleLabel.color = new Color(255, 250, 210);
    bubbleLabel.string = "";
    bubbleNode.addChild(bubbleLabelNode);

    this.actionBubbleNode = bubbleNode;
    this.actionBubbleLabel = bubbleLabel;
    this.node.addChild(bubbleNode);

    const saveNode = new Node("SavingHint");
    const saveTransform = saveNode.addComponent(UITransform);
    saveTransform.setContentSize(120, 24);
    saveNode.setPosition(
      new Vec3(PixelCamera.LOGICAL_WIDTH * 0.5 - 72, PixelCamera.LOGICAL_HEIGHT * 0.5 - 14, 10)
    );
    const saveLabel = saveNode.addComponent(Label);
    saveLabel.fontSize = 16;
    saveLabel.lineHeight = 17;
    saveLabel.color = new Color(180, 255, 210);
    saveLabel.string = "Saving...";
    saveNode.active = false;

    this.saveHintNode = saveNode;
    this.node.addChild(saveNode);
  }

  private createPlayerNode(): void {
    const playerNode = new Node("Player");
    const playerTransform = playerNode.addComponent(UITransform);
    playerTransform.setContentSize(
      GameScene.PLAYER_FRAME_SIZE,
      GameScene.PLAYER_FRAME_SIZE
    );
    const sprite = playerNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    playerNode.setPosition(new Vec3(this.player.x, this.player.y, 1));
    this.node.addChild(playerNode);

    this.playerNode = playerNode;
    this.playerSprite = sprite;
  }

  private createSampleRoomInteractables(): void {
    this.interactables = this.sampleRoom.createInteractables({
      collectItem: (item: Item) => this.player.addItem(item),
    });

    for (const interactable of this.interactables) {
      if (interactable instanceof Chest) {
        this.createInteractableMarker(interactable, new Color(186, 137, 81), "箱");
      } else {
        this.createInteractableMarker(interactable, new Color(90, 110, 200), "NPC");
      }
    }
  }

  private createInteractableMarker(
    interactable: Interactable,
    color: Color,
    markerText: string
  ): void {
    const markerNode = new Node(`Interactable_${interactable.id}`);
    const transform = markerNode.addComponent(UITransform);
    transform.setContentSize(interactable.width, interactable.height);
    const sprite = markerNode.addComponent(Sprite);
    sprite.color = color;
    markerNode.setPosition(new Vec3(interactable.x, interactable.y, 1));

    const labelNode = new Node("Label");
    const label = labelNode.addComponent(Label);
    label.fontSize = 14;
    label.lineHeight = 15;
    label.color = Color.WHITE;
    label.string = markerText;
    markerNode.addChild(labelNode);

    this.node.addChild(markerNode);
    this.interactableMarkers.set(interactable.id, {
      sprite,
      baseColor: new Color(color.r, color.g, color.b, color.a),
    });
  }

  private createContextActionButton(): void {
    const node = new Node("ContextActionButton");
    const contextButton = node.addComponent(ContextActionButton);
    node.on(
      ContextActionButton.EVENT_ACTION_RESULT,
      (message: string) => {
        this.showActionBubble(message);
        this.inventoryPanel?.refresh();
        this.updateQuestProgress();
      },
      this
    );
    this.contextActionButton = contextButton;
    this.node.addChild(node);
  }

  private createInventoryPanel(): void {
    const panelNode = new Node("InventoryPanel");
    panelNode.setPosition(new Vec3(PixelCamera.LOGICAL_WIDTH * 0.5 - 120, 0, 12));
    const panel = panelNode.addComponent(InventoryPanel);
    panel.bindPlayer(this.player);
    panelNode.on(
      InventoryPanel.EVENT_MESSAGE,
      (message: string) => {
        this.showActionBubble(message);
        this.updateQuestProgress();
      },
      this
    );

    this.inventoryPanel = panel;
    this.node.addChild(panelNode);
    this.inventoryPanel.refresh();
  }

  private createInventoryToggleButton(): void {
    const buttonNode = new Node("InventoryToggleButton");
    const transform = buttonNode.addComponent(UITransform);
    transform.setContentSize(90, 42);
    const sprite = buttonNode.addComponent(Sprite);
    sprite.color = new Color(42, 89, 122, 230);

    const widget = buttonNode.addComponent(Widget);
    widget.isAlignTop = true;
    widget.isAlignRight = true;
    widget.top = 12;
    widget.right = 16;
    widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;

    buttonNode.addComponent(Button);
    buttonNode.on(Button.EventType.CLICK, () => {
      this.inventoryPanel?.toggle();
    });

    const labelNode = new Node("Label");
    const label = labelNode.addComponent(Label);
    label.fontSize = 18;
    label.lineHeight = 19;
    label.color = Color.WHITE;
    label.string = "背包";
    buttonNode.addChild(labelNode);

    this.node.addChild(buttonNode);
  }

  private bindInput(): void {
    const canvasElement =
      (game.canvas as HTMLCanvasElement | null) ??
      (typeof document !== "undefined"
        ? (document.querySelector("canvas") as HTMLCanvasElement | null)
        : null);

    if (!canvasElement) {
      return;
    }

    this.inputManager.init(canvasElement);
    this.inputManager.onTap((x, y) => {
      const now = Date.now();
      const isDoubleTap = now - this.lastTapTime <= GameScene.DOUBLE_TAP_GAP_MS;
      this.lastTapTime = now;
      const worldPos = this.logicToWorld(x, y);
      const shouldRun = isDoubleTap && this.player.canRun();
      this.player.moveTo(worldPos.x, worldPos.y, shouldRun);
      void this.saveGame("move");
    });
  }

  private drawTileFloor(tileFrame: SpriteFrame | null): void {
    const floorRoot = new Node("Floor");
    floorRoot.setPosition(new Vec3(0, 0, -3));
    this.node.addChild(floorRoot);

    const cols = Math.ceil(PixelCamera.LOGICAL_WIDTH / GameScene.TILE_SIZE);
    const rows = Math.ceil(PixelCamera.LOGICAL_HEIGHT / GameScene.TILE_SIZE);
    const startX = -PixelCamera.LOGICAL_WIDTH * 0.5 + GameScene.TILE_SIZE * 0.5;
    const startY = -PixelCamera.LOGICAL_HEIGHT * 0.5 + GameScene.TILE_SIZE * 0.5;

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const tileNode = new Node(`Tile_${col}_${row}`);
        const sprite = tileNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        if (tileFrame) {
          sprite.spriteFrame = tileFrame;
          sprite.color = Color.WHITE;
        } else {
          sprite.color = (col + row) % 2 === 0 ? new Color(46, 78, 48) : new Color(55, 90, 58);
        }

        const transform = tileNode.addComponent(UITransform);
        transform.setContentSize(GameScene.TILE_SIZE, GameScene.TILE_SIZE);

        tileNode.setPosition(
          new Vec3(
            startX + col * GameScene.TILE_SIZE,
            startY + row * GameScene.TILE_SIZE,
            -2
          )
        );
        floorRoot.addChild(tileNode);
      }
    }
  }

  private syncPlayerNodePosition(): void {
    if (!this.playerNode) {
      return;
    }
    this.playerNode.setPosition(new Vec3(this.player.x, this.player.y, 1));
  }

  private updateStaminaHud(): void {
    if (!this.staminaLabel) {
      return;
    }
    this.staminaLabel.string = `Stamina: ${Math.round(this.player.stamina)}`;
  }

  private updateActionBubble(deltaTime: number): void {
    if (!this.actionBubbleNode) {
      return;
    }

    if (this.actionBubbleNode.active) {
      this.actionBubbleNode.setPosition(new Vec3(this.player.x, this.player.y + 56, 9));
      this.actionBubbleRemainSeconds -= deltaTime;
      if (this.actionBubbleRemainSeconds <= 0) {
        this.actionBubbleNode.active = false;
      }
    }
  }

  private updateSaveHint(deltaTime: number): void {
    if (!this.saveHintNode || !this.saveHintNode.active) {
      return;
    }
    this.saveHintRemainSeconds -= deltaTime;
    if (this.saveHintRemainSeconds <= 0) {
      this.saveHintNode.active = false;
    }
  }

  private updateAutoSave(deltaTime: number): void {
    this.autoSaveElapsedSeconds += deltaTime;
    if (this.autoSaveElapsedSeconds < GameScene.AUTO_SAVE_INTERVAL_SECONDS) {
      return;
    }
    this.autoSaveElapsedSeconds = 0;
    void this.saveGame("auto");
  }

  private updateContextActionTarget(): void {
    const nearest = this.findNearestInteractable(66);
    const nearestId = nearest?.id ?? null;
    if (nearestId === this.currentContextTargetId) {
      return;
    }

    this.currentContextTargetId = nearestId;
    this.contextActionButton?.setContext(nearest);
    this.updateInteractableHighlight(nearestId);
  }

  private findNearestInteractable(maxDistance: number): Interactable | null {
    let closest: Interactable | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const target of this.interactables) {
      const dx = this.player.x - target.x;
      const dy = this.player.y - target.y;
      const distance = Math.hypot(dx, dy);
      if (distance > maxDistance || distance >= closestDistance) {
        continue;
      }
      closest = target;
      closestDistance = distance;
    }

    return closest;
  }

  private updateInteractableHighlight(targetId: string | null): void {
    for (const [id, marker] of this.interactableMarkers) {
      if (id === targetId) {
        marker.sprite.color = this.highlightColor(marker.baseColor);
      } else {
        marker.sprite.color = new Color(
          marker.baseColor.r,
          marker.baseColor.g,
          marker.baseColor.b,
          marker.baseColor.a
        );
      }
    }
  }

  private highlightColor(baseColor: Color): Color {
    return new Color(
      Math.min(255, baseColor.r + 55),
      Math.min(255, baseColor.g + 55),
      Math.min(255, baseColor.b + 55),
      255
    );
  }

  private showActionBubble(message: string, durationSeconds = 2.2): void {
    if (!this.actionBubbleLabel || !this.actionBubbleNode) {
      return;
    }

    this.actionBubbleLabel.string = message;
    this.actionBubbleNode.active = true;
    this.actionBubbleRemainSeconds = durationSeconds;
    this.actionBubbleNode.setPosition(new Vec3(this.player.x, this.player.y + 56, 9));
  }

  private updateQuestProgress(showCompletionToast = true): void {
    if (this.questCompleted) {
      return;
    }
    if (this.player.getTotalItemCount(GameScene.QUEST_ITEM_ID) <= 0) {
      return;
    }
    this.questCompleted = true;
    if (showCompletionToast) {
      this.showActionBubble("任务完成！", 2.4);
    }
    void this.saveGame("quest");
  }

  private async restoreFromLocalSave(): Promise<void> {
    const saveData = await this.saveManager.loadLocal();
    if (!saveData) {
      const loadResult = this.saveManager.getLastResult();
      if (loadResult.code !== "NO_DATA") {
        this.showActionBubble(`读档失败(${loadResult.code})`, 2.4);
      }
      return;
    }

    this.applySaveData(saveData);
    this.inventoryPanel?.refresh();
    this.syncPlayerNodePosition();
    this.showActionBubble("已恢复本地存档。", 1.6);
  }

  private applySaveData(saveData: SaveData): void {
    this.player.x = saveData.player.x;
    this.player.y = saveData.player.y;
    this.player.hp = saveData.player.hp;
    this.player.stamina = saveData.player.stamina;
    this.player.level = saveData.player.level;
    this.player.inventory = this.normalizeInventory(saveData.player.inventory);
    this.player.equipped = this.cloneEquipped(saveData.player.equipped);

    this.discoveredRooms.clear();
    for (const roomId of saveData.scene.discoveredRooms) {
      this.discoveredRooms.add(roomId);
    }
    this.discoveredRooms.add(this.sampleRoom.sceneId);
  }

  private normalizeInventory(inventory: Array<Item | null>): Array<Item | null> {
    const normalized = new Array<Item | null>(this.player.inventorySize).fill(null);
    const copyCount = Math.min(inventory.length, normalized.length);
    for (let index = 0; index < copyCount; index += 1) {
      normalized[index] = inventory[index] ? this.cloneItem(inventory[index]) : null;
    }
    return normalized;
  }

  private cloneEquipped(equipped: Record<string, Item | null>): Record<string, Item | null> {
    const cloned: Record<string, Item | null> = {};
    for (const [slot, item] of Object.entries(equipped)) {
      cloned[slot] = item ? this.cloneItem(item) : null;
    }
    return cloned;
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

  private buildSaveData(): SaveData {
    return {
      version: "1.0",
      player: {
        id: this.player.id,
        x: this.player.x,
        y: this.player.y,
        hp: this.player.hp,
        stamina: this.player.stamina,
        level: this.player.level,
        inventory: this.normalizeInventory(this.player.inventory),
        equipped: this.cloneEquipped(this.player.equipped),
      },
      scene: {
        currentSceneId: this.sampleRoom.sceneId,
        discoveredRooms: [...this.discoveredRooms],
      },
      timestamp: Date.now(),
    };
  }

  private async saveGame(trigger: "move" | "auto" | "quest"): Promise<void> {
    if (this.saveInProgress) {
      return;
    }
    this.saveInProgress = true;
    this.autoSaveElapsedSeconds = 0;
    this.showSavingHint();

    const saveData = this.buildSaveData();
    const localSaved = await this.saveManager.saveLocal(saveData);
    if (!localSaved && trigger !== "auto") {
      const result = this.saveManager.getLastResult();
      this.showActionBubble(`保存失败(${result.code})`, 2.2);
      this.saveInProgress = false;
      return;
    }

    await this.saveManager.saveCloudStub(saveData);
    this.saveInProgress = false;
  }

  private showSavingHint(): void {
    if (!this.saveHintNode) {
      return;
    }
    this.saveHintNode.active = true;
    this.saveHintRemainSeconds = GameScene.SAVE_HINT_DURATION_SECONDS;
  }

  private updateRunAnimation(deltaTime: number): void {
    if (!this.playerSprite || this.playerFrames.length === 0) {
      return;
    }

    if (!this.player.isMoving()) {
      this.currentAnimationFrame = 0;
      this.animationClock = 0;
      this.playerSprite.spriteFrame = this.playerFrames[0];
      return;
    }

    const dynamicFps = this.player.isRunning() ? 12 : 7;
    this.animationClock += deltaTime * dynamicFps;

    if (this.animationClock < 1) {
      return;
    }

    const frameAdvance = Math.floor(this.animationClock);
    this.animationClock -= frameAdvance;
    this.currentAnimationFrame =
      (this.currentAnimationFrame + frameAdvance) % this.playerFrames.length;
    this.playerSprite.spriteFrame = this.playerFrames[this.currentAnimationFrame];
  }

  private logicToWorld(x: number, y: number): { x: number; y: number } {
    return {
      x: x - PixelCamera.LOGICAL_WIDTH * 0.5,
      y: y - PixelCamera.LOGICAL_HEIGHT * 0.5,
    };
  }

  private async loadTexture(path: string): Promise<Texture2D> {
    const imageAsset = await new Promise<ImageAsset>((resolve, reject) => {
      assetManager.loadRemote<ImageAsset>(path, { ext: ".png" }, (error, asset) => {
        if (error || !asset) {
          reject(error ?? new Error(`Failed to load image from ${path}`));
          return;
        }
        resolve(asset);
      });
    });

    const texture = new Texture2D();
    texture.image = imageAsset;
    PixelCamera.useNearestTextureFilter(texture);
    return texture;
  }

  private createTileFrame(texture: Texture2D): SpriteFrame {
    const frame = new SpriteFrame();
    frame.texture = texture;
    frame.rect = new Rect(0, 0, GameScene.TILE_SIZE, GameScene.TILE_SIZE);
    PixelCamera.useNearestFilter(frame);
    return frame;
  }

  private createPlayerFrames(texture: Texture2D): SpriteFrame[] {
    const frameWidth = GameScene.PLAYER_FRAME_SIZE;
    const frameHeight = GameScene.PLAYER_FRAME_SIZE;
    const maxFrames = Math.max(1, Math.floor(texture.width / frameWidth));
    const frameCount = Math.min(4, maxFrames);
    const frames: SpriteFrame[] = [];

    for (let index = 0; index < frameCount; index += 1) {
      const frame = new SpriteFrame();
      frame.texture = texture;
      frame.rect = new Rect(index * frameWidth, 0, frameWidth, frameHeight);
      PixelCamera.useNearestFilter(frame);
      frames.push(frame);
    }

    return frames;
  }

  private ensurePlayerFallbackSprite(): void {
    if (!this.playerSprite) {
      return;
    }
    this.playerSprite.color = new Color(210, 40, 40);
  }
}
