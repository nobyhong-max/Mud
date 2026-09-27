/** 半个岛 — 共享领域类型（Phase 0） */

export type RelationshipType = "couple" | "friends";
export type PromptAudience = "couple" | "friends" | "neutral";
export type PromptType = "open_text" | "single_choice" | "whos_more_likely" | "either_or";
export type IntimacyLevel = 0 | 1 | 2 | 3 | 4;

/**
 * 今日题 / 揭晓状态机（C1 将落地完整校验）
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
  status: "pending" | "active" | "dissolved";
  createdAt: string;
}

export interface DailyPrompt {
  id: string;
  type: PromptType;
  prompt: string;
  choices: string[] | null;
  intimacyLevel: IntimacyLevel;
  audience: PromptAudience;
  /** L4 预留；一期默认池不得使用 */
  nsfwFlag: boolean;
  status: "draft" | "active" | "archived";
}

export interface Assignment {
  id: string;
  pairId: string;
  promptId: string;
  dateKey: string; // Asia/Shanghai YYYY-MM-DD
  status: AssignmentStatus;
  createdAt: string;
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
  revealedAt: string | null;
}

export interface HealthResponse {
  ok: true;
  service: "half-island-api";
  brand: "半个岛";
  slogan: "你来了，岛才完整。";
  phase: "0";
  time: string;
}
