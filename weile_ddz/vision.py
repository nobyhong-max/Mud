"""
YOLO / 截图识别预留接口。

本版不跑模型、不抓屏、不控制外部程序。
未来若接入：用户主动上传图片 → 识别牌名 → 回填 CardState，并必须人工修正。
微乐是游戏渲染牌面，公开实体扑克权重通常不适用，需要自己标注微调。
"""

from __future__ import annotations

import re
from typing import Any

from weile_ddz.cards import CARD_BY_ID
from weile_ddz.state import Bucket, CardState

SCHEMA_VERSION = 1

LOCATION_TO_BUCKET = {
    "hand": Bucket.IN_HAND,
    "in_hand": Bucket.IN_HAND,
    "seen": Bucket.SEEN,
    "played": Bucket.SEEN,
    "unknown": Bucket.UNKNOWN,
}


class VisionNotConnected(RuntimeError):
    pass


def resolve_label(label: str) -> str | None:
    raw = (label or "").strip()
    if raw in CARD_BY_ID:
        return raw
    aliases = {
        "小王": "SJ",
        "大王": "BJ",
        "joker_small": "SJ",
        "joker_big": "BJ",
        "JOX": "SJ",
        "JOY": "BJ",
        "SJ": "SJ",
        "BJ": "BJ",
    }
    if raw in aliases:
        return aliases[raw]
    compact = raw.replace(" ", "")
    if compact in CARD_BY_ID:
        return compact
    match = re.fullmatch(r"([SHCD])_?([0-9]{1,2}|A|J|Q|K)", compact, flags=re.I)
    if match:
        suit = match.group(1).upper()
        rank = match.group(2).upper()
        if rank == "1":
            return None
        if rank == "11":
            rank = "J"
        if rank == "12":
            rank = "Q"
        if rank == "13":
            rank = "K"
        if rank == "14":
            rank = "A"
        if rank == "15":
            rank = "2"
        card_id = f"{suit}_{rank}"
        if card_id in CARD_BY_ID:
            return card_id
    return None


def ingest_detections(state: CardState, payload: dict[str, Any], threshold: float = 0.5) -> dict[str, Any]:
    detections = payload.get("detections") or payload.get("cards") or []
    applied = []
    skipped = []
    for item in detections:
        card_id = resolve_label(item.get("label") or item.get("class") or "")
        conf = float(item.get("confidence", item.get("score", 1)))
        loc = str(item.get("location", "unknown")).lower()
        bucket = LOCATION_TO_BUCKET.get(loc)
        if not card_id:
            skipped.append({**item, "reason": "无法映射牌面"})
            continue
        if bucket is None:
            skipped.append({**item, "reason": f"未知位置 {loc}"})
            continue
        if conf < threshold:
            skipped.append({**item, "reason": "置信度过低"})
            continue
        state.set_card(card_id, bucket, record_undo=False)
        applied.append({"id": card_id, "bucket": bucket.value, "confidence": conf})
    return {"applied": applied, "skipped": skipped, "message": f"已合并 {len(applied)} 张，跳过 {len(skipped)} 条"}


def recognize_image(_image_bytes: bytes) -> dict[str, Any]:
    raise VisionNotConnected(
        "YOLO 尚未接入。请继续手动点选；若以后上传截图识别，也必须人工核对结果。"
    )
