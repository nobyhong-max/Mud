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
import { Player } from "../player/Player";
import { Interactable, InteractableType } from "../entities/Interactable";
import { ContextActionButton } from "../ui/ContextActionButton";
import { InventoryPanel } from "../ui/InventoryPanel";

const { ccclass } = _decorator;

class DemoInteractable extends Interactable {
  private readonly actionLabel: string;
  private readonly actionHandler: () => Promise<string>;

  constructor(params: {
    id: string;
    type: InteractableType;
    x: number;
    y: number;
    width: number;
    height: number;
    actionLabel: string;
    actionHandler: () => Promise<string>;
  }) {
    super(params);
    this.actionLabel = params.actionLabel;
    this.actionHandler = params.actionHandler;
  }

  public getContextAction(): { label: string; handler: () => Promise<string> } {
    return {
      label: this.actionLabel,
      handler: this.actionHandler,
    };
  }
}

@ccclass("GameScene")
export class GameScene extends Component {
  public static readonly SCENE_NAME = "GameScene";
  private static readonly TILE_SIZE = 32;
  private static readonly PLAYER_FRAME_SIZE = 48;
  private static readonly DOUBLE_TAP_GAP_MS = 260;

  private readonly inputManager = new InputManager(
    PixelCamera.LOGICAL_WIDTH,
    PixelCamera.LOGICAL_HEIGHT
  );

  private readonly player = new Player({
    id: "player-1",
    name: "Shaolin Football Hero",
    x: 0,
    y: 0,
    hp: 100,
    stamina: 100,
    level: 1,
    inventory: [
      { id: "mud", name: "泥", type: "material", qty: 1 },
      { id: "water", name: "水", type: "material", qty: 1 },
      { id: "rusty-dagger", name: "旧匕首", type: "equipment", qty: 1 },
    ],
  });

  private pixelCamera: PixelCamera | null = null;
  private playerNode: Node | null = null;
  private playerSprite: Sprite | null = null;
  private playerFrames: SpriteFrame[] = [];
  private staminaLabel: Label | null = null;
  private actionBubbleNode: Node | null = null;
  private actionBubbleLabel: Label | null = null;
  private actionBubbleRemainSeconds = 0;
  private contextActionButton: ContextActionButton | null = null;
  private inventoryPanel: InventoryPanel | null = null;
  private interactables: Interactable[] = [];
  private currentContextTargetId: string | null = null;

  private animationClock = 0;
  private currentAnimationFrame = 0;
  private lastTapTime = 0;

  /**
   * 场景脚本启动生命周期。
   * 完成像素地板、角色和输入系统初始化。
   */
  start(): void {
    this.initCamera();
    this.createHud();
    this.createPlayerNode();
    this.createDemoInteractables();
    this.createContextActionButton();
    this.createInventoryPanel();
    this.createInventoryToggleButton();
    this.bindInput();

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
    this.updateContextActionTarget();
    this.updateStaminaHud();
    this.updateRunAnimation(deltaTime);
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

  private createDemoInteractables(): void {
    const chest = new DemoInteractable({
      id: "chest-1",
      type: "container",
      x: 120,
      y: 32,
      width: 32,
      height: 26,
      actionLabel: "打开宝箱",
      actionHandler: async () => {
        const addResult = this.player.addItem({
          id: "mud",
          name: "泥",
          type: "material",
          qty: 1,
        });
        this.inventoryPanel?.refresh();
        return addResult.success ? "你打开宝箱，获得了 泥 x1。" : "宝箱里有材料，但背包已经满了。";
      },
    });

    const npc = new DemoInteractable({
      id: "npc-mentor",
      type: "npc",
      x: -110,
      y: 40,
      width: 30,
      height: 44,
      actionLabel: "与村民交谈",
      actionHandler: async () => "村民说：把泥和水放在一起，也许会有惊喜。",
    });

    this.interactables = [chest, npc];
    this.createInteractableMarker(chest, new Color(186, 137, 81), "箱");
    this.createInteractableMarker(npc, new Color(90, 110, 200), "NPC");
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
  }

  private createContextActionButton(): void {
    const node = new Node("ContextActionButton");
    const contextButton = node.addComponent(ContextActionButton);
    node.on(
      ContextActionButton.EVENT_ACTION_RESULT,
      (message: string) => {
        this.showActionBubble(message);
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

  private updateContextActionTarget(): void {
    const nearest = this.findNearestInteractable(66);
    const nearestId = nearest?.id ?? null;
    if (nearestId === this.currentContextTargetId) {
      return;
    }

    this.currentContextTargetId = nearestId;
    this.contextActionButton?.setContext(nearest);
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

  private showActionBubble(message: string): void {
    if (!this.actionBubbleLabel || !this.actionBubbleNode) {
      return;
    }

    this.actionBubbleLabel.string = message;
    this.actionBubbleNode.active = true;
    this.actionBubbleRemainSeconds = 2.2;
    this.actionBubbleNode.setPosition(new Vec3(this.player.x, this.player.y + 56, 9));
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
