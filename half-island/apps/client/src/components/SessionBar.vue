<template>
  <div class="session">
    <label>
      演示身份
      <select v-model="session.userId" @change="onUserChange">
        <option v-for="u in demoUsers" :key="u.id" :value="u.id">{{ u.label }}</option>
      </select>
    </label>
    <nav class="nav-row">
      <router-link to="/invite">邀请</router-link>
      <router-link to="/today">今日</router-link>
      <router-link to="/answer">作答</router-link>
      <router-link to="/waiting">等待</router-link>
      <router-link to="/reveal">揭晓</router-link>
      <router-link to="/memory">回忆</router-link>
      <router-link to="/decks">牌组</router-link>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { demoUsers, persistSession, session } from "../session";

function onUserChange(): void {
  const hit = demoUsers.find((u) => u.id === session.userId);
  if (hit) session.pairId = hit.pairId;
  persistSession();
}
</script>

<style scoped>
.session {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  opacity: 0.85;
}
</style>
