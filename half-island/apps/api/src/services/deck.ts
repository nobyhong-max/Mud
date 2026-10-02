import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";

export interface DeckPrompt {
  id: string;
  deck: string;
  relationMode: "couple" | "friend" | "both";
  intimacyLevel: number;
  type: string;
  prompt: string;
  promptEn: string;
  choices: string[] | null;
  choicesEn: string[] | null;
  tags: string[];
  notes: string;
  followup: string | null;
  followupEn: string | null;
  audience: "couple" | "friends" | "neutral";
  nsfwFlag: boolean;
  dailyEligible: boolean;
  needsReview: boolean;
  status: string;
}

export interface DeckFile {
  version: string;
  brand: string;
  source: string;
  count: number;
  deckOnlyIds: string[];
  prompts: DeckPrompt[];
}

export function resolveDeckPath(): string {
  const candidates = [
    process.env.DECK_PATH,
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../packages/content/decks/v1.json",
    ),
    path.resolve(process.cwd(), "../../packages/content/decks/v1.json"),
    path.resolve(process.cwd(), "packages/content/decks/v1.json"),
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error("decks/v1.json not found; run scripts/import-question-bank.mjs");
}

export function loadDeckV1(): DeckFile {
  const p = resolveDeckPath();
  return JSON.parse(fs.readFileSync(p, "utf8")) as DeckFile;
}

export function insertPromptsFromDeck(db: DatabaseSync, deck: DeckFile): void {
  const stmt = db.prepare(
    `INSERT INTO prompts (
      id, type, prompt, prompt_en, choices_json, choices_en_json, intimacy_level, audience, relation_mode,
      deck, tags_json, followup, followup_en, daily_eligible, needs_review, nsfw_flag, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const pr of deck.prompts) {
    if (pr.nsfwFlag || pr.intimacyLevel >= 4) continue; // no L4
    stmt.run(
      pr.id,
      pr.type,
      pr.prompt,
      pr.promptEn || pr.prompt,
      pr.choices ? JSON.stringify(pr.choices) : null,
      pr.choicesEn ? JSON.stringify(pr.choicesEn) : null,
      pr.intimacyLevel,
      pr.audience,
      pr.relationMode,
      pr.deck,
      JSON.stringify(pr.tags),
      pr.followup,
      pr.followupEn ?? null,
      pr.dailyEligible ? 1 : 0,
      pr.needsReview ? 1 : 0,
      0,
      pr.status,
    );
  }
}
