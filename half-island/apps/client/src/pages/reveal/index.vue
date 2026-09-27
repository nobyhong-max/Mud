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

        <div
          v-if="reveal.phase === 'revealed' && reveal.partnerAnswer"
          class="split joined"
        >
          <div class="pane">
            <p class="label">你</p>
            <p class="body">{{ reveal.selfAnswer?.body ?? "—" }}</p>
            <p v-if="reveal.selfAnsweredAt" class="time">
              {{ formatTime(reveal.selfAnsweredAt) }}
            </p>
          </div>
          <div class="pane">
            <p class="label">TA</p>
            <p class="body">{{ reveal.partnerAnswer.body }}</p>
            <p v-if="reveal.partnerAnsweredAt" class="time">
              {{ formatTime(reveal.partnerAnsweredAt) }}
            </p>
          </div>
        </div>

        <template v-else-if="reveal.phase === 'ready_to_reveal'">
          <p class="muted">双方都已落笔。点一下，把岛拼完整。</p>
          <button :disabled="busy" @click="doReveal">揭晓</button>
        </template>

        <template v-else>
          <p class="muted">
            {{
              reveal.phase === "pending_self"
                ? "你还没作答，先去写今日题。"
                : "对方答案在双方都写完前不可见。"
            }}
          </p>
          <router-link
            class="btn"
            :to="reveal.phase === 'pending_self' ? '/answer' : '/waiting'"
          >
            {{ reveal.phase === "pending_self" ? "去作答" : "去等待" }}
          </router-link>
        </template>

        <p v-if="reveal.prompt.followup && reveal.phase === 'revealed'" class="followup">
          追问：{{ reveal.prompt.followup }}
        </p>
        <p v-if="streakMsg" class="streak">{{ streakMsg }}</p>
        <router-link v-if="reveal.phase === 'revealed'" class="btn ghost" to="/memory">
          回忆墙
        </router-link>
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

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

async function load(): Promise<void> {
  error.value = "";
  try {
    const data = await api.today(session.pairId, session.userId);
    reveal.value = data.reveal;
    if (data.reveal.phase === "revealed") {
      streakMsg.value = `岛的连线：${data.streak} 天`;
    } else if (data.reveal.phase === "ready_to_reveal") {
      await doReveal();
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败";
  }
}

async function doReveal(): Promise<void> {
  if (!reveal.value) return;
  busy.value = true;
  error.value = "";
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
}
.split.joined {
  animation: join 0.85s ease both;
}
.pane {
  padding: 0.75rem 0;
  border-top: 1px solid rgba(196, 165, 116, 0.35);
}
.label {
  opacity: 0.6;
  font-size: 0.85rem;
  margin: 0 0 0.35rem;
}
.body {
  margin: 0;
  font-size: 1.1rem;
  line-height: 1.5;
}
.time {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  opacity: 0.5;
}
.followup {
  opacity: 0.8;
  font-size: 0.95rem;
}
.streak {
  font-family: var(--font-display);
  font-size: 1.2rem;
  letter-spacing: 0.06em;
}
.ghost {
  display: inline-block;
  margin-top: 0.5rem;
  text-decoration: none;
  background: transparent;
}
.btn {
  display: inline-block;
  text-decoration: none;
}
@keyframes join {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
</style>
