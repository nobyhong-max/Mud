import type { FastifyInstance } from "fastify";
import type {
  Pair,
  RelationshipStage,
  RelationshipType,
} from "@half-island/shared";
import { getDb } from "../db/client.js";
import { id, inviteCode } from "../lib/ids.js";
import { trackEvent } from "../services/events.js";
import { buildInviteShareCard } from "../services/invite-share.js";

const STAGES = new Set<RelationshipStage>([
  "just_met",
  "getting_close",
  "steady",
  "years",
  "unspecified",
]);

function rowToPair(row: Record<string, unknown>): Pair {
  return {
    id: String(row.id),
    inviteCode: String(row.invite_code),
    relationshipType: row.relationship_type as RelationshipType,
    userAId: String(row.user_a_id),
    userBId: row.user_b_id ? String(row.user_b_id) : null,
    streak: Number(row.streak),
    lastStreakDate: row.last_streak_date ? String(row.last_streak_date) : null,
    premium: Boolean(row.premium),
    status: row.status as Pair["status"],
    createdAt: String(row.created_at),
    dissolvedAt: row.dissolved_at ? String(row.dissolved_at) : null,
    relationshipStage: (row.relationship_stage as RelationshipStage) || "unspecified",
    anniversaryDate: row.anniversary_date ? String(row.anniversary_date) : null,
  };
}

function ensureUser(userId: string, displayName?: string): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (existing) return;
  db.prepare(
    `INSERT INTO users (id, display_name, created_at) VALUES (?, ?, ?)`,
  ).run(userId, displayName || userId, new Date().toISOString());
}

