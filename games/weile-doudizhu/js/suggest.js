/**
 * 可出选项 + 启发式评分 + 简化模拟胜率参考。
 * 胜率不是精确求解，只根据剩余未知牌随机分给另外两家。
 */
import { RANK_VALUES, rankLabel, sortCards } from "./cards.js";
import { estimateRankProb } from "./hyper.js";
import {
  PATTERN,
  canBeat,
  cheapestBeat,
  enumerateLegal,
  greedyLead,
  isBombLike,
  subtractCards,
} from "./rules.js";
import { PLAYER } from "./tracker.js";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(list, rng) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function dealUnknown(unknown, prevN, nextN, rng) {
  const cards = shuffle(unknown, rng);
  const prev = cards.slice(0, prevN);
  const next = cards.slice(prevN, prevN + nextN);
  return { prev, next };
}

function leftoverQuality(cards) {
  if (cards.length === 0) return { score: 100, finishIn: 0, singles: 0, bombs: 0 };
  const counts = new Array(18).fill(0);
  for (const c of cards) counts[c.rank] += 1;
  let bombs = 0;
  let triples = 0;
  let pairs = 0;
  let singles = 0;
  for (let r = 3; r <= 15; r += 1) {
    if (counts[r] === 4) bombs += 1;
    else if (counts[r] === 3) triples += 1;
    else if (counts[r] === 2) pairs += 1;
    else if (counts[r] === 1) singles += 1;
  }
  const jokers = counts[16] + counts[17];
  if (counts[16] && counts[17]) bombs += 1;
  else singles += jokers === 1 ? 1 : 0;

  let seq = 0;
  let run = 0;
  for (let r = 3; r <= 14; r += 1) {
    if (counts[r] >= 1) {
      run += 1;
      if (run >= 5) seq += 1;
    } else run = 0;
  }

  const finishIn = Math.max(1, singles + Math.ceil((cards.length - singles - bombs * 4) / 5));
  let score = 55;
  score += bombs * 8;
  score += triples * 4;
  score += pairs * 2;
  score += seq * 3;
  score -= singles * 5;
  score -= Math.max(0, cards.length - 10) * 0.4;
  if (cards.length <= 2) score += 12;
  return { score: Math.max(0, Math.min(100, score)), finishIn, singles, bombs };
}

function wastesControl(play) {
  if (!play) return false;
  const hasJoker = play.cards.some((c) => c.rank >= 16);
  const hasTwo = play.cards.some((c) => c.rank === 15);
  if (play.type === PATTERN.SINGLE && (hasJoker || hasTwo) && play.rank >= 15) return play.rank >= 16;
  return false;
}

function breaksStraight(hand, play) {
  const before = leftoverQuality(hand).score;
  const after = leftoverQuality(subtractCards(hand, play.cards)).score;
  return after < before - 12;
}

function heuristicScore(hand, play, lastPlay) {
  const reasons = [];
  if (play.cards.length === hand.length) {
    return { score: 100, reasons: ["能一次出完"] };
  }
  const remain = subtractCards(hand, play.cards);
  const q = leftoverQuality(remain);
  let score = 42 + q.score * 0.28;
  score += (play.cards.length / hand.length) * 16;

  if (!lastPlay) {
    if (play.cards.length >= 5) {
      score += 8;
      reasons.push("领出长牌型，减少手数");
    }
    if (play.type === PATTERN.SINGLE && play.rank <= 10) {
      score += 4;
      reasons.push("先甩小单");
    }
  } else {
    const options = enumerateLegal(hand, lastPlay).filter((p) => !isBombLike(p));
    const minRank = options.length ? Math.min(...options.map((p) => p.rank)) : play.rank;
    if (!isBombLike(play) && play.rank === minRank) {
      score += 9;
      reasons.push("最小跟牌，留住大牌");
    } else if (!isBombLike(play) && play.rank > minRank + 2) {
      score -= 6;
      reasons.push("跟牌偏大，可能亏牌力");
    }
  }

  if (isBombLike(play) && hand.length > 8) {
    score -= 18;
    reasons.push(play.type === PATTERN.ROCKET ? "中盘动王炸，通常亏" : "中盘拆炸弹，通常亏");
  } else if (isBombLike(play) && hand.length <= 6) {
    score += 8;
    reasons.push("牌不多时炸弹更适合收割");
  }

  if (wastesControl(play) && hand.length > 4) {
    score -= 10;
    reasons.push("用王/大牌压小牌，牌力浪费");
  }

  if (breaksStraight(hand, play)) {
    score -= 8;
    reasons.push("可能拆散顺子或连对");
  }

  if (q.singles >= 4) {
    score -= 5;
    reasons.push("出完后散牌偏多");
  } else if (q.singles <= 1 && remain.length > 0) {
    score += 6;
    reasons.push("出完后手牌更整");
  }

  if (remain.length <= 2) {
    score += 10;
    reasons.push("接近出完");
  }

  return { score: Math.max(0, Math.min(99, Math.round(score))), reasons };
}

function nextPlayer(p) {
  if (p === PLAYER.ME) return PLAYER.NEXT;
  if (p === PLAYER.NEXT) return PLAYER.PREV;
  return PLAYER.ME;
}

