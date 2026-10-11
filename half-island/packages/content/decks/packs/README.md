# 题库扩容管线（v1.1 ≥300）

> 核心包：`../v1.json` = **300** 题（L0–L3，含密友 + `festival_qixi`）。  
> 源真：Project docs `half-island-question-bank-v1.1.md` §6 CSV + `../v1-en.json`。  
> 重建：`node scripts/build-question-bank-v1.1.mjs` 或 `pnpm import:deck`。

## 目录约定

| 文件 | 用途 |
|------|------|
| `../v1.json` + `../v1-en.json` | 日更主库（已入库；节日题 `dailyEligible=false`） |
| `festival_qixi.json` | 七夕运营包 **20** 题（已合并入核心） |
| `manifest.json` | 包清单：id / 题数 / relation 配比 / 是否已合并 |

## 导入步骤

1. 编辑 `half-island-question-bank-v1.1.md` CSV 或 `scripts/data/v1.1-expansion-*.json`，**禁止**抄竞品题干。  
2. `node scripts/build-question-bank-v1.1.mjs`（或 `node scripts/import-question-bank.mjs <v1.1.md>`）重生 `v1.json`。  
3. `pnpm seed` → `SELECT COUNT(*) FROM prompts` 验收 ≥300。  
4. 日更仍过滤 `intimacy_level < 4` 且 `nsfw_flag = 0`；`festival_qixi` 不进日更。

## 配比建议（扩到 300 时）

- 情侣 L0–L3：约 55–60%  
- 密友 / 中性：约 25–30%  
- 节日 / 运营包：约 10–15%（可 `daily_eligible=0`，仅牌组解锁）

L4 亲密包：**默认不做**（产品锁定二期）。
