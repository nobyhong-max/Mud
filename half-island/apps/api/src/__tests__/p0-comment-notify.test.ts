import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { closeDb, getDb } from "../db/client.js";
import { upsertComment, listComments } from "../services/comments.js";
import { buildInviteShareCard } from "../services/invite-share.js";
import {
  enqueueNotify,
  listNotifications,
  notifyTemplatesPreview,
  NOTIFY_KIND_DAILY_LIMIT,
} from "../services/notify.js";
import { COMMENT_REACTIONS, NOTIFY_TEMPLATES } from "@half-island/shared";

function withTempDb(fn: () => void | Promise<void>): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hi-p0-"));
  process.env.DATABASE_PATH = path.join(dir, "t.db");
  closeDb();
  return Promise.resolve()
    .then(() => fn())
    .finally(() => {
      closeDb();
      fs.rmSync(dir, { recursive: true, force: true });
    });
}

function seedPair(): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
  ).run("u1", "a", "t");
  db.prepare(
    `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
  ).run("u2", "b", "t");
  db.prepare(
    `INSERT INTO pairs (id, invite_code, relationship_type, user_a_id, user_b_id, streak, status, created_at)
     VALUES ('p1','ABC123','couple','u1','u2',2,'active','t')`,
  ).run();
  db.prepare(
    `INSERT INTO prompts (id, type, prompt, intimacy_level, audience, relation_mode, deck, status)
     VALUES ('q1','open_text','题',0,'neutral','both','daily_bits','active')`,
  ).run();
  db.prepare(
    `INSERT INTO assignments (id, pair_id, prompt_id, date_key, status, created_at, revealed_at, kind)
     VALUES ('asg1','p1','q1','2026-10-11','revealed','t','t','daily')`,
  ).run();
}

test("comment upsert after reveal; one per user; bilingual", async () => {
  await withTempDb(async () => {
    seedPair();
    const r = await upsertComment({
      assignmentId: "asg1",
      userId: "u1",
      body: "读完了，心软了一下",
      reaction: "❤️",
    });
    assert.ok("ok" in r && r.ok);
    assert.equal(r.comment.reaction, "❤️");
    assert.ok(r.comment.bilingual.zh.includes("读完了"));

    const again = await upsertComment({
      assignmentId: "asg1",
      userId: "u1",
      body: "改一句",
      reaction: "✨",
    });
    assert.ok("ok" in again && again.ok);
    const all = listComments("asg1");
    assert.equal(all.length, 1);
    assert.equal(all[0]!.body, "改一句");

    await upsertComment({
      assignmentId: "asg1",
      userId: "u2",
      body: "我也在",
      reaction: null,
    });
    assert.equal(listComments("asg1").length, 2);
    assert.ok(COMMENT_REACTIONS.includes("🌊"));
  });
});

test("partner_answered notify enqueued with couple copy; rate limited", async () => {
  await withTempDb(() => {
    seedPair();
    const first = enqueueNotify({
      kind: "partner_answered",
      pairId: "p1",
      userId: "u2",
      relationshipType: "couple",
      payload: { assignmentId: "asg1" },
    });
    assert.ok(!("skipped" in first));
    assert.equal(first.kind, "partner_answered");
    assert.match(first.title, /另一岸/);
    assert.match(first.titleEn, /shore/i);

    for (let i = 0; i < NOTIFY_KIND_DAILY_LIMIT - 1; i++) {
      enqueueNotify({
        kind: "partner_answered",
        pairId: "p1",
        userId: "u2",
        relationshipType: "couple",
      });
    }
    const blocked = enqueueNotify({
      kind: "partner_answered",
      pairId: "p1",
      userId: "u2",
      relationshipType: "couple",
    });
    assert.deepEqual(blocked, { skipped: "limit" });

    const friends = enqueueNotify({
      kind: "partner_answered",
      pairId: "p1",
      userId: "u1",
      relationshipType: "friends",
    });
    assert.ok(!("skipped" in friends));
    assert.match(friends.title, /密友/);

    assert.equal(listNotifications({ pairId: "p1", userId: "u2" }).length, 2);
  });
});

test("notify templates + wx stub ids + invite share hides answers", () => {
  const preview = notifyTemplatesPreview();
  assert.equal(preview.templates.length, 3);
  assert.equal(NOTIFY_TEMPLATES.length, 3);
  assert.equal(preview.delivery, "stub_h5_local_only");
  assert.equal(preview.wxSubscribeTemplateIds.daily_ready, null);

  const share = buildInviteShareCard({
    inviteCode: "ISLAND1",
    relationshipType: "friends",
  });
  assert.equal(share.answersHidden, true);
  assert.equal(share.brand, "半个岛");
  assert.match(share.deepLink, /code=ISLAND1/);
  assert.doesNotMatch(share.description, /答案是|answer is/i);
});
