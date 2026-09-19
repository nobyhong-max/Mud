"""
专家规则出牌评分：0–100，只给参考，不是真实胜率。
倾向：能脱手加分；不轻易拆炸弹/拆 2；农民少抢节奏；地主优先打通长牌。
"""

from __future__ import annotations

from dataclasses import dataclass

from weile_ddz.cards import Card
from weile_ddz.rules import Play, enumerate_legal, is_bomb_like, subtract
from weile_ddz.state import Role
from weile_ddz.stats import leftover_shape, threat_summary
from weile_ddz.state import CardState


@dataclass
class ScoredPlay:
    play: Play
    score: int
    reasons: list[str]
    priority: str


def _priority(score: int) -> str:
    if score >= 75:
        return "高"
    if score >= 50:
        return "中"
    return "低"


def _breaks_long_combo(hand: list[Card], play: Play) -> bool:
    remain = leftover_shape(subtract(hand, play.cards))
    before = leftover_shape(hand)
    return remain["singles"] >= before["singles"] + 2


def score_play(state: CardState, play: Play, last: Play | None, legal: list[Play]) -> ScoredPlay:
    hand = state.my_hand()
    reasons: list[str] = []
    if len(play.cards) == len(hand):
        return ScoredPlay(play, 100, ["能一次出完"], "高")

    remain = leftover_shape(subtract(hand, play.cards))
    score = 52

    if last is None:
        if play.length >= 5:
            score += 12
            reasons.append("领出长牌，减少手数")
        if play.type == "single" and play.rank <= 10:
            score += 4
            reasons.append("先甩小单")
        if state.role == Role.LANDLORD.value and play.type in {"straight", "pair_straight", "plane", "plane_single", "plane_pair"}:
            score += 8
            reasons.append("地主优先打通长顺/连对/飞机")
    else:
        normals = [item for item in legal if not is_bomb_like(item)]
        min_rank = min((item.rank for item in normals), default=play.rank)
        if not is_bomb_like(play) and play.rank == min_rank:
            score += 10
            reasons.append("最小跟牌，留住大牌")
        elif not is_bomb_like(play) and play.rank > min_rank + 2:
            score -= 7
            reasons.append("跟牌偏大")
        if state.role == Role.FARMER.value and play.rank >= 15 and last.rank <= 10 and not is_bomb_like(play):
            score -= 8
            reasons.append("农民不宜用大牌乱抢小牌节奏")

    if is_bomb_like(play) and len(hand) > 8:
        score -= 22
        reasons.append("中盘尽量不要随便拆炸弹/王炸")
    elif is_bomb_like(play) and len(hand) <= 6:
        score += 8
        reasons.append("牌不多时炸弹更适合收割")

    uses_two = any(card.value == 15 for card in play.cards)
    if uses_two and play.type in {"single", "pair"} and (last is None or last.rank <= 12) and len(hand) > 6:
        score -= 9
        reasons.append("非必要不拆 2")

    if remain["singles"] <= 1:
        score += 8
        reasons.append("出完后手牌更整，更容易脱手")
    elif remain["singles"] >= 4:
        score -= 6
        reasons.append("出完后散牌偏多")

    if _breaks_long_combo(hand, play):
        score -= 8
        reasons.append("可能拆散较长牌型")

    if len(subtract(hand, play.cards)) <= 2:
        score += 10
        reasons.append("接近出完")

    threat = threat_summary(state)
    if play.type == "single" and play.rank >= 16 and int(threat["unknown_jokers"]) == 0:
        score += 3
        reasons.append("外面王已明，控制牌更稳")

    only_normal = len([item for item in legal if not is_bomb_like(item)]) == 1 and not is_bomb_like(play)
    if only_normal:
        score = max(score, 40)
        reasons.insert(0, "当前几乎只有这一手普通跟牌")

    score = max(0, min(99, round(score)))
    return ScoredPlay(play, score, reasons[:3], _priority(score))


def recommend(state: CardState, top_n: int = 3) -> tuple[Play | None, list[ScoredPlay], bool]:
    last = None
    if state.last_play_ids:
        from weile_ddz.cards import cards_by_ids
        from weile_ddz.rules import classify

        last = classify(cards_by_ids(state.last_play_ids))
    legal = enumerate_legal(state.my_hand(), last)
    scored = [score_play(state, play, last, legal) for play in legal]
    scored.sort(key=lambda item: (-item.score, item.play.rank))
    return last, scored[:top_n], bool(last)
