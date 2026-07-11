import {
  _decorator,
  Camera,
  CameraProjection,
  Component,
  Filter,
  ResolutionPolicy,
  SpriteFrame,
  Texture2D,
  view,
} from "cc";

const { ccclass, property } = _decorator;

@ccclass("PixelCamera")
export class PixelCamera extends Component {
  public static readonly LOGICAL_WIDTH = 360;
  public static readonly LOGICAL_HEIGHT = 200;

  @property({ type: Camera })
  public targetCamera: Camera | null = null;

  onLoad(): void {
    view.setDesignResolutionSize(
      PixelCamera.LOGICAL_WIDTH,
      PixelCamera.LOGICAL_HEIGHT,
      ResolutionPolicy.SHOW_ALL
    );
    this.refresh();
    view.on("canvas-resize", this.refresh, this);
  }

  onDestroy(): void {
    view.off("canvas-resize", this.refresh, this);
  }

  /**
   * 重新计算像素缩放，确保逻辑分辨率稳定。
   */
  public refresh(): void {
    const camera = this.resolveCamera();
    if (!camera) {
      return;
    }

    const frameSize = view.getFrameSize();
    const dpr = this.getDpr();
    const pixelWidth = frameSize.width * dpr;
    const pixelHeight = frameSize.height * dpr;

    const zoom = Math.max(
      1,
      Math.floor(
        Math.min(
          pixelWidth / PixelCamera.LOGICAL_WIDTH,
          pixelHeight / PixelCamera.LOGICAL_HEIGHT
        )
      )
    );

    camera.projection = CameraProjection.ORTHO;
    camera.orthoHeight = PixelCamera.LOGICAL_HEIGHT * 0.5;
    camera.zoomRatio = zoom;
  }

  /**
   * 对贴图启用最近邻采样，避免像素被平滑。
   */
  public static useNearestFilter(spriteFrame: SpriteFrame | null): void {
    if (!spriteFrame || !spriteFrame.texture) {
      return;
    }
    PixelCamera.useNearestTextureFilter(spriteFrame.texture);
  }

  public static useNearestTextureFilter(texture: Texture2D | null): void {
    if (!texture) {
      return;
    }
    texture.setFilters(Filter.NEAREST, Filter.NEAREST);
    const maybeTexture = texture as Texture2D & {
      setMipFilter?: (filter: Filter) => void;
    };
    if (typeof maybeTexture.setMipFilter === "function") {
      maybeTexture.setMipFilter(Filter.NEAREST);
    }
  }

  private resolveCamera(): Camera | null {
    if (this.targetCamera) {
      return this.targetCamera;
    }

    this.targetCamera =
      this.getComponent(Camera) ?? this.node.getComponentInChildren(Camera);
    return this.targetCamera;
  }

  private getDpr(): number {
    if (typeof window !== "undefined" && window.devicePixelRatio > 0) {
      return window.devicePixelRatio;
    }
    return 1;
  }
}
