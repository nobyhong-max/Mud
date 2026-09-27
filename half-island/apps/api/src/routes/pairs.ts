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
    status: row.status as Pair["status"],
    createdAt: String(row.created_at),
  };
}

export async function pairRoutes(app: FastifyInstance): Promise<void> {
  app.get("/pairs", async () => {
    const rows = getDb().prepare("SELECT * FROM pairs ORDER BY created_at").all();
    return { pairs: rows.map((r) => rowToPair(r as Record<string, unknown>)) };
  });

  app.get<{ Params: { id: string } }>("/pairs/:id", async (req, reply) => {
    const row = getDb()
      .prepare("SELECT * FROM pairs WHERE id = ?")
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return reply.code(404).send({ error: "pair_not_found" });
    return { pair: rowToPair(row) };
  });

  /** Phase 0 stub：创建邀请（含 relationship_type） */
  app.post<{
    Body: { userId: string; relationshipType: RelationshipType; displayName?: string };
  }>("/pairs/invite", async (req, reply) => {
    const { userId, relationshipType } = req.body ?? {};
    if (!userId || (relationshipType !== "couple" && relationshipType !== "friends")) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    const db = getDb();
    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) return reply.code(404).send({ error: "user_not_found" });

    const pair: Pair = {
      id: id("pair"),
      inviteCode: inviteCode(),
      relationshipType,
      userAId: userId,
      userBId: null,
      streak: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    db.prepare(
      `INSERT INTO pairs (id, invite_code, relationship_type, user_a_id, user_b_id, streak, status, created_at)
       VALUES (?, ?, ?, ?, NULL, 0, 'pending', ?)`,
    ).run(pair.id, pair.inviteCode, pair.relationshipType, pair.userAId, pair.createdAt);

    return { pair };
  });

  /** Phase 0 stub：接受邀请 */
  app.post<{ Body: { userId: string; inviteCode: string } }>(
    "/pairs/accept",
    async (req, reply) => {
      const { userId, inviteCode: code } = req.body ?? {};
      if (!userId || !code) return reply.code(400).send({ error: "invalid_body" });
      const db = getDb();
      const row = db
        .prepare("SELECT * FROM pairs WHERE invite_code = ?")
        .get(code.toUpperCase()) as Record<string, unknown> | undefined;
      if (!row) return reply.code(404).send({ error: "invite_not_found" });
      if (row.user_b_id) return reply.code(409).send({ error: "pair_full" });
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
    },
  );
}
