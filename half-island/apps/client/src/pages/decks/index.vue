<template>
  <div class="page">
    <SessionBar />
    <div class="page-main top">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">主题牌组 · 软门槛</p>
      <div class="wave" />
      <p class="soft">{{ paywallMsg }}</p>

      <button class="ghost" :disabled="busy" @click="toggle">
        {{ premium ? "关闭演示会员" : "假开通双人会员（无扣款）" }}
      </button>

      <p v-if="error" class="muted">{{ error }}</p>
      <ul class="decks">
        <li v-for="d in decks" :key="d.id">
          <div>
            <p class="title">{{ d.title }}</p>
            <p class="sub">{{ d.count }} 题 · {{ d.locked ? "需会员" : "可进入" }}</p>
          </div>
          <button :disabled="busy" @click="openDeck(d)">
            {{ d.locked ? "查看门槛" : "抽一题" }}
          </button>
        </li>
      </ul>
      <p v-if="extraPrompt" class="extra">
        加练题：{{ extraPrompt }}
        <router-link to="/answer">去作答需自行带 assignment（演示以今日为主）</router-link>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { DeckSummary } from "@half-island/shared";
import { api } from "../../api/client";
import SessionBar from "../../components/SessionBar.vue";
import { session } from "../../session";

const decks = ref<DeckSummary[]>([]);
const premium = ref(false);
const paywallMsg = ref("");
const error = ref("");
const busy = ref(false);
const extraPrompt = ref("");

async function load(): Promise<void> {
  error.value = "";
  try {
    const data = await api.decks(session.pairId, session.userId);
    decks.value = data.decks;
    premium.value = data.paywall.premium;
    paywallMsg.value = data.paywall.message;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  }
}

async function toggle(): Promise<void> {
  busy.value = true;
  try {
    const res = await api.togglePremium({
      pairId: session.pairId,
      userId: session.userId,
      premium: !premium.value,
    });
    premium.value = res.paywall.premium;
    paywallMsg.value = res.paywall.message;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "失败";
  } finally {
    busy.value = false;
  }
}

async function openDeck(d: DeckSummary): Promise<void> {
  busy.value = true;
  error.value = "";
  extraPrompt.value = "";
  try {
    if (d.locked) {
      await api.paywall(session.pairId, session.userId);
      error.value = "主题牌组需双人会员。每日免费揭晓与回忆墙不受影响。";
      return;
    }
    const res = await api.startDeck({
      pairId: session.pairId,
      userId: session.userId,
      deckId: d.id,
    });
    extraPrompt.value = res.prompt.prompt;
  } catch (e) {
    const err = e as Error & { data?: { message?: string } };
    error.value = err.data?.message || err.message || "无法开始";
    await load();
  } finally {
    busy.value = false;
  }
}

onMounted(load);
watch(() => [session.userId, session.pairId], load);
</script>

<style scoped>
.top {
  justify-content: flex-start;
}
.soft {
  opacity: 0.75;
  font-size: 0.9rem;
  line-height: 1.45;
  margin: 0;
}
.ghost {
  background: transparent;
  align-self: flex-start;
}
.decks {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.decks li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  border-top: 1px solid rgba(201, 166, 107, 0.25);
  padding-top: 0.75rem;
}
.title {
  margin: 0;
  font-size: 1.05rem;
}
.sub {
  margin: 0.2rem 0 0;
  font-size: 0.8rem;
  opacity: 0.6;
}
.extra {
  font-size: 0.95rem;
  opacity: 0.85;
  line-height: 1.45;
}
</style>
