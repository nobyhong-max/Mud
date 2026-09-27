import { getDb, closeDb } from "./db/client.js";
import { id, inviteCode, shanghaiDateKey } from "./lib/ids.js";

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
    relationship_type: "couple",
    user_a_id: "user_alice",
    user_b_id: "user_bobo",
    streak: 0,
    status: "active",
    created_at: NOW,
  },
  {
    id: "pair_friends_demo",
    invite_code: "ISLAND2",
    relationship_type: "friends",
    user_a_id: "user_chen",
    user_b_id: "user_doudou",
    streak: 0,
    status: "active",
    created_at: NOW,
  },
];

/** Phase 0 占位题（非生产题库；完整牌组由内容工人产出） */
const prompts = [
  {
    id: "prompt_p01",
    type: "open_text",
    prompt: "最近哪件小事，让你突然觉得这座岛更完整了一点？",
    choices_json: null,
    intimacy_level: 1,
    audience: "neutral",
    nsfw_flag: 0,
    status: "active",
  },
  {
    id: "prompt_p02",
    type: "whos_more_likely",
    prompt: "谁更可能出门前把外套换了又换？",
    choices_json: JSON.stringify(["我", "TA"]),
    intimacy_level: 0,
    audience: "neutral",
    nsfw_flag: 0,
    status: "active",
  },
  {
    id: "prompt_p03",
    type: "either_or",
    prompt: "周末多出来的两小时，你更想？",
    choices_json: JSON.stringify(["补觉", "出门走走"]),
    intimacy_level: 0,
    audience: "friends",
    nsfw_flag: 0,
    status: "active",
  },
  {
    id: "prompt_p04",
    type: "open_text",
    prompt: "异地或各自忙碌时，你最想对方怎样「轻轻露面」？",
    choices_json: null,
    intimacy_level: 2,
    audience: "couple",
    nsfw_flag: 0,
    status: "active",
  },
  {
    id: "prompt_p05",
    type: "single_choice",
    prompt: "和密友吵架后，怎样算真正和好？",
    choices_json: JSON.stringify([
      "当面说开",
      "发一条消息就够",
      "一起吃顿饭",
      "过几天自然就好了",
    ]),
    intimacy_level: 1,
    audience: "friends",
    nsfw_flag: 0,
    status: "active",
  },
];

function main(): void {
  const db = getDb();
  db.exec("DELETE FROM answers; DELETE FROM assignments; DELETE FROM prompts; DELETE FROM pairs; DELETE FROM users;");

  const insertUser = db.prepare(
    `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
  );
  const insertPair = db.prepare(
    `INSERT INTO pairs (id, invite_code, relationship_type, user_a_id, user_b_id, streak, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertPrompt = db.prepare(
    `INSERT INTO prompts (id, type, prompt, choices_json, intimacy_level, audience, nsfw_flag, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertAssignment = db.prepare(
    `INSERT INTO assignments (id, pair_id, prompt_id, date_key, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  db.exec("BEGIN");
  try {
    for (const u of users) insertUser.run(u.id, u.display_name, u.created_at);
    for (const p of pairs) {
      insertPair.run(
        p.id,
        p.invite_code,
        p.relationship_type,
        p.user_a_id,
        p.user_b_id,
        p.streak,
        p.status,
        p.created_at,
      );
    }
    for (const pr of prompts) {
      insertPrompt.run(
        pr.id,
        pr.type,
        pr.prompt,
        pr.choices_json,
        pr.intimacy_level,
        pr.audience,
        pr.nsfw_flag,
        pr.status,
      );
    }

    const dateKey = shanghaiDateKey();
    insertAssignment.run(
      id("asg"),
      "pair_couple_demo",
      "prompt_p01",
      dateKey,
      "assigned",
      NOW,
    );
    insertAssignment.run(
      id("asg"),
      "pair_friends_demo",
      "prompt_p03",
      dateKey,
      "assigned",
      NOW,
    );
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  console.log("半个岛 seed 完成");
  console.log(`  users: ${users.length}`);
  console.log(`  pairs: couple=${pairs[0]!.invite_code} / friends=${pairs[1]!.invite_code}`);
  console.log(`  prompts: ${prompts.length}（占位）`);
  console.log(`  today: ${shanghaiDateKey()}`);
  console.log(`  unused helper inviteCode sample: ${inviteCode()}`);
  closeDb();
}

main();
