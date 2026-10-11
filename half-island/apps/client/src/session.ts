import { reactive } from "vue";

/** Phase 0 本地会话占位（真实登录在 Phase 1） */
export const session = reactive({
  userId: localStorage.getItem("hi_userId") || "user_alice",
  pairId: localStorage.getItem("hi_pairId") || "pair_couple_demo",
});

export function persistSession(): void {
  localStorage.setItem("hi_userId", session.userId);
  localStorage.setItem("hi_pairId", session.pairId);
}

export const demoUsers = [
  { id: "user_alice", label: "阿梨（情侣岛 A）", pairId: "pair_couple_demo" },
  { id: "user_bobo", label: "波波（情侣岛 B）", pairId: "pair_couple_demo" },
  { id: "user_chen", label: "陈陈（密友岛 A）", pairId: "pair_friends_demo" },
  { id: "user_doudou", label: "豆豆（密友岛 B）", pairId: "pair_friends_demo" },
];
