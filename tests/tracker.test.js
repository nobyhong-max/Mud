import assert from "node:assert/strict";
import { test } from "node:test";
import { DECK } from "../js/cards.js";
import { BUCKET, GameState, PLAYER, ROLE, loadExampleGame } from "../js/tracker.js";

test("初始全部未知，三组之和 54", () => {
  const s = new GameState();
  assert.equal(s.unknownCards().length, 54);
  assert.equal(s.myHand().length, 0);
  assert.deepEqual(s.summary(), { hand: 0, played: 0, unknown: 54, total: 54 });
  assert.ok(s.integrity().ok || s.integrity().issues.length <= 1);
});

test("录入手牌与已出后状态互斥", () => {
  const s = new GameState();
  s.setCardBucket("S3", BUCKET.HAND);
  s.setCardBucket("H3", BUCKET.PLAYED);
  assert.equal(s.bucket.S3, BUCKET.HAND);
  assert.equal(s.bucket.H3, BUCKET.PLAYED);
  assert.equal(s.unknownCards().length, 52);
  assert.equal(s.myHand().length + s.playedCards().length + s.unknownCards().length, 54);
});

test("我出牌必须来自手牌，且记入历史", () => {
  const s = new GameState();
  s.setCardBucket("S8", BUCKET.HAND);
  const bad = s.applyPlay(PLAYER.ME, ["H8"]);
  assert.equal(bad.ok, false);
  const ok = s.applyPlay(PLAYER.ME, ["S8"]);
  assert.equal(ok.ok, true);
  assert.equal(s.bucket.S8, BUCKET.PLAYED);
  assert.equal(s.history.at(-1).player, PLAYER.ME);
});

test("别人出牌从未知进入已出", () => {
  const s = new GameState();
  const r = s.applyPlay(PLAYER.NEXT, ["S3", "H3"]);
  assert.equal(r.ok, true);
  assert.equal(s.bucket.S3, BUCKET.PLAYED);
  assert.equal(s.lastNonPass().play.type, "pair");
});

test("示例牌局手牌 17 张且无重复", () => {
  const s = loadExampleGame();
  assert.equal(s.role, ROLE.FARMER);
  assert.equal(s.myHand().length, 17);
  const used = new Set();
  for (const card of DECK) {
    assert.ok(!used.has(card.id));
    used.add(card.id);
  }
  const ids = [...s.myHand(), ...s.playedCards(), ...s.unknownCards()].map((c) => c.id);
  assert.equal(new Set(ids).size, 54);
  assert.ok(s.lastNonPass());
  assert.equal(s.tablePlayForMe().type, "pair");
});
