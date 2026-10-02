<template>
  <div class="page">
    <SessionBar />
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">你来了，岛才完整。</p>
      <div class="wave" />
      <p class="muted">创建或加入一座岛 · 情侣 / 密友分流</p>

      <label>
        关系类型
        <select v-model="relationshipType">
          <option value="couple">情侣岛</option>
          <option value="friends">密友岛</option>
        </select>
      </label>

      <button :disabled="busy" @click="createInvite">生成 6 位邀请码</button>
      <p v-if="createdCode" class="code">{{ createdCode }}</p>

      <label>
        输入邀请码上岛
        <input v-model="joinCode" maxlength="6" placeholder="例如 ISLAND1" />
      </label>
      <button :disabled="busy || joinCode.trim().length < 4" @click="acceptInvite">
        接受邀请
      </button>

      <button class="ghost" :disabled="busy" @click="dissolve">软解绑当前岛</button>
      <p v-if="msg" class="muted">{{ msg }}</p>
      <p v-if="paywallMsg" class="paywall">{{ paywallMsg }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { RelationshipType } from "@half-island/shared";
import { api } from "../../api/client";
import SessionBar from "../../components/SessionBar.vue";
import { persistSession, session } from "../../session";

const relationshipType = ref<RelationshipType>("couple");
const createdCode = ref("");
const joinCode = ref("");
const msg = ref("");
const paywallMsg = ref("");
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
    msg.value = `${pair.relationshipType === "couple" ? "情侣" : "密友"}邀请已创建。`;
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

async function dissolve(): Promise<void> {
  busy.value = true;
  try {
    await api.dissolve({ pairId: session.pairId, userId: session.userId });
    msg.value = "已软解绑（数据仍保留归档策略留给后续）。";
  } catch (e) {
    msg.value = e instanceof Error ? e.message : "失败";
  } finally {
    busy.value = false;
  }
}

onMounted(async () => {
  try {
    const { paywall } = await api.paywall(session.pairId, session.userId);
    paywallMsg.value = paywall.message;
  } catch {
    /* demo pair may be fine */
  }
});
</script>

<style scoped>
.code {
  font-family: var(--font-display);
  font-size: 1.8rem;
  letter-spacing: 0.25em;
  margin: 0;
  animation: rise 0.5s ease both;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.ghost {
  background: transparent;
  opacity: 0.75;
}
.paywall {
  font-size: 0.9rem;
  opacity: 0.7;
  border-top: 1px solid rgba(215, 228, 239, 0.15);
  padding-top: 0.75rem;
}
</style>
