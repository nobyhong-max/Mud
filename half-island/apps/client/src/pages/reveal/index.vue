<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">两座半岛，拼在一起。 / Two peninsulas, joined.</p>
      <div class="island-silhouette" aria-hidden="true" />
      <div class="wave" />

      <p v-if="error" class="muted">{{ error }}</p>
      <template v-else-if="reveal">
        <p class="prompt-text">{{ reveal.prompt.prompt }}</p>
        <p
          v-if="reveal.prompt.promptEn && reveal.prompt.promptEn !== reveal.prompt.prompt"
          class="prompt-en"
        >
          {{ reveal.prompt.promptEn }}
        </p>

        <div
          v-if="reveal.phase === 'revealed' && reveal.partnerAnswer"
          class="split joined"
        >
          <div class="pane">
            <p class="label">{{ dual(UI_COPY.you.zh, UI_COPY.you.en) }}</p>
            <BilingualAnswer :text="reveal.selfAnswer?.bilingual" :fallback="reveal.selfAnswer?.body" />
            <p v-if="reveal.selfAnsweredAt" class="time">
              {{ formatTime(reveal.selfAnsweredAt) }}
            </p>
          </div>
          <div class="pane">
            <p class="label">{{ dual(UI_COPY.partner.zh, UI_COPY.partner.en) }}</p>
            <BilingualAnswer :text="reveal.partnerAnswer.bilingual" :fallback="reveal.partnerAnswer.body" />
            <p v-if="reveal.partnerAnsweredAt" class="time">
              {{ formatTime(reveal.partnerAnsweredAt) }}
            </p>
          </div>
        </div>

        <template v-else-if="reveal.phase === 'ready_to_reveal'">
          <p class="muted">
            双方都已落笔。点一下，把岛拼完整。 / Both wrote. Tap to join the island.
          </p>
          <button :disabled="busy" @click="doReveal">
            {{ dual(UI_COPY.reveal.zh, UI_COPY.reveal.en) }}
          </button>
        </template>

        <template v-else>
          <p class="muted">
            {{
              reveal.phase === "pending_self"
                ? "你还没作答，先去写今日题。 / Answer today's prompt first."
                : "对方答案在双方都写完前不可见。 / Their answer stays hidden until both finish."
            }}
          </p>
          <router-link
            class="btn"
            :to="reveal.phase === 'pending_self' ? '/answer' : '/waiting'"
          >
            {{
              reveal.phase === "pending_self"
                ? dual(UI_COPY.goAnswer.zh, UI_COPY.goAnswer.en)
                : dual(UI_COPY.waiting.zh, UI_COPY.waiting.en)
            }}
          </router-link>
        </template>

        <p v-if="reveal.prompt.followup && reveal.phase === 'revealed'" class="followup">
          追问 / Follow-up：{{ reveal.prompt.followup }}
          <span
            v-if="reveal.prompt.followupEn && reveal.prompt.followupEn !== reveal.prompt.followup"
            class="fu-en"
          >
            {{ reveal.prompt.followupEn }}
          </span>
        </p>
        <p v-if="streakMsg" class="streak">{{ streakMsg }}</p>
        <p v-if="reveal.phase === 'revealed'" class="free">
          已揭晓内容可永久回看，与会员无关。 / Revealed archive stays free forever.
        </p>
        <router-link v-if="reveal.phase === 'revealed'" class="btn ghost" to="/memory">
          {{ dual(UI_COPY.memory.zh, UI_COPY.memory.en) }}
        </router-link>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { Reveal } from "@half-island/shared";
import { api } from "../../api/client";
import BilingualAnswer from "../../components/BilingualAnswer.vue";
import SessionBar from "../../components/SessionBar.vue";
import { dual, UI_COPY } from "../../i18n";
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
      streakMsg.value = `岛的连线：${data.streak} 天 / Island streak: ${data.streak} days`;
    } else if (data.reveal.phase === "ready_to_reveal") {
      await doReveal();
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败 / Failed to load";
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
    streakMsg.value = `岛的连线：${res.streak} 天 / Island streak: ${res.streak} days`;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "揭晓失败 / Reveal failed";
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
  animation: join 0.9s ease both;
}
.pane {
  padding: 0.85rem 0;
  border-top: 1px solid rgba(201, 166, 107, 0.4);
}
.label {
  opacity: 0.58;
  font-size: 0.85rem;
  margin: 0 0 0.35rem;
}
.prompt-en {
  margin: -0.35rem 0 0.5rem;
  font-size: 0.95rem;
  opacity: 0.72;
  line-height: 1.45;
  font-style: italic;
}
.time {
  margin: 0.4rem 0 0;
  font-size: 0.75rem;
  opacity: 0.48;
}
.followup {
  opacity: 0.82;
  font-size: 0.95rem;
}
.fu-en {
  display: block;
  margin-top: 0.25rem;
  font-style: italic;
  opacity: 0.75;
}
.streak {
  font-family: var(--font-display);
  font-size: 1.25rem;
  letter-spacing: 0.06em;
}
.free {
  font-size: 0.85rem;
  opacity: 0.65;
  margin: 0;
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
    filter: blur(2px);
    transform: translateY(18px) scale(0.97);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: translateY(0) scale(1);
  }
}
</style>
