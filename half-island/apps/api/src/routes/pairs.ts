import type { FastifyInstance } from "fastify";
import type { Pair, RelationshipType } from "@half-island/shared";
import { getDb } from "../db/client.js";
import { id, inviteCode } from "../lib/ids.js";

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

  /** 创建邀请：6 位码 + relationship_type */
  app.post<{
    Body: {
      userId: string;
      relationshipType: RelationshipType;
      displayName?: string;
    };
  }>("/pairs/invite", async (req, reply) => {
    const { userId, relationshipType, displayName } = req.body ?? {};
    if (!userId || (relationshipType !== "couple" && relationshipType !== "friends")) {
      return reply.code(400).send({ error: "invalid_body" });
    }
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
    };
    getDb()
      .prepare(
        `INSERT INTO pairs (id, invite_code, relationship_type, user_a_id, user_b_id, streak, last_streak_date, premium, status, created_at, dissolved_at)
         VALUES (?, ?, ?, ?, NULL, 0, NULL, 0, 'pending', ?, NULL)`,
      )
      .run(pair.id, pair.inviteCode, pair.relationshipType, pair.userAId, pair.createdAt);

    return { pair };
  });

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
