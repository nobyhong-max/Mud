import { _decorator, Component } from "cc";

const { ccclass } = _decorator;

@ccclass("GameScene")
export class GameScene extends Component {
  public static readonly SCENE_NAME = "GameScene";

  /**
   * 场景脚本启动生命周期。
   * 当前保留为空壳，后续可添加 MUD 世界初始化逻辑。
   */
  start(): void {
    // MUD core systems will be initialized here later.
  }
}
