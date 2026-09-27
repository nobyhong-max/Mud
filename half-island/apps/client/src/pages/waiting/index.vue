<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">另一半还在路上。</p>
      <div class="wave" />

      <div class="beacon" aria-hidden="true">
        <span class="shore self" />
        <span class="gap" />
        <span class="shore other dim" />
      </div>

      <p class="prompt-text waiting">
        你已写好。岛的另一岸亮起来时，就能揭晓——在那之前，对方的答案对你不可见。
      </p>
      <p class="muted">状态：{{ status || "检查中…" }}</p>
      <p v-if="lastPoll" class="muted tiny">上次刷新 {{ lastPoll }}</p>
      <button :disabled="busy" @click="refresh">刷新状态</button>
      <router-link class="btn ghost" to="/today">回今日</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../../api/client";
import SessionBar from "../../components/SessionBar.vue";
import { session } from "../../session";

const router = useRouter();
const busy = ref(false);
const status = ref("");
const lastPoll = ref("");
let timer: ReturnType<typeof setInterval> | null = null;

async function refresh(): Promise<void> {
  busy.value = true;
  try {
    const data = await api.today(session.pairId, session.userId);
    lastPoll.value = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    if (data.reveal.phase === "pending_self") {
      status.value = "你还没作答。";
      await router.push("/answer");
    } else if (
      data.reveal.phase === "ready_to_reveal" ||
      data.reveal.phase === "revealed"
    ) {
      status.value = "两座半岛可以拼上了。";
      await router.push("/reveal");
    } else {
      status.value = "仍在等待对方落笔…";
    }
  } catch (e) {
    status.value = e instanceof Error ? e.message : "失败";
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void refresh();
  timer = setInterval(() => void refresh(), 4000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.beacon {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin: 0.5rem 0 1rem;
}
.shore {
  width: 64px;
  height: 64px;
  border-radius: 50% 40% 55% 45%;
  background: radial-gradient(circle at 30% 30%, #f0e6d4, #2f5d6e 70%);
  animation: pulse 2.4s ease-in-out infinite;
}
.shore.dim {
  opacity: 0.35;
  animation: pulse 2.4s ease-in-out infinite 0.6s;
}
.gap {
  width: 28px;
  height: 2px;
  background: linear-gradient(90deg, var(--shore), transparent);
}
.waiting {
  opacity: 0.92;
}
.tiny {
  font-size: 0.8rem;
}
.ghost {
  display: inline-block;
  margin-top: 0.5rem;
  text-decoration: none;
  background: transparent;
}
</style>
