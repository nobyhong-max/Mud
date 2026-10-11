#!/usr/bin/env node
/**
 * Merge v1 CSV + v1.1 expansion → store doc, EN overlay, festival pack, then import v1.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const storeDocs = "/cursor/stores/self/docs";
const v1MdPath = path.join(storeDocs, "half-island-question-bank-v1.md");
const v11MdPath = path.join(storeDocs, "half-island-question-bank-v1.1.md");
const enPath = path.join(root, "packages/content/decks/v1-en.json");
const part1 = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/v1.1-expansion-part1.json"), "utf8"),
);
const part2 = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data/v1.1-expansion-part2.json"), "utf8"),
);
const expansion = [...part1, ...part2];

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQ = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

function csvEscape(s) {
  const t = String(s ?? "");
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function rowToCsv(row) {
  return [
    row.id,
    row.deck,
    row.relation_mode,
    row.level,
    row.type,
    row.prompt,
    row.choice_a,
    row.choice_b,
    row.choice_c,
    row.tags,
    row.notes,
    row.followup,
  ]
    .map(csvEscape)
    .join(",");
}

const v1Md = fs.readFileSync(v1MdPath, "utf8");
const csvMatch = v1Md.match(/```csv\n([\s\S]*?)```/);
if (!csvMatch) throw new Error("CSV not found in v1.md");
const baseRows = parseCsv(csvMatch[1]);
if (baseRows.length !== 145) {
  throw new Error(`expected 145 base rows, got ${baseRows.length}`);
}

const newRows = expansion.map((p) => ({
  id: p.id,
  deck: p.deck,
  relation_mode: p.relation_mode,
  level: String(p.level),
  type: p.type,
  prompt: p.prompt,
  choice_a: p.choice_a || "",
  choice_b: p.choice_b || "",
  choice_c: p.choice_c || "",
  tags: p.tags || "",
  notes: p.notes || "",
  followup: p.followup || "",
}));

const allRows = [...baseRows, ...newRows];
if (allRows.length < 300) {
  throw new Error(`total ${allRows.length} < 300`);
}

// Stats
const modes = {};
const levels = {};
const types = {};
const decks = {};
for (const r of allRows) {
  modes[r.relation_mode] = (modes[r.relation_mode] || 0) + 1;
  levels[r.level] = (levels[r.level] || 0) + 1;
  types[r.type] = (types[r.type] || 0) + 1;
  decks[r.deck] = (decks[r.deck] || 0) + 1;
}
const friendAvailable =
  (modes.friend || 0) + (modes.both || 0);
const festivalIds = allRows
  .filter((r) => r.deck === "festival_qixi")
  .map((r) => r.id);
const reviewIds = allRows
  .filter((r) => (r.notes || "").includes("需复审"))
  .map((r) => r.id);

// Inherit deck-only from v1 + festival + new review-sensitive L2+
const v1DeckOnlyLine = v1Md
  .split("\n")
  .find((l) => l.startsWith("HI-Q-026, HI-Q-039"));
const v1DeckOnly = v1DeckOnlyLine
  ? v1DeckOnlyLine
      .replace(/\s/g, "")
      .split(",")
      .filter((x) => x.startsWith("HI-Q-"))
  : [];
const extraDeckOnly = [
  ...festivalIds,
  ...allRows
    .filter(
      (r) =>
        Number(r.level) >= 3 ||
        ((r.notes || "").includes("牌组") &&
          (Number(r.level) >= 2 || (r.notes || "").includes("需复审"))),
    )
    .map((r) => r.id),
];
const deckOnlyIds = [...new Set([...v1DeckOnly, ...extraDeckOnly])].sort(
  (a, b) => Number(a.slice(5)) - Number(b.slice(5)),
);

const en = JSON.parse(fs.readFileSync(enPath, "utf8"));
for (const p of expansion) {
  en[p.id] = {
    promptEn: p.promptEn,
    choicesEn: p.choicesEn ?? null,
    followupEn: p.followupEn ?? null,
  };
}
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + "\n", "utf8");

const csvBody = [
  "id,deck,relation_mode,level,type,prompt,choice_a,choice_b,choice_c,tags,notes,followup",
  ...allRows.map(rowToCsv),
].join("\n");

const md = `# 半个岛 · 题库 v1.1（≥300 扩容包）

> 品牌：**半个岛** · Slogan：**你来了，岛才完整。**  
> 用途：P0-3 题库冲量；在 v1（145）上增补至 **${allRows.length}** 题；含 \`festival_qixi\` 七夕运营包。  
> 对齐：[\`candle-vs-half-island-upgrades.md\`](./candle-vs-half-island-upgrades.md) P0-3 · [\`half-island-question-bank-v1.md\`](./half-island-question-bank-v1.md)  
> 状态：中文原创 + 英文 overlay；**无 L4**；禁止抄 Candle / Paired 原文。

---

## 0. 相对 v1 的变更

| 项 | v1 | v1.1 |
|----|----|------|
| 总量 | 145 | **${allRows.length}** |
| 新增题号 | — | HI-Q-146 … HI-Q-${String(allRows.length).padStart(3, "0")} |
| 节日包 | stub 3 题 | \`festival_qixi\` **${decks.festival_qixi || 0}** 题（已合并入核心 CSV） |
| 英文 overlay | 145 | **${Object.keys(en).length}** |
| 机读产物 | \`packages/content/decks/v1.json\` | 同路径，由本文件 CSV 重生 |

---

## 1. 分类统计

**总计：${allRows.length} 题**

### 按关系模式 \`relation_mode\`

| relation_mode | 数量 |
|---------------|------|
| couple | ${modes.couple || 0} |
| friend | ${modes.friend || 0} |
| both | ${modes.both || 0} |
| **密友可用（friend+both）** | **${friendAvailable}** |

### 按亲密度 \`level\`

| level | 数量 |
|-------|------|
| L0 | ${levels["0"] || 0} |
| L1 | ${levels["1"] || 0} |
| L2 | ${levels["2"] || 0} |
| L3 | ${levels["3"] || 0} |
| L4 | 0（本包不写） |

### 按题型 \`type\`

| type | 数量 |
|------|------|
| open | ${types.open || 0} |
| single | ${types.single || 0} |
| whos_more_likely | ${types.whos_more_likely || 0} |
| either_or | ${types.either_or || 0} |

### 按牌组/主题 \`deck\`

| deck | 数量 |
|------|------|
| daily_bits | ${decks.daily_bits || 0} |
| whos_more | ${decks.whos_more || 0} |
| either_or | ${decks.either_or || 0} |
| values | ${decks.values || 0} |
| long_distance | ${decks.long_distance || 0} |
| repair | ${decks.repair || 0} |
| friends_neutral | ${decks.friends_neutral || 0} |
| festival_qixi | ${decks.festival_qixi || 0} |

---

## 2. 字段说明

同 v1：\`id\` / \`deck\` / \`relation_mode\` / \`level\` / \`type\` / \`prompt\` / \`choice_*\` / \`tags\` / \`notes\` / \`followup\`。  
入库映射：\`intimacy_level=level\`，\`audience≈relation_mode\`（\`both\`→\`neutral\`），\`nsfw_flag=false\`，\`locale=zh-CN\`。

英文 overlay：\`half-island/packages/content/decks/v1-en.json\`（\`promptEn\` / \`choicesEn\` / \`followupEn\`）。

---

## 3. 「今日题」轮播规则

沿用 v1 §3；额外：

1. \`festival_qixi\` **默认不进日更**（仅主题牌组 / 运营解锁）。
2. 日更仍过滤 \`intimacy_level < 4\` 且无 nsfw。
3. 密友池 = \`friend\` ∪ \`both\`；情侣池 = \`couple\` ∪ \`both\`。

---

## 4. 审核注意事项

- **原创性**：本包宣称全原创中文；禁止对照 Candle / Paired / Gottman 原文改写。
- **无 L4**；密友题无恋爱默认口吻。
- **需复审**（含 v1 继承 + v1.1 新增）：${reviewIds.length} 题。

示意 id（不全列 v1）：新增含 HI-Q-219, HI-Q-228, HI-Q-231, HI-Q-233, HI-Q-238, HI-Q-248, HI-Q-253, HI-Q-256, HI-Q-260 等。

### 4.2 不适合做日更（建议牌组）

原则：L3 全部；\`festival_qixi\` 全部；价值观/冲突 L2+；未过审复审题。

${deckOnlyIds.join(", ")}

---

## 5. 双语

见 [\`half-island-question-bank-v1-bilingual.md\`](./half-island-question-bank-v1-bilingual.md)；v1.1 源真改为本文件 CSV + 全量 \`v1-en.json\`。

---

## 6. CSV 附录（便于导入）

\`\`\`csv
${csvBody}
\`\`\`
`;

fs.writeFileSync(v11MdPath, md, "utf8");
console.log(`Wrote ${v11MdPath} (${allRows.length} prompts)`);

// Festival pack (full, merged)
const festivalPrompts = expansion
  .filter((p) => p.deck === "festival_qixi")
  .map((p) => {
    const choices = [p.choice_a, p.choice_b, p.choice_c]
      .map((c) => (c || "").trim())
      .filter(Boolean);
    return {
      id: p.id,
      deck: "festival_qixi",
      relationMode: p.relation_mode,
      intimacyLevel: p.level,
      type: { open: "open_text", single: "single_choice", whos_more_likely: "whos_more_likely", either_or: "either_or" }[p.type],
      prompt: p.prompt,
      promptEn: p.promptEn,
      choices: choices.length ? choices : null,
      choicesEn: p.choicesEn ?? null,
      tags: (p.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
      notes: p.notes || "",
      followup: p.followup || null,
      followupEn: p.followupEn ?? null,
      audience: { couple: "couple", friend: "friends", both: "neutral" }[p.relation_mode],
      nsfwFlag: false,
      dailyEligible: false,
      needsReview: (p.notes || "").includes("需复审"),
      status: "active",
    };
  });

const packPath = path.join(
  root,
  "packages/content/decks/packs/festival_qixi.json",
);
const stubPath = path.join(
  root,
  "packages/content/decks/packs/festival_qixi.stub.json",
);
fs.writeFileSync(
  packPath,
  JSON.stringify(
    {
      version: "pack-festival_qixi-v1",
      brand: "半个岛",
      packId: "festival_qixi",
      targetCount: 20,
      count: festivalPrompts.length,
      notes: "Merged into core v1.json via question-bank v1.1; dailyEligible=false.",
      prompts: festivalPrompts,
    },
    null,
    2,
  ) + "\n",
  "utf8",
);
if (fs.existsSync(stubPath)) fs.unlinkSync(stubPath);

const manifestPath = path.join(
  root,
  "packages/content/decks/packs/manifest.json",
);
fs.writeFileSync(
  manifestPath,
  JSON.stringify(
    {
      brand: "半个岛",
      coreDeck: "v1",
      coreCount: allRows.length,
      targetTotal: 300,
      packs: [
        {
          id: "festival_qixi",
          file: "festival_qixi.json",
          title: "七夕飞地",
          titleEn: "Qixi enclave",
          targetCount: 20,
          count: festivalPrompts.length,
          mergedIntoCore: true,
          dailyEligibleDefault: false,
          relationModes: ["couple", "both"],
          notes: "v1.1 已扩满并合并入核心 CSV / v1.json",
        },
      ],
    },
    null,
    2,
  ) + "\n",
  "utf8",
);

const importScript = path.join(root, "scripts/import-question-bank.mjs");
let importSrc = fs.readFileSync(importScript, "utf8");
importSrc = importSrc.replace(
  "/cursor/stores/self/docs/half-island-question-bank-v1.md",
  "/cursor/stores/self/docs/half-island-question-bank-v1.1.md",
);
importSrc = importSrc.replace(
  'source: "docs/half-island-question-bank-v1.md §6 CSV + bilingual EN overlay"',
  'source: "docs/half-island-question-bank-v1.1.md §6 CSV + bilingual EN overlay"',
);
// Exclude festival_qixi from daily by deck
if (!importSrc.includes('row.deck.trim() === "festival_qixi"')) {
  importSrc = importSrc.replace(
    "const dailyEligible =\n    level <= 1 &&\n    !deckOnlyIds.includes(id) &&\n    !needsReview &&\n    !notes.includes(\"L3\");",
    `const dailyEligible =
    level <= 1 &&
    !deckOnlyIds.includes(id) &&
    !needsReview &&
    !notes.includes("L3") &&
    row.deck.trim() !== "festival_qixi";`,
  );
}
fs.writeFileSync(importScript, importSrc, "utf8");

const r = spawnSync(
  process.execPath,
  [importScript, v11MdPath],
  { cwd: root, encoding: "utf8" },
);
process.stdout.write(r.stdout || "");
process.stderr.write(r.stderr || "");
if (r.status !== 0) process.exit(r.status ?? 1);

console.log(
  JSON.stringify(
    {
      total: allRows.length,
      modes,
      levels,
      types,
      decks,
      festival: festivalPrompts.length,
      enKeys: Object.keys(en).length,
      deckOnly: deckOnlyIds.length,
    },
    null,
    2,
  ),
);
