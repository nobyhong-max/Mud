<template>
  <div class="bi">
    <p class="body zh">{{ zh }}</p>
    <p v-if="showEn" class="body en">{{ en }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { BilingualText } from "@half-island/shared";

const props = defineProps<{
  text?: BilingualText | null;
  fallback?: string | null;
}>();

const zh = computed(() => props.text?.zh || props.fallback || "—");
const en = computed(() => props.text?.en || "");
const showEn = computed(() => Boolean(en.value) && en.value !== zh.value);
</script>

<style scoped>
.bi {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.body {
  margin: 0;
  font-size: 1.12rem;
  line-height: 1.5;
}
.body.en {
  font-size: 0.95rem;
  opacity: 0.72;
  font-style: italic;
}
</style>
