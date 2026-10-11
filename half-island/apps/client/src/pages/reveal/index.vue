<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">两座半岛，拼在一起。 / Two peninsulas, joined.</p>
      <div class="island-silhouette" aria-hidden="true" />
      <div class="wave" />

      <NotifyBanner :items="notifications" />

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

        <section v-if="reveal.phase === 'revealed'" class="comments">
          <h2 class="c-title">{{ dual(UI_COPY.leaveComment.zh, UI_COPY.leaveComment.en) }}</h2>
          <ul v-if="comments.length" class="c-list">
            <li v-for="c in comments" :key="c.id">
              <span v-if="c.reaction" class="react">{{ c.reaction }}</span>
              <BilingualAnswer :text="c.bilingual" :fallback="c.body" />
              <span class="who">{{ c.userId === session.userId ? dual(UI_COPY.you.zh, UI_COPY.you.en) : dual(UI_COPY.partner.zh, UI_COPY.partner.en) }}</span>
            </li>
          </ul>
          <div class="react-row">
            <button
              v-for="r in COMMENT_REACTIONS"
              :key="r"
              type="button"
              class="react-btn"
              :class="{ on: reaction === r }"
              @click="reaction = reaction === r ? null : r"
            >
              {{ r }}
            </button>
          </div>
          <label>
            <input
              v-model="commentBody"
              maxlength="120"
              :placeholder="dual(placeholder.zh, placeholder.en)"
            />
          </label>
          <button :disabled="busy || (!commentBody.trim() && !reaction)" @click="submitComment">
            {{ dual(UI_COPY.leaveComment.zh, UI_COPY.leaveComment.en) }}
          </button>
        </section>

        <router-link v-if="reveal.phase === 'revealed'" class="btn ghost" to="/memory">
          {{ dual(UI_COPY.memory.zh, UI_COPY.memory.en) }}
        </router-link>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type {
  AssignmentComment,
  CommentReaction,
  NotifyEvent,
  Reveal,
} from "@half-island/shared";
import { COMMENT_PLACEHOLDER, COMMENT_REACTIONS } from "@half-island/shared";
import { api } from "../../api/client";
import BilingualAnswer from "../../components/BilingualAnswer.vue";
import NotifyBanner from "../../components/NotifyBanner.vue";
import SessionBar from "../../components/SessionBar.vue";
import { dual, UI_COPY } from "../../i18n";
import { session } from "../../session";

const reveal = ref<Reveal | null>(null);
const error = ref("");
const busy = ref(false);
const streakMsg = ref("");
const comments = ref<AssignmentComment[]>([]);
const commentBody = ref("");
const reaction = ref<CommentReaction | null>(null);
const placeholder = ref(COMMENT_PLACEHOLDER.couple);
const notifications = ref<NotifyEvent[]>([]);

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
    comments.value = data.reveal.comments ?? [];
    placeholder.value = data.commentPlaceholder ?? COMMENT_PLACEHOLDER.couple;
    notifications.value = data.notifications ?? [];
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
    comments.value = res.reveal.comments ?? [];
    streakMsg.value = `岛的连线：${res.streak} 天 / Island streak: ${res.streak} days`;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "揭晓失败 / Reveal failed";
  } finally {
    busy.value = false;
  }
}

async function submitComment(): Promise<void> {
  if (!reveal.value) return;
  busy.value = true;
  error.value = "";
  try {
    const res = await api.postComment(reveal.value.assignmentId, {
      userId: session.userId,
      body: commentBody.value,
      reaction: reaction.value,
    });
    comments.value = res.comments;
    placeholder.value = res.placeholder;
    commentBody.value = "";
    reaction.value = null;
    if (reveal.value) reveal.value = { ...reveal.value, comments: res.comments };
  } catch (e) {
    error.value = e instanceof Error ? e.message : "留言失败 / Comment failed";
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
.comments {
  width: 100%;
  margin-top: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(201, 166, 107, 0.28);
  animation: rise 0.5s ease both;
}
.c-title {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 400;
  margin: 0 0 0.5rem;
}
.c-list {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.c-list li {
  position: relative;
  padding-left: 0.1rem;
}
.react {
  margin-right: 0.35rem;
}
.who {
  display: block;
  font-size: 0.75rem;
  opacity: 0.5;
  margin-top: 0.15rem;
}
.react-row {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
}
.react-btn {
  background: transparent;
  padding: 0.25rem 0.45rem;
  font-size: 1.1rem;
  border: 1px solid transparent;
}
.react-btn.on {
  border-color: rgba(201, 166, 107, 0.7);
}
.comments label {
  display: block;
  width: 100%;
  margin-bottom: 0.5rem;
}
.comments input {
  width: 100%;
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
