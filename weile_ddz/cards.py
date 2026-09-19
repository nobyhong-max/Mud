"""54 张牌编码：S/H/C/D + 点数；SJ=小王，BJ=大王。例：S_A、H_2。"""

from __future__ import annotations

from dataclasses import dataclass

SUITS = (
    ("S", "♠", "黑桃", "black"),
    ("H", "♥", "红桃", "red"),
    ("C", "♣", "梅花", "black"),
    ("D", "♦", "方片", "red"),
)

RANK_LABELS = ("3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2")
RANK_VALUE = {label: index + 3 for index, label in enumerate(RANK_LABELS)}
RANK_VALUE["SJ"] = 16
RANK_VALUE["BJ"] = 17

SEQUENCE_MIN = 3
SEQUENCE_MAX = 14  # A
SEQUENCE_RANKS = {label for label, value in RANK_VALUE.items() if 3 <= value <= 14}

VALUE_LABEL = {value: label for label, value in RANK_VALUE.items()}
VALUE_LABEL[16] = "小王"
VALUE_LABEL[17] = "大王"


@dataclass(frozen=True)
class Card:
    id: str
    rank: str
    value: int
    suit: str | None
    symbol: str
    label: str
    name: str
    color: str
    is_joker: bool

    def display(self) -> str:
        if self.is_joker:
            return self.label
        return f"{self.symbol}{self.label}"


def _build_deck() -> list[Card]:
    cards: list[Card] = []
    for rank in RANK_LABELS:
        for suit, symbol, suit_name, color in SUITS:
            card_id = f"{suit}_{rank}"
            cards.append(
                Card(
                    id=card_id,
                    rank=rank,
                    value=RANK_VALUE[rank],
                    suit=suit,
                    symbol=symbol,
                    label=rank,
                    name=f"{suit_name}{rank}",
                    color=color,
                    is_joker=False,
                )
            )
    cards.append(
        Card("SJ", "SJ", 16, None, "☆", "小王", "小王", "joker-s", True)
    )
    cards.append(
        Card("BJ", "BJ", 17, None, "★", "大王", "大王", "joker-b", True)
    )
    return cards


DECK = _build_deck()
CARD_BY_ID = {card.id: card for card in DECK}
ALL_IDS = [card.id for card in DECK]


def cards_by_ids(ids: list[str]) -> list[Card]:
    return [CARD_BY_ID[card_id] for card_id in ids]


def sort_cards(cards: list[Card]) -> list[Card]:
    return sorted(cards, key=lambda card: (card.value, card.suit or "Z"))


def format_cards(cards: list[Card]) -> str:
    return " ".join(card.display() for card in sort_cards(cards))


def format_ranks(cards: list[Card]) -> str:
    return " ".join(card.label for card in sort_cards(cards))


def rank_counts(cards: list[Card]) -> dict[int, int]:
    counts: dict[int, int] = {}
    for card in cards:
        counts[card.value] = counts.get(card.value, 0) + 1
    return counts


def value_label(value: int) -> str:
    return VALUE_LABEL.get(value, str(value))
