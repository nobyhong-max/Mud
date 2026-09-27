# 半个岛 · Phase 0 脚手架

> **品牌**：半个岛  
> **Slogan**：你来了，岛才完整。  
> **定位**：1v1 专属飞地——每天各自作答、再一起揭晓。灵感来自 Candle 类机制，品牌与内容原创。

本目录是可本地跑通的 **MVP 脚手架（Phase 0 / C0）**：共享后端 + 跨端客户端壳，预留情侣 / 密友绑定与揭晓状态机。

---

## 技术选型（为何这样选）

| 层 | 选择 | 理由 |
|----|------|------|
| 仓库 | `half-island/` pnpm monorepo（`apps/*` + `packages/*`） | 现有 Mud 仓库承载多项目；半个岛独立成树，避免与其它小游戏耦合 |
| 共享类型 | `@half-island/shared`（TypeScript） | Pair / DailyPrompt / Answer / Reveal 一端定义，双端共用 |
| API | **Fastify + Node 内置 `node:sqlite`** | 比完整 Nest 更轻；无原生编译 / 无云密钥；结构接近 Nest 模块（routes/db），后续可迁 Nest |
| 客户端 | **Vue 3 + Vite（H5）**，页面目录按 **uni-app `pages/`** 约定 | Phase 0 无需微信/App Store 账号即可验收 UI 流；同一页面树后续用 uni-app/Taro 出**微信小程序 + App**，共享本 API |
| 数据 | SQLite 文件库（Node 22+） | 开发零依赖；生产可换 PostgreSQL |

**双端路径**：小程序与 App **共享本 API**；客户端 Phase 0 用 H5 壳跑通邀请→今日→作答→等待→揭晓；`apps/client/pages.json` 与 `src/pages/*` 对齐未来 uni-app 入口。真机小程序/商店包需主体与审核账号（见下方「何时需要你」）。

---

## 目录

```
half-island/
├── apps/
│   ├── api/          # Fastify API + SQLite
│   └── client/       # Vue3 H5（uni-app 页面约定）
├── packages/
│   └── shared/       # 共享类型
├── .env.example
└── README.md
```

---

## 快速开始

需要 Node ≥ 20、[pnpm](https://pnpm.io)。

```bash
cd half-island
cp .env.example .env          # 可选；默认即可
pnpm install
pnpm --filter @half-island/shared build
pnpm seed                     # 4 用户 + 情侣/密友各 1 对 + 5 占位题 + 今日 assignment
pnpm dev                      # API :8787 + Client :5173
```

分开启动：

```bash
pnpm dev:api      # http://localhost:8787/health
pnpm dev:client   # http://localhost:5173
```

### 演示账号（seed 后）

| 身份 | userId | pairId | 类型 |
|------|--------|--------|------|
| 阿梨 | `user_alice` | `pair_couple_demo` | 情侣 |
| 波波 | `user_bobo` | `pair_couple_demo` | 情侣 |
| 陈陈 | `user_chen` | `pair_friends_demo` | 密友 |
| 豆豆 | `user_doudou` | `pair_friends_demo` | 密友 |

客户端顶栏可切换身份。邀请码样例：`ISLAND1`（情侣）、`ISLAND2`（密友）。

手动验收双人揭晓：浏览器开两个窗口，分别选阿梨 / 波波 → 今日 → 作答 → 双方提交后揭晓。

---

## API 一览（Phase 0）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/pairs` | 列出 pair |
| POST | `/pairs/invite` | 创建邀请（`relationshipType`: couple \| friends） |
| POST | `/pairs/accept` | 接受邀请码 |
| GET | `/today?pairId&userId` | 今日题 + 揭晓阶段（未双答不返回对方正文） |
| POST | `/answers` | 提交/覆盖答案 |
| POST | `/reveal` | 双方完成后揭晓 |
| GET | `/prompts` | 占位题列表 |

揭晓状态机（类型已就绪，C1 加深校验）：

```
assigned → answered_partial → ready_to_reveal → revealed → archived
客户端视角：pending_self → pending_partner → ready_to_reveal → revealed
```

---

## 已实现 vs 占位

| 项 | 状态 |
|----|------|
| monorepo、共享类型、env 样例、中文 README | ✅ |
| SQLite 模型 User / Pair / Prompt / Assignment / Answer | ✅ |
| seed：4 用户、情侣+密友 pair、5 占位题、今日 assignment | ✅ |
| 健康检查 + 邀请/今日/作答/揭晓路由 | ✅ 可跑通 |
| 客户端：邀请 / 今日 / 作答 / 等待 / 揭晓 | ✅ UI 占位 + 接 API |
| 微信登录 / App 登录 / 真推送 / 支付 | ❌ 未做（接口位预留在 `.env.example`） |
| 生产题库 / L4 / 软会员闭环 | ❌ 非本阶段 |
| 未双答前泄题的单测 hardening | ⏳ C1 |

---

## 环境变量

见 [`.env.example`](./.env.example)。**不要提交真实密钥**。本地默认：

- `PORT=8787`
- `DATABASE_PATH=./data/half-island.db`
- `VITE_API_BASE=http://localhost:8787`

---

## 何时需要你（真人账号）

Phase 0 **不需要**。仅当要上：

- 微信小程序 AppID / 登录与订阅消息  
- App Store / 各安卓商店账号与推送  
- 支付主体与虚拟支付资质  

再提供即可；栈与文件夹命名无需再拍板。

---

## Phase 0 验收对照（C0）

- [x] 少步启动后端 + seed 后可查 pair 与今日 assignment  
- [x] `relationship_type` 区分情侣 / 密友  
- [x] 无真实密钥入库  
- [x] README 可供另一名工程师约 15 分钟跑通  

下一阶段见方案 **C1**：邀请码硬化、泄题 403 测试、Streak 时区、回忆墙。
