<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="muted">
        {{ dual(UI_COPY.answer.zh, UI_COPY.answer.en) }} · 先写完再揭晓 / Write first, reveal later
      </p>
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

        <div v-if="reveal.prompt.choices?.length" class="choices">
          <button
            v-for="(c, i) in reveal.prompt.choices"
            :key="c"
            :class="{ selected: choiceIndex === i }"
            @click="choiceIndex = i"
          >
            <span class="zh">{{ c }}</span>
            <span
              v-if="reveal.prompt.choicesEn?.[i] && reveal.prompt.choicesEn[i] !== c"
              class="en"
            >
              {{ reveal.prompt.choicesEn[i] }}
            </span>
          </button>
        </div>
        <textarea
          v-else
          v-model="body"
          rows="4"
          placeholder="写在这座岛上，只有你们看得见。 / Write on this island — only you two can see."
        />

        <button :disabled="busy || !canSubmit" @click="submit">
          {{ dual(UI_COPY.lockAnswer.zh, UI_COPY.lockAnswer.en) }}
        </button>
        <p v-if="msg" class="muted">{{ msg }}</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import type { Reveal } from "@half-island/shared";
import { api } from "../../api/client";
import SessionBar from "../../components/SessionBar.vue";
import { dual, UI_COPY } from "../../i18n";
import { session } from "../../session";

const router = useRouter();
const reveal = ref<Reveal | null>(null);
const body = ref("");
const choiceIndex = ref<number | null>(null);
const busy = ref(false);
const error = ref("");
const msg = ref("");

const canSubmit = computed(() => {
  if (!reveal.value) return false;
  if (reveal.value.prompt.choices?.length) return choiceIndex.value !== null;
  return body.value.trim().length > 0;
});

async function load(): Promise<void> {
  error.value = "";
  try {
    const data = await api.today(session.pairId, session.userId);
    reveal.value = data.reveal;
    if (data.reveal.selfAnswer) {
      body.value = data.reveal.selfAnswer.body;
      choiceIndex.value = data.reveal.selfAnswer.choiceIndex;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加载失败 / Failed to load";
  }
}

async function submit(): Promise<void> {
  if (!reveal.value) return;
  busy.value = true;
  msg.value = "";
  try {
    const text =
      choiceIndex.value !== null && reveal.value.prompt.choices
        ? reveal.value.prompt.choices[choiceIndex.value]!
        : body.value.trim();
    const res = await api.answer({
      assignmentId: reveal.value.assignmentId,
      userId: session.userId,
      body: text,
      choiceIndex: choiceIndex.value,
    });
    msg.value = "已锁定。 / Locked.";
    if (res.assignmentStatus === "ready_to_reveal") {
      await router.push("/reveal");
    } else {
      await router.push("/waiting");
    }
  } catch (e) {
    msg.value = e instanceof Error ? e.message : "提交失败 / Submit failed";
  } finally {
    busy.value = false;
  }
}

onMounted(load);
watch(() => [session.userId, session.pairId], load);
</script>

<style scoped>
.prompt-en {
  margin: -0.35rem 0 0.5rem;
  font-size: 0.95rem;
  opacity: 0.72;
  line-height: 1.45;
  font-style: italic;
}
.choices {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.choices button {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  text-align: left;
}
.choices button .en {
  font-size: 0.85rem;
  opacity: 0.7;
  font-style: italic;
}
.choices button.selected {
  border-color: var(--shore);
  background: rgba(196, 165, 116, 0.35);
}
</style>
