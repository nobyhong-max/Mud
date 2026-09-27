import assert from "node:assert/strict";
import { test } from "node:test";
import { beats } from "../js/rules.js";
import { remainingDistribution, suggestPlays } from "../js/suggest.js";
import { BUCKET, GameState, loadExampleGame } from "../js/tracker.js";

test("一次出完的选项评分为 100、胜率 1", () => {
  const s = new GameState();
  s.setCardBucket("S8", BUCKET.HAND);
  const out = suggestPlays(s, { samples: 20, seed: 1 });
  assert.equal(out.leading, true);
  const single = out.options.find((o) => o.play.cards.length === 1);
  assert.ok(single);
  assert.equal(single.score, 100);
  assert.equal(single.winRate, 1);
});

test("跟对子时建议都是合法且可压过", () => {
  const s = loadExampleGame();
  const out = suggestPlays(s, { samples: 24, seed: 7 });
  assert.equal(out.leading, false);
  assert.ok(out.options.length >= 1);
  assert.ok(out.options.every((o) => beats(o.play, out.lastPlay)));
  assert.ok(out.options.some((o) => o.play.type === "pair" && o.play.rank === 6));
});

test("剩余分布行数覆盖全部点数", () => {
  const rows = remainingDistribution(new GameState());
  assert.equal(rows.length, 15);
  const threes = rows.find((r) => r.label === "3");
  assert.equal(threes.unknown, 4);
});
