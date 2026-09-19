"""剩余未知牌的加权统计。这是条件概率估算，不是上帝视角。"""

from __future__ import annotations

from dataclasses import dataclass

from weile_ddz.cards import DECK, RANK_VALUE, Card, value_label
from weile_ddz.state import Bucket, CardState


def _comb(n: int, k: int) -> float:
    if k < 0 or k > n:
        return 0.0
    k = min(k, n - k)
    out = 1.0
    for i in range(1, k + 1):
        out = out * (n - k + i) / i
    return out


def _hyper_at_least(n_pop: int, k_success: int, n_draw: int, t: int) -> float:
    if t <= 0:
        return 1.0
    if n_pop <= 0 or n_draw <= 0:
        return 0.0
    n_draw = min(n_draw, n_pop)
    total = _comb(n_pop, n_draw)
    if total == 0:
        return 0.0
    p = 0.0
    for x in range(t, min(k_success, n_draw) + 1):
        p += _comb(k_success, x) * _comb(n_pop - k_success, n_draw - x)
    return max(0.0, min(1.0, p / total))


@dataclass
class RankRow:
    label: str
    value: int
    in_hand: int
    seen: int
    unknown: int
    p_at_least_1: float
    p_pair: float
    p_bomb: float


def remaining_rows(state: CardState, opp_hand_guess: int | None = None) -> list[RankRow]:
    unknown_total = len(state.get_remaining_unknown())
    if opp_hand_guess is None:
        # 未知牌大致均分给另外两家
        opp_hand_guess = max(1, (unknown_total + 1) // 2)
    rows: list[RankRow] = []
    values = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
    for value in values:
        cards = [card for card in DECK if card.value == value]
        in_hand = sum(1 for card in cards if state.bucket[card.id] == Bucket.IN_HAND.value)
        seen = sum(1 for card in cards if state.bucket[card.id] == Bucket.SEEN.value)
        unknown = sum(1 for card in cards if state.bucket[card.id] == Bucket.UNKNOWN.value)
        rows.append(
            RankRow(
                label=value_label(value),
                value=value,
                in_hand=in_hand,
                seen=seen,
                unknown=unknown,
                p_at_least_1=_hyper_at_least(unknown_total, unknown, opp_hand_guess, 1),
                p_pair=_hyper_at_least(unknown_total, unknown, opp_hand_guess, 2),
                p_bomb=_hyper_at_least(unknown_total, unknown, opp_hand_guess, 4) if value <= 15 else 0.0,
            )
        )
    return rows


def threat_summary(state: CardState) -> dict[str, int | str]:
    rows = {row.value: row for row in remaining_rows(state)}
    bomb_potential = sum(1 for row in rows.values() if row.value <= 15 and row.unknown >= 3)
    return {
        "unknown_2": rows[15].unknown,
        "unknown_A": rows[14].unknown,
        "unknown_sj": rows[16].unknown,
        "unknown_bj": rows[17].unknown,
        "unknown_jokers": rows[16].unknown + rows[17].unknown,
        "bomb_potential_ranks": bomb_potential,
        "unknown_total": len(state.get_remaining_unknown()),
        "note": "按未知牌在另外两家之间分配的加权统计，不是精确分布。",
    }


def leftover_shape(cards: list[Card]) -> dict[str, int]:
    counts: dict[int, int] = {}
    for card in cards:
        counts[card.value] = counts.get(card.value, 0) + 1
    bombs = triples = pairs = singles = 0
    for value, n in counts.items():
        if value >= 16:
            continue
        if n == 4:
            bombs += 1
        elif n == 3:
            triples += 1
        elif n == 2:
            pairs += 1
        elif n == 1:
            singles += 1
    jokers = counts.get(16, 0) + counts.get(17, 0)
    if counts.get(16, 0) and counts.get(17, 0):
        bombs += 1
    elif jokers == 1:
        singles += 1
    return {"bombs": bombs, "triples": triples, "pairs": pairs, "singles": singles, "n": len(cards)}
