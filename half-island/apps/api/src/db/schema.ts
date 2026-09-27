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
      status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'dissolved')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      choices_json TEXT,
      intimacy_level INTEGER NOT NULL DEFAULT 0,
      audience TEXT NOT NULL CHECK (audience IN ('couple', 'friends', 'neutral')),
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
      UNIQUE(pair_id, date_key)
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
  `);
}
