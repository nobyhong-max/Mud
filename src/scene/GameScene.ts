import {
  _decorator,
  assetManager,
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
} from "cc";
import { PixelCamera } from "../camera/PixelCamera";
import { InputManager } from "../core/InputManager";
import { Player } from "../player/Player";

const { ccclass } = _decorator;

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
    inventory: [],
  });

  private pixelCamera: PixelCamera | null = null;
  private playerNode: Node | null = null;
  private playerSprite: Sprite | null = null;
  private playerFrames: SpriteFrame[] = [];
  private staminaLabel: Label | null = null;

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
            0
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
