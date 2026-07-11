import { director } from "cc";
import { GameScene } from "./scene/GameScene";

/**
 * 游戏启动入口。
 * 在 Cocos Creator 中可由初始化流程调用该方法。
 */
export function bootstrapGame(): void {
  director.loadScene(GameScene.SCENE_NAME);
}
