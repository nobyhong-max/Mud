<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <p class="eyebrow">今日 · {{ dateKey || "—" }}</p>
      <h1 class="brand">半个岛</h1>
      <p class="slogan">你来了，岛才完整。</p>
      <div class="wave" />

      <p v-if="error" class="muted">{{ error }}</p>
      <template v-else-if="reveal">
        <p class="meta">
          {{ relationshipLabel }} · 连线 {{ streak }} 天 ·
          <span>{{ phaseLabel }}</span>
        </p>
        <p class="prompt-text">{{ reveal.prompt.prompt }}</p>
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
      </template>
      <p v-else class="muted">加载中…</p>
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
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-size: 0.75rem;
  opacity: 0.65;
  animation: rise 0.6s ease both;
}
.meta {
  margin: 0;
  opacity: 0.75;
  font-size: 0.95rem;
}
.actions {
  margin-top: 0.5rem;
}
.actions .btn {
  display: inline-block;
  text-decoration: none;
}
</style>