function simulateGreedy(myHand, opp, justPlayedByMe, lastPlay, rng, maxTurns = 36) {
  const hands = {
    [PLAYER.ME]: [...myHand],
    [PLAYER.PREV]: [...opp.prev],
    [PLAYER.NEXT]: [...opp.next],
  };
  let current = justPlayedByMe;
  let lastPlayer = PLAYER.ME;
  let turn = PLAYER.NEXT;
  let passes = 0;
  let steps = 0;

  const playFrom = (who, play) => {
    const ids = new Set(play.cards.map((c) => c.id));
    hands[who] = hands[who].filter((c) => !ids.has(c.id));
    current = play;
    lastPlayer = who;
    passes = 0;
  };

  while (steps < maxTurns) {
    steps += 1;
    if (hands[PLAYER.ME].length === 0) return true;
    if (hands[PLAYER.PREV].length === 0 || hands[PLAYER.NEXT].length === 0) return false;

    const hand = hands[turn];
    if (!current) {
      const lead = greedyLead(hand);
      if (!lead) return turn !== PLAYER.ME ? true : false;
      playFrom(turn, lead);
    } else {
      const beat = cheapestBeat(hand, current);
      const desperate = hand.length <= 6 || (turn !== PLAYER.ME && hands[PLAYER.ME].length <= 4);
      if (beat && (!isBombLike(beat) || desperate || !enumerateLegal(hand, current).some((p) => !isBombLike(p)))) {
        playFrom(turn, beat);
      } else {
        passes += 1;
        if (passes >= 2) {
          current = null;
          turn = lastPlayer;
          passes = 0;
          continue;
        }
      }
    }
    if (hands[turn].length === 0) {
      return turn === PLAYER.ME;
    }
    turn = nextPlayer(turn);
  }

  const mine = hands[PLAYER.ME].length;
  return mine <= hands[PLAYER.PREV].length && mine <= hands[PLAYER.NEXT].length;
}

function onePlySafe(opp, play) {
  return !canBeat(opp.next, play) && !canBeat(opp.prev, play);
}

/**
 * @param {import('./tracker.js').GameState} state
 * @param {{ samples?: number, seed?: number }} [options]
 */
export function suggestPlays(state, options = {}) {
  const samples = options.samples ?? 140;
  const seed = options.seed ?? 20260919;
  const hand = state.myHand();
  const lastPlay = state.tablePlayForMe();
  const raw = enumerateLegal(hand, lastPlay);
  const unknown = state.unknownCards();
  let prevN = state.prevRemain;
  let nextN = state.nextRemain;
  if (prevN + nextN !== unknown.length) {
    nextN = Math.max(0, unknown.length - prevN);
    prevN = unknown.length - nextN;
  }

  const evals = raw.map((play, index) => {
    const h = heuristicScore(hand, play, lastPlay);
    const remain = subtractCards(hand, play.cards);
    let safe = 0;
    let wins = 0;
    const simN = Math.min(samples, 80);
    const plyN = samples;
    for (let i = 0; i < plyN; i += 1) {
      const rng = mulberry32(seed + index * 997 + i * 13);
      const deal = dealUnknown(unknown, prevN, nextN, rng);
      if (onePlySafe(deal, play)) safe += 1;
      if (i < simN) {
        if (simulateGreedy(remain, deal, play, lastPlay, rng)) wins += 1;
      }
    }
    const safeRate = plyN ? safe / plyN : 0;
    const winRate = simN ? wins / simN : 0;
    const blended = 0.38 * h.score + 0.22 * safeRate * 100 + 0.4 * winRate * 100;
    const reasons = [...h.reasons];
    const onlyNormal = raw.filter((p) => !isBombLike(p)).length === 1 && !isBombLike(play);
    if (onlyNormal) reasons.unshift("当前几乎只有这一手普通跟牌");
    if (safeRate >= 0.7) reasons.push("抽样里另外两家较难马上压过");
    else if (safeRate <= 0.25 && !isBombLike(play)) reasons.push("抽样里常被下家或上家压住");
    if (play.cards.length === hand.length) {
      return {
        play,
        score: 100,
        winRate: 1,
        safeRate,
        reasons: ["能一次出完"],
      };
    }
    return {
      play,
      score: Math.round(Math.max(onlyNormal ? 36 : 0, Math.min(99, blended))),
      winRate,
      safeRate,
      reasons: reasons.slice(0, 3),
    };
  });

  evals.sort((a, b) => b.score - a.score || b.winRate - a.winRate);
  return {
    lastPlay,
    leading: !lastPlay,
    options: evals,
    passAllowed: Boolean(lastPlay),
    samples,
  };
}

export function remainingDistribution(state) {
  const unknownTotal = state.unknownCards().length;
  return RANK_VALUES.map((rank) => {
    const row = state.rankRows().find((r) => r.rank === rank);
    const next = estimateRankProb(row.unknown, unknownTotal, state.nextRemain);
    const prev = estimateRankProb(row.unknown, unknownTotal, state.prevRemain);
    return {
      rank,
      label: rankLabel(rank),
      hand: row.hand,
      played: row.played,
      unknown: row.unknown,
      pNext1: next.atLeast1,
      pNext2: next.atLeast2,
      pNextBomb: next.bomb,
      pPrev1: prev.atLeast1,
      pPrev2: prev.atLeast2,
      pPrevBomb: prev.bomb,
    };
  });
}

export function formatPercent(p) {
  if (Number.isNaN(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

export function summarizeSuggestion(item) {
  const cards = sortCards(item.play.cards)
    .map((c) => c.label)
    .join(" ");
  return `${item.play.label} ${cards}`;
}

export { leftoverQuality };
