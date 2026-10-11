import type { RelationshipType } from "@half-island/shared";
import { getDb } from "../db/client.js";
import { id, shanghaiDateKey } from "../lib/ids.js";

export const NUDGE_DAILY_LIMIT = 3;

export function nudgeCopy(relationshipType: RelationshipType): string {
  if (relationshipType === "friends") {
    return "轻轻戳了一下：岛的另一岸，今天的题还等你落笔。";
  }
  return "轻轻戳了一下：你来了，岛才完整——今日题在等你。";
}

export function sendNudge(opts: {
  pairId: string;
  fromUserId: string;
  relationshipType: RelationshipType;
}): { ok: true; remaining: number; message: string } | { error: "limit_reached"; remaining: 0 } {
  const db = getDb();
  const dateKey = shanghaiDateKey();
  const used = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM nudges
         WHERE pair_id = ? AND from_user_id = ? AND date_key = ?`,
      )
      .get(opts.pairId, opts.fromUserId, dateKey) as { c: number }
  ).c;

  if (used >= NUDGE_DAILY_LIMIT) {
    return { error: "limit_reached", remaining: 0 };
  }

  db.prepare(
    `INSERT INTO nudges (id, pair_id, from_user_id, date_key, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id("ndg"), opts.pairId, opts.fromUserId, dateKey, new Date().toISOString());

  const remaining = NUDGE_DAILY_LIMIT - used - 1;
  return {
    ok: true,
    remaining,
    message: nudgeCopy(opts.relationshipType),
  };
}
