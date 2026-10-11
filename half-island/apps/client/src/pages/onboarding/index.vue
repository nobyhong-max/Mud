<template>
  <div class="page">
    <div class="page-main">
      <h1 class="brand">半个岛</h1>
      <p class="slogan">你来了，岛才完整。 / You arrive — the island becomes whole.</p>
      <div class="wave" />

      <p class="step-label">{{ stepLabel }}</p>

      <template v-if="step === 0">
        <p class="muted">这座岛给谁？ / Who is this island for?</p>
        <div class="choices">
          <button type="button" :class="{ on: relationshipType === 'couple' }" @click="relationshipType = 'couple'">
            情侣岛 / Couple
          </button>
          <button type="button" :class="{ on: relationshipType === 'friends' }" @click="relationshipType = 'friends'">
            密友岛 / Friends
          </button>
        </div>
        <button :disabled="busy" @click="step = 1">下一步 / Next</button>
      </template>

      <template v-else-if="step === 1">
        <label>
          怎么称呼你？（可选） / Nickname (optional)
          <input v-model="displayName" :placeholder="relationshipType === 'friends' ? '例如 陈陈' : '例如 阿梨'" />
        </label>
        <button :disabled="busy" @click="step = 2">下一步 / Next</button>
      </template>

      <template v-else-if="step === 2">
        <p class="muted">相处到哪一步？（可选） / Stage (optional)</p>
        <div class="choices wrap">
          <button
            v-for="s in stages"
            :key="s"
            type="button"
            :class="{ on: stage === s }"
            @click="stage = s"
          >
            {{ dual(RELATIONSHIP_STAGE_LABELS[s].zh, RELATIONSHIP_STAGE_LABELS[s].en) }}
          </button>
        </div>
        <button :disabled="busy" @click="step = 3">下一步 / Next</button>
      </template>

      <template v-else-if="step === 3">
        <label>
          纪念日（可选） / Anniversary (optional)
          <input v-model="anniversary" type="date" />
        </label>
        <p class="muted tiny">可跳过。密友路径不会默认恋爱文案。 / Skip anytime. Friends path stays neutral.</p>
        <button :disabled="busy" @click="createIsland">生成邀请 · 建岛 / Create island</button>
      </template>

      <template v-else>
        <div class="share-card" aria-label="invite share card">
          <p class="card-brand">半个岛</p>
          <p class="card-slogan">{{ share?.slogan }}</p>
          <p class="card-title">{{ share?.title }}</p>
          <p class="card-en">{{ share?.titleEn }}</p>
          <p class="card-desc">{{ share?.description }}</p>
          <p class="card-desc en">{{ share?.descriptionEn }}</p>
          <p class="card-code">{{ share?.inviteCode }}</p>
          <p class="card-meta">分享不暴露答案 · answersHidden: true</p>
        </div>
        <p class="muted">深链：{{ share?.deepLink }}</p>
        <div class="row">
          <button type="button" class="ghost" @click="copyLink">复制链接 / Copy link</button>
          <router-link class="btn" to="/today">先玩今日题 / Play today</router-link>
        </div>
      </template>

      <p v-if="msg" class="muted">{{ msg }}</p>
      <router-link v-if="step < 4" class="skip" to="/invite">已有邀请码？ / Have a code?</router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  InviteShareCard,
  RelationshipStage,
  RelationshipType,
} from "@half-island/shared";
import { RELATIONSHIP_STAGE_LABELS } from "@half-island/shared";
import { api } from "../../api/client";
import { dual } from "../../i18n";
import { persistSession, session } from "../../session";

const step = ref(0);
const relationshipType = ref<RelationshipType>("couple");
const displayName = ref("");
const stage = ref<RelationshipStage>("unspecified");
const anniversary = ref("");
const share = ref<InviteShareCard | null>(null);
const busy = ref(false);
const msg = ref("");

const stages: RelationshipStage[] = [
  "just_met",
  "getting_close",
  "steady",
  "years",
  "unspecified",
];

const stepLabel = computed(() => {
  const labels = [
    "1/4 关系类型",
    "2/4 昵称",
    "3/4 阶段",
    "4/4 纪念日",
    "邀请卡就绪",
  ];
  return labels[step.value] ?? "";
});

async function createIsland(): Promise<void> {
  busy.value = true;
  msg.value = "";
  try {
    const { pair, share: card } = await api.invite({
      userId: session.userId,
      relationshipType: relationshipType.value,
      displayName: displayName.value.trim() || undefined,
      relationshipStage: stage.value,
      anniversaryDate: anniversary.value || null,
    });
    session.pairId = pair.id;
    persistSession();
    localStorage.setItem("hi_onboarded", "1");
    share.value = card;
    step.value = 4;
    msg.value =
      pair.relationshipType === "friends"
        ? "密友岛已建好。把卡片发给对方吧。"
        : "情侣岛已建好。把卡片发给对方吧。";
  } catch (e) {
    msg.value = e instanceof Error ? e.message : "失败";
  } finally {
    busy.value = false;
  }
}

async function copyLink(): Promise<void> {
  if (!share.value) return;
  try {
    await navigator.clipboard.writeText(share.value.deepLink);
    msg.value = "已复制深链 / Link copied";
  } catch {
    msg.value = share.value.deepLink;
  }
}
</script>

<style scoped>
.step-label {
  margin: 0;
  opacity: 0.55;
  font-size: 0.85rem;
}
.choices {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.choices.wrap {
  flex-direction: row;
  flex-wrap: wrap;
}
.choices button {
  background: transparent;
  border: 1px solid rgba(201, 166, 107, 0.35);
}
.choices button.on {
  border-color: rgba(201, 166, 107, 0.9);
  background: rgba(201, 166, 107, 0.12);
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
}
.tiny {
  font-size: 0.8rem;
}
.share-card {
  width: 100%;
  padding: 1.25rem 0 1rem;
  border-top: 1px solid rgba(201, 166, 107, 0.4);
  animation: rise 0.55s ease both;
}
.card-brand {
  font-family: var(--font-display);
  font-size: 2rem;
  margin: 0;
  letter-spacing: 0.08em;
}
.card-slogan {
  margin: 0.25rem 0 0.75rem;
  opacity: 0.8;
}
.card-title {
  font-family: var(--font-display);
  font-size: 1.35rem;
  margin: 0;
}
.card-en {
  margin: 0.15rem 0 0.5rem;
  font-style: italic;
  opacity: 0.7;
}
.card-desc {
  margin: 0.25rem 0;
  line-height: 1.45;
  font-size: 0.95rem;
}
.card-desc.en {
  font-style: italic;
  opacity: 0.72;
}
.card-code {
  font-family: var(--font-display);
  font-size: 1.75rem;
  letter-spacing: 0.28em;
  margin: 0.85rem 0 0.35rem;
}
.card-meta {
  font-size: 0.75rem;
  opacity: 0.5;
  margin: 0;
}
.row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}
.ghost {
  background: transparent;
}
.btn {
  text-decoration: none;
}
.skip {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  opacity: 0.65;
}
</style>
