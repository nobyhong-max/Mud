<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <p class="eyebrow">今日 · {{ dateKey || "—" }}</p>
      <h1 class="brand">半个岛</h1>
      <p class="slogan">你来了，岛才完整。</p>
      <div class="island-silhouette" aria-hidden="true" />
      <div class="wave" />

      <p v-if="error" class="muted">{{ error }}</p>
      <template v-else-if="reveal">
        <p class="meta">
          {{ relationshipLabel }} · 连线 {{ streak }} 天 · {{ phaseLabel }}
        </p>
        <p class="prompt-text">{{ reveal.prompt.prompt }}</p>
        <p class="tag">
          {{ reveal.prompt.deck }} · {{ reveal.prompt.relationMode }} · L{{
            reveal.prompt.intimacyLevel
          }}
        </p>
        <div class="actions">
          <router-link v-if="reveal.phase === 'pending_self'" class="btn" to="/answer">
            去作答
          </router-link>
          <router-link
            v-else-if="reveal.phase === 'pending_partner'"
            class="btn"
            to="/waiting"
          >
            等待对方
          </router-link>
          <router-link
            v-else-if="reveal.phase === 'ready_to_reveal' || reveal.phase === 'revealed'"
            class="btn"
            to="/reveal"
          >
            {{ reveal.phase === "revealed" ? "查看揭晓" : "一起揭晓" }}
          </router-link>
        </div>
        <p class="soft">{{ softNote }}</p>
        <div class="links">
          <router-link to="/decks">主题牌组</router-link>
          <router-link to="/memory">回忆墙</router-link>
        </div>
      </template>
      <p v-else class="muted">潮水正在拢岸…</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { Reveal } from "@half-island/shared";
import { api } from "../../api/client";
import SessionBar from "../../components/SessionBar.vue";
import { session } from "../../session";

const reveal = ref<Reveal | null>(null);
const dateKey = ref("");
const streak = ref(0);
const relationshipType = ref("");
const error = ref("");
const softNote = ref("每日一题揭晓永久免费。");

const relationshipLabel = computed(() =>
  relationshipType.value === "friends" ? "密友岛" : "情侣岛",
);

const phaseLabel = computed(() => {
  switch (reveal.value?.phase) {
    case "pending_self":
      return "就差你作答";
    case "pending_partner":
      return "对方还在路上";
    case "ready_to_reveal":
      return "可以揭晓了";
    case "revealed":
      return "已揭晓";
    default:
      return "";
  }
});

async function load(): Promise<void> {
  error.value = "";
  reveal.value = null;
  try {
    const data = await api.today(session.pairId, session.userId);
    reveal.value = data.reveal;
    dateKey.value = data.dateKey;
    streak.value = data.streak;
    relationshipType.value = data.relationshipType;
    softNote.value = data.paywall?.message ?? softNote.value;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  }
}

onMounted(load);
watch(() => [session.userId, session.pairId], load);
</script>

<style scoped>
.eyebrow {
  margin: 0;
  letter-spacing: 0.2em;
  font-size: 0.72rem;
  opacity: 0.62;
  animation: rise 0.6s ease both;
}
.meta {
  margin: 0;
  opacity: 0.78;
  font-size: 0.95rem;
}
.tag {
  margin: 0;
  font-size: 0.78rem;
  opacity: 0.5;
}
.actions {
  margin-top: 0.35rem;
}
.actions .btn {
  display: inline-block;
  text-decoration: none;
}
.soft {
  margin-top: 0.85rem;
  font-size: 0.86rem;
  opacity: 0.68;
  line-height: 1.45;
}
.links {
  display: flex;
  gap: 1rem;
  font-size: 0.9rem;
  opacity: 0.85;
}
.links a {
  text-decoration: none;
  border-bottom: 1px solid rgba(201, 166, 107, 0.4);
}
</style>
