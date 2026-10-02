<template>
  <div class="page">
    <SessionBar />
    <div class="page-main top">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">
        {{ dual(UI_COPY.memory.zh, UI_COPY.memory.en) }} · 已揭晓的飞地 / Revealed enclave
      </p>
      <div class="wave" />
      <p class="meta">
        连线 {{ streak }} 天 · 已揭晓回看永久免费 / Streak {{ streak }} · archive free forever
      </p>

      <p v-if="error" class="muted">{{ error }}</p>
      <p v-else-if="!items.length" class="muted">
        还没有揭晓记录。先完成今日题，把另一半半岛拼上来。
        / No reveals yet — finish today's prompt first.
      </p>
      <ul v-else class="list">
        <li v-for="item in items" :key="item.assignmentId" class="card-ish">
          <div class="head">
            <span class="date">{{ item.dateKey }}</span>
            <span class="deck">{{ item.deck }}</span>
          </div>
          <p class="q">{{ item.prompt }}</p>
          <p v-if="item.promptEn && item.promptEn !== item.prompt" class="q-en">
            {{ item.promptEn }}
          </p>
          <div class="pair">
            <div class="ans">
              <span class="who">{{ dual(UI_COPY.you.zh, UI_COPY.you.en) }}</span>
              <BilingualAnswer :text="item.selfBilingual" :fallback="item.selfAnswer" />
            </div>
            <div class="ans">
              <span class="who">{{ dual(UI_COPY.partner.zh, UI_COPY.partner.en) }}</span>
              <BilingualAnswer :text="item.partnerBilingual" :fallback="item.partnerAnswer" />
            </div>
          </div>
          <p v-if="item.followup" class="fu">
            追问 / Follow-up：{{ item.followup }}
            <span v-if="item.followupEn && item.followupEn !== item.followup" class="fu-en">
              {{ item.followupEn }}
            </span>
          </p>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { MemoryItem } from "@half-island/shared";
import { api } from "../../api/client";
import BilingualAnswer from "../../components/BilingualAnswer.vue";
import SessionBar from "../../components/SessionBar.vue";
import { dual, UI_COPY } from "../../i18n";
import { session } from "../../session";

const items = ref<MemoryItem[]>([]);
const streak = ref(0);
const error = ref("");

async function load(): Promise<void> {
  error.value = "";
  try {
    const data = await api.memory(session.pairId, session.userId);
    items.value = data.items;
    streak.value = data.streak;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败 / Failed to load";
  }
}

onMounted(load);
watch(() => [session.userId, session.pairId], load);
</script>

<style scoped>
.top {
  justify-content: flex-start;
  padding-top: 0.5rem;
}
.meta {
  margin: 0;
  opacity: 0.65;
  font-size: 0.9rem;
}
.list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
}
.card-ish {
  border-top: 1px solid rgba(201, 166, 107, 0.28);
  padding-top: 0.85rem;
  animation: rise 0.55s ease both;
}
.head {
  display: flex;
  justify-content: space-between;
  opacity: 0.55;
  font-size: 0.78rem;
}
.q {
  margin: 0.35rem 0 0.15rem;
  font-size: 1.05rem;
  line-height: 1.45;
}
.q-en {
  margin: 0 0 0.55rem;
  font-size: 0.9rem;
  opacity: 0.7;
  font-style: italic;
  line-height: 1.4;
}
.pair {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  font-size: 0.95rem;
  padding-left: 0.7rem;
  border-left: 2px solid rgba(201, 166, 107, 0.4);
}
.ans {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.who {
  display: inline-block;
  min-width: 1.6rem;
  opacity: 0.55;
  font-size: 0.82rem;
}
.fu {
  margin: 0.55rem 0 0;
  font-size: 0.86rem;
  opacity: 0.7;
}
.fu-en {
  display: block;
  margin-top: 0.2rem;
  font-style: italic;
}
</style>
