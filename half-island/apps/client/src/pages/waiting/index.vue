<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">另一半还在路上。</p>
      <div class="wave" />
      <p class="prompt-text waiting">你已写好。岛的另一岸亮起来时，就能揭晓。</p>
      <p class="muted">Phase 0：轮询刷新 · 推送打桩留给 Phase 1</p>
      <button :disabled="busy" @click="refresh">刷新状态</button>
      <p v-if="status" class="muted">{{ status }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../api/client";
import SessionBar from "../../components/SessionBar.vue";
import { session } from "../../session";

const router = useRouter();
const busy = ref(false);
const status = ref("");

async function refresh(): Promise<void> {
  busy.value = true;
  try {
    const data = await api.today(session.pairId, session.userId);
    if (data.reveal.phase === "pending_self") {
      status.value = "你还没作答。";
      await router.push("/answer");
    } else if (
      data.reveal.phase === "ready_to_reveal" ||
      data.reveal.phase === "revealed"
    ) {
      status.value = "可以揭晓了。";
      await router.push("/reveal");
    } else {
      status.value = "仍在等待对方…";
    }
  } catch (e) {
    status.value = e instanceof Error ? e.message : "失败";
  } finally {
    busy.value = false;
  }
}

onMounted(refresh);
</script>

<style scoped>
.waiting {
  opacity: 0.9;
  animation: pulse 2.4s ease-in-out infinite;
}
</style>
