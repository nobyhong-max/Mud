import type { AnalyticsEventName } from "@half-island/shared";
import { getDb } from "../db/client.js";
import { id } from "../lib/ids.js";

export function trackEvent(
  name: AnalyticsEventName,
  opts: {
    pairId?: string | null;
    userId?: string | null;
    platform?: string;
    payload?: Record<string, unknown>;
  } = {},
): void {
  getDb()
    .prepare(
      `INSERT INTO events (id, name, pair_id, user_id, platform, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id("evt"),
      name,
      opts.pairId ?? null,
      opts.userId ?? null,
      opts.platform ?? "h5",
      opts.payload ? JSON.stringify(opts.payload) : null,
      new Date().toISOString(),
    );
}
