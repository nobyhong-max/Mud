import { getDb, closeDb } from "./db/client.js";
import { id, inviteCode, shanghaiDateKey } from "./lib/ids.js";
import { loadDeckV1, insertPromptsFromDeck } from "./services/deck.js";
import { pickDailyPromptId } from "./services/prompt-picker.js";

const NOW = new Date().toISOString();

const users = [
  { id: "user_alice", display_name: "阿梨", created_at: NOW },
  { id: "user_bobo", display_name: "波波", created_at: NOW },
  { id: "user_chen", display_name: "陈陈", created_at: NOW },
  { id: "user_doudou", display_name: "豆豆", created_at: NOW },
];

const pairs = [
  {
    id: "pair_couple_demo",
    invite_code: "ISLAND1",
    relationship_type: "couple" as const,
    user_a_id: "user_alice",
    user_b_id: "user_bobo",
  },
  {
    id: "pair_friends_demo",
    invite_code: "ISLAND2",
    relationship_type: "friends" as const,
    user_a_id: "user_chen",
    user_b_id: "user_doudou",
  },
];

function main(): void {
  const db = getDb();
  db.exec(`
    DELETE FROM events;
    DELETE FROM nudges;
    DELETE FROM pair_prompt_history;
    DELETE FROM answer_translations;
    DELETE FROM answers;
    DELETE FROM assignments;
    DELETE FROM prompts;
    DELETE FROM pairs;
    DELETE FROM users;
  `);

  const insertUser = db.prepare(
    `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
  );
  const insertPair = db.prepare(
    `INSERT INTO pairs (id, invite_code, relationship_type, user_a_id, user_b_id, streak, last_streak_date, premium, status, created_at, dissolved_at)
     VALUES (?, ?, ?, ?, ?, 0, NULL, 0, 'active', ?, NULL)`,
  );

  for (const u of users) insertUser.run(u.id, u.display_name, u.created_at);
  for (const p of pairs) {
    insertPair.run(
      p.id,
      p.invite_code,
      p.relationship_type,
      p.user_a_id,
      p.user_b_id,
      NOW,
    );
  }

  const deck = loadDeckV1();
  insertPromptsFromDeck(db, deck);

  const dateKey = shanghaiDateKey();
  const insertAsg = db.prepare(
    `INSERT INTO assignments (id, pair_id, prompt_id, date_key, status, created_at, revealed_at, kind, deck_id)
     VALUES (?, ?, ?, ?, 'assigned', ?, NULL, 'daily', NULL)`,
  );
  const hist = db.prepare(
    `INSERT INTO pair_prompt_history (pair_id, prompt_id, used_on) VALUES (?, ?, ?)`,
  );

  for (const p of pairs) {
    const promptId = pickDailyPromptId(db, p.id, p.relationship_type);
    if (!promptId) throw new Error(`no daily prompt for ${p.relationship_type}`);
    insertAsg.run(id("asg"), p.id, promptId, dateKey, NOW);
    hist.run(p.id, promptId, dateKey);
  }

  console.log("半个岛 Phase 2 seed 完成");
  console.log(`  users: ${users.length}`);
  console.log(
    `  pairs: couple=${pairs[0]!.invite_code} / friends=${pairs[1]!.invite_code}`,
  );
  console.log(`  prompts: ${deck.count}（题库 v1）`);
  console.log(`  today: ${dateKey}`);
  console.log(`  sample invite: ${inviteCode()}`);
  closeDb();
}

main();
