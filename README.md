# mud

使用 Cocos Creator v3.x + TypeScript 的微信小游戏 MUD（泥巴）项目骨架。

## 1) 本地安装依赖

```bash
npm install
```

## 2) 在 Cocos Creator 中打开项目

1. 打开 Cocos Creator v3.x。
2. 在启动页选择 **导入项目**（Import Project）。
3. 选择当前目录：`/Users/jerryhong/cursor-projects/Mud`。
4. 打开后确认脚本编译无报错，并在资源管理器中创建你的首个场景资源（例如 `GameScene.scene`）。

## 3) 构建并导入微信开发者工具

1. 在 Cocos Creator 菜单中选择 **项目 -> 构建发布**。
2. 平台选择 **微信小游戏**。
3. 配置微信小游戏的 `AppID`（测试可使用游客模式），点击 **构建**。
4. 打开微信开发者工具，选择 **导入项目**。
5. 选择 Cocos 构建产物目录（通常在 `build/wechatgame`）。
6. 完成导入后点击 **编译**，即可在微信开发者工具中预览。

## 常用脚本

```bash
npm run start  # TypeScript watch
npm run build  # TypeScript build
npm run lint   # ESLint
npm run test   # Jest
```
