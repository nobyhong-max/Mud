import type {
  NotifyEvent,
  NotifyEventKind,
  RelationshipType,
  WxSubscribeTemplateIds,
} from "@half-island/shared";
import { NOTIFY_TEMPLATES } from "@half-island/shared";
import { getDb } from "../db/client.js";
import { id, shanghaiDateKey } from "../lib/ids.js";
import { trackEvent } from "./events.js";

/** 与 nudge 分离的触达日限（每用户每 kind） */
export const NOTIFY_KIND_DAILY_LIMIT = 2;

export function wxSubscribeTemplateIds(): WxSubscribeTemplateIds {
  return {
    daily_ready: process.env.WX_SUBSCRIBE_DAILY_READY || null,
    partner_answered: process.env.WX_SUBSCRIBE_PARTNER_ANSWERED || null,
    streak_risk: process.env.WX_SUBSCRIBE_STREAK_RISK || null,
  };
}

function templateFor(
  kind: NotifyEventKind,
  relationshipType: RelationshipType,
): { title: string; titleEn: string; body: string; bodyEn: string } {
  const row = NOTIFY_TEMPLATES.find((t) => t.kind === kind)!;
  return relationshipType === "friends" ? row.friends : row.couple;
}

export function mapNotify(row: Record<string, unknown>): NotifyEvent {
  return {
    id: String(row.id),
    kind: row.kind as NotifyEventKind,
    pairId: String(row.pair_id),
    userId: String(row.user_id),
    title: String(row.title),
    titleEn: String(row.title_en),
    body: String(row.body),
    bodyEn: String(row.body_en),
    status: row.status as NotifyEvent["status"],
    payload: row.payload_json
      ? (JSON.parse(String(row.payload_json)) as Record<string, unknown>)
      : null,
    createdAt: String(row.created_at),
  };
}

/**
 * 写入可触达记录。同 pair+user+kind+date 限频，且不与 nudge 共用计数。
 * 不做真实微信推送。
 */
export function enqueueNotify(opts: {
  kind: NotifyEventKind;
  pairId: string;
  userId: string;
  relationshipType: RelationshipType;
  payload?: Record<string, unknown>;
}): NotifyEvent | { skipped: "limit" | "self" } {
  const db = getDb();
  const dateKey = shanghaiDateKey();
  const used = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM notifications
         WHERE pair_id = ? AND user_id = ? AND kind = ? AND date_key = ?`,
      )
      .get(opts.pairId, opts.userId, opts.kind, dateKey) as { c: number }
  ).c;

  if (used >= NOTIFY_KIND_DAILY_LIMIT) {
    return { skipped: "limit" };
  }

  const copy = templateFor(opts.kind, opts.relationshipType);
  const nid = id("ntf");
  const createdAt = new Date().toISOString();
  db.prepare(
    `INSERT INTO notifications
      (id, kind, pair_id, user_id, title, title_en, body, body_en, status, payload_json, date_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
  ).run(
    nid,
    opts.kind,
    opts.pairId,
    opts.userId,
    copy.title,
    copy.titleEn,
    copy.body,
    copy.bodyEn,
    opts.payload ? JSON.stringify(opts.payload) : null,
    dateKey,
    createdAt,
  );

  trackEvent("notify_enqueued", {
    pairId: opts.pairId,
    userId: opts.userId,
    payload: { kind: opts.kind, notifyId: nid },
  });

  return mapNotify(
    db.prepare("SELECT * FROM notifications WHERE id = ?").get(nid) as Record<
      string,
      unknown
    >,
  );
}

export function listNotifications(opts: {
  pairId: string;
  userId: string;
  limit?: number;
}): NotifyEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM notifications
       WHERE pair_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(opts.pairId, opts.userId, opts.limit ?? 20) as Record<string, unknown>[];
  return rows.map(mapNotify);
}

export function ackNotification(
  notifyId: string,
  userId: string,
  status: "local_shown" | "acked" = "acked",
): NotifyEvent | null {
  const db = getDb();
  const row = db
    .prepare(`SELECT * FROM notifications WHERE id = ? AND user_id = ?`)
    .get(notifyId, userId) as Record<string, unknown> | undefined;
  if (!row) return null;
  db.prepare(`UPDATE notifications SET status = ? WHERE id = ?`).run(status, notifyId);
  trackEvent("notify_ack", {
    pairId: String(row.pair_id),
    userId,
    payload: { notifyId, status },
  });
  return mapNotify({ ...row, status });
}

/** 若昨日有连线且今日尚未揭晓 → streak_risk（温和文案） */
export function maybeEnqueueStreakRisk(opts: {
  pairId: string;
  userId: string;
  relationshipType: RelationshipType;
  lastStreakDate: string | null;
  streak: number;
  todayRevealed: boolean;
}): NotifyEvent | { skipped: string } | null {
  if (opts.streak <= 0 || !opts.lastStreakDate || opts.todayRevealed) {
    return null;
  }
  const today = shanghaiDateKey();
  const y = new Date(`${today}T12:00:00+08:00`);
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  if (opts.lastStreakDate !== yesterday && opts.lastStreakDate !== today) {
    return null;
  }
  if (opts.lastStreakDate === today) return null;
  return enqueueNotify({
    kind: "streak_risk",
    pairId: opts.pairId,
    userId: opts.userId,
    relationshipType: opts.relationshipType,
    payload: { lastStreakDate: opts.lastStreakDate, streak: opts.streak },
  });
}

export function notifyTemplatesPreview() {
  return {
    templates: NOTIFY_TEMPLATES,
    wxSubscribeTemplateIds: wxSubscribeTemplateIds(),
    kindDailyLimit: NOTIFY_KIND_DAILY_LIMIT,
    delivery: "stub_h5_local_only" as const,
  };
}
