<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="muted">各自作答 · 先写完再揭晓</p>
      <div class="wave" />

      <p v-if="error" class="muted">{{ error }}</p>
      <template v-else-if="reveal">
        <p class="prompt-text">{{ reveal.prompt.prompt }}</p>

        <div v-if="reveal.prompt.choices?.length" class="choices">
          <button
            v-for="(c, i) in reveal.prompt.choices"
            :key="c"
            :class="{ selected: choiceIndex === i }"
            @click="choiceIndex = i"
          >
            {{ c }}
          </button>
        </div>
        <textarea
          v-else
          v-model="body"
          rows="4"
          placeholder="写在这座岛上，只有你们看得见。"
        />

        <button :disabled="busy || !canSubmit" @click="submit">锁定答案</button>
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
    error.value = e instanceof Error ? e.message : "加载失败";
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
    msg.value = "已锁定。";
    if (res.assignmentStatus === "ready_to_reveal") {
      await router.push("/reveal");
    } else {
      await router.push("/waiting");
    }
  } catch (e) {
    msg.value = e instanceof Error ? e.message : "提交失败";
  } finally {
    busy.value = false;
  }
}

onMounted(load);
watch(() => [session.userId, session.pairId], load);
</script>

<style scoped>
.choices {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.choices button.selected {
  border-color: var(--shore);
  background: rgba(196, 165, 116, 0.35);
}
</style>
