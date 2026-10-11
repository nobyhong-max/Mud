<template>
  <div v-if="item" class="banner" role="status">
    <p class="title">{{ dual(item.title, item.titleEn) }}</p>
    <p class="body">{{ dual(item.body, item.bodyEn) }}</p>
    <p class="stub">H5 本地提醒 stub · 非微信推送 / Local stub only</p>
    <button type="button" class="ack" @click="ack">知道了 / Got it</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { NotifyEvent } from "@half-island/shared";
import { api } from "../api/client";
import { dual } from "../i18n";
import { session } from "../session";

const props = defineProps<{ items: NotifyEvent[] }>();
const dismissed = ref<string | null>(null);

const item = computed(() => {
  const pending = props.items.find(
    (n) => n.status === "pending" && n.id !== dismissed.value,
  );
  return pending ?? null;
});

watch(
  item,
  async (n) => {
    if (!n || n.status !== "pending") return;
    try {
      await api.ackNotification({
        notifyId: n.id,
        userId: session.userId,
        status: "local_shown",
      });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(n.title, { body: n.body });
      }
    } catch {
      /* stub best-effort */
    }
  },
  { immediate: true },
);

async function ack(): Promise<void> {
  if (!item.value) return;
  const id = item.value.id;
  try {
    await api.ackNotification({
      notifyId: id,
      userId: session.userId,
      status: "acked",
    });
  } catch {
    /* ignore */
  }
  dismissed.value = id;
}
</script>

<style scoped>
.banner {
  margin: 0 0 0.75rem;
  padding: 0.75rem 0;
  border-top: 1px solid rgba(201, 166, 107, 0.35);
  border-bottom: 1px solid rgba(201, 166, 107, 0.2);
  animation: rise 0.45s ease both;
}
.title {
  margin: 0 0 0.25rem;
  font-family: var(--font-display);
  font-size: 1.05rem;
}
.body {
  margin: 0;
  font-size: 0.9rem;
  opacity: 0.85;
  line-height: 1.45;
}
.stub {
  margin: 0.35rem 0 0.5rem;
  font-size: 0.72rem;
  opacity: 0.5;
}
.ack {
  font-size: 0.85rem;
  padding: 0.35rem 0.75rem;
  background: transparent;
}
</style>
