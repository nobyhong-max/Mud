const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8787";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  health: () => request<{ ok: boolean; brand: string }>("/health"),
  pairs: () => request<{ pairs: import("@half-island/shared").Pair[] }>("/pairs"),
  invite: (body: {
    userId: string;
    relationshipType: "couple" | "friends";
  }) =>
    request<{ pair: import("@half-island/shared").Pair }>("/pairs/invite", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  accept: (body: { userId: string; inviteCode: string }) =>
    request<{ pair: import("@half-island/shared").Pair }>("/pairs/accept", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  today: (pairId: string, userId: string) =>
    request<{
      dateKey: string;
      relationshipType: string;
      streak: number;
      assignment: import("@half-island/shared").Assignment;
      reveal: import("@half-island/shared").Reveal;
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
};

export { API_BASE };
