<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">两座半岛，拼在一起。</p>
      <div class="wave" />

      <p v-if="error" class="muted">{{ error }}</p>
      <template v-else-if="reveal">
        <p class="prompt-text">{{ reveal.prompt.prompt }}</p>
        <div v-if="reveal.phase === 'revealed' || reveal.partnerAnswer" class="split">
          <div>
            <p class="label">你</p>
            <p>{{ reveal.selfAnswer?.body ?? "—" }}</p>
          </div>
          <div>
            <p class="label">TA</p>
            <p>{{ reveal.partnerAnswer?.body ?? "—" }}</p>
          </div>
        </div>
        <template v-else>
          <p class="muted">对方答案在双方都写完前不可见。</p>
          <button :disabled="busy" @click="doReveal">揭晓</button>
        </template>
        <p v-if="streakMsg" class="muted">{{ streakMsg }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { Reveal } from "@half-island/shared";
import { api } from "../../api/client";
import SessionBar from "../../components/SessionBar.vue";
import { session } from "../../session";

const reveal = ref<Reveal | null>(null);
const error = ref("");
const busy = ref(false);
const streakMsg = ref("");

async function load(): Promise<void> {
  error.value = "";
  try {
    const data = await api.today(session.pairId, session.userId);
    reveal.value = data.reveal;
    if (data.reveal.phase === "ready_to_reveal") {
      await doReveal();
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  }
}

async function doReveal(): Promise<void> {
  if (!reveal.value) return;
  busy.value = true;
  try {
    const res = await api.reveal({
      assignmentId: reveal.value.assignmentId,
      userId: session.userId,
    });
    reveal.value = res.reveal;
    streakMsg.value = `岛的连线：${res.streak} 天`;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "揭晓失败";
  } finally {
    busy.value = false;
  }
}

onMounted(load);
watch(() => [session.userId, session.pairId], load);
</script>

<style scoped>
.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  animation: rise 0.8s ease both;
}
.label {
  opacity: 0.6;
  font-size: 0.85rem;
  margin: 0 0 0.35rem;
}
</style>
