<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">另一半还在路上。</p>
      <div class="island-silhouette" aria-hidden="true" />
      <div class="wave" />

      <div class="beacon" aria-hidden="true">
        <span class="shore self lit" />
        <span class="gap" />
        <span class="shore other dim" />
      </div>

      <p class="prompt-text waiting">
        你已写好。岛的另一岸亮起来时，就能揭晓——在那之前，对方的答案对你不可见。
      </p>
      <p class="muted">{{ status || "检查中…" }}</p>
      <p v-if="nudgeMsg" class="nudge">{{ nudgeMsg }}</p>
      <div class="row">
        <button :disabled="busy" @click="refresh">刷新状态</button>
        <button class="ghost" :disabled="busy || nudgeLeft === 0" @click="nudge">
          轻轻戳一下{{ nudgeLeft !== null ? `（剩 ${nudgeLeft}）` : "" }}
        </button>
      </div>
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
const nudgeMsg = ref("");
const nudgeLeft = ref<number | null>(3);
let timer: ReturnType<typeof setInterval> | null = null;

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

async function nudge(): Promise<void> {
  busy.value = true;
  try {
    const res = await api.nudge({
      pairId: session.pairId,
      userId: session.userId,
    });
    nudgeMsg.value = res.message;
    nudgeLeft.value = res.remaining;
  } catch (e) {
    nudgeMsg.value = e instanceof Error ? e.message : "催促失败";
    nudgeLeft.value = 0;
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
  gap: 0.85rem;
  margin: 0.35rem 0 0.85rem;
}
.shore {
  width: 68px;
  height: 68px;
  border-radius: 52% 42% 58% 44%;
  background: radial-gradient(circle at 30% 30%, #f3ead8, #2a5566 72%);
}
.shore.lit {
  animation: pulse 2.2s ease-in-out infinite;
  box-shadow: 0 0 28px rgba(201, 166, 107, 0.25);
}
.shore.dim {
  opacity: 0.32;
  animation: pulse 2.6s ease-in-out infinite 0.7s;
}
.gap {
  width: 36px;
  height: 2px;
  background: linear-gradient(90deg, var(--shore), transparent);
}
.waiting {
  opacity: 0.93;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}
.ghost {
  background: transparent;
}
.nudge {
  opacity: 0.85;
  font-size: 0.95rem;
  border-left: 2px solid rgba(201, 166, 107, 0.5);
  padding-left: 0.65rem;
}
.btn.ghost {
  display: inline-block;
  margin-top: 0.35rem;
  text-decoration: none;
}
</style>
