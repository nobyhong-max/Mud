import assert from "node:assert/strict";
import { test } from "node:test";
import { GameState } from "../js/tracker.js";
import { ingestVisionPayload, parseVisionPayload, recognizeImage, resolveVisionLabel } from "../js/vision.js";

test("YOLO 标签别名能解析花色与王牌", () => {
  assert.equal(resolveVisionLabel("S3"), "S3");
  assert.equal(resolveVisionLabel("♠3"), "S3");
  assert.equal(resolveVisionLabel("小王"), "JOX");
  assert.equal(resolveVisionLabel("joker_big"), "JOY");
});

test("低置信度检测会被跳过", () => {
  const parsed = parseVisionPayload(
    {
      detections: [
        { label: "S3", confidence: 0.9, location: "hand" },
        { label: "H10", confidence: 0.2, location: "hand" },
      ],
    },
    0.5,
  );
  assert.equal(parsed.accepted.length, 1);
  assert.equal(parsed.skipped.length, 1);
});

test("导入识别 JSON 只改记牌状态", () => {
  const state = new GameState();
  const result = ingestVisionPayload(state, {
    detections: [
      { label: "S3", confidence: 0.96, location: "hand" },
      { label: "D3", confidence: 0.88, location: "played" },
    ],
  });
  assert.equal(state.bucket.S3, "hand");
  assert.equal(state.bucket.D3, "played");
  assert.equal(result.applied.length, 2);
});

test("recognizeImage 明确未接入，而不是去读游戏", async () => {
  await assert.rejects(() => recognizeImage("table.png"), /尚未接入/);
});
