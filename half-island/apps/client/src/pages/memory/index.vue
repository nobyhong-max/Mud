<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">回忆墙 · 已揭晓的飞地</p>
      <div class="wave" />

      <p v-if="error" class="muted">{{ error }}</p>
      <p v-else-if="!items.length" class="muted">还没有揭晓记录。先完成今日题吧。</p>
      <ul v-else class="list">
        <li v-for="item in items" :key="item.assignmentId">
          <p class="date">{{ item.dateKey }}</p>
          <p class="q">{{ item.prompt }}</p>
          <div class="pair">
            <span>你：{{ item.selfAnswer }}</span>
            <span>TA：{{ item.partnerAnswer }}</span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { MemoryItem } from "@half-island/shared";
import { api } from "../../api/client";
import SessionBar from "../../components/SessionBar.vue";
import { session } from "../../session";

const items = ref<MemoryItem[]>([]);
const error = ref("");

async function load(): Promise<void> {
  error.value = "";
  try {
    const data = await api.memory(session.pairId, session.userId);
    items.value = data.items;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  }
}

onMounted(load);
watch(() => [session.userId, session.pairId], load);
</script>

<style scoped>
.list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.date {
  margin: 0;
  opacity: 0.55;
  font-size: 0.8rem;
}
.q {
  margin: 0.25rem 0 0.5rem;
  font-size: 1.05rem;
}
.pair {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.95rem;
  opacity: 0.9;
  border-left: 2px solid rgba(196, 165, 116, 0.45);
  padding-left: 0.75rem;
}
</style>
