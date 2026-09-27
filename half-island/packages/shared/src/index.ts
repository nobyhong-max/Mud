/** 半个岛 — 共享领域类型（Phase 1） */

export type RelationshipType = "couple" | "friends";
/** 题库 relation_mode；入库 audience: couple|friends|neutral(both) */
export type RelationMode = "couple" | "friend" | "both";
export type PromptAudience = "couple" | "friends" | "neutral";
export type PromptType = "open_text" | "single_choice" | "whos_more_likely" | "either_or";
export type IntimacyLevel = 0 | 1 | 2 | 3 | 4;

/**
 * assigned → answered_partial → ready_to_reveal → revealed → archived
 */
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
  /** 软会员旗标（Phase 1 stub；不锁已揭晓） */
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
  /** L4 预留；一期默认池不得使用 */
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
}

export interface Answer {
  id: string;
  assignmentId: string;
  userId: string;
  body: string;
  choiceIndex: number | null;
  createdAt: string;
}

/** 揭晓聚合（仅 both_answered 后可返回对方正文） */
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
}

export interface SoftPaywallInfo {
  /** 每日免费揭晓常开 */
  dailyRevealFree: true;
  /** 超额题量 / 主题牌组门槛（stub） */
  premiumRequiredForExtraDecks: true;
  premium: boolean;
  message: string;
}

export interface HealthResponse {
  ok: true;
  service: "half-island-api";
  brand: "半个岛";
  slogan: "你来了，岛才完整。";
  phase: "1";
  time: string;
}
