import unittest

from weile_ddz.cards import CARD_BY_ID, DECK, cards_by_ids
from weile_ddz.rules import beats, classify, enumerate_legal, is_valid_play
from weile_ddz.scorer import recommend
from weile_ddz.state import Bucket, CardState, load_example
from weile_ddz.vision import recognize_image, VisionNotConnected, ingest_detections


def of_rank(rank: str, n: int):
    return [card for card in DECK if card.rank == rank][:n]


class RulesTest(unittest.TestCase):
    def test_deck_54(self):
        self.assertEqual(len(DECK), 54)
        self.assertIn("S_A", CARD_BY_ID)
        self.assertIn("H_2", CARD_BY_ID)
        self.assertIn("SJ", CARD_BY_ID)
        self.assertIn("BJ", CARD_BY_ID)

    def test_basic_patterns(self):
        self.assertEqual(classify(of_rank("8", 1)).type, "single")
        self.assertEqual(classify(of_rank("8", 2)).type, "pair")
        self.assertEqual(classify(of_rank("8", 3)).type, "triple")
        self.assertEqual(classify(of_rank("8", 4)).type, "bomb")
        self.assertEqual(classify(cards_by_ids(["SJ", "BJ"])).type, "rocket")

    def test_straight_no_two_no_joker(self):
        ok = classify(cards_by_ids(["S_3", "H_4", "C_5", "D_6", "S_7"]))
        self.assertEqual(ok.type, "straight")
        self.assertIsNone(classify(cards_by_ids(["S_3", "H_4", "C_5", "D_6"])))
        self.assertIsNone(classify(cards_by_ids(["S_10", "H_J", "C_Q", "D_K", "S_A", "H_2"])))
        self.assertIsNone(classify(cards_by_ids(["S_3", "H_4", "C_5", "D_6", "SJ"])))

    def test_pair_straight_and_plane(self):
        self.assertEqual(classify(of_rank("3", 2) + of_rank("4", 2) + of_rank("5", 2)).type, "pair_straight")
        self.assertIsNone(classify(of_rank("K", 2) + of_rank("A", 2) + of_rank("2", 2)))
        self.assertEqual(classify(of_rank("6", 3) + of_rank("7", 3)).type, "plane")
        self.assertIsNone(classify(of_rank("A", 3) + of_rank("2", 3)))

    def test_four_two_is_not_bomb(self):
        play = classify(of_rank("9", 4) + of_rank("3", 1) + of_rank("5", 1))
        self.assertEqual(play.type, "four_two_single")
        self.assertIsNone(classify(of_rank("9", 4) + cards_by_ids(["SJ", "BJ"])))
        rocket = classify(cards_by_ids(["SJ", "BJ"]))
        bomb = classify(of_rank("2", 4))
        self.assertTrue(beats(rocket, bomb))
        self.assertTrue(beats(bomb, play))
        self.assertFalse(beats(play, bomb))

    def test_follow_pair(self):
        hand = of_rank("8", 2) + of_rank("10", 2) + of_rank("2", 4) + cards_by_ids(["SJ", "BJ"])
        last = classify(of_rank("9", 2))
        opts = enumerate_legal(hand, last)
        self.assertTrue(all(beats(p, last) for p in opts))
        self.assertTrue(any(p.type == "pair" and p.rank == 10 for p in opts))
        self.assertFalse(any(p.type == "pair" and p.rank == 8 for p in opts))

    def test_invalid_message(self):
        ok, play, msg = is_valid_play(cards_by_ids(["S_3", "H_4", "C_5", "D_6"]))
        self.assertFalse(ok)
        self.assertIsNone(play)
        self.assertIn("2", msg)


class StateScorerTest(unittest.TestCase):
    def test_example_top3(self):
        state = load_example()
        self.assertEqual(len(state.my_hand()), 17)
        last, top, following = recommend(state, top_n=3)
        self.assertTrue(following)
        self.assertEqual(last.type, "pair")
        self.assertGreaterEqual(len(top), 1)
        self.assertTrue(any(item.play.type == "pair" and item.play.rank == 6 for item in top))
        self.assertLessEqual(len(top), 3)
        self.assertTrue(all(0 <= item.score <= 100 for item in top))
        pair6 = next(item for item in top if item.play.type == "pair" and item.play.rank == 6)
        state.play_from_hand([card.id for card in pair6.play.cards])
        last2, top2, following2 = recommend(state, top_n=3)
        self.assertFalse(following2)
        self.assertIsNone(last2)
        self.assertGreaterEqual(len(top2), 1)

    def test_undo_and_seen(self):
        state = CardState()
        state.set_my_hand(["S_3", "H_3"])
        state.add_seen(["C_3"], as_last_play=True)
        self.assertEqual(state.bucket["S_3"], Bucket.IN_HAND.value)
        self.assertEqual(state.bucket["C_3"], Bucket.SEEN.value)
        state.undo()
        self.assertEqual(state.bucket["C_3"], Bucket.UNKNOWN.value)

    def test_vision_stub(self):
        state = CardState()
        result = ingest_detections(
            state,
            {"detections": [{"label": "S_3", "confidence": 0.9, "location": "hand"}]},
        )
        self.assertEqual(state.bucket["S_3"], Bucket.IN_HAND.value)
        self.assertEqual(len(result["applied"]), 1)
        with self.assertRaises(VisionNotConnected):
            recognize_image(b"")


if __name__ == "__main__":
    unittest.main()
