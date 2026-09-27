import type {
  Answer,
  Assignment,
  AssignmentStatus,
  DailyPrompt,
  IntimacyLevel,
  PromptAudience,
  PromptType,
  RelationMode,
  Reveal,
  RevealPhase,
} from "@half-island/shared";

export function mapPrompt(row: Record<string, unknown>): DailyPrompt {
  return {
    id: String(row.id),
    type: row.type as PromptType,
    prompt: String(row.prompt),
    choices: row.choices_json
      ? (JSON.parse(String(row.choices_json)) as string[])
      : null,
    intimacyLevel: Number(row.intimacy_level) as IntimacyLevel,
    audience: row.audience as PromptAudience,
    relationMode: (row.relation_mode as RelationMode) || "both",
    deck: String(row.deck ?? "daily_bits"),
    tags: row.tags_json ? (JSON.parse(String(row.tags_json)) as string[]) : [],
    followup: row.followup ? String(row.followup) : null,
    dailyEligible: Boolean(row.daily_eligible ?? 1),
    nsfwFlag: Boolean(row.nsfw_flag),
    status: row.status as DailyPrompt["status"],
  };
}

export function mapAssignment(row: Record<string, unknown>): Assignment {
  return {
    id: String(row.id),
    pairId: String(row.pair_id),
    promptId: String(row.prompt_id),
    dateKey: String(row.date_key),
    status: row.status as AssignmentStatus,
    createdAt: String(row.created_at),
    revealedAt: row.revealed_at ? String(row.revealed_at) : null,
  };
}

export function mapAnswer(row: Record<string, unknown>): Answer {
  return {
    id: String(row.id),
    assignmentId: String(row.assignment_id),
    userId: String(row.user_id),
    body: String(row.body),
    choiceIndex:
      row.choice_index === null || row.choice_index === undefined
        ? null
        : Number(row.choice_index),
    createdAt: String(row.created_at),
  };
}

export function partnerId(
  pair: { user_a_id: string; user_b_id: string | null },
  userId: string,
): string | null {
  if (pair.user_a_id === userId) return pair.user_b_id;
  if (pair.user_b_id === userId) return pair.user_a_id;
  return null;
}

export function computePhase(
  selfAnswered: boolean,
  partnerAnswered: boolean,
  status: AssignmentStatus,
): RevealPhase {
  if (status === "revealed") return "revealed";
  if (selfAnswered && partnerAnswered) return "ready_to_reveal";
  if (!selfAnswered) return "pending_self";
  return "pending_partner";
}

/**
 * 安全硬规则：未双答前 partnerAnswer 必须为 null。
 * 即使 DB 里已有对方答案，API 也不得返回正文。
 */
export function buildReveal(opts: {
  assignmentId: string;
  prompt: DailyPrompt;
  status: AssignmentStatus;
  selfRow: Record<string, unknown> | undefined;
  partnerRow: Record<string, unknown> | undefined;
  revealedAt: string | null;
}): Reveal {
  const both = Boolean(opts.selfRow && opts.partnerRow);
  // partner body only when both answered — never leak otherwise
  const partnerAnswer =
    both && opts.partnerRow ? mapAnswer(opts.partnerRow) : null;

  return {
    assignmentId: opts.assignmentId,
    prompt: opts.prompt,
    phase: computePhase(
      Boolean(opts.selfRow),
      Boolean(opts.partnerRow),
      opts.status,
    ),
    selfAnswer: opts.selfRow ? mapAnswer(opts.selfRow) : null,
    partnerAnswer: both ? partnerAnswer : null,
    selfAnsweredAt: opts.selfRow ? String(opts.selfRow.created_at) : null,
    partnerAnsweredAt:
      both && opts.partnerRow ? String(opts.partnerRow.created_at) : null,
    revealedAt: opts.status === "revealed" ? opts.revealedAt : null,
  };
}

/** 未双答时读取对方答案 → 应 403 */
export function canReadPartnerAnswer(answerCount: number): boolean {
  return answerCount >= 2;
}

/**
 * Streak：Asia/Shanghai 连续日。
 * 首次揭晓或与上次 streak 日差 1 → +1；同日重复不 +；断签重置为 1。
 */
export function nextStreak(
  current: number,
  lastStreakDate: string | null,
  todayKey: string,
): { streak: number; lastStreakDate: string } {
  if (lastStreakDate === todayKey) {
    return { streak: current, lastStreakDate: todayKey };
  }
  if (!lastStreakDate) {
    return { streak: 1, lastStreakDate: todayKey };
  }
  const prev = new Date(lastStreakDate + "T12:00:00+08:00");
  const today = new Date(todayKey + "T12:00:00+08:00");
  const diffDays = Math.round(
    (today.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 1) {
    return { streak: current + 1, lastStreakDate: todayKey };
  }
  return { streak: 1, lastStreakDate: todayKey };
}
