/**
 * 微乐经典无癞子斗地主牌型与比较。
 * 不包含癞子、不读取任何游戏进程。
 */
import {
  SEQUENCE_MAX_RANK,
  SEQUENCE_MIN_RANK,
  rankCountsFromCards,
  rankLabel,
  sortCards,
} from "./cards.js";

export const PATTERN = {
  SINGLE: "single",
  PAIR: "pair",
  TRIPLE: "triple",
  TRIPLE_ONE: "triple_one",
  TRIPLE_PAIR: "triple_pair",
  STRAIGHT: "straight",
  PAIR_STRAIGHT: "pair_straight",
  PLANE: "plane",
  PLANE_SINGLE: "plane_single",
  PLANE_PAIR: "plane_pair",
  FOUR_TWO_SINGLE: "four_two_single",
  FOUR_TWO_PAIR: "four_two_pair",
  BOMB: "bomb",
  ROCKET: "rocket",
};

export const PATTERN_LABELS = {
  [PATTERN.SINGLE]: "单张",
  [PATTERN.PAIR]: "对子",
  [PATTERN.TRIPLE]: "三张",
  [PATTERN.TRIPLE_ONE]: "三带一",
  [PATTERN.TRIPLE_PAIR]: "三带对",
  [PATTERN.STRAIGHT]: "顺子",
  [PATTERN.PAIR_STRAIGHT]: "连对",
  [PATTERN.PLANE]: "飞机",
  [PATTERN.PLANE_SINGLE]: "飞机带单",
  [PATTERN.PLANE_PAIR]: "飞机带对",
  [PATTERN.FOUR_TWO_SINGLE]: "四带二",
  [PATTERN.FOUR_TWO_PAIR]: "四带两对",
  [PATTERN.BOMB]: "炸弹",
  [PATTERN.ROCKET]: "王炸",
};

export function patternLabel(type) {
  return PATTERN_LABELS[type] ?? type;
}

function makePlay(type, rank, length, cards, extra = {}) {
  return {
    type,
    rank,
    length,
    cards: sortCards(cards),
    label: patternLabel(type),
    ...extra,
  };
}

function isConsecutive(ranks) {
  if (ranks.length === 0) return false;
  const sorted = [...ranks].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] !== sorted[i - 1] + 1) return false;
  }
  return true;
}

function allInSequenceRange(ranks) {
  return ranks.every((rank) => rank >= SEQUENCE_MIN_RANK && rank <= SEQUENCE_MAX_RANK);
}

function groupsFromCounts(counts) {
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => a.rank - b.rank);
}

/**
 * 识别一组牌是否构成唯一合法牌型。
 * 连续三张优先按最长飞机解释；四带二不是炸弹。
 */
