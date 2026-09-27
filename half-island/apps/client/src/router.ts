import { createRouter, createWebHistory } from "vue-router";
import InvitePage from "./pages/invite/index.vue";
import TodayPage from "./pages/today/index.vue";
import AnswerPage from "./pages/answer/index.vue";
import WaitingPage from "./pages/waiting/index.vue";
import RevealPage from "./pages/reveal/index.vue";

/**
 * 页面路由与未来 uni-app pages.json 对齐：
 * pages/invite | today | answer | waiting | reveal
 */
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/today" },
    { path: "/invite", component: InvitePage, meta: { title: "邀请上岛" } },
    { path: "/today", component: TodayPage, meta: { title: "今日" } },
    { path: "/answer", component: AnswerPage, meta: { title: "作答" } },
    { path: "/waiting", component: WaitingPage, meta: { title: "等待" } },
    { path: "/reveal", component: RevealPage, meta: { title: "揭晓" } },
  ],
});
