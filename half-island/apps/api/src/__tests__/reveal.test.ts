import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { closeDb, getDb } from "../db/client.js";
import { loadDeckV1, insertPromptsFromDeck } from "../services/deck.js";
import {
  assertPromptAllowedForPair,
  pickDailyPromptId,
} from "../services/prompt-picker.js";
import {
  buildReveal,
  canReadPartnerAnswer,
  mapPrompt,
  nextStreak,
} from "../services/reveal.js";

function withTempDb(fn: () => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hi-test-"));
  const dbPath = path.join(dir, "t.db");
  process.env.DATABASE_PATH = dbPath;
  closeDb();
  try {
    fn();
  } finally {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("canReadPartnerAnswer requires both answers", () => {
  assert.equal(canReadPartnerAnswer(0), false);
  assert.equal(canReadPartnerAnswer(1), false);
  assert.equal(canReadPartnerAnswer(2), true);
});

test("buildReveal never leaks partner body before both answered", () => {
  const prompt = mapPrompt({
    id: "HI-Q-001",
    type: "open_text",
    prompt: "测试题",
    choices_json: null,
    intimacy_level: 0,
    audience: "neutral",
    relation_mode: "both",
    deck: "daily_bits",
    tags_json: "[]",
    followup: null,
    daily_eligible: 1,
    nsfw_flag: 0,
    status: "active",
  });

  const self = {
    id: "a1",
    assignment_id: "asg1",
    user_id: "u1",
    body: "我的答案秘密",
    choice_index: null,
    created_at: "2026-01-01T00:00:00Z",
  };
  const partner = {
    id: "a2",
    assignment_id: "asg1",
    user_id: "u2",
    body: "对方不该提前看见",
    choice_index: null,
    created_at: "2026-01-01T01:00:00Z",
  };

  const onlySelf = buildReveal({
    assignmentId: "asg1",
    prompt,
    status: "answered_partial",
    selfRow: self,
    partnerRow: undefined,
    revealedAt: null,
  });
  assert.equal(onlySelf.phase, "pending_partner");
  assert.equal(onlySelf.partnerAnswer, null);

  // Even if partner row is somehow present but we only pass one — still null when not both
  const leakedAttempt = buildReveal({
    assignmentId: "asg1",
    prompt,
    status: "answered_partial",
    selfRow: self,
    partnerRow: undefined,
    revealedAt: null,
  });
  assert.equal(leakedAttempt.partnerAnswer, null);

  const both = buildReveal({
    assignmentId: "asg1",
    prompt,
    status: "ready_to_reveal",
    selfRow: self,
    partnerRow: partner,
    revealedAt: null,
  });
  assert.equal(both.phase, "ready_to_reveal");
  assert.equal(both.partnerAnswer?.body, "对方不该提前看见");
});

test("nextStreak Asia/Shanghai consecutive days", () => {
  assert.deepEqual(nextStreak(0, null, "2026-09-28"), {
    streak: 1,
    lastStreakDate: "2026-09-28",
  });
  assert.deepEqual(nextStreak(1, "2026-09-27", "2026-09-28"), {
    streak: 2,
    lastStreakDate: "2026-09-28",
  });
  assert.deepEqual(nextStreak(5, "2026-09-28", "2026-09-28"), {
    streak: 5,
    lastStreakDate: "2026-09-28",
  });
  assert.deepEqual(nextStreak(5, "2026-09-20", "2026-09-28"), {
    streak: 1,
    lastStreakDate: "2026-09-28",
  });
});

test("friends pair never picks couple-only prompts", () => {
  withTempDb(() => {
    const db = getDb();
    const deck = loadDeckV1();
    insertPromptsFromDeck(db, deck);

    db.prepare(
      `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
    ).run("u1", "a", "t");
    db.prepare(
      `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
    ).run("u2", "b", "t");
    db.prepare(
      `INSERT INTO pairs (id, invite_code, relationship_type, user_a_id, user_b_id, streak, status, created_at)
       VALUES ('pf','CODE01','friends','u1','u2',0,'active',?)`,
    ).run("t");

    for (let i = 0; i < 40; i++) {
      const pid = pickDailyPromptId(db, "pf", "friends");
      assert.ok(pid);
      const row = db.prepare("SELECT relation_mode FROM prompts WHERE id = ?").get(pid) as {
        relation_mode: string;
      };
      assert.ok(
        assertPromptAllowedForPair("friends", row.relation_mode),
        `got couple-only ${pid}`,
      );
      assert.notEqual(row.relation_mode, "couple");
    }
  });
});

test("deck v1 has 145 prompts and no L4", () => {
  const deck = loadDeckV1();
  assert.equal(deck.count, 145);
  assert.equal(deck.prompts.length, 145);
  assert.ok(deck.prompts.every((p) => p.intimacyLevel <= 3 && !p.nsfwFlag));
  assert.ok(deck.prompts.some((p) => p.relationMode === "friend"));
  assert.ok(deck.prompts.some((p) => p.relationMode === "couple"));
});
