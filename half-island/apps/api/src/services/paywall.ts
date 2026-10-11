import type { SoftPaywallInfo } from "@half-island/shared";
import { getDb } from "../db/client.js";
import { shanghaiDateKey } from "../lib/ids.js";
import type { PairRow } from "./pair-access.js";

/** 每日免费日更额度（揭晓闭环常开） */
export const FREE_DAILY_LIMIT = 1;

export function countDailyAssignments(pairId: string, dateKey = shanghaiDateKey()): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM assignments
       WHERE pair_id = ? AND date_key = ? AND kind = 'daily'`,
    )
    .get(pairId, dateKey) as { c: number };
  return row.c;
}

export function countExtraAssignments(pairId: string, dateKey = shanghaiDateKey()): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM assignments
       WHERE pair_id = ? AND date_key = ? AND kind = 'extra'`,
    )
    .get(pairId, dateKey) as { c: number };
  return row.c;
}

export function buildPaywallInfo(pair: PairRow): SoftPaywallInfo {
  const used = countDailyAssignments(pair.id);
  const premium = Boolean(pair.premium);
  return {
    dailyRevealFree: true,
    premiumRequiredForExtraDecks: true,
    freeDailyLimit: FREE_DAILY_LIMIT,
    freeDailyUsed: Math.min(used, FREE_DAILY_LIMIT),
    premium,
    message: premium
      ? "双人会员已开启：主题牌组与加练可用。每日揭晓与已揭晓回看始终免费。"
      : "每日一题揭晓永久免费。主题牌组与超额加练需双人会员（本地可假开通，无真实扣款）。",
  };
}

/** 主题牌组需要会员；日更 daily_bits 浏览不锁 */
export function deckRequiresPremium(deckId: string): boolean {
  return deckId !== "daily_bits";
}

export function canStartExtraDeck(pair: PairRow, deckId: string): boolean {
  if (!deckRequiresPremium(deckId)) return true;
  return Boolean(pair.premium);
}
