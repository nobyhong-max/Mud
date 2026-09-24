# 微乐斗地主 · 本地记牌 & 出牌参考

独立网页工具，按**微乐经典无癞子斗地主**记牌、校验牌型，并给出可出牌组的评分 / 简化胜率参考。

只用于学习与本地模拟：

- 不对接微乐或其他游戏客户端
- 不读取游戏内存、不挂钩进程、不自动点击
- 本版手牌和已出牌都靠手动点选；YOLO 只留了 JSON 接口

## 公网体验（推荐）

远程、手机或 Cursor iOS 测试请用公网链接（无需本机 `localhost`）：

**<https://jade-solace-44pa.here.now/>**

页面为静态托管，与仓库根目录一致。站点已绑定 here.now 账号后**长期有效**（同一 slug 不变）。

更新代码后重新发布（需本机或 Agent 已保存 here.now API Key，见 [here.now 文档](https://here.now/docs)）：

```bash
~/.agents/skills/here-now/scripts/publish.sh . --slug jade-solace-44pa --client cursor
```

## 本地打开

需要用静态服务器加载 ES 模块（不要直接双击 `index.html` 走 `file://`）：

```bash
npm start
# 或
python3 -m http.server 8765
```

浏览器打开 <http://localhost:8765>（仅本机可访问）。

## 功能

1. **54 张完整牌库**，每张可记为：我手上 / 已出过 / 未知（另外两家手里或曾经底牌）
2. **自动记牌盘**：点花色牌，或点左侧点数把该点下一张未知牌快速记入
3. **牌型校验**：单、对、三张、三带一、三带对、顺子、连对、飞机、飞机带翅膀、四带二、四带两对、炸弹、王炸
   - 顺子 / 连对 / 飞机主体不能含 2 和王
   - 王炸 > 炸弹 > 普通牌
   - 四带二不是炸弹
4. **出牌参考**：列出当前可出组合，给启发式评分，并把未知牌随机分给上/下家做简化模拟
5. **剩余分布**：按超几何分布估计某点落在下家 / 上家的概率
6. **YOLO 预留**：`js/vision.js`、`window.__WEILE_VISION_BRIDGE__`、`vision/example-detections.json`

## 测试

```bash
npm test
```

## 仓库说明

本仓库最初在 Mac Mini 上创建，供 Cursor iOS 远程操作。记牌工具是其中的本地学习页面。
