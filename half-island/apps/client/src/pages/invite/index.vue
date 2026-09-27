<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">你来了，岛才完整。</p>
      <div class="wave" />
      <p class="muted">邀请绑定（Phase 0 占位）· 情侣 / 密友</p>

      <label>
        关系类型
        <select v-model="relationshipType">
          <option value="couple">情侣</option>
          <option value="friends">密友</option>
        </select>
      </label>

      <button :disabled="busy" @click="createInvite">生成邀请码</button>
      <p v-if="createdCode" class="code">邀请码：{{ createdCode }}</p>

      <label>
        输入邀请码上岛
        <input v-model="joinCode" maxlength="6" placeholder="例如 ISLAND1" />
      </label>
      <button :disabled="busy || !joinCode" @click="acceptInvite">接受邀请</button>
      <p v-if="msg" class="muted">{{ msg }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import type { RelationshipType } from "@half-island/shared";
import { api } from "../../api/client";
import SessionBar from "../../components/SessionBar.vue";
import { persistSession, session } from "../../session";

const relationshipType = ref<RelationshipType>("couple");
const createdCode = ref("");
const joinCode = ref("");
const msg = ref("");
const busy = ref(false);

async function createInvite(): Promise<void> {
  busy.value = true;
  msg.value = "";
  try {
    const { pair } = await api.invite({
      userId: session.userId,
      relationshipType: relationshipType.value,
    });
    createdCode.value = pair.inviteCode;
    session.pairId = pair.id;
    persistSession();
    msg.value = "邀请已创建，把邀请码发给 TA。";
  } catch (e) {
    msg.value = e instanceof Error ? e.message : "失败";
  } finally {
    busy.value = false;
  }
}

async function acceptInvite(): Promise<void> {
  busy.value = true;
  msg.value = "";
  try {
    const { pair } = await api.accept({
      userId: session.userId,
      inviteCode: joinCode.value.trim(),
    });
    session.pairId = pair.id;
    persistSession();
    msg.value = `已登上${pair.relationshipType === "couple" ? "情侣" : "密友"}岛。`;
  } catch (e) {
    msg.value = e instanceof Error ? e.message : "失败";
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.code {
  font-family: var(--font-display);
  font-size: 1.6rem;
  letter-spacing: 0.2em;
  margin: 0;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
</style>
