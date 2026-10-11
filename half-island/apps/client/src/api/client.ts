const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = (await res.json()) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw Object.assign(new Error(data.message || data.error || `HTTP ${res.status}`), {
      status: res.status,
      data,
    });
  }
  return data;
}

export const api = {
  health: () => request<{ ok: boolean; brand: string; phase: string }>("/health"),
  pairs: () => request<{ pairs: import("@half-island/shared").Pair[] }>("/pairs"),
  invite: (body: {
    userId: string;
    relationshipType: "couple" | "friends";
    displayName?: string;
    relationshipStage?: import("@half-island/shared").RelationshipStage;
    anniversaryDate?: string | null;
  }) =>
    request<{
      pair: import("@half-island/shared").Pair;
      share: import("@half-island/shared").InviteShareCard;
    }>("/pairs/invite", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  accept: (body: { userId: string; inviteCode: string; displayName?: string }) =>
    request<{ pair: import("@half-island/shared").Pair }>("/pairs/accept", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  dissolve: (body: { pairId: string; userId: string }) =>
    request<{ ok: true }>("/pairs/dissolve", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProfile: (body: {
    pairId: string;
    userId: string;
    relationshipStage?: import("@half-island/shared").RelationshipStage;
    anniversaryDate?: string | null;
    displayName?: string;
  }) =>
    request<{ pair: import("@half-island/shared").Pair }>("/pairs/profile", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  inviteShare: (opts: { code?: string; pairId?: string }) => {
    const q = opts.code
      ? `code=${encodeURIComponent(opts.code)}`
      : `pairId=${encodeURIComponent(opts.pairId || "")}`;
    return request<{
      share: import("@half-island/shared").InviteShareCard;
      pair: import("@half-island/shared").Pair;
    }>(`/invite/share?${q}`);
  },
  today: (pairId: string, userId: string) =>
    request<{
      dateKey: string;
      relationshipType: string;
      streak: number;
      premium: boolean;
      assignment: import("@half-island/shared").Assignment;
      reveal: import("@half-island/shared").Reveal;
      paywall: import("@half-island/shared").SoftPaywallInfo;
      commentPlaceholder: { zh: string; en: string };
      notifications: import("@half-island/shared").NotifyEvent[];
    }>(`/today?pairId=${encodeURIComponent(pairId)}&userId=${encodeURIComponent(userId)}`),
  answer: (body: {
    assignmentId: string;
    userId: string;
    body: string;
    choiceIndex?: number | null;
  }) =>
    request<{ ok: true; assignmentStatus: string }>("/answers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  reveal: (body: { assignmentId: string; userId: string }) =>
    request<{
      reveal: import("@half-island/shared").Reveal;
      streak: number;
    }>("/reveal", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  memory: (pairId: string, userId: string) =>
    request<{
      items: import("@half-island/shared").MemoryItem[];
      freeRevealArchive: true;
      streak: number;
    }>(
      `/memory?pairId=${encodeURIComponent(pairId)}&userId=${encodeURIComponent(userId)}`,
    ),
  paywall: (pairId: string, userId: string) =>
    request<{ paywall: import("@half-island/shared").SoftPaywallInfo }>(
      `/paywall?pairId=${encodeURIComponent(pairId)}&userId=${encodeURIComponent(userId)}`,
    ),
  togglePremium: (body: { pairId: string; userId: string; premium: boolean }) =>
    request<{ paywall: import("@half-island/shared").SoftPaywallInfo }>(
      "/premium/toggle",
      { method: "POST", body: JSON.stringify(body) },
    ),
  decks: (pairId: string, userId: string) =>
    request<{
      decks: import("@half-island/shared").DeckSummary[];
      paywall: import("@half-island/shared").SoftPaywallInfo;
    }>(`/decks?pairId=${encodeURIComponent(pairId)}&userId=${encodeURIComponent(userId)}`),
  startDeck: (body: { pairId: string; userId: string; deckId: string }) =>
    request<{
      assignmentId: string;
      prompt: import("@half-island/shared").DailyPrompt;
      kind: "extra";
    }>("/decks/start", { method: "POST", body: JSON.stringify(body) }),
  nudge: (body: { pairId: string; userId: string }) =>
    request<import("@half-island/shared").NudgeResult>("/nudge", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  postComment: (assignmentId: string, body: {
    userId: string;
    body?: string;
    reaction?: import("@half-island/shared").CommentReaction | null;
  }) =>
    request<{
      comment: import("@half-island/shared").AssignmentComment;
      comments: import("@half-island/shared").AssignmentComment[];
      placeholder: { zh: string; en: string };
    }>(`/assignments/${encodeURIComponent(assignmentId)}/comment`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  comments: (assignmentId: string, userId: string) =>
    request<{
      comments: import("@half-island/shared").AssignmentComment[];
      placeholder: { zh: string; en: string };
    }>(
      `/assignments/${encodeURIComponent(assignmentId)}/comments?userId=${encodeURIComponent(userId)}`,
    ),
  notifications: (pairId: string, userId: string) =>
    request<{
      notifications: import("@half-island/shared").NotifyEvent[];
      delivery: "stub_h5_local_only";
    }>(
      `/notifications?pairId=${encodeURIComponent(pairId)}&userId=${encodeURIComponent(userId)}`,
    ),
  ackNotification: (body: {
    notifyId: string;
    userId: string;
    status?: "local_shown" | "acked";
  }) =>
    request<{ notification: import("@half-island/shared").NotifyEvent }>(
      "/notifications/ack",
      { method: "POST", body: JSON.stringify(body) },
    ),
};

export { API_BASE };
