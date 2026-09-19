/**
 * 54 张牌状态：我手上 / 已出过 / 未知（另外两家或曾经底牌）。
 */
import { CARD_BY_ID, DECK, RANK_VALUES, cardsByIds, rankLabel, sortCards } from "./cards.js";
import { classify, describePlay, validateSelection } from "./rules.js";

export const BUCKET = {
  HAND: "hand",
  PLAYED: "played",
  UNKNOWN: "unknown",
};

export const PLAYER = {
  ME: "me",
  PREV: "prev",
  NEXT: "next",
};

export const PLAYER_LABELS = {
  [PLAYER.ME]: "我",
  [PLAYER.PREV]: "上家",
  [PLAYER.NEXT]: "下家",
};

export const ROLE = {
  LANDLORD: "landlord",
  FARMER: "farmer",
};

const START_HAND = {
  [ROLE.LANDLORD]: 20,
  [ROLE.FARMER]: 17,
};

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.bucket = {};
    for (const card of DECK) this.bucket[card.id] = BUCKET.UNKNOWN;
    this.role = ROLE.FARMER;
    this.landlordPos = PLAYER.NEXT;
    this.bottomIds = [];
    this.history = [];
    this.selection = [];
    this.prevRemain = 20;
    this.nextRemain = 17;
    this.autoRemain = true;
    this.notes = "";
    this.syncRemainDefaults();
  }

  expectedMyStartCount() {
    return START_HAND[this.role];
  }

  syncRemainDefaults() {
    if (!this.autoRemain) return;
    const unknown = this.cardsIn(BUCKET.UNKNOWN).length;
    const start = this.startingOppCounts();
    const playedPrev = this.playedBy(PLAYER.PREV).length;
    const playedNext = this.playedBy(PLAYER.NEXT).length;
    const attributed = playedPrev + playedNext;
    const unattributedPlayed = this.cardsIn(BUCKET.PLAYED).length - this.playedBy(PLAYER.ME).length - attributed;
    let prev = start.prev - playedPrev;
    let next = start.next - playedNext;
    if (unattributedPlayed > 0) {
      const extraPrev = Math.floor(unattributedPlayed / 2);
      const extraNext = unattributedPlayed - extraPrev;
      prev -= extraPrev;
      next -= extraNext;
    }
    prev = Math.max(0, prev);
    next = Math.max(0, next);
    if (prev + next !== unknown && unknown >= 0) {
      if (prev + next === 0 && unknown > 0) {
        prev = Math.ceil(unknown / 2);
        next = unknown - prev;
      } else {
        next = Math.max(0, unknown - prev);
        prev = unknown - next;
      }
    }
    this.prevRemain = prev;
    this.nextRemain = next;
  }

  startingOppCounts() {
    if (this.role === ROLE.LANDLORD) return { prev: 17, next: 17 };
    if (this.landlordPos === PLAYER.PREV) return { prev: 20, next: 17 };
    return { prev: 17, next: 20 };
  }

  clone() {
    const next = new GameState();
    next.restore(this.snapshot());
    return next;
  }

  snapshot() {
    return JSON.parse(
      JSON.stringify({
        bucket: this.bucket,
        role: this.role,
        landlordPos: this.landlordPos,
        bottomIds: this.bottomIds,
        history: this.history.map((item) => ({
          player: item.player,
          pass: item.pass,
          cardIds: item.cardIds,
          note: item.note,
        })),
        selection: this.selection,
        prevRemain: this.prevRemain,
        nextRemain: this.nextRemain,
        autoRemain: this.autoRemain,
        notes: this.notes,
      }),
    );
  }

  restore(data) {
    this.bucket = { ...data.bucket };
    this.role = data.role;
    this.landlordPos = data.landlordPos;
    this.bottomIds = [...data.bottomIds];
    this.history = data.history.map((item) => ({
      player: item.player,
      pass: item.pass,
      cardIds: [...item.cardIds],
      note: item.note,
    }));
    this.selection = [...data.selection];
    this.prevRemain = data.prevRemain;
    this.nextRemain = data.nextRemain;
    this.autoRemain = data.autoRemain;
    this.notes = data.notes;
    return this;
  }

  cardsIn(bucket) {
    return sortCards(DECK.filter((card) => this.bucket[card.id] === bucket));
  }

  myHand() {
    return this.cardsIn(BUCKET.HAND);
  }

  playedCards() {
    return this.cardsIn(BUCKET.PLAYED);
  }

  unknownCards() {
    return this.cardsIn(BUCKET.UNKNOWN);
  }

  playedBy(player) {
    const ids = this.history.filter((h) => !h.pass && h.player === player).flatMap((h) => h.cardIds);
    return cardsByIds(ids);
  }

  summary() {
    return {
      hand: this.myHand().length,
      played: this.playedCards().length,
      unknown: this.unknownCards().length,
      total: DECK.length,
    };
  }

  integrity() {
    const s = this.summary();
    const issues = [];
    if (s.hand + s.played + s.unknown !== 54) {
      issues.push("三组张数之和必须是 54");
    }
    if (this.prevRemain + this.nextRemain !== s.unknown) {
      issues.push(`上家+下家剩余 (${this.prevRemain}+${this.nextRemain}) 应等于未知 ${s.unknown}`);
    }
    return { ok: issues.length === 0, issues, ...s };
  }

  setRole(role) {
    this.role = role;
    if (role === ROLE.LANDLORD) this.landlordPos = PLAYER.ME;
    this.syncRemainDefaults();
  }

  setLandlordPos(pos) {
    this.landlordPos = pos;
    if (pos === PLAYER.ME) this.role = ROLE.LANDLORD;
    else if (this.role === ROLE.LANDLORD) this.role = ROLE.FARMER;
    this.syncRemainDefaults();
  }

  setCardBucket(id, bucket) {
    if (!CARD_BY_ID[id]) throw new Error(`未知牌 ${id}`);
    if (!Object.values(BUCKET).includes(bucket)) throw new Error(`未知状态 ${bucket}`);
    this.bucket[id] = bucket;
    this.selection = this.selection.filter((x) => x !== id);
    this.syncRemainDefaults();
  }

  moveMany(ids, bucket) {
    for (const id of ids) this.setCardBucket(id, bucket);
  }

  toggleSelect(id) {
    if (!CARD_BY_ID[id]) return;
    const i = this.selection.indexOf(id);
    if (i >= 0) this.selection.splice(i, 1);
    else this.selection.push(id);
  }

  clearSelection() {
    this.selection = [];
  }

  selectedCards() {
    return sortCards(cardsByIds(this.selection));
  }

  takeNextUnknownOfRank(rank, bucket) {
    const card = this.unknownCards().find((c) => c.rank === rank);
    if (!card) return false;
    this.setCardBucket(card.id, bucket);
    return true;
  }

  markBottom(ids) {
    this.bottomIds = [...ids];
    if (this.role === ROLE.LANDLORD) {
      this.moveMany(ids, BUCKET.HAND);
    }
  }

  applyPass(player) {
    this.history.push({ player, pass: true, cardIds: [], note: "过" });
  }

  applyPlay(player, cardIds) {
    const unique = [...new Set(cardIds)];
    const cards = cardsByIds(unique);
    const check = validateSelection(cards);
    if (!check.ok) return check;

    if (player === PLAYER.ME) {
      for (const id of unique) {
        if (this.bucket[id] !== BUCKET.HAND) {
          return { ok: false, play: check.play, message: "我方出牌必须来自手牌" };
        }
      }
    } else {
      for (const id of unique) {
        if (this.bucket[id] === BUCKET.HAND) {
          return { ok: false, play: check.play, message: "别人出的牌不能是我的手牌" };
        }
        if (this.bucket[id] === BUCKET.PLAYED) {
          return { ok: false, play: check.play, message: "这些牌已经记为出过" };
        }
      }
    }

    this.moveMany(unique, BUCKET.PLAYED);
    this.history.push({
      player,
      pass: false,
      cardIds: unique,
      note: describePlay(check.play),
    });
    this.clearSelection();
    this.syncRemainDefaults();
    return { ok: true, play: check.play, message: `${PLAYER_LABELS[player]}出 ${check.message}` };
  }

  lastNonPass() {
    for (let i = this.history.length - 1; i >= 0; i -= 1) {
      const item = this.history[i];
      if (!item.pass && item.cardIds.length) {
        const cards = cardsByIds(item.cardIds);
        return { ...item, cards, play: classify(cards), player: item.player };
      }
    }
    return null;
  }

  tablePlayForMe() {
    const last = this.lastNonPass();
    if (!last) return null;
    if (last.player === PLAYER.ME) return null;
    return last.play;
  }

  rankRows() {
    return RANK_VALUES.map((rank) => {
      const all = DECK.filter((c) => c.rank === rank);
      const hand = all.filter((c) => this.bucket[c.id] === BUCKET.HAND).length;
      const played = all.filter((c) => this.bucket[c.id] === BUCKET.PLAYED).length;
      const unknown = all.filter((c) => this.bucket[c.id] === BUCKET.UNKNOWN).length;
      return { rank, label: rankLabel(rank), cards: all, hand, played, unknown };
    });
  }
}