export function classify(cards) {
  if (!cards || cards.length === 0) return null;
  const n = cards.length;
  const counts = rankCountsFromCards(cards);
  const groups = groupsFromCounts(counts);
  const jokerCount = (counts.get(16) || 0) + (counts.get(17) || 0);

  if (n === 2 && (counts.get(16) || 0) === 1 && (counts.get(17) || 0) === 1) {
    return makePlay(PATTERN.ROCKET, 17, 2, cards);
  }

  if (n === 4 && groups.length === 1 && groups[0].count === 4) {
    return makePlay(PATTERN.BOMB, groups[0].rank, 4, cards);
  }

  if (n === 1) {
    return makePlay(PATTERN.SINGLE, cards[0].rank, 1, cards);
  }

  if (n === 2 && groups.length === 1 && groups[0].rank <= 15 && groups[0].count === 2) {
    return makePlay(PATTERN.PAIR, groups[0].rank, 2, cards);
  }

  if (n === 3 && groups.length === 1 && groups[0].count === 3) {
    return makePlay(PATTERN.TRIPLE, groups[0].rank, 3, cards);
  }

  if (n === 4) {
    const triple = groups.find((g) => g.count === 3);
    const single = groups.find((g) => g.count === 1);
    if (triple && single) {
      return makePlay(PATTERN.TRIPLE_ONE, triple.rank, 4, cards);
    }
  }

  if (n === 5) {
    const triple = groups.find((g) => g.count === 3);
    const pair = groups.find((g) => g.count === 2);
    if (triple && pair && groups.length === 2) {
      return makePlay(PATTERN.TRIPLE_PAIR, triple.rank, 5, cards);
    }
  }

  const plane = classifyPlane(cards, counts, n);
  if (plane) return plane;

  if (n === 6) {
    const four = groups.find((g) => g.count === 4);
    if (four) {
      if (jokerCount === 2) return null;
      return makePlay(PATTERN.FOUR_TWO_SINGLE, four.rank, 6, cards);
    }
  }

  if (n === 8) {
    const fours = groups.filter((g) => g.count === 4);
    const pairs = groups.filter((g) => g.count === 2);
    if (jokerCount > 0) {
      /* 四带两对不能带王 */
    } else if (fours.length === 2) {
      const main = Math.max(fours[0].rank, fours[1].rank);
      return makePlay(PATTERN.FOUR_TWO_PAIR, main, 8, cards);
    } else if (fours.length === 1 && pairs.length === 2 && groups.length === 3) {
      return makePlay(PATTERN.FOUR_TWO_PAIR, fours[0].rank, 8, cards);
    } else if (fours.length === 1 && groups.some((g) => g.count === 4) && groups.some((g) => g.count === 2) && groups.some((g) => g.count === 2)) {
      return makePlay(PATTERN.FOUR_TWO_PAIR, fours[0].rank, 8, cards);
    }
  }

  if (n >= 5 && groups.every((g) => g.count === 1) && allInSequenceRange(groups.map((g) => g.rank)) && isConsecutive(groups.map((g) => g.rank))) {
    const ranks = groups.map((g) => g.rank);
    return makePlay(PATTERN.STRAIGHT, Math.max(...ranks), n, cards, { chain: n });
  }

  if (
    n >= 6 &&
    n % 2 === 0 &&
    groups.every((g) => g.count === 2) &&
    allInSequenceRange(groups.map((g) => g.rank)) &&
    isConsecutive(groups.map((g) => g.rank)) &&
    groups.length >= 3
  ) {
    const ranks = groups.map((g) => g.rank);
    return makePlay(PATTERN.PAIR_STRAIGHT, Math.max(...ranks), n, cards, { chain: groups.length });
  }

  return null;
}

