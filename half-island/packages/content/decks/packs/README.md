# 题库扩容管线（→ ≥300）

> v1 核心包：`../v1.json` = **145** 题（L0–L3，含密友）。  
> 目标总量：`DECK_PACK_TARGETS.targetTotal` = **300**。  
> **不**在此目录批量发明未审题；运营包经审校后再 `import` 合并。

## 目录约定

| 文件 | 用途 |
|------|------|
| `../v1.json` + `../v1-en.json` | 日更主库（已入库） |
| `festival_qixi.stub.json` | 七夕运营包占位（结构 + 少量样例，目标 20 题） |
| `manifest.json` | 包清单：id / 目标题数 / relation 配比 / 是否已合并 |

## 导入步骤

1. 在 Project docs 增补题库 CSV（或 v1.1 md），**禁止**抄竞品题干。  
2. `node scripts/import-question-bank.mjs` 重生 `v1.json`，或扩展脚本合并 `packs/*.json`。  
3. `pnpm seed` → `SELECT COUNT(*) FROM prompts` 验收。  
4. 日更仍过滤 `intimacy_level < 4` 且 `nsfw_flag = 0`。

## 配比建议（扩到 300 时）

- 情侣 L0–L3：约 55–60%  
- 密友 / 中性：约 25–30%  
- 节日 / 运营包：约 10–15%（可 `daily_eligible=0`，仅牌组解锁）

L4 亲密包：**默认不做**（产品锁定二期）。
