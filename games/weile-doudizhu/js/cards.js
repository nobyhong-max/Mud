/** 微乐经典斗地主：一副 54 张（4 花色 × 13 点 + 小王 + 大王）。 */

export const SUITS = [
  { id: "S", symbol: "♠", name: "黑桃", color: "black" },
  { id: "H", symbol: "♥", name: "红桃", color: "red" },
  { id: "C", symbol: "♣", name: "梅花", color: "black" },
  { id: "D", symbol: "♦", name: "方片", color: "red" },
];

/** 点数从 3 到大王，数值越大越大。2=15，小王=16，大王=17。 */
export const RANK_VALUES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

export const RANK_LABEL = {
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
  15: "2",
  16: "小王",
  17: "大王",
};

/** 可参与顺子 / 连对 / 飞机主体的点数（3–A）。2 与王不行。 */
export const SEQUENCE_MAX_RANK = 14;
export const SEQUENCE_MIN_RANK = 3;

export function rankLabel(rank) {
  return RANK_LABEL[rank] ?? String(rank);
}

export function createDeck() {
  const cards = [];
  for (const rank of RANK_VALUES) {
    if (rank >= 16) continue;
    for (const suit of SUITS) {
      cards.push({
        id: `${suit.id}${rank}`,
        rank,
        suit: suit.id,
        label: RANK_LABEL[rank],
        symbol: suit.symbol,
        color: suit.color,
        isJoker: false,
        name: `${suit.name}${RANK_LABEL[rank]}`,
      });
    }
  }
  cards.push({
    id: "JOX",
    rank: 16,
    suit: "J",
    label: "小王",
    symbol: "☆",
    color: "joker-s",
    isJoker: true,
    name: "小王",
  });
  cards.push({
    id: "JOY",
    rank: 17,
    suit: "J",
    label: "大王",
    symbol: "★",
    color: "joker-b",
    isJoker: true,
    name: "大王",
  });
  return cards;
}

export const DECK = createDeck();
export const CARD_BY_ID = Object.fromEntries(DECK.map((card) => [card.id, card]));

export function cardsByIds(ids) {
  return ids.map((id) => {
    const card = CARD_BY_ID[id];
    if (!card) throw new Error(`未知牌 id: ${id}`);
    return card;
  });
}

export function sortCards(cards) {
  return [...cards].sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit));
}

export function formatCards(cards) {
  return sortCards(cards)
    .map((card) => (card.isJoker ? card.label : `${card.symbol}${card.label}`))
    .join(" ");
}

export function formatRanks(cards) {
  return sortCards(cards)
    .map((card) => card.label)
    .join(" ");
}

export function rankCountsFromCards(cards) {
  const counts = new Map();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return counts;
}

export function cardsOfRank(cards, rank) {
  return cards.filter((card) => card.rank === rank);
}

export function uniqueIds(ids) {
  return [...new Set(ids)];
}
