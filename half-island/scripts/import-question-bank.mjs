#!/usr/bin/env node
/**
 * 从 Project docs 的题库 Markdown CSV 附录生成 packages/content/decks/v1.json
 * Usage: node scripts/import-question-bank.mjs [path-to-md]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const mdPath =
  process.argv[2] ||
  "/cursor/stores/self/docs/half-island-question-bank-v1.md";

const TYPE_MAP = {
  open: "open_text",
  single: "single_choice",
  whos_more_likely: "whos_more_likely",
  either_or: "either_or",
};
const AUDIENCE_MAP = {
  couple: "couple",
  friend: "friends",
  both: "neutral",
};

/** Minimal CSV parser that respects double-quoted fields. */
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

const md = fs.readFileSync(mdPath, "utf8");
const csvMatch = md.match(/```csv\n([\s\S]*?)```/);
if (!csvMatch) throw new Error("CSV appendix not found in " + mdPath);

const deckOnlyLine = md
  .split("\n")
  .find((l) => l.startsWith("HI-Q-026, HI-Q-039"));
const deckOnlyIds = deckOnlyLine
  ? deckOnlyLine
      .replace(/\s/g, "")
      .split(",")
      .filter((x) => x.startsWith("HI-Q-"))
  : [];

const rows = parseCsv(csvMatch[1]);

const prompts = rows.map((row) => {
  const choices = [row.choice_a, row.choice_b, row.choice_c]
    .map((c) => (c || "").trim())
    .filter(Boolean);
  const notes = (row.notes || "").trim();
  const level = Number(row.level);
  const id = row.id.trim();
  const needsReview = notes.includes("需复审");
  const dailyEligible =
    level <= 1 &&
    !deckOnlyIds.includes(id) &&
    !needsReview &&
    !notes.includes("L3");

  return {
    id,
    deck: row.deck.trim(),
    relationMode: row.relation_mode.trim(),
    intimacyLevel: level,
    type: TYPE_MAP[row.type.trim()],
    prompt: row.prompt.trim(),
    promptEn: null,
    choices: choices.length ? choices : null,
    choicesEn: null,
    tags: (row.tags || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    notes,
    followup: (row.followup || "").trim() || null,
    followupEn: null,
    audience: AUDIENCE_MAP[row.relation_mode.trim()],
    nsfwFlag: false,
    dailyEligible,
    needsReview,
    status: "active",
  };
});

const enOverlayPath = path.join(root, "packages/content/decks/v1-en.json");
if (fs.existsSync(enOverlayPath)) {
  const en = JSON.parse(fs.readFileSync(enOverlayPath, "utf8"));
  for (const p of prompts) {
    const e = en[p.id];
    if (!e) continue;
    p.promptEn = e.promptEn || null;
    p.choicesEn = e.choicesEn ?? null;
    p.followupEn = e.followupEn ?? null;
  }
} else {
  console.warn("v1-en.json missing — promptEn will be null until overlay added");
}

const out = {
  version: "v1",
  brand: "半个岛",
  source: "docs/half-island-question-bank-v1.md §6 CSV + bilingual EN overlay",
  count: prompts.length,
  deckOnlyIds,
  prompts,
};

const dest = path.join(root, "packages/content/decks/v1.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(
  `Wrote ${dest} (${prompts.length} prompts, dailyEligible=${prompts.filter((p) => p.dailyEligible).length})`,
);
