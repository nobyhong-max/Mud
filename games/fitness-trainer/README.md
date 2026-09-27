# 健身大亨

手机网页健身房模拟：玩家指挥 **Three.js 低多边形 GLB 主角**在跑步机上跑、举铁、俯卧撑等，赚取金币并在商店升级力量、耐力、速度。

- 纯静态：`index.html` + `css/style.css` + `js/game.js` + `js/hero3d.js`
- 3D 模型：`models/fitness-hero.glb`（`npm run models:fitness-hero` 重新生成）
- 进度：`localStorage` 键 `jianshen-dayheng-v1`
- 与旧版 `games/fitness/`（燃动闯关 · 真人跟练）方向不同，本目录为正确 MVP

本地预览：

```bash
cd games/fitness-trainer && python3 -m http.server 8766
```

打开 http://localhost:8766
