# 微乐斗地主 · 本地记牌与出牌参考

独立学习工具，按**微乐经典无癞子斗地主**做记牌、牌型校验和规则评分推荐。

## 红线（先看这个）

微乐是联网商业游戏，用户协议禁止外部辅助、记牌器、自动化。

- 本仓库只做**个人编程学习 / 本地模拟 / 教学**
- **不要**在真实微乐对局里用，不要截游戏画面实时注入
- **不要**读内存、挂钩进程、自动点击、抓窗口连打
- 用于实战既违规，也破坏公平，有封号风险
- 评分是规则加权参考，**不是真实胜率**；看不到另外两家手牌，任何模型都给不出精确胜率

癞子场、DouZero 上帝视角、YOLO 微调都刻意没做进第一版。

## 推荐入口：Python + Streamlit

```bash
python3 -m pip install -r requirements.txt
python3 -m streamlit run app.py --server.port 8501 --server.headless true
```

浏览器打开 http://localhost:8501 。

模块：

| 模块 | 文件 | 作用 |
| --- | --- | --- |
| 牌库 | `weile_ddz/cards.py` | 54 张，编码 `S_A` / `H_2` / `SJ` / `BJ` |
| 状态 | `weile_ddz/state.py` | `in_hand` / `seen` / `unknown`，撤销、重置 |
| 牌型 | `weile_ddz/rules.py` | 微乐校验与比较（顺子不能含 2/王，四带二不是炸弹） |
| 统计 | `weile_ddz/stats.py` | 剩余 2/A/王、炸弹潜力、加权估算 |
| 评分 | `weile_ddz/scorer.py` | 专家规则 0–100，前 3 推荐 + 理由 |
| 视觉预留 | `weile_ddz/vision.py` | 只收 JSON；`recognize_image` 明确未接入 |
| UI | `app.py` | Streamlit 面板 |

叫分 / 加倍只改展示倍数，不改牌型。

## 备选：静态网页

```bash
npm start
# http://localhost:8765
```

这是同一规则的 HTML/JS 版，方便不装 Python 时点选。

## 测试

```bash
python3 -m unittest tests.test_python_rules -v
npm test
```

## 以后不要一上来就做的事

1. **DouZero**：需要三家完整手牌。你只有自己的牌 + 已出牌，只能蒙特卡洛乱分未知牌，慢，且原版允许顺子带 2，和微乐不一致。
2. **YOLO**：公开扑克权重看的是实体牌，不是微乐渲染。要自己标数据微调；即便做了，也只该是「用户主动上传图片 → 人工核对」，不是后台抓屏。

## 仓库说明

最初在 Mac Mini 上创建，供 Cursor iOS 远程操作。
