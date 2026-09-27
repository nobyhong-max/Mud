import type { DatabaseSync } from "node:sqlite";
import type { RelationshipType } from "@half-island/shared";

/**
 * 日更抽题：
 * couple → relation_mode IN (couple, both)
 * friends → relation_mode IN (friend, both)
 * 仅 daily_eligible=1、L0–L1、无 nsfw、无 L4；排除近 21 天已出题。
 */
export function pickDailyPromptId(
  db: DatabaseSync,
  pairId: string,
  relationshipType: RelationshipType,
): string | null {
  const modes =
    relationshipType === "friends"
      ? ["friend", "both"]
      : ["couple", "both"];

  const placeholders = modes.map(() => "?").join(",");
  const recent = db
    .prepare(
      `SELECT prompt_id FROM pair_prompt_history
       WHERE pair_id = ?
         AND used_on >= date('now', '-21 days')`,
    )
    .all(pairId) as { prompt_id: string }[];
  const recentIds = new Set(recent.map((r) => r.prompt_id));

  const rows = db
    .prepare(
      `SELECT id FROM prompts
       WHERE status = 'active'
         AND nsfw_flag = 0
         AND intimacy_level BETWEEN 0 AND 1
         AND daily_eligible = 1
         AND relation_mode IN (${placeholders})
       ORDER BY RANDOM()`,
    )
    .all(...modes) as { id: string }[];

  const fresh = rows.find((r) => !recentIds.has(r.id));
  return (fresh ?? rows[0])?.id ?? null;
}

/** 校验密友 pair 不会抽到 couple-only 题 */
export function assertPromptAllowedForPair(
  relationshipType: RelationshipType,
  relationMode: string,
): boolean {
  if (relationshipType === "friends") {
    return relationMode === "friend" || relationMode === "both";
  }
  return relationMode === "couple" || relationMode === "both";
}
