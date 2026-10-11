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
  | "deck_locked_tap"
  | "comment_posted"
  | "notify_enqueued"
  | "notify_ack";

/** 留存触达事件（推送未接线前先入库 + H5 stub） */
export type NotifyEventKind =
  | "daily_ready"
  | "partner_answered"
  | "streak_risk";

export type RelationshipStage =
  | "just_met"
  | "getting_close"
  | "steady"
  | "years"
  | "unspecified";

/** 揭晓后短评允许的表情（非聊天） */
export const COMMENT_REACTIONS = ["❤️", "🤗", "✨", "🌊", "🏝️"] as const;
export type CommentReaction = (typeof COMMENT_REACTIONS)[number];

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
  /** Onboarding：关系阶段（可选） */
  relationshipStage: RelationshipStage;
  /** Onboarding：纪念日 YYYY-MM-DD（可选） */
  anniversaryDate: string | null;
}

/** 揭晓后 assignment 级短评（每人一条） */
export interface AssignmentComment {
  id: string;
  assignmentId: string;
  userId: string;
  body: string;
  reaction: CommentReaction | null;
  bilingual: BilingualText;
  createdAt: string;
}

/** 可触达留存记录（无真实微信推送） */
export interface NotifyEvent {
  id: string;
  kind: NotifyEventKind;
  pairId: string;
  /** 接收方 */
  userId: string;
  title: string;
  titleEn: string;
  body: string;
  bodyEn: string;
  /** pending | local_shown | acked */
  status: "pending" | "local_shown" | "acked";
  payload: Record<string, unknown> | null;
  createdAt: string;
}

/** 邀请分享卡（无答案） */
export interface InviteShareCard {
  brand: string;
  slogan: string;
  sloganEn: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  inviteCode: string;
  relationshipType: RelationshipType;
  deepLink: string;
  /** 明确：分享不暴露任何答案 */
  answersHidden: true;
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
  /** 仅 phase=revealed 时填充；未揭晓为空数组 */
  comments: AssignmentComment[];
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
  comments: AssignmentComment[];
}

export interface NudgeResult {
  ok: true;
  remaining: number;
  message: string;
}

/** 微信订阅消息模板位（无 AppID 时为空占位） */
export interface WxSubscribeTemplateIds {
  daily_ready: string | null;
  partner_answered: string | null;
  streak_risk: string | null;
}

export interface NotifyTemplatePreview {
  kind: NotifyEventKind;
  couple: { title: string; titleEn: string; body: string; bodyEn: string };
  friends: { title: string; titleEn: string; body: string; bodyEn: string };
  wxTemplateIdKey: keyof WxSubscribeTemplateIds;
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
  festival_qixi: "七夕飞地",
};

export const DECK_TITLES_EN: Record<string, string> = {
  daily_bits: "Daily bits",
  whos_more: "Who's more likely",
  either_or: "Either / or",
  values: "Values",
  long_distance: "Long distance",
  repair: "Repair",
  friends_neutral: "Friends / neutral",
  festival_qixi: "Qixi enclave",
};

/** 运营包扩容管线：v1.1 核心 ≥300；festival_qixi 已合并 */
export const DECK_PACK_TARGETS = {
  coreV1: 300,
  targetTotal: 300,
  festivalQixi: 20,
} as const;

export const RELATIONSHIP_STAGE_LABELS: Record<
  RelationshipStage,
  { zh: string; en: string }
> = {
  just_met: { zh: "刚认识", en: "Just met" },
  getting_close: { zh: "越来越熟", en: "Getting close" },
  steady: { zh: "稳定相处", en: "Steady" },
  years: { zh: "已经很多年", en: "Years together" },
  unspecified: { zh: "先不说", en: "Skip for now" },
};

export const COMMENT_PLACEHOLDER: Record<
  RelationshipType,
  { zh: string; en: string }
> = {
  couple: {
    zh: "读完对方答案，留一句给岛…",
    en: "One line for the island after reading…",
  },
  friends: {
    zh: "读完对方答案，留一句给这座飞地…",
    en: "One line for this enclave after reading…",
  },
};

export const NOTIFY_TEMPLATES: NotifyTemplatePreview[] = [
  {
    kind: "daily_ready",
    wxTemplateIdKey: "daily_ready",
    couple: {
      title: "今日岛亮了",
      titleEn: "Today's island is lit",
      body: "今日一题已备好——你来了，岛才完整。",
      bodyEn: "Today's prompt is ready — you arrive, the island is whole.",
    },
    friends: {
      title: "岛上有新动静",
      titleEn: "Something new on the island",
      body: "今日一题在等你们落笔，不催恋爱口气。",
      bodyEn: "Today's prompt is waiting — no romance pressure.",
    },
  },
  {
    kind: "partner_answered",
    wxTemplateIdKey: "partner_answered",
    couple: {
      title: "另一岸亮了",
      titleEn: "Their shore lit up",
      body: "对方已作答。差你揭晓，才能把半岛拼完整。",
      bodyEn: "They answered. Reveal together to join the peninsulas.",
    },
    friends: {
      title: "密友已落笔",
      titleEn: "Your friend wrote",
      body: "对方已写好今日题。轮到你了——答案在双方完成前互不可见。",
      bodyEn: "They finished today's prompt. Your turn — answers stay hidden until both write.",
    },
  },
  {
    kind: "streak_risk",
    wxTemplateIdKey: "streak_risk",
    couple: {
      title: "连线还差一口气",
      titleEn: "Streak needs a spark",
      body: "今日题还没揭晓。轻轻回来一下，别让岛降温。",
      bodyEn: "Today isn't revealed yet. Come back gently — keep the island warm.",
    },
    friends: {
      title: "飞地还差你们",
      titleEn: "The enclave is waiting",
      body: "今日连线还没合上。不恐吓断签，只是岛还亮着等你们。",
      bodyEn: "Today's link isn't closed. No scare tactics — the island is still lit for you.",
    },
  },
];

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
  onboarding: { zh: "建岛引导", en: "Onboarding" },
  leaveComment: { zh: "留下一句", en: "Leave a note" },
  notifications: { zh: "岛上提醒", en: "Island reminders" },
  shareInvite: { zh: "分享邀请卡", en: "Share invite card" },
} as const;

export function bilingualLine(zh: string, en: string): string {
  if (!en || en === zh) return zh;
  return `${zh} / ${en}`;
}
