# 掘地建造

Project「老二的小游戏」— 2D 侧视方块沙盒（原创命名，玩法灵感来自方块生存类，无官方素材）。

## 本地运行

需静态服务器（ES 模块）：

```bash
cd games/blockworld
python3 -m http.server 8766
```

浏览器打开 http://localhost:8766

## 功能（MVP）

- 程序化地形：草、泥土、石头、树木（原木/树叶）、简单洞穴
- 挖掘（按住）与放置、物品栏与快捷栏
- 重力、跳跃；手机虚拟摇杆 + 跳跃
- 存档：`localStorage` 键 `laoer-juedi-v1`（种子 + 方块改动 + 背包）
