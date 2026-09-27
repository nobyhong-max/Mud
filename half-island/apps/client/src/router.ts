import { createRouter, createWebHistory } from "vue-router";
import InvitePage from "./pages/invite/index.vue";
import TodayPage from "./pages/today/index.vue";
import AnswerPage from "./pages/answer/index.vue";
import WaitingPage from "./pages/waiting/index.vue";
import RevealPage from "./pages/reveal/index.vue";
import MemoryPage from "./pages/memory/index.vue";
import DecksPage from "./pages/decks/index.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/today" },
    { path: "/invite", component: InvitePage, meta: { title: "邀请上岛" } },
    { path: "/today", component: TodayPage, meta: { title: "今日" } },
    { path: "/answer", component: AnswerPage, meta: { title: "作答" } },
    { path: "/waiting", component: WaitingPage, meta: { title: "等待" } },
    { path: "/reveal", component: RevealPage, meta: { title: "揭晓" } },
    { path: "/memory", component: MemoryPage, meta: { title: "回忆墙" } },
    { path: "/decks", component: DecksPage, meta: { title: "牌组" } },
  ],
});
