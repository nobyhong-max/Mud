# 半个岛 · Phase 1 MVP 核心环

> **品牌**：半个岛  
> **Slogan**：你来了，岛才完整。  
> **定位**：1v1 专属飞地——每天各自作答、再一起揭晓。灵感来自 Candle 类机制，品牌与内容原创。

本目录为 **Phase 1 / C1**：情侣/密友绑定、题库 v1 入库、先答后揭状态机硬化、回忆墙、软付费说明 stub。Phase 0 脚手架保留并演进。

---

## 技术选型（为何这样选）

| 层 | 选择 | 理由 |
|----|------|------|
| 仓库 | `half-island/` pnpm monorepo（`apps/*` + `packages/*`） | Mud 多项目仓库内独立成树 |
| 共享类型 | `@half-island/shared` | Pair / DailyPrompt / Answer / Reveal / Memory |
| 题库 | `@half-island/content` → `decks/v1.json` | **自 `half-island-question-bank-v1.md` CSV 附录导出**，不另造牌组 |
| API | **Fastify + Node `node:sqlite`** | 零原生编译、零云密钥；可迁 Nest |
| 客户端 | **Vue 3 + Vite H5**，`pages/` 对齐 uni-app | 本地可验收；后续出微信小程序 + App，共享 API |

---

## 目录

```
half-island/
├── apps/
│   ├── api/                 # Fastify API + SQLite
│   └── client/              # Vue3 H5
├── packages/
│   ├── shared/              # 共享类型
│   └── content/decks/v1.json  # 题库机读（145 题）
├── scripts/import-question-bank.mjs
├── .env.example
└── README.md
```

---

## 快速开始

需要 Node ≥ 20、[pnpm](https://pnpm.io)。

```bash
cd half-island
cp .env.example .env          # 可选
pnpm install
pnpm --filter @half-island/shared build
# 若需从 Markdown 重建题库 JSON（默认已提交 v1.json）：
# pnpm import:deck
pnpm seed                     # 4 用户 + 情侣/密友岛 + 题库 v1 + 今日题
pnpm test                     # 泄题 / 密友分流 / streak / 题量
pnpm dev                      # API :8787 + Client :5173
```

### 演示账号

| 身份 | userId | pairId | 类型 | 邀请码 |
|------|--------|--------|------|--------|
| 阿梨 | `user_alice` | `pair_couple_demo` | 情侣 | ISLAND1 |
| 波波 | `user_bobo` | `pair_couple_demo` | 情侣 | ISLAND1 |
| 陈陈 | `user_chen` | `pair_friends_demo` | 密友 | ISLAND2 |
| 豆豆 | `user_doudou` | `pair_friends_demo` | 密友 | ISLAND2 |

**双人揭晓**：两窗口分别选阿梨 / 波波 → 今日 → 作答 → 等待/揭晓。未双答前 API 不会返回对方正文（`GET /answers/partner` → 403）。

**密友路径**：陈陈 / 豆豆；今日题仅 `friend`∪`both`。

---

## 题库

- 源文档：Project `docs/half-island-question-bank-v1.md` §6 CSV  
- 机读：`packages/content/decks/v1.json`（145 题，无 L4）  
- 日更池：`dailyEligible`（约 L0–L1，排除复审/牌组硬题）  
- 分流：`relationMode` = couple | friend | both → pair `relationship_type` 过滤  

重建：

```bash
pnpm import:deck   # 读取 /cursor/stores/self/docs/half-island-question-bank-v1.md
```

---

## API（Phase 1）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | phase=`1` |
| GET | `/pairs` | 活跃 pair |
| POST | `/pairs/invite` | 6 位邀请码 + couple/friends |
| POST | `/pairs/accept` | 接受邀请 |
| POST | `/pairs/dissolve` | 软解绑 |
| GET | `/today?pairId&userId` | 今日题；未双答不泄对方答案 |
| GET | `/answers/partner?assignmentId&userId` | **硬规则**：未双答 → **403** |
| POST | `/answers` | 幂等提交 |
| POST | `/reveal` | 双方完成后揭晓 + Streak（Asia/Shanghai） |
| GET | `/memory?pairId&userId` | 回忆墙 |
| GET | `/paywall?pairId&userId` | 软付费说明 stub（不锁揭晓） |
| GET | `/prompts` | 题库查询（可按 relationMode） |

状态机：

```
assigned → answered_partial → ready_to_reveal → revealed → archived
客户端：pending_self → pending_partner → ready_to_reveal → revealed
```

---

## 已实现 vs 占位

| 项 | 状态 |
|----|------|
| 题库 v1 导入 + relation_mode 日更过滤 | ✅ |
| 邀请绑定 / 软解绑 | ✅ |
| 泄题防护 + 单测 | ✅ |
| Streak（上海时区） | ✅ |
| 回忆墙 | ✅ |
| 等待/揭晓 UI（轮询 + 拼合动效） | ✅ |
| 软付费文案 stub | ✅（无真实支付） |
| 微信登录 / 推送 / IAP | ❌ 需主体账号 |
| L4 | ❌ 不出 |

---

## 环境变量

见 [`.env.example`](./.env.example)。勿提交真实密钥。

- `PORT=8787`
- `DATABASE_PATH=./data/half-island.db`
- `VITE_API_BASE=http://localhost:8787`
- `DECK_PATH`（可选，覆盖题库 JSON 路径）

---

## Phase 1 验收（C1）

- [x] 两账号可绑定并揭晓；未双答不可读对方答案  
- [x] 密友 pair 不抽 couple-only 题（单测）  
- [x] Streak 按 Asia/Shanghai  
- [x] 回忆墙可见 revealed  
- [x] 无生产密钥 / 无 L4  

下一阶段 **C2**：牌组浏览额度、假支付旗标、催一催限频、Admin CRUD、埋点。
