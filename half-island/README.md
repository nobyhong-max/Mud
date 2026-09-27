# 半个岛 · Phase 2 软付费与留存打磨

> **品牌**：半个岛 · **Slogan**：你来了，岛才完整。  
> 覆盖 Phase 0 脚手架 → Phase 1 核心环 → **Phase 2 / C2** 软付费、催一催、牌组、埋点、UI 打磨。

---

## 技术选型

| 层 | 选择 | 理由 |
|----|------|------|
| Monorepo | `half-island/` pnpm（`apps/*` + `packages/*`） | 独立于 Mud 其它小游戏 |
| 共享 | `@half-island/shared` | Pair / Reveal / SoftPaywall / Deck / Events |
| 题库 | `@half-island/content/decks/v1.json` | 源自题库文档 CSV，不另造牌组 |
| API | Fastify + Node `node:sqlite` | 零云密钥本地可跑 |
| 客户端 | Vue3 + Vite H5（uni-app 页面约定） | 无需微信/商店账号即可验收 |

---

## 快速开始

```bash
cd half-island
pnpm install
pnpm --filter @half-island/shared build
pnpm seed
pnpm test
pnpm dev    # API :8787 · Client :5173
```

演示：阿梨/波波（情侣 `ISLAND1`）、陈陈/豆豆（密友 `ISLAND2`）。

---

## Phase 2 要点

### 软付费（硬规则）
- **每日一题揭晓永久免费**；已揭晓回忆墙对免费用户可回看。
- 仅锁：**主题牌组加练** / 超额题量。`POST /decks/start` 非会员 → 402。
- `POST /premium/toggle`：**假开通**，无真实扣款。

### 催一催
- `POST /nudge`：每人每天对同一岛 ≤ **3** 次；情侣/密友文案分流。

### 埋点 events
`pair_success` · `prompt_answered` · `revealed` · `streak_increment` · `paywall_view` · `nudge_sent` · `deck_locked_tap`  
查看：`GET /admin/events`（Header `x-admin-token: dev-admin`）

### 简易 Admin
- `GET/PATCH /admin/prompts`（上下架；默认 token `dev-admin`）

---

## API 增补（C2）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/paywall` | 额度与文案 |
| POST | `/premium/toggle` | 假会员开关 |
| GET | `/decks` | 牌组列表 + locked |
| POST | `/decks/start` | 加练（会员校验） |
| POST | `/nudge` | 催一催（429 触顶） |
| GET | `/admin/prompts` | 题库 |
| PATCH | `/admin/prompts/:id` | 上下架 |
| GET | `/admin/events` | 最近埋点 |

---

## 需你提供（真人账号 / 资质）

本阶段 **不需要**。上线前再准备：

1. 微信小程序 AppID / 登录与订阅消息  
2. App Store / 安卓商店账号与推送证书  
3. 支付主体与虚拟支付 / IAP 资质  

`.env.example` 留有占位，**勿提交真实密钥**。

---

## 验收对照（C2）

- [x] 免费用户每日 1 题可完整体验揭晓  
- [x] 会员旗标解锁主题牌组；已揭晓回看仍免费  
- [x] 催促限频 3 次/日  
- [x] Admin 可上下架题  
- [x] 埋点可查  
- [x] `pnpm test` / lint / build  

详见客户端路由：今日 / 等待（戳一下）/ 揭晓 / 回忆 / 牌组。
