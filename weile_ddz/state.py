"""三种牌状态：in_hand / seen / unknown。支持撤销与重置。"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from enum import Enum

from weile_ddz.cards import ALL_IDS, CARD_BY_ID, DECK, Card, cards_by_ids, sort_cards


class Bucket(str, Enum):
    IN_HAND = "in_hand"
    SEEN = "seen"
    UNKNOWN = "unknown"


class Role(str, Enum):
    LANDLORD = "landlord"
    FARMER = "farmer"


@dataclass
class Snapshot:
    bucket: dict[str, str]
    last_play_ids: list[str]
    role: str
    call_score: int
    my_double: bool
    opp_double: bool
    note: str


@dataclass
class CardState:
    bucket: dict[str, str] = field(default_factory=lambda: {card_id: Bucket.UNKNOWN.value for card_id in ALL_IDS})
    last_play_ids: list[str] = field(default_factory=list)
    role: str = Role.FARMER.value
    call_score: int = 1
    my_double: bool = False
    opp_double: bool = False
    _undo: list[Snapshot] = field(default_factory=list)

    def _push_undo(self, note: str) -> None:
        self._undo.append(
            Snapshot(
                bucket=dict(self.bucket),
                last_play_ids=list(self.last_play_ids),
                role=self.role,
                call_score=self.call_score,
                my_double=self.my_double,
                opp_double=self.opp_double,
                note=note,
            )
        )
        if len(self._undo) > 80:
            self._undo.pop(0)

    def reset(self) -> None:
        self.bucket = {card_id: Bucket.UNKNOWN.value for card_id in ALL_IDS}
        self.last_play_ids = []
        self.role = Role.FARMER.value
        self.call_score = 1
        self.my_double = False
        self.opp_double = False
        self._undo.clear()

    def undo(self) -> str | None:
        if not self._undo:
            return None
        snap = self._undo.pop()
        self.bucket = snap.bucket
        self.last_play_ids = snap.last_play_ids
        self.role = snap.role
        self.call_score = snap.call_score
        self.my_double = snap.my_double
        self.opp_double = snap.opp_double
        return snap.note

    def set_card(self, card_id: str, bucket: Bucket, record_undo: bool = True) -> None:
        if card_id not in CARD_BY_ID:
            raise KeyError(f"未知牌编码: {card_id}")
        if record_undo:
            self._push_undo(f"把 {card_id} 记为 {bucket.value}")
        self.bucket[card_id] = bucket.value

    def set_my_hand(self, card_ids: list[str]) -> None:
        self._push_undo("设置手牌")
        for card_id in card_ids:
            if self.bucket[card_id] == Bucket.SEEN.value:
                continue
            self.bucket[card_id] = Bucket.IN_HAND.value

    def add_seen(self, card_ids: list[str], as_last_play: bool = False) -> None:
        self._push_undo("标记已出")
        for card_id in card_ids:
            if self.bucket.get(card_id) == Bucket.IN_HAND.value and not as_last_play:
                # 别人出的牌不能是我的手牌；我自己出时由 play_from_hand 处理
                if card_id not in self.cards(Bucket.IN_HAND):
                    pass
            self.bucket[card_id] = Bucket.SEEN.value
        if as_last_play:
            self.last_play_ids = list(card_ids)

    def play_from_hand(self, card_ids: list[str]) -> None:
        self._push_undo("从手牌打出")
        for card_id in card_ids:
            if self.bucket[card_id] != Bucket.IN_HAND.value:
                raise ValueError(f"{card_id} 不在手牌里")
            self.bucket[card_id] = Bucket.SEEN.value
        self.last_play_ids = list(card_ids)

    def set_last_play(self, card_ids: list[str]) -> None:
        self._push_undo("设置上家牌")
        self.last_play_ids = list(card_ids)
        for card_id in card_ids:
            if self.bucket[card_id] == Bucket.IN_HAND.value:
                continue
            self.bucket[card_id] = Bucket.SEEN.value

    def clear_last_play(self) -> None:
        self._push_undo("清空上家牌")
        self.last_play_ids = []

    def cards(self, bucket: Bucket) -> list[Card]:
        return sort_cards([card for card in DECK if self.bucket[card.id] == bucket.value])

    def get_remaining_unknown(self) -> list[Card]:
        return self.cards(Bucket.UNKNOWN)

    def my_hand(self) -> list[Card]:
        return self.cards(Bucket.IN_HAND)

    def seen_cards(self) -> list[Card]:
        return self.cards(Bucket.SEEN)

    def counts(self) -> dict[str, int]:
        return {
            "in_hand": len(self.my_hand()),
            "seen": len(self.seen_cards()),
            "unknown": len(self.get_remaining_unknown()),
            "total": 54,
        }

    def expected_hand(self) -> int:
        return 20 if self.role == Role.LANDLORD.value else 17

    def multiplier(self) -> int:
        value = max(1, int(self.call_score))
        if self.my_double:
            value *= 2
        if self.opp_double:
            value *= 2
        return value

    def clone(self) -> CardState:
        return copy.deepcopy(self)


def load_example() -> CardState:
    """一副可演示的中盘：农民、上家对5，手里有对6。"""
    state = CardState()
    state.role = Role.FARMER.value
    hand = [
        "S_3", "H_3", "C_4", "D_5", "S_6", "H_6", "C_6", "D_7",
        "S_8", "H_9", "C_10", "D_J", "S_Q", "H_K", "C_A", "S_2", "SJ",
    ]
    seen = [
        "D_3", "C_3", "S_4", "H_4", "D_4", "S_5",
        "S_7", "H_7", "C_7", "S_9", "C_9", "D_9", "H_10",
        "H_8", "C_8", "D_8", "H_5", "C_5",
    ]
    for card_id in hand:
        state.bucket[card_id] = Bucket.IN_HAND.value
    for card_id in seen:
        state.bucket[card_id] = Bucket.SEEN.value
    state.last_play_ids = ["H_5", "C_5"]
    state.call_score = 2
    return state


def cards_by_ids_safe(ids: list[str]) -> list[Card]:
    return cards_by_ids(ids)