function classifyPlane(cards, counts, n) {
  const maxK = Math.floor(n / 3);
  for (let k = maxK; k >= 2; k -= 1) {
    for (let start = SEQUENCE_MIN_RANK; start + k - 1 <= SEQUENCE_MAX_RANK; start += 1) {
      let ok = true;
      for (let r = start; r < start + k; r += 1) {
        if ((counts.get(r) || 0) < 3) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      const remain = new Map(counts);
      for (let r = start; r < start + k; r += 1) {
        remain.set(r, remain.get(r) - 3);
      }
      let remainN = 0;
      for (const c of remain.values()) remainN += c;
      const high = start + k - 1;

      if (remainN === 0) {
        return makePlay(PATTERN.PLANE, high, n, cards, { chain: k });
      }
      if (remainN === k) {
        return makePlay(PATTERN.PLANE_SINGLE, high, n, cards, { chain: k });
      }
      if (remainN === 2 * k) {
        let pairsOk = true;
        for (const [rank, count] of remain.entries()) {
          if (count === 0) continue;
          if (rank >= 16 || count % 2 !== 0) {
            pairsOk = false;
            break;
          }
        }
        if (pairsOk) {
          return makePlay(PATTERN.PLANE_PAIR, high, n, cards, { chain: k });
        }
      }
    }
  }
  return null;
}

export function isBombLike(play) {
  return play && (play.type === PATTERN.BOMB || play.type === PATTERN.ROCKET);
}

/** 新出的 a 能否压过桌面上的 b。 */
export function beats(a, b) {
  if (!a) return false;
  if (!b) return true;
  if (a.type === PATTERN.ROCKET) return true;
  if (b.type === PATTERN.ROCKET) return false;
  if (a.type === PATTERN.BOMB && b.type !== PATTERN.BOMB) return true;
  if (b.type === PATTERN.BOMB && a.type !== PATTERN.BOMB) return false;
  if (a.type !== b.type) return false;
  if (a.cards.length !== b.cards.length) return false;
  if ((a.chain || a.length) && (b.chain || b.length) && a.cards.length === b.cards.length) {
    /* 同张数已足够约束顺子/飞机长度 */
  }
  return a.rank > b.rank;
}

export function describePlay(play) {
  if (!play) return "过";
  const body = play.cards.map((c) => c.label).join("");
  return `${play.label} ${body}`.trim();
}

export function playSignature(play) {
  if (!play) return "pass";
  const ranks = play.cards.map((c) => c.rank).sort((a, b) => a - b);
  return `${play.type}:${ranks.join(",")}`;
}

function cloneCounts(counts) {
  const next = new Array(18).fill(0);
  for (let i = 0; i < counts.length; i += 1) next[i] = counts[i];
  return next;
}

function cardsToCountArray(cards) {
  const counts = new Array(18).fill(0);
  for (const card of cards) counts[card.rank] += 1;
  return counts;
}

function takeCardsByCounts(hand, need) {
  const used = [];
  const pool = new Map();
  for (const card of sortCards(hand)) {
    if (!pool.has(card.rank)) pool.set(card.rank, []);
    pool.get(card.rank).push(card);
  }
  for (let rank = 3; rank <= 17; rank += 1) {
    const n = need[rank] || 0;
    if (n === 0) continue;
    const available = pool.get(rank) || [];
    if (available.length < n) return null;
    used.push(...available.slice(0, n));
  }
  return used;
}

function pushUnique(plays, seen, cards) {
  const play = classify(cards);
  if (!play) return;
  const sig = playSignature(play);
  if (seen.has(sig)) return;
  seen.add(sig);
  plays.push(play);
}

function chooseRanks(options, k, start, acc, visit) {
  if (acc.length === k) {
    visit(acc);
    return;
  }
  for (let i = start; i < options.length; i += 1) {
    acc.push(options[i]);
    chooseRanks(options, k, i + 1, acc, visit);
    acc.pop();
  }
}

/**
 * 枚举手牌全部合法出法。lastPlay 为空表示领出；否则只保留能压过的牌（不含「过」）。
 */
export function enumerateLegal(hand, lastPlay = null) {
  const plays = [];
  const seen = new Set();
  const counts = cardsToCountArray(hand);
  const emit = (need) => {
    const cards = takeCardsByCounts(hand, need);
    if (cards) pushUnique(plays, seen, cards);
  };

  const tryNeed = (need) => {
    for (let r = 3; r <= 17; r += 1) {
      if ((need[r] || 0) > counts[r]) return;
    }
    emit(need);
  };

  const singles = [];
  const pairs = [];
  const triples = [];
  const bombs = [];
  for (let r = 3; r <= 17; r += 1) {
    if (counts[r] >= 1) singles.push(r);
    if (counts[r] >= 2 && r <= 15) pairs.push(r);
    if (counts[r] >= 3 && r <= 15) triples.push(r);
    if (counts[r] >= 4 && r <= 15) bombs.push(r);
  }

  if (!lastPlay || lastPlay.type === PATTERN.SINGLE) {
    for (const r of singles) {
      const need = new Array(18).fill(0);
      need[r] = 1;
      tryNeed(need);
    }
  }

  if (!lastPlay || lastPlay.type === PATTERN.PAIR) {
    for (const r of pairs) {
      const need = new Array(18).fill(0);
      need[r] = 2;
      tryNeed(need);
    }
  }

  if (!lastPlay || lastPlay.type === PATTERN.TRIPLE) {
    for (const r of triples) {
      const need = new Array(18).fill(0);
      need[r] = 3;
      tryNeed(need);
    }
  }

  if (!lastPlay || lastPlay.type === PATTERN.TRIPLE_ONE) {
    for (const t of triples) {
      for (const s of singles) {
        if (s === t && counts[t] < 4) continue;
        const need = new Array(18).fill(0);
        need[t] = 3;
        need[s] += 1;
        tryNeed(need);
      }
    }
  }

  if (!lastPlay || lastPlay.type === PATTERN.TRIPLE_PAIR) {
    for (const t of triples) {
      for (const p of pairs) {
        if (p === t) continue;
        const need = new Array(18).fill(0);
        need[t] = 3;
        need[p] = 2;
        tryNeed(need);
      }
    }
  }

  if (!lastPlay || lastPlay.type === PATTERN.STRAIGHT) {
    const minLen = lastPlay?.type === PATTERN.STRAIGHT ? lastPlay.cards.length : 5;
    const maxLen = lastPlay?.type === PATTERN.STRAIGHT ? lastPlay.cards.length : 12;
    for (let len = minLen; len <= maxLen; len += 1) {
      for (let start = SEQUENCE_MIN_RANK; start + len - 1 <= SEQUENCE_MAX_RANK; start += 1) {
        const need = new Array(18).fill(0);
        let ok = true;
        for (let r = start; r < start + len; r += 1) {
          if (counts[r] < 1) {
            ok = false;
            break;
          }
          need[r] = 1;
        }
        if (ok) tryNeed(need);
      }
    }
  }

  if (!lastPlay || lastPlay.type === PATTERN.PAIR_STRAIGHT) {
    const minPairs = lastPlay?.type === PATTERN.PAIR_STRAIGHT ? lastPlay.cards.length / 2 : 3;
    const maxPairs = lastPlay?.type === PATTERN.PAIR_STRAIGHT ? lastPlay.cards.length / 2 : 10;
    for (let len = minPairs; len <= maxPairs; len += 1) {
      for (let start = SEQUENCE_MIN_RANK; start + len - 1 <= SEQUENCE_MAX_RANK; start += 1) {
        const need = new Array(18).fill(0);
        let ok = true;
        for (let r = start; r < start + len; r += 1) {
          if (counts[r] < 2) {
            ok = false;
            break;
          }
          need[r] = 2;
        }
        if (ok) tryNeed(need);
      }
    }
  }

  const emitPlanes = (wantType) => {
    const lastIs = lastPlay && lastPlay.type === wantType;
    if (lastPlay && !lastIs) return;
    const chainMin = lastIs ? lastPlay.chain || lastPlay.cards.length / (wantType === PATTERN.PLANE ? 3 : wantType === PATTERN.PLANE_SINGLE ? 4 : 5) : 2;
    const chainFixed = lastIs;
    for (let k = 2; k <= 6; k += 1) {
      if (chainFixed && k !== lastPlay.chain && k !== Math.round(chainMin)) continue;
      if (!chainFixed && k < 2) continue;
      for (let start = SEQUENCE_MIN_RANK; start + k - 1 <= SEQUENCE_MAX_RANK; start += 1) {
        let bodyOk = true;
        const body = new Array(18).fill(0);
        for (let r = start; r < start + k; r += 1) {
          if (counts[r] < 3) {
            bodyOk = false;
            break;
          }
          body[r] = 3;
        }
        if (!bodyOk) continue;

        if (wantType === PATTERN.PLANE) {
          tryNeed(body);
          continue;
        }

        if (wantType === PATTERN.PLANE_SINGLE) {
          const remainSingles = [];
          for (let r = 3; r <= 17; r += 1) {
            const left = counts[r] - body[r];
            for (let i = 0; i < left; i += 1) remainSingles.push(r);
          }
          if (remainSingles.length < k) continue;
          chooseRanks(
            remainSingles.map((rank, idx) => ({ rank, idx })),
            k,
            0,
            [],
            (picked) => {
              const usedIdx = new Set();
              let valid = true;
              for (const item of picked) {
                if (usedIdx.has(item.idx)) valid = false;
                usedIdx.add(item.idx);
              }
              if (!valid) return;
              const need = cloneCounts(body);
              for (const item of picked) need[item.rank] += 1;
              tryNeed(need);
            },
          );
        }

        if (wantType === PATTERN.PLANE_PAIR) {
          const pairSlots = [];
          for (let r = 3; r <= 15; r += 1) {
            const left = counts[r] - body[r];
            const pairNum = Math.floor(left / 2);
            for (let i = 0; i < pairNum; i += 1) pairSlots.push(r);
          }
          if (pairSlots.length < k) continue;
          chooseRanks(
            pairSlots.map((rank, idx) => ({ rank, idx })),
            k,
            0,
            [],
            (picked) => {
              const usedIdx = new Set();
              for (const item of picked) {
                if (usedIdx.has(item.idx)) return;
                usedIdx.add(item.idx);
              }
              const need = cloneCounts(body);
              for (const item of picked) need[item.rank] += 2;
              tryNeed(need);
            },
          );
        }
      }
    }
  };

  if (!lastPlay || lastPlay.type === PATTERN.PLANE) emitPlanes(PATTERN.PLANE);
  if (!lastPlay || lastPlay.type === PATTERN.PLANE_SINGLE) emitPlanes(PATTERN.PLANE_SINGLE);
  if (!lastPlay || lastPlay.type === PATTERN.PLANE_PAIR) emitPlanes(PATTERN.PLANE_PAIR);

  if (!lastPlay || lastPlay.type === PATTERN.FOUR_TWO_SINGLE) {
    for (const b of bombs) {
      const rest = [];
      for (let r = 3; r <= 17; r += 1) {
        const left = r === b ? counts[r] - 4 : counts[r];
        for (let i = 0; i < left; i += 1) rest.push(r);
      }
      if (rest.length < 2) continue;
      for (let i = 0; i < rest.length; i += 1) {
        for (let j = i + 1; j < rest.length; j += 1) {
          const x = rest[i];
          const y = rest[j];
          if ((x === 16 && y === 17) || (x === 17 && y === 16)) continue;
          const need = new Array(18).fill(0);
          need[b] = 4;
          need[x] += 1;
          need[y] += 1;
          tryNeed(need);
        }
      }
    }
  }

  if (!lastPlay || lastPlay.type === PATTERN.FOUR_TWO_PAIR) {
    for (const b of bombs) {
      const pairSlots = [];
      for (let r = 3; r <= 15; r += 1) {
        const left = r === b ? counts[r] - 4 : counts[r];
        const n = Math.floor(left / 2);
        for (let i = 0; i < n; i += 1) pairSlots.push(r);
      }
      if (pairSlots.length < 2) continue;
      for (let i = 0; i < pairSlots.length; i += 1) {
        for (let j = i + 1; j < pairSlots.length; j += 1) {
          const need = new Array(18).fill(0);
          need[b] = 4;
          need[pairSlots[i]] += 2;
          need[pairSlots[j]] += 2;
          tryNeed(need);
        }
      }
    }
  }

  for (const b of bombs) {
    const need = new Array(18).fill(0);
    need[b] = 4;
    tryNeed(need);
  }

  if (counts[16] >= 1 && counts[17] >= 1) {
    const need = new Array(18).fill(0);
    need[16] = 1;
    need[17] = 1;
    tryNeed(need);
  }

  let filtered = plays;
  if (lastPlay) {
    filtered = plays.filter((play) => beats(play, lastPlay));
  }

  filtered.sort((a, b) => {
    const bombA = isBombLike(a) ? 1 : 0;
    const bombB = isBombLike(b) ? 1 : 0;
    if (bombA !== bombB) return bombA - bombB;
    if (a.cards.length !== b.cards.length) return b.cards.length - a.cards.length;
    return a.rank - b.rank;
  });

  return filtered;
}

export function subtractCards(hand, played) {
  const used = new Set(played.map((c) => c.id));
  return hand.filter((c) => !used.has(c.id));
}

export function hasRocket(hand) {
  return hand.some((c) => c.rank === 16) && hand.some((c) => c.rank === 17);
}

export function biggerBombs(hand, lastPlay) {
  const counts = rankCountsFromCards(hand);
  const bombs = [];
  for (const [rank, count] of counts.entries()) {
    if (count >= 4 && rank <= 15) {
      if (!lastPlay || lastPlay.type !== PATTERN.BOMB || rank > lastPlay.rank) {
        bombs.push(rank);
      }
    }
  }
  return bombs;
}

/** 快速判断手牌是否能压过桌面牌（供模拟用，不展开全部组合）。 */
export function canBeat(hand, lastPlay) {
  if (!lastPlay) return hand.length > 0;
  if (hasRocket(hand)) return true;
  if (biggerBombs(hand, lastPlay).length > 0) return true;

  const counts = cardsToCountArray(hand);
  const type = lastPlay.type;
  const rank = lastPlay.rank;

  const hasSeq = (each, len, minStartRank) => {
    const startMin = Math.max(SEQUENCE_MIN_RANK, minStartRank);
    for (let start = startMin; start + len - 1 <= SEQUENCE_MAX_RANK; start += 1) {
      let ok = true;
      for (let r = start; r < start + len; r += 1) {
        if (counts[r] < each) {
          ok = false;
          break;
        }
      }
      if (ok) return true;
    }
    return false;
  };

  switch (type) {
    case PATTERN.SINGLE:
      return RANK_SCAN(counts, 1, rank);
    case PATTERN.PAIR:
      return RANK_SCAN(counts, 2, rank, 15);
    case PATTERN.TRIPLE:
      return RANK_SCAN(counts, 3, rank, 15);
    case PATTERN.TRIPLE_ONE:
      if (!RANK_SCAN(counts, 3, rank, 15)) return false;
      return hand.length >= 4;
    case PATTERN.TRIPLE_PAIR:
      for (let t = rank + 1; t <= 15; t += 1) {
        if (counts[t] < 3) continue;
        for (let p = 3; p <= 15; p += 1) {
          if (p === t) continue;
          if (counts[p] >= 2) return true;
        }
      }
      return false;
    case PATTERN.STRAIGHT:
      return hasSeq(1, lastPlay.cards.length, lastPlay.rank - lastPlay.cards.length + 2);
    case PATTERN.PAIR_STRAIGHT:
      return hasSeq(2, lastPlay.cards.length / 2, lastPlay.rank - lastPlay.cards.length / 2 + 2);
    case PATTERN.PLANE:
      return hasSeq(3, lastPlay.chain || lastPlay.cards.length / 3, lastPlay.rank - (lastPlay.chain || 2) + 2);
    case PATTERN.PLANE_SINGLE:
    case PATTERN.PLANE_PAIR: {
      const k = lastPlay.chain || (type === PATTERN.PLANE_SINGLE ? lastPlay.cards.length / 4 : lastPlay.cards.length / 5);
      for (let start = SEQUENCE_MIN_RANK; start + k - 1 <= SEQUENCE_MAX_RANK; start += 1) {
        if (start + k - 1 <= rank) continue;
        let ok = true;
        let used = 0;
        for (let r = start; r < start + k; r += 1) {
          if (counts[r] < 3) {
            ok = false;
            break;
          }
          used += 3;
        }
        if (!ok) continue;
        const remain = hand.length - used;
        if (type === PATTERN.PLANE_SINGLE && remain >= k) return true;
        if (type === PATTERN.PLANE_PAIR) {
          let pairSlots = 0;
          for (let r = 3; r <= 15; r += 1) {
            const left = r >= start && r < start + k ? counts[r] - 3 : counts[r];
            pairSlots += Math.floor(Math.max(0, left) / 2);
          }
          if (pairSlots >= k) return true;
        }
      }
      return false;
    }
    case PATTERN.FOUR_TWO_SINGLE:
      for (const b of biggerBombs(hand, { type: PATTERN.BOMB, rank })) {
        if (hand.length >= 6 && !(counts[16] + counts[17] === 2 && hand.length === 6)) return true;
        if (hand.length - 4 >= 2) {
          const jokers = (counts[16] > 0 ? 1 : 0) + (counts[17] > 0 ? 1 : 0);
          const others = hand.length - 4 - (counts[b] - 4);
          if (others + Math.min(jokers, 1) >= 2 || (others >= 2)) return true;
        }
      }
      for (let b = rank + 1; b <= 15; b += 1) {
        if (counts[b] >= 4 && hand.length >= 6) return true;
      }
      return false;
    case PATTERN.FOUR_TWO_PAIR:
      for (let b = rank + 1; b <= 15; b += 1) {
        if (counts[b] < 4) continue;
        let slots = 0;
        for (let r = 3; r <= 15; r += 1) {
          const left = r === b ? counts[r] - 4 : counts[r];
          slots += Math.floor(left / 2);
        }
        if (slots >= 2) return true;
      }
      return false;
    case PATTERN.BOMB:
      return biggerBombs(hand, lastPlay).length > 0;
    case PATTERN.ROCKET:
      return false;
    default:
      return false;
  }
}

function RANK_SCAN(counts, need, greaterThan, maxRank = 17) {
  for (let r = greaterThan + 1; r <= maxRank; r += 1) {
    if (counts[r] >= need) return true;
  }
  return false;
}

export function cheapestBeat(hand, lastPlay) {
  if (!lastPlay) return null;
  const options = enumerateLegal(hand, lastPlay);
  const normal = options.filter((p) => !isBombLike(p));
  const pool = normal.length ? normal : options;
  if (!pool.length) return null;
  pool.sort((a, b) => a.rank - b.rank || a.cards.length - b.cards.length);
  return pool[0];
}

export function greedyLead(hand) {
  if (hand.length === 0) return null;
  const options = enumerateLegal(hand, null);
  if (!options.length) return null;
  const nonBomb = options.filter((p) => !isBombLike(p));
  const pool = nonBomb.length ? nonBomb : options;
  pool.sort((a, b) => {
    if (a.cards.length !== b.cards.length) return b.cards.length - a.cards.length;
    return a.rank - b.rank;
  });
  return pool[0];
}

export function validateSelection(cards) {
  if (!cards.length) return { ok: false, play: null, message: "还没选牌" };
  const play = classify(cards);
  if (!play) {
    return { ok: false, play: null, message: "不是微乐经典无癞子的合法牌型（顺子/连对/飞机不能含 2 或王；四带二不能带两王）" };
  }
  return { ok: true, play, message: `${play.label}，比较点 ${rankLabel(play.rank)}` };
}

export function pickFirstOfRanks(hand, rankList) {
  const remain = [...hand];
  const picked = [];
  for (const rank of rankList) {
    const idx = remain.findIndex((c) => c.rank === rank);
    if (idx < 0) return null;
    picked.push(remain.splice(idx, 1)[0]);
  }
  return picked;
}
