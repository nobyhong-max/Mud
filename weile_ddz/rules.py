"""
微乐经典无癞子牌型识别与比较。
顺子/连对/飞机主体不能含 2 和王；四带二不是炸弹；王炸最大。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

from weile_ddz.cards import (
    SEQUENCE_MAX,
    SEQUENCE_MIN,
    Card,
    format_ranks,
    rank_counts,
    sort_cards,
    value_label,
)

PATTERN_LABELS = {
    "single": "单张",
    "pair": "对子",
    "triple": "三张",
    "triple_one": "三带一",
    "triple_pair": "三带对",
    "straight": "顺子",
    "pair_straight": "连对",
    "plane": "飞机",
    "plane_single": "飞机带单",
    "plane_pair": "飞机带对",
    "four_two_single": "四带二",
    "four_two_pair": "四带两对",
    "bomb": "炸弹",
    "rocket": "王炸",
}


@dataclass
class Play:
    type: str
    rank: int
    cards: list[Card]
    chain: int = 1
    label: str = ""

    def __post_init__(self) -> None:
        self.cards = sort_cards(self.cards)
        if not self.label:
            self.label = PATTERN_LABELS.get(self.type, self.type)

    @property
    def length(self) -> int:
        return len(self.cards)

    def text(self) -> str:
        return f"{self.label} {format_ranks(self.cards)}"

    def signature(self) -> str:
        ranks = ",".join(str(card.value) for card in sort_cards(self.cards))
        return f"{self.type}:{ranks}"


def _groups(counts: dict[int, int]) -> list[tuple[int, int]]:
    return sorted((rank, n) for rank, n in counts.items() if n > 0)


def _consecutive(ranks: list[int]) -> bool:
    if not ranks:
        return False
    ordered = sorted(ranks)
    return all(ordered[i] == ordered[i - 1] + 1 for i in range(1, len(ordered)))


def _in_sequence_range(ranks: list[int]) -> bool:
    return all(SEQUENCE_MIN <= rank <= SEQUENCE_MAX for rank in ranks)


def _classify_plane(cards: list[Card], counts: dict[int, int], n: int) -> Play | None:
    max_k = n // 3
    for k in range(max_k, 1, -1):
        for start in range(SEQUENCE_MIN, SEQUENCE_MAX - k + 2):
            if any(counts.get(rank, 0) < 3 for rank in range(start, start + k)):
                continue
            remain = dict(counts)
            for rank in range(start, start + k):
                remain[rank] -= 3
            remain_n = sum(remain.values())
            high = start + k - 1
            if remain_n == 0:
                return Play("plane", high, cards, chain=k)
            if remain_n == k:
                return Play("plane_single", high, cards, chain=k)
            if remain_n == 2 * k:
                ok = True
                for rank, count in remain.items():
                    if count == 0:
                        continue
                    if rank >= 16 or count % 2 != 0:
                        ok = False
                        break
                if ok:
                    return Play("plane_pair", high, cards, chain=k)
    return None


def classify(cards: list[Card]) -> Play | None:
    if not cards:
        return None
    n = len(cards)
    counts = rank_counts(cards)
    groups = _groups(counts)
    jokers = counts.get(16, 0) + counts.get(17, 0)

    if n == 2 and counts.get(16, 0) == 1 and counts.get(17, 0) == 1:
        return Play("rocket", 17, cards)
    if n == 4 and len(groups) == 1 and groups[0][1] == 4:
        return Play("bomb", groups[0][0], cards)
    if n == 1:
        return Play("single", cards[0].value, cards)
    if n == 2 and len(groups) == 1 and groups[0][0] <= 15 and groups[0][1] == 2:
        return Play("pair", groups[0][0], cards)
    if n == 3 and len(groups) == 1 and groups[0][1] == 3:
        return Play("triple", groups[0][0], cards)
    if n == 4:
        triple = next((g for g in groups if g[1] == 3), None)
        single = next((g for g in groups if g[1] == 1), None)
        if triple and single:
            return Play("triple_one", triple[0], cards)
    if n == 5:
        triple = next((g for g in groups if g[1] == 3), None)
        pair = next((g for g in groups if g[1] == 2), None)
        if triple and pair and len(groups) == 2:
            return Play("triple_pair", triple[0], cards)

    plane = _classify_plane(cards, counts, n)
    if plane:
        return plane

    if n == 6:
        four = next((g for g in groups if g[1] == 4), None)
        if four:
            if jokers == 2:
                return None
            return Play("four_two_single", four[0], cards)
    if n == 8 and jokers == 0:
        fours = [g for g in groups if g[1] == 4]
        pairs = [g for g in groups if g[1] == 2]
        if len(fours) == 2:
            return Play("four_two_pair", max(fours[0][0], fours[1][0]), cards)
        if len(fours) == 1 and len(pairs) == 2:
            return Play("four_two_pair", fours[0][0], cards)

    ranks = [g[0] for g in groups]
    if (
        n >= 5
        and all(g[1] == 1 for g in groups)
        and _in_sequence_range(ranks)
        and _consecutive(ranks)
    ):
        return Play("straight", max(ranks), cards, chain=n)
    if (
        n >= 6
        and n % 2 == 0
        and all(g[1] == 2 for g in groups)
        and _in_sequence_range(ranks)
        and _consecutive(ranks)
        and len(groups) >= 3
    ):
        return Play("pair_straight", max(ranks), cards, chain=len(groups))
    return None


def is_valid_play(cards: list[Card]) -> tuple[bool, Play | None, str]:
    play = classify(cards)
    if not play:
        return False, None, "不是微乐经典无癞子的合法牌型（顺子/连对/飞机不能含2或王；四带二不能带两王）"
    return True, play, f"{play.label}，比较点 {value_label(play.rank)}"


def is_bomb_like(play: Play | None) -> bool:
    return bool(play and play.type in {"bomb", "rocket"})


def compare_play(play1: Play, play2: Play) -> int:
    """play1 相对 play2：1 压过，0 相同，-1 压不住。"""
    if play1.type == "rocket":
        return 0 if play2.type == "rocket" else 1
    if play2.type == "rocket":
        return -1
    if play1.type == "bomb" and play2.type != "bomb":
        return 1
    if play2.type == "bomb" and play1.type != "bomb":
        return -1
    if play1.type != play2.type or play1.length != play2.length:
        return -1
    if play1.rank > play2.rank:
        return 1
    if play1.rank < play2.rank:
        return -1
    return 0


def beats(new_play: Play, table: Play | None) -> bool:
    if table is None:
        return True
    return compare_play(new_play, table) > 0


def _count_array(cards: list[Card]) -> list[int]:
    counts = [0] * 18
    for card in cards:
        counts[card.value] += 1
    return counts


def _take(hand: list[Card], need: list[int]) -> list[Card] | None:
    used: list[Card] = []
    pool: dict[int, list[Card]] = {}
    for card in sort_cards(hand):
        pool.setdefault(card.value, []).append(card)
    for rank, n in enumerate(need):
        if n <= 0:
            continue
        available = pool.get(rank, [])
        if len(available) < n:
            return None
        used.extend(available[:n])
    return used


def enumerate_legal(hand: list[Card], last: Play | None = None) -> list[Play]:
    plays: list[Play] = []
    seen: set[str] = set()
    counts = _count_array(hand)

    def emit(need: list[int]) -> None:
        if any(need[r] > counts[r] for r in range(18)):
            return
        cards = _take(hand, need)
        if not cards:
            return
        play = classify(cards)
        if not play:
            return
        sig = play.signature()
        if sig in seen:
            return
        seen.add(sig)
        plays.append(play)

    singles = [r for r in range(3, 18) if counts[r] >= 1]
    pairs = [r for r in range(3, 16) if counts[r] >= 2]
    triples = [r for r in range(3, 16) if counts[r] >= 3]
    bombs = [r for r in range(3, 16) if counts[r] >= 4]

    if last is None or last.type == "single":
        for rank in singles:
            need = [0] * 18
            need[rank] = 1
            emit(need)
    if last is None or last.type == "pair":
        for rank in pairs:
            need = [0] * 18
            need[rank] = 2
            emit(need)
    if last is None or last.type == "triple":
        for rank in triples:
            need = [0] * 18
            need[rank] = 3
            emit(need)
    if last is None or last.type == "triple_one":
        for triple in triples:
            for single in singles:
                need = [0] * 18
                need[triple] = 3
                need[single] += 1
                emit(need)
    if last is None or last.type == "triple_pair":
        for triple in triples:
            for pair in pairs:
                if pair == triple:
                    continue
                need = [0] * 18
                need[triple] = 3
                need[pair] = 2
                emit(need)

    if last is None or last.type == "straight":
        min_len = last.length if last and last.type == "straight" else 5
        max_len = last.length if last and last.type == "straight" else 12
        for length in range(min_len, max_len + 1):
            for start in range(SEQUENCE_MIN, SEQUENCE_MAX - length + 2):
                need = [0] * 18
                if all(counts[r] >= 1 for r in range(start, start + length)):
                    for r in range(start, start + length):
                        need[r] = 1
                    emit(need)
    if last is None or last.type == "pair_straight":
        min_pairs = last.length // 2 if last and last.type == "pair_straight" else 3
        max_pairs = last.length // 2 if last and last.type == "pair_straight" else 10
        for length in range(min_pairs, max_pairs + 1):
            for start in range(SEQUENCE_MIN, SEQUENCE_MAX - length + 2):
                if all(counts[r] >= 2 for r in range(start, start + length)):
                    need = [0] * 18
                    for r in range(start, start + length):
                        need[r] = 2
                    emit(need)

    def emit_planes(want: str) -> None:
        if last is not None and last.type != want:
            return
        for k in range(2, 7):
            if last is not None and last.chain != k:
                continue
            for start in range(SEQUENCE_MIN, SEQUENCE_MAX - k + 2):
                if any(counts[r] < 3 for r in range(start, start + k)):
                    continue
                body = [0] * 18
                for r in range(start, start + k):
                    body[r] = 3
                if want == "plane":
                    emit(body)
                    continue
                if want == "plane_single":
                    remain: list[int] = []
                    for r in range(3, 18):
                        remain.extend([r] * (counts[r] - body[r]))
                    if len(remain) < k:
                        continue
                    for combo in combinations(range(len(remain)), k):
                        need = body[:]
                        for idx in combo:
                            need[remain[idx]] += 1
                        emit(need)
                if want == "plane_pair":
                    slots: list[int] = []
                    for r in range(3, 16):
                        left = counts[r] - body[r]
                        slots.extend([r] * (left // 2))
                    if len(slots) < k:
                        continue
                    for combo in combinations(range(len(slots)), k):
                        need = body[:]
                        for idx in combo:
                            need[slots[idx]] += 2
                        emit(need)

    emit_planes("plane")
    emit_planes("plane_single")
    emit_planes("plane_pair")

    if last is None or last.type == "four_two_single":
        for bomb in bombs:
            rest: list[int] = []
            for r in range(3, 18):
                left = counts[r] - (4 if r == bomb else 0)
                rest.extend([r] * max(0, left))
            if len(rest) < 2:
                continue
            for i, j in combinations(range(len(rest)), 2):
                x, y = rest[i], rest[j]
                if {x, y} == {16, 17}:
                    continue
                need = [0] * 18
                need[bomb] = 4
                need[x] += 1
                need[y] += 1
                emit(need)
    if last is None or last.type == "four_two_pair":
        for bomb in bombs:
            slots = []
            for r in range(3, 16):
                left = counts[r] - (4 if r == bomb else 0)
                slots.extend([r] * (left // 2))
            if len(slots) < 2:
                continue
            for i, j in combinations(range(len(slots)), 2):
                need = [0] * 18
                need[bomb] = 4
                need[slots[i]] += 2
                need[slots[j]] += 2
                emit(need)

    for bomb in bombs:
        need = [0] * 18
        need[bomb] = 4
        emit(need)
    if counts[16] and counts[17]:
        need = [0] * 18
        need[16] = 1
        need[17] = 1
        emit(need)

    filtered = [play for play in plays if beats(play, last)] if last else plays
    filtered.sort(key=lambda p: (is_bomb_like(p), -p.length, p.rank))
    return filtered


def subtract(hand: list[Card], played: list[Card]) -> list[Card]:
    used = {card.id for card in played}
    return [card for card in hand if card.id not in used]
