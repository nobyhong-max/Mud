import assert from "node:assert/strict";
import { test } from "node:test";
import { CARD_BY_ID, DECK, cardsByIds } from "../js/cards.js";
import {
  PATTERN,
  beats,
  canBeat,
  cheapestBeat,
  classify,
  enumerateLegal,
  validateSelection,
} from "../js/rules.js";

function ids(...list) {
  return cardsByIds(list);
}

function ofRank(rank, n) {
  return DECK.filter((c) => c.rank === rank).slice(0, n);
}

test("一副牌恰好 54 张且 id 唯一", () => {
  assert.equal(DECK.length, 54);
  assert.equal(new Set(DECK.map((c) => c.id)).size, 54);
  assert.ok(CARD_BY_ID.JOX && CARD_BY_ID.JOY);
});

test("单张对子三张炸弹王炸", () => {
  assert.equal(classify(ofRank(8, 1)).type, PATTERN.SINGLE);
  assert.equal(classify(ofRank(8, 2)).type, PATTERN.PAIR);
  assert.equal(classify(ofRank(8, 3)).type, PATTERN.TRIPLE);
  assert.equal(classify(ofRank(8, 4)).type, PATTERN.BOMB);
  const rocket = classify(ids("JOX", "JOY"));
  assert.equal(rocket.type, PATTERN.ROCKET);
});

test("三带一与三带对", () => {
  const t1 = classify([...ofRank(7, 3), ...ofRank(4, 1)]);
  assert.equal(t1.type, PATTERN.TRIPLE_ONE);
  assert.equal(t1.rank, 7);
  const t2 = classify([...ofRank(7, 3), ...ofRank(4, 2)]);
  assert.equal(t2.type, PATTERN.TRIPLE_PAIR);
});

test("顺子不能含 2 或王，3 到 A 可以", () => {
  const ok = classify(ids("S3", "H4", "C5", "D6", "S7"));
  assert.equal(ok.type, PATTERN.STRAIGHT);
  assert.equal(ok.rank, 7);
  assert.equal(classify(ids("S10", "H11", "C12", "D13", "S14")).type, PATTERN.STRAIGHT);
  assert.equal(classify(ids("S3", "H4", "C5", "D6")), null);
  assert.equal(classify(ids("S14", "H15", "C3", "D4", "S5")), null);
  assert.equal(classify(ids("S10", "H11", "C12", "D13", "S14", "H15")), null);
  assert.equal(classify(ids("S3", "H4", "C5", "D6", "JOX")), null);
});

test("连对至少三对且不能含 2", () => {
  const ok = classify([...ofRank(3, 2), ...ofRank(4, 2), ...ofRank(5, 2)]);
  assert.equal(ok.type, PATTERN.PAIR_STRAIGHT);
  assert.equal(classify([...ofRank(3, 2), ...ofRank(4, 2)]), null);
  assert.equal(classify([...ofRank(13, 2), ...ofRank(14, 2), ...ofRank(15, 2)]), null);
});

test("飞机主体不能含 2", () => {
  const plane = classify([...ofRank(6, 3), ...ofRank(7, 3)]);
  assert.equal(plane.type, PATTERN.PLANE);
  assert.equal(classify([...ofRank(14, 3), ...ofRank(15, 3)]), null);
  const wing = classify([...ofRank(6, 3), ...ofRank(7, 3), ...ofRank(3, 1), ...ofRank(9, 1)]);
  assert.equal(wing.type, PATTERN.PLANE_SINGLE);
  const wp = classify([...ofRank(6, 3), ...ofRank(7, 3), ...ofRank(3, 2), ...ofRank(9, 2)]);
  assert.equal(wp.type, PATTERN.PLANE_PAIR);
});

test("四带二不是炸弹，且不能带两王", () => {
  const f2 = classify([...ofRank(9, 4), ...ofRank(3, 1), ...ofRank(5, 1)]);
  assert.equal(f2.type, PATTERN.FOUR_TWO_SINGLE);
  assert.notEqual(f2.type, PATTERN.BOMB);
  const pairWing = classify([...ofRank(9, 4), ...ofRank(3, 2)]);
  assert.equal(pairWing.type, PATTERN.FOUR_TWO_SINGLE);
  assert.equal(classify([...ofRank(9, 4), ...ids("JOX", "JOY")]), null);
  const f2p = classify([...ofRank(9, 4), ...ofRank(3, 2), ...ofRank(5, 2)]);
  assert.equal(f2p.type, PATTERN.FOUR_TWO_PAIR);
});

test("王炸 > 炸弹 > 四带二；四带二压不住异型普通牌", () => {
  const rocket = classify(ids("JOX", "JOY"));
  const bomb2 = classify(ofRank(15, 4));
  const bomb3 = classify(ofRank(3, 4));
  const fourTwo = classify([...ofRank(14, 4), ...ofRank(5, 1), ...ofRank(6, 1)]);
  const straight = classify(ids("S3", "H4", "C5", "D6", "S7"));
  assert.ok(beats(rocket, bomb2));
  assert.ok(beats(bomb2, bomb3));
  assert.ok(beats(bomb3, fourTwo));
  assert.ok(!beats(fourTwo, bomb3));
  assert.ok(!beats(fourTwo, straight));
  assert.ok(beats(classify(ids("S4", "H5", "C6", "D7", "S8")), straight));
});

test("同型同长度比点数", () => {
  const a = classify(ofRank(12, 2));
  const b = classify(ofRank(11, 2));
  assert.ok(beats(a, b));
  assert.ok(!beats(b, a));
});

test("校验器拒绝非法组合", () => {
  const bad = validateSelection(ids("S3", "H4", "C5", "D6"));
  assert.equal(bad.ok, false);
  const good = validateSelection(ids("S3", "H4", "C5", "D6", "S7"));
  assert.equal(good.ok, true);
});

test("枚举跟牌只给出能压过的合法牌", () => {
  const hand = [...ofRank(8, 2), ...ofRank(10, 2), ...ofRank(15, 4), ...ids("JOX", "JOY"), ...ofRank(3, 1)];
  const last = classify(ofRank(9, 2));
  const opts = enumerateLegal(hand, last);
  assert.ok(opts.every((p) => beats(p, last)));
  assert.ok(opts.some((p) => p.type === PATTERN.PAIR && p.rank === 10));
  assert.ok(opts.some((p) => p.type === PATTERN.BOMB));
  assert.ok(opts.some((p) => p.type === PATTERN.ROCKET));
  assert.ok(!opts.some((p) => p.type === PATTERN.PAIR && p.rank === 8));
});

test("最小跟牌不优先炸", () => {
  const hand = [...ofRank(10, 2), ...ofRank(15, 4)];
  const last = classify(ofRank(9, 2));
  const cheap = cheapestBeat(hand, last);
  assert.equal(cheap.type, PATTERN.PAIR);
  assert.equal(cheap.rank, 10);
});

test("canBeat 能识别更大对子和王炸", () => {
  const hand = [...ofRank(13, 2), ...ids("JOX", "JOY")];
  assert.ok(canBeat(hand, classify(ofRank(8, 2))));
  assert.ok(canBeat(hand, classify(ofRank(3, 4))));
  assert.ok(!canBeat(ofRank(5, 2), classify(ofRank(8, 2))));
});
