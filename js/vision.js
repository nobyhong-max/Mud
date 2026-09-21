/**
 * YOLO / 图像识别预留接口。
 *
 * 本版只接受「已经识别好的结构化结果」，不读游戏内存、
 * 不挂钩微乐进程、不自动截屏、不自动点击。
 *
 * 未来接入方式：
 * 1. 独立 YOLO 模块输出 JSON（见 VISION_SCHEMA）
 * 2. 调用 window.__WEILE_VISION_BRIDGE__.applyDetections(payload)
 * 3. 或调用 ingestVisionPayload(state, payload)
 */
import { CARD_BY_ID, DECK } from "./cards.js";
import { BUCKET } from "./tracker.js";

export const VISION_SCHEMA_VERSION = 1;

export const VISION_SCHEMA = {
  schemaVersion: VISION_SCHEMA_VERSION,
  source: "yolo",
  threshold: 0.5,
  detections: [
    {
      label: "S3",
      confidence: 0.92,
      location: "hand",
      bbox: [0, 0, 0, 0],
    },
  ],
};

const LOCATION_TO_BUCKET = {
  hand: BUCKET.HAND,
  mine: BUCKET.HAND,
  my_hand: BUCKET.HAND,
  played: BUCKET.PLAYED,
  discarded: BUCKET.PLAYED,
  table: BUCKET.PLAYED,
  unknown: BUCKET.UNKNOWN,
  opponent: BUCKET.UNKNOWN,
  bottom: BUCKET.UNKNOWN,
  landlord_bottom: BUCKET.UNKNOWN,
};

function buildAliasMap() {
  const map = {};
  for (const card of DECK) {
    map[card.id] = card.id;
    map[card.id.toLowerCase()] = card.id;
    map[card.name] = card.id;
    if (!card.isJoker) {
      map[`${card.suit}${card.label}`] = card.id;
      map[`${card.suit.toLowerCase()}${card.label}`] = card.id;
      map[`${card.suit.toLowerCase()}${card.rank}`] = card.id;
      map[`${card.symbol}${card.label}`] = card.id;
      map[`${card.label}${card.suit}`] = card.id;
    }
  }
  const extras = {
    joker_small: "JOX",
    joker_big: "JOY",
    small_joker: "JOX",
    big_joker: "JOY",
    joker_s: "JOX",
    joker_b: "JOY",
    jox: "JOX",
    joy: "JOY",
    小王: "JOX",
    大王: "JOY",
    black_joker: "JOX",
    red_joker: "JOY",
    "joker-small": "JOX",
    "joker-big": "JOY",
  };
  Object.assign(map, extras);
  return map;
}

export const YOLO_LABEL_ALIASES = buildAliasMap();

export function resolveVisionLabel(label) {
  if (!label) return null;
  const raw = String(label).trim();
  if (CARD_BY_ID[raw]) return raw;
  const key = raw.replace(/\s+/g, "");
  return YOLO_LABEL_ALIASES[key] || YOLO_LABEL_ALIASES[key.toLowerCase()] || null;
}

export function parseVisionPayload(payload, threshold = 0.5) {
  if (!payload || typeof payload !== "object") {
    throw new Error("识别结果必须是对象");
  }
  const detections = payload.detections || payload.cards || [];
  if (!Array.isArray(detections)) {
    throw new Error("识别列表必须是数组");
  }
  const cut = payload.threshold ?? threshold;
  const accepted = [];
  const skipped = [];
  for (const item of detections) {
    const id = resolveVisionLabel(item.label || item.class || item.name);
    const confidence = item.confidence ?? item.score ?? 1;
    const location = String(item.location || item.bucket || "unknown").toLowerCase();
    const bucket = LOCATION_TO_BUCKET[location];
    if (!id) {
      skipped.push({ ...item, reason: "无法映射牌面" });
      continue;
    }
    if (!bucket) {
      skipped.push({ ...item, reason: `未知位置 ${location}` });
      continue;
    }
    if (confidence < cut) {
      skipped.push({ ...item, reason: `置信度 ${confidence} 低于阈值` });
      continue;
    }
    accepted.push({
      id,
      bucket,
      confidence,
      location,
      bbox: item.bbox || null,
    });
  }
  return {
    schemaVersion: payload.schemaVersion ?? VISION_SCHEMA_VERSION,
    source: payload.source || "yolo",
    accepted,
    skipped,
  };
}

/**
 * 把识别结果合并进记牌状态。
 * 同一张牌多次出现时：手牌优先于已出，已出优先于未知。
 */
export function ingestVisionPayload(state, payload, options = {}) {
  const parsed = parseVisionPayload(payload, options.threshold ?? 0.5);
  const priority = { [BUCKET.HAND]: 3, [BUCKET.PLAYED]: 2, [BUCKET.UNKNOWN]: 1 };
  const best = new Map();
  for (const hit of parsed.accepted) {
    const prev = best.get(hit.id);
    if (!prev || priority[hit.bucket] > priority[prev.bucket] || hit.confidence > prev.confidence) {
      best.set(hit.id, hit);
    }
  }
  const applied = [];
  for (const [id, hit] of best.entries()) {
    state.setCardBucket(id, hit.bucket);
    applied.push(hit);
  }
  const bottoms = parsed.accepted.filter((h) => h.location === "bottom" || h.location === "landlord_bottom");
  if (bottoms.length) {
    state.markBottom(bottoms.map((h) => h.id));
  }
  return {
    ...parsed,
    applied,
    message: `已合并 ${applied.length} 张识别牌面，跳过 ${parsed.skipped.length} 条`,
  };
}

export async function recognizeImage(_fileOrUrl) {
  throw new Error("图像识别模块尚未接入。请手动点选记牌，或导入识别结果文件。");
}

export function createVisionBridge(getState) {
  return {
    schemaVersion: VISION_SCHEMA_VERSION,
    schema: VISION_SCHEMA,
    recognizeImage,
    applyDetections(payload) {
      return ingestVisionPayload(getState(), payload);
    },
    parse: parseVisionPayload,
  };
}