export async function pairRoutes(app: FastifyInstance): Promise<void> {
  app.get("/pairs", async () => {
    const rows = getDb()
      .prepare("SELECT * FROM pairs WHERE status != 'dissolved' ORDER BY created_at")
      .all();
    return { pairs: rows.map((r) => rowToPair(r as Record<string, unknown>)) };
  });

  app.get<{ Params: { id: string } }>("/pairs/:id", async (req, reply) => {
    const row = getDb()
      .prepare("SELECT * FROM pairs WHERE id = ?")
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return reply.code(404).send({ error: "pair_not_found" });
    return { pair: rowToPair(row) };
  });

  /** 创建邀请：6 位码 + relationship_type + 可选 onboarding 档案 */
  app.post<{
    Body: {
      userId: string;
      relationshipType: RelationshipType;
      displayName?: string;
      relationshipStage?: RelationshipStage;
      anniversaryDate?: string | null;
    };
  }>("/pairs/invite", async (req, reply) => {
    const {
      userId,
      relationshipType,
      displayName,
      relationshipStage,
      anniversaryDate,
    } = req.body ?? {};
    if (!userId || (relationshipType !== "couple" && relationshipType !== "friends")) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    const stage: RelationshipStage =
      relationshipStage && STAGES.has(relationshipStage)
        ? relationshipStage
        : "unspecified";
    const ann =
      anniversaryDate && /^\d{4}-\d{2}-\d{2}$/.test(anniversaryDate)
        ? anniversaryDate
        : null;
    ensureUser(userId, displayName);

    const pair: Pair = {
      id: id("pair"),
      inviteCode: inviteCode(),
      relationshipType,
      userAId: userId,
      userBId: null,
      streak: 0,
      lastStreakDate: null,
      premium: false,
      status: "pending",
      createdAt: new Date().toISOString(),
      dissolvedAt: null,
      relationshipStage: stage,
      anniversaryDate: ann,
    };
    getDb()
      .prepare(
        `INSERT INTO pairs (id, invite_code, relationship_type, user_a_id, user_b_id, streak, last_streak_date, premium, status, created_at, dissolved_at, relationship_stage, anniversary_date)
         VALUES (?, ?, ?, ?, NULL, 0, NULL, 0, 'pending', ?, NULL, ?, ?)`,
      )
      .run(
        pair.id,
        pair.inviteCode,
        pair.relationshipType,
        pair.userAId,
        pair.createdAt,
        pair.relationshipStage,
        pair.anniversaryDate,
      );

    const share = buildInviteShareCard({
      inviteCode: pair.inviteCode,
      relationshipType: pair.relationshipType,
    });
    return { pair, share };
  });

  /** 补全 onboarding 档案（阶段 / 纪念日）；pending 岛也可改 */
  app.post<{
    Body: {
      pairId: string;
      userId: string;
      relationshipStage?: RelationshipStage;
      anniversaryDate?: string | null;
      displayName?: string;
    };
  }>("/pairs/profile", async (req, reply) => {
    const { pairId, userId, relationshipStage, anniversaryDate, displayName } =
      req.body ?? {};
    if (!pairId || !userId) return reply.code(400).send({ error: "invalid_body" });

    const row = getDb()
      .prepare("SELECT * FROM pairs WHERE id = ?")
      .get(pairId) as Record<string, unknown> | undefined;
    if (!row) return reply.code(404).send({ error: "pair_not_found" });
    if (row.status === "dissolved") {
      return reply.code(410).send({ error: "pair_dissolved" });
    }
    if (String(row.user_a_id) !== userId && String(row.user_b_id) !== userId) {
      return reply.code(403).send({ error: "not_in_pair" });
    }

    if (displayName) {
      ensureUser(userId, displayName);
      getDb()
        .prepare(`UPDATE users SET display_name = ? WHERE id = ?`)
        .run(displayName, userId);
    }
    if (relationshipStage && STAGES.has(relationshipStage)) {
      getDb()
        .prepare(`UPDATE pairs SET relationship_stage = ? WHERE id = ?`)
        .run(relationshipStage, pairId);
    }
    if (anniversaryDate === null) {
      getDb()
        .prepare(`UPDATE pairs SET anniversary_date = NULL WHERE id = ?`)
        .run(pairId);
    } else if (anniversaryDate && /^\d{4}-\d{2}-\d{2}$/.test(anniversaryDate)) {
      getDb()
        .prepare(`UPDATE pairs SET anniversary_date = ? WHERE id = ?`)
        .run(anniversaryDate, pairId);
    }

    const updated = getDb()
      .prepare("SELECT * FROM pairs WHERE id = ?")
      .get(pairId) as Record<string, unknown>;
    return { pair: rowToPair(updated) };
  });

  /** 邀请分享卡 meta（无答案） */
  app.get<{ Querystring: { code?: string; pairId?: string } }>(
    "/invite/share",
    async (req, reply) => {
      const code = req.query.code?.toUpperCase();
      const pairId = req.query.pairId;
      const db = getDb();
      let row: Record<string, unknown> | undefined;
      if (code) {
        row = db
          .prepare(
            `SELECT * FROM pairs WHERE invite_code = ? AND status != 'dissolved'`,
          )
          .get(code) as Record<string, unknown> | undefined;
      } else if (pairId) {
        row = db
          .prepare(`SELECT * FROM pairs WHERE id = ? AND status != 'dissolved'`)
          .get(pairId) as Record<string, unknown> | undefined;
      } else {
        return reply.code(400).send({ error: "code_or_pairId_required" });
      }
      if (!row) return reply.code(404).send({ error: "invite_not_found" });
      const share = buildInviteShareCard({
        inviteCode: String(row.invite_code),
        relationshipType: row.relationship_type as RelationshipType,
      });
      return { share, pair: rowToPair(row) };
    },
  );

  /** 接受邀请 → active */
  app.post<{
    Body: { userId: string; inviteCode: string; displayName?: string };
  }>("/pairs/accept", async (req, reply) => {
    const { userId, inviteCode: code, displayName } = req.body ?? {};
    if (!userId || !code) return reply.code(400).send({ error: "invalid_body" });
    ensureUser(userId, displayName);

    const db = getDb();
    const row = db
      .prepare(
        `SELECT * FROM pairs WHERE invite_code = ? AND status != 'dissolved'`,
      )
      .get(code.toUpperCase()) as Record<string, unknown> | undefined;
    if (!row) return reply.code(404).send({ error: "invite_not_found" });
    if (row.status === "active" && row.user_b_id) {
      return reply.code(409).send({ error: "pair_full" });
    }
    if (String(row.user_a_id) === userId) {
      return reply.code(400).send({ error: "cannot_accept_own_invite" });
    }

    const pairId = String(row.id);
    db.prepare(
      `UPDATE pairs SET user_b_id = ?, status = 'active' WHERE id = ?`,
    ).run(userId, pairId);

    const updated = db.prepare("SELECT * FROM pairs WHERE id = ?").get(pairId) as Record<
      string,
      unknown
    >;
    trackEvent("pair_success", {
      pairId,
      userId,
      payload: { relationshipType: String(updated.relationship_type) },
    });
    return { pair: rowToPair(updated) };
  });

  /** 软解绑 */
  app.post<{ Body: { pairId: string; userId: string } }>(
    "/pairs/dissolve",
    async (req, reply) => {
      const { pairId, userId } = req.body ?? {};
      if (!pairId || !userId) return reply.code(400).send({ error: "invalid_body" });
      const db = getDb();
      const row = db.prepare("SELECT * FROM pairs WHERE id = ?").get(pairId) as
        | Record<string, unknown>
        | undefined;
      if (!row) return reply.code(404).send({ error: "pair_not_found" });
      if (String(row.user_a_id) !== userId && String(row.user_b_id) !== userId) {
        return reply.code(403).send({ error: "not_in_pair" });
      }
      db.prepare(
        `UPDATE pairs SET status = 'dissolved', dissolved_at = ? WHERE id = ?`,
      ).run(new Date().toISOString(), pairId);
      return { ok: true };
    },
  );
}
