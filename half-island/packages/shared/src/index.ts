/** 半个岛 — 共享领域类型（Phase 2 + bilingual） */

export type RelationshipType = "couple" | "friends";
export type RelationMode = "couple" | "friend" | "both";
export type PromptAudience = "couple" | "friends" | "neutral";
export type PromptType = "open_text" | "single_choice" | "whos_more_likely" | "either_or";
export type IntimacyLevel = 0 | 1 | 2 | 3 | 4;
export type SourceLang = "zh" | "en" | "mixed";

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

/** 用户可见结果区：中英并列 */
export interface BilingualText {
  zh: string;
  en: string;
  sourceLang: SourceLang;
  /** 机翻/占位时为 true；题库人工英译为 false */
  needsReview: boolean;
}

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
  /** 中文题干（主） */
  prompt: string;
  /** 英文题干（辅） */
  promptEn: string;
  choices: string[] | null;
  choicesEn: string[] | null;
  intimacyLevel: IntimacyLevel;
  audience: PromptAudience;
  relationMode: RelationMode;
  deck: string;
  tags: string[];
  followup: string | null;
  followupEn: string | null;
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
  /** 原文 */
  body: string;
  choiceIndex: number | null;
  createdAt: string;
  /** 揭晓/回忆用：原文 + 另一语言 */
  bilingual: BilingualText;
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
  promptEn: string;
  selfAnswer: string;
  partnerAnswer: string;
  selfBilingual: BilingualText;
  partnerBilingual: BilingualText;
  revealedAt: string;
  relationshipType: RelationshipType;
  deck: string;
  followup: string | null;
  followupEn: string | null;
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
  titleEn: string;
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
  sloganEn: "You arrive — the island becomes whole.";
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

export const DECK_TITLES_EN: Record<string, string> = {
  daily_bits: "Daily bits",
  whos_more: "Who's more likely",
  either_or: "Either / or",
  values: "Values",
  long_distance: "Long distance",
  repair: "Repair",
  friends_neutral: "Friends / neutral",
};

/** 关键 chrome：中英并列展示 */
export const UI_COPY = {
  brand: { zh: "半个岛", en: "Half Island" },
  slogan: { zh: "你来了，岛才完整。", en: "You arrive — the island becomes whole." },
  today: { zh: "今日", en: "Today" },
  answer: { zh: "作答", en: "Answer" },
  waiting: { zh: "等待", en: "Waiting" },
  reveal: { zh: "揭晓", en: "Reveal" },
  memory: { zh: "回忆墙", en: "Memory" },
  decks: { zh: "主题牌组", en: "Decks" },
  goAnswer: { zh: "去作答", en: "Answer now" },
  waitPartner: { zh: "等待对方", en: "Waiting for them" },
  revealTogether: { zh: "一起揭晓", en: "Reveal together" },
  viewReveal: { zh: "查看揭晓", en: "View reveal" },
  lockAnswer: { zh: "锁定答案", en: "Lock answer" },
  you: { zh: "你", en: "You" },
  partner: { zh: "TA", en: "Them" },
} as const;

export function bilingualLine(zh: string, en: string): string {
  if (!en || en === zh) return zh;
  return `${zh} / ${en}`;
}