export function loadExampleGame() {
  const state = new GameState();
  state.setRole(ROLE.FARMER);
  state.setLandlordPos(PLAYER.NEXT);

  const hand = ["S3", "H3", "C4", "D5", "S6", "H6", "C6", "D7", "S8", "H9", "C10", "D11", "S12", "H13", "C14", "S15", "JOX"];
  state.moveMany(hand, BUCKET.HAND);

  const played = ["D3", "C3", "S4", "H4", "D4", "S5", "S7", "H7", "C7", "S9", "C9", "D9", "H10", "H8", "C8", "D8", "H5", "C5"];
  state.moveMany(played, BUCKET.PLAYED);
  state.history = [
    { player: PLAYER.NEXT, pass: false, cardIds: ["D3", "C3"], note: "对子 33" },
    { player: PLAYER.ME, pass: true, cardIds: [], note: "过" },
    { player: PLAYER.PREV, pass: false, cardIds: ["S4", "H4", "D4", "S5"], note: "三带一 4445" },
    { player: PLAYER.NEXT, pass: true, cardIds: [], note: "过" },
    { player: PLAYER.ME, pass: true, cardIds: [], note: "过" },
    { player: PLAYER.PREV, pass: false, cardIds: ["S7", "H7", "C7"], note: "三张 777" },
    { player: PLAYER.NEXT, pass: false, cardIds: ["S9", "C9", "D9", "H10"], note: "三带一 99910" },
    { player: PLAYER.ME, pass: true, cardIds: [], note: "过" },
    { player: PLAYER.PREV, pass: true, cardIds: [], note: "过" },
    { player: PLAYER.NEXT, pass: false, cardIds: ["H8", "C8", "D8"], note: "三张 888" },
    { player: PLAYER.ME, pass: true, cardIds: [], note: "过" },
    { player: PLAYER.PREV, pass: true, cardIds: [], note: "过" },
    { player: PLAYER.NEXT, pass: false, cardIds: ["H5", "C5"], note: "对子 55" },
  ];
  state.autoRemain = true;
  state.syncRemainDefaults();
  state.notes = "示例：我是农民，下家地主。用于演示记牌盘与出牌参考。";
  return state;
}
