import type { RelationshipType } from "@half-island/shared";
import { getDb } from "../db/client.js";

export type PairRow = {
  id: string;
  user_a_id: string;
  user_b_id: string | null;
  relationship_type: RelationshipType;
  streak: number;
  last_streak_date: string | null;
  premium: number;
  status: string;
};

export function getActivePair(
  pairId: string,
  userId: string,
): PairRow | "not_found" | "forbidden" | "dissolved" {
  const pair = getDb().prepare("SELECT * FROM pairs WHERE id = ?").get(pairId) as
    | PairRow
    | undefined;
  if (!pair) return "not_found";
  if (pair.status === "dissolved") return "dissolved";
  if (pair.user_a_id !== userId && pair.user_b_id !== userId) return "forbidden";
  return pair;
}

export function pairError(
  pair: "not_found" | "forbidden" | "dissolved",
): { code: number; error: string } {
  if (pair === "forbidden") return { code: 403, error: "not_in_pair" };
  if (pair === "dissolved") return { code: 410, error: "pair_dissolved" };
  return { code: 404, error: "pair_not_found" };
}
