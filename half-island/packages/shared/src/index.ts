/** 半个岛 — 共享领域类型（Phase 2） */

export type RelationshipType = "couple" | "friends";
export type RelationMode = "couple" | "friend" | "both";
export type PromptAudience = "couple" | "friends" | "neutral";
export type PromptType = "open_text" | "single_choice" | "whos_more_likely" | "either_or";
export type IntimacyLevel = 0 | 1 | 2 | 3 | 4;

export type AssignmentStatus =
  | "assigned"
  | "answered_partial"
  | "ready_to_reveal"
  | "revealed"
  | "archived";

export type RevealPhase =
  | "pending_self"
  | "pending_partner"
  | "ready_to_reveal"
  | "revealed";

export type AnalyticsEventName =
  | "pair_success"
  | "prompt_answered"
  | "revealed"
  | "streak_increment"
  | "paywall_view"
  | "nudge_sent"
  | "deck_locked_tap";

export interface User {
  id: string;
  displayName: string;
  createdAt: string;
}

export interface Pair {
  id: string;
  inviteCode: string;
  relationshipType: RelationshipType;
  userAId: string;
  userBId: string | null;
  streak: number;
  lastStreakDate: string | null;
  /** 软会员旗标（假支付可开关；不锁已揭晓） */
  premium: boolean;
  status: "pending" | "active" | "dissolved";
  createdAt: string;
  dissolvedAt: string | null;
}

export interface DailyPrompt {
  id: string;
  type: PromptType;
  prompt: string;
  choices: string[] | null;
  intimacyLevel: IntimacyLevel;
  audience: PromptAudience;
  relationMode: RelationMode;
  deck: string;
  tags: string[];
  followup: string | null;
  dailyEligible: boolean;
  nsfwFlag: boolean;
  status: "draft" | "active" | "archived";
}

export interface Assignment {
  id: string;
  pairId: string;
  promptId: string;
  dateKey: string;
  status: AssignmentStatus;
  createdAt: string;
  revealedAt: string | null;
  /** daily = 免费日更；extra = 超额/牌组加练 */
  kind: "daily" | "extra";
  deckId: string | null;
}

export interface Answer {
  id: string;
  assignmentId: string;
  userId: string;
  body: string;
  choiceIndex: number | null;
  createdAt: string;
}

export interface Reveal {
  assignmentId: string;
  prompt: DailyPrompt;
  phase: RevealPhase;
  selfAnswer: Answer | null;
  partnerAnswer: Answer | null;
  selfAnsweredAt: string | null;
  partnerAnsweredAt: string | null;
  revealedAt: string | null;
}

export interface MemoryItem {
  assignmentId: string;
  dateKey: string;
  prompt: string;
  selfAnswer: string;
  partnerAnswer: string;
  revealedAt: string;
  relationshipType: RelationshipType;
  deck: string;
  followup: string | null;
}

export interface SoftPaywallInfo {
  dailyRevealFree: true;
  premiumRequiredForExtraDecks: true;
  freeDailyLimit: number;
  freeDailyUsed: number;
  premium: boolean;
  message: string;
}

export interface DeckSummary {
  id: string;
  title: string;
  count: number;
  locked: boolean;
  relationModes: RelationMode[];
}

export interface NudgeResult {
  ok: true;
  remaining: number;
  message: string;
}

export interface HealthResponse {
  ok: true;
  service: "half-island-api";
  brand: "半个岛";
  slogan: "你来了，岛才完整。";
  phase: "2";
  time: string;
}

export const DECK_TITLES: Record<string, string> = {
  daily_bits: "今日琐碎",
  whos_more: "谁更可能",
  either_or: "二选一",
  values: "价值观",
  long_distance: "异地",
  repair: "冲突修复",
  friends_neutral: "密友/中性",
};
