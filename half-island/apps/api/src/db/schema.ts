import type { DatabaseSync } from "node:sqlite";

export function migrate(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pairs (
      id TEXT PRIMARY KEY,
      invite_code TEXT NOT NULL UNIQUE,
      relationship_type TEXT NOT NULL CHECK (relationship_type IN ('couple', 'friends')),
      user_a_id TEXT NOT NULL REFERENCES users(id),
      user_b_id TEXT REFERENCES users(id),
      streak INTEGER NOT NULL DEFAULT 0,
      last_streak_date TEXT,
      premium INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'dissolved')),
      created_at TEXT NOT NULL,
      dissolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      prompt_en TEXT,
      choices_json TEXT,
      choices_en_json TEXT,
      intimacy_level INTEGER NOT NULL DEFAULT 0,
      audience TEXT NOT NULL CHECK (audience IN ('couple', 'friends', 'neutral')),
      relation_mode TEXT NOT NULL CHECK (relation_mode IN ('couple', 'friend', 'both')),
      deck TEXT NOT NULL DEFAULT 'daily_bits',
      tags_json TEXT,
      followup TEXT,
      followup_en TEXT,
      daily_eligible INTEGER NOT NULL DEFAULT 1,
      needs_review INTEGER NOT NULL DEFAULT 0,
      nsfw_flag INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      pair_id TEXT NOT NULL REFERENCES pairs(id),
      prompt_id TEXT NOT NULL REFERENCES prompts(id),
      date_key TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      revealed_at TEXT,
      kind TEXT NOT NULL DEFAULT 'daily',
      deck_id TEXT
    );

    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      choice_index INTEGER,
      created_at TEXT NOT NULL,
      UNIQUE(assignment_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS pair_prompt_history (
      pair_id TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      used_on TEXT NOT NULL,
      PRIMARY KEY (pair_id, prompt_id, used_on)
    );

    CREATE TABLE IF NOT EXISTS nudges (
      id TEXT PRIMARY KEY,
      pair_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      date_key TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pair_id TEXT,
      user_id TEXT,
      platform TEXT NOT NULL DEFAULT 'h5',
      payload_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS answer_translations (
      cache_key TEXT PRIMARY KEY,
      answer_id TEXT,
      source_lang TEXT NOT NULL,
      zh TEXT NOT NULL,
      en TEXT NOT NULL,
      needs_review INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);

  const cols = (table: string) =>
    (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map(
      (c) => c.name,
    );

  const pairCols = cols("pairs");
  if (!pairCols.includes("last_streak_date")) {
    db.exec("ALTER TABLE pairs ADD COLUMN last_streak_date TEXT");
  }
  if (!pairCols.includes("premium")) {
    db.exec("ALTER TABLE pairs ADD COLUMN premium INTEGER NOT NULL DEFAULT 0");
  }
  if (!pairCols.includes("dissolved_at")) {
    db.exec("ALTER TABLE pairs ADD COLUMN dissolved_at TEXT");
  }

  const promptCols = cols("prompts");
  for (const [name, sql] of [
    ["relation_mode", "ALTER TABLE prompts ADD COLUMN relation_mode TEXT NOT NULL DEFAULT 'both'"],
    ["deck", "ALTER TABLE prompts ADD COLUMN deck TEXT NOT NULL DEFAULT 'daily_bits'"],
    ["tags_json", "ALTER TABLE prompts ADD COLUMN tags_json TEXT"],
    ["followup", "ALTER TABLE prompts ADD COLUMN followup TEXT"],
    ["followup_en", "ALTER TABLE prompts ADD COLUMN followup_en TEXT"],
    ["prompt_en", "ALTER TABLE prompts ADD COLUMN prompt_en TEXT"],
    ["choices_en_json", "ALTER TABLE prompts ADD COLUMN choices_en_json TEXT"],
    ["daily_eligible", "ALTER TABLE prompts ADD COLUMN daily_eligible INTEGER NOT NULL DEFAULT 1"],
    ["needs_review", "ALTER TABLE prompts ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0"],
  ] as const) {
    if (!promptCols.includes(name)) db.exec(sql);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS answer_translations (
      cache_key TEXT PRIMARY KEY,
      answer_id TEXT,
      source_lang TEXT NOT NULL,
      zh TEXT NOT NULL,
      en TEXT NOT NULL,
      needs_review INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_answer_translations_answer
      ON answer_translations(answer_id);
  `);

  const asgCols = cols("assignments");
  if (!asgCols.includes("revealed_at")) {
    db.exec("ALTER TABLE assignments ADD COLUMN revealed_at TEXT");
  }
  if (!asgCols.includes("kind")) {
    db.exec("ALTER TABLE assignments ADD COLUMN kind TEXT NOT NULL DEFAULT 'daily'");
  }
  if (!asgCols.includes("deck_id")) {
    db.exec("ALTER TABLE assignments ADD COLUMN deck_id TEXT");
  }

  // Unique daily assignment per pair/day (extras use separate rows with kind=extra)
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_daily
      ON assignments(pair_id, date_key) WHERE kind = 'daily';
  `);
}
