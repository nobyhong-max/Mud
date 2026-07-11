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

## 3) 构建微信小游戏包（CLI）

### 3.1 使用构建脚本

```bash
npm run build:wechat
```

默认输出目录：`build/wechat`。

可选参数示例：

```bash
bash build-scripts/build-wechat.sh --platform wechat --debug
```

### 3.2 构建脚本做了什么

1. 检查 Cocos Creator v3.x 是否安装（支持 `COCOS_CREATOR_PATH` 环境变量）。
2. 调用 Cocos Creator 命令行执行微信小游戏构建。
3. 输出构建产物到 `build/wechat`。
4. 自动校验目录是否存在且非空，失败时返回非 0 状态码。

## 4) 导入到微信开发者工具（详细步骤）

1. 打开微信开发者工具，点击 **+ 新建项目**。
2. 选择 **小游戏** 项目类型。
3. 填写或选择 `AppID`：
   - 正式联调：填写你的小程序/小游戏 `AppID`。
   - 本地调试：可选择测试号或游客模式（以微信开发者工具当前能力为准）。
4. 项目目录选择 Cocos 构建输出目录：`/Users/jerryhong/cursor-projects/Mud/build/wechat`。
5. 点击 **创建**，等待项目初始化完成。
6. 在工具栏点击 **编译**，确认控制台无致命错误。

## 5) 微信小游戏配置说明

### 5.1 AppID 设置

- 在微信开发者工具项目设置中使用正确 `AppID`。
- 团队协作建议将调试用 `AppID` 写入团队文档，不直接硬编码在仓库脚本中。
- 切换 `AppID` 后，建议重新编译并清缓存验证。

### 5.2 分包（子包）建议

- 微信小游戏可通过 `subpackages` 减少主包体积，提升首包加载速度。
- 常见拆分方式：
  - 主包：登录流程、基础 UI、核心场景骨架
  - 子包：大型地图、剧情资源、低频功能模块
- 配置位置通常在小游戏配置文件中（如 `game.json` / 构建产物对应配置），按微信官方规则维护路径和包大小限制。

## 6) 真机预览步骤

1. 微信开发者工具中点击 **预览**，生成二维码。
2. 使用绑定开发者账号的微信扫码。
3. 在手机端验证：
   - 启动耗时与首屏表现
   - 输入交互（点击、拖拽、长按）
   - 存档与场景切换流程
4. 如果出现资源或权限问题，回到开发者工具查看日志并重新编译后再次预览。

## 常用脚本

```bash
npm run start  # TypeScript watch
npm run build  # TypeScript build
npm run build:wechat  # 构建微信小游戏包
npm run lint   # ESLint
npm run test   # Jest
npm run test:coverage  # Jest 覆盖率
```
