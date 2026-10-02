import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { closeDb, getDb } from "../db/client.js";
import { NUDGE_DAILY_LIMIT, sendNudge } from "../services/nudge.js";
import {
  buildPaywallInfo,
  canStartExtraDeck,
  FREE_DAILY_LIMIT,
} from "../services/paywall.js";
import type { PairRow } from "../services/pair-access.js";

function withTempDb(fn: () => void): void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hi-p2-"));
  process.env.DATABASE_PATH = path.join(dir, "t.db");
  closeDb();
  try {
    fn();
  } finally {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const basePair = (over: Partial<PairRow> = {}): PairRow => ({
  id: "p1",
  user_a_id: "u1",
  user_b_id: "u2",
  relationship_type: "couple",
  streak: 0,
  last_streak_date: null,
  premium: 0,
  status: "active",
  ...over,
});

test("soft paywall keeps daily free; theme decks need premium", () => {
  const free = buildPaywallInfo(basePair());
  assert.equal(free.dailyRevealFree, true);
  assert.equal(free.freeDailyLimit, FREE_DAILY_LIMIT);
  assert.equal(free.premium, false);
  assert.equal(canStartExtraDeck(basePair(), "daily_bits"), true);
  assert.equal(canStartExtraDeck(basePair(), "values"), false);
  assert.equal(canStartExtraDeck(basePair({ premium: 1 }), "values"), true);
});

test("nudge rate limit is 3 per user per day", () => {
  withTempDb(() => {
    const db = getDb();
    db.prepare(
      `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
    ).run("u1", "a", "t");
    db.prepare(
      `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
    ).run("u2", "b", "t");
    db.prepare(
      `INSERT INTO pairs (id, invite_code, relationship_type, user_a_id, user_b_id, streak, status, created_at)
       VALUES ('p1','ABC123','couple','u1','u2',0,'active','t')`,
    ).run();

    for (let i = 0; i < NUDGE_DAILY_LIMIT; i++) {
      const r = sendNudge({
        pairId: "p1",
        fromUserId: "u1",
        relationshipType: "couple",
      });
      assert.ok("ok" in r && r.ok);
    }
    const blocked = sendNudge({
      pairId: "p1",
      fromUserId: "u1",
      relationshipType: "couple",
    });
    assert.equal("error" in blocked && blocked.error, "limit_reached");

    const other = sendNudge({
      pairId: "p1",
      fromUserId: "u2",
      relationshipType: "couple",
    });
    assert.ok("ok" in other && other.ok);
  });
});
