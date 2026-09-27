#!/usr/bin/env python3
"""Timed probe / fetch harness for 足球·今日 (interval 1–120s).

Until platform APIs are reachable, this records connectivity samples.
When endpoints are known, fill SOURCE_ENDPOINTS and compare payloads.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

MIN_INTERVAL = 1
MAX_INTERVAL = 120

# Placeholder map — replace paths once logged-in sports APIs are known.
SOURCE_ENDPOINTS: dict[str, str] = {
    "乐古体育": "/api/sports/football/today",
    "FB体育": "/api/sports/football/today",
    "利记体育": "/api/sports/football/today",
}


def clamp_interval(seconds: float) -> float:
    return max(MIN_INTERVAL, min(MAX_INTERVAL, seconds))


def _header_map(headers) -> dict[str, str]:
    if headers is None:
        return {}
    out: dict[str, str] = {}
    for key in ("cf-ray", "server", "content-type", "cf-mitigated"):
        val = headers.get(key)
        if val:
            out[key] = val
    return out


def fetch(url: str, cookie: str | None, timeout: float = 20.0) -> dict:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json,text/html,*/*",
    }
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(url, headers=headers, method="GET")
    started = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(65536)
            return {
                "ok": True,
                "status": resp.status,
                "elapsed_ms": int((time.time() - started) * 1000),
                "url": url,
                "bytes": len(body),
                "preview": body[:240].decode("utf-8", errors="replace"),
                "headers": _header_map(resp.headers),
            }
    except urllib.error.HTTPError as e:
        body = e.read(2048) if e.fp else b""
        return {
            "ok": False,
            "status": e.code,
            "elapsed_ms": int((time.time() - started) * 1000),
            "url": url,
            "bytes": len(body),
            "preview": body[:240].decode("utf-8", errors="replace"),
            "headers": _header_map(e.headers),
            "error": str(e),
        }
    except Exception as e:  # noqa: BLE001 — harness should never crash a round
        return {
            "ok": False,
            "status": None,
            "elapsed_ms": int((time.time() - started) * 1000),
            "url": url,
            "bytes": 0,
            "preview": "",
            "headers": {},
            "error": f"{type(e).__name__}: {e}",
        }


def main() -> int:
    p = argparse.ArgumentParser(description="Timed 足球·今日 fetch harness")
    p.add_argument("--base", default=os.environ.get("LOKGU_BASE_URL", "https://lokgujd2t.com"))
    p.add_argument("--cookie", default=os.environ.get("LOKGU_COOKIE", ""))
    p.add_argument(
        "--sources",
        default=os.environ.get("LOKGU_SOURCES", ",".join(SOURCE_ENDPOINTS)),
        help="Comma-separated source names",
    )
    p.add_argument(
        "--interval",
        type=float,
        default=float(os.environ.get("LOKGU_INTERVAL", "30")),
        help="Seconds between rounds (clamped to 1–120)",
    )
    p.add_argument("--rounds", type=int, default=3, help="How many poll rounds")
    p.add_argument("--timeout", type=float, default=20.0, help="Per-request timeout seconds")
    p.add_argument("--out", type=Path, default=Path("./samples"))
    args = p.parse_args()

    interval = clamp_interval(args.interval)
    sources = [s.strip() for s in args.sources.split(",") if s.strip()]
    args.out.mkdir(parents=True, exist_ok=True)
    timeout = max(1.0, float(args.timeout))

    print(
        f"base={args.base} interval={interval}s rounds={args.rounds} "
        f"timeout={timeout}s sources={sources} cookie={'set' if args.cookie else 'none'}",
        flush=True,
    )

    all_rounds: list[dict] = []
    for i in range(1, args.rounds + 1):
        ts = datetime.now(timezone.utc).isoformat()
        round_result = {"round": i, "ts": ts, "sources": {}}
        print(f"\n=== round {i}/{args.rounds} @ {ts} ===", flush=True)
        for name in sources:
            path = SOURCE_ENDPOINTS.get(name, "/")
            url = args.base.rstrip("/") + path
            # Also always hit base for CF/connectivity signal
            result = fetch(url, args.cookie or None, timeout=timeout)
            # If placeholder path 404s, still probe base root
            if result.get("status") in (404, None) and path != "/":
                root = fetch(args.base.rstrip("/") + "/", args.cookie or None, timeout=timeout)
                result["root_probe"] = root
            round_result["sources"][name] = result
            status = result.get("status")
            err = result.get("error", "")
            print(f"  [{name}] status={status} {err or result.get('preview','')[:80]!r}", flush=True)
        all_rounds.append(round_result)
        out_file = args.out / f"round-{i:02d}.json"
        out_file.write_text(json.dumps(round_result, ensure_ascii=False, indent=2), encoding="utf-8")
        if i < args.rounds:
            time.sleep(interval)

    summary = args.out / "summary.json"
    summary.write_text(json.dumps(all_rounds, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {summary}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
