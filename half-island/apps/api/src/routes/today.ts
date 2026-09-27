import type { FastifyInstance } from "fastify";
import type {
  AssignmentStatus,
  Reveal,
  SoftPaywallInfo,
} from "@half-island/shared";
import { getDb } from "../db/client.js";
import { id, shanghaiDateKey } from "../lib/ids.js";
import { pickDailyPromptId } from "../services/prompt-picker.js";
import {
  buildReveal,
  canReadPartnerAnswer,
  mapAnswer,
  mapAssignment,
  mapPrompt,
  nextStreak,
  partnerId,
} from "../services/reveal.js";

type PairRow = {
  id: string;
  user_a_id: string;
  user_b_id: string | null;
  relationship_type: "couple" | "friends";
  streak: number;
  last_streak_date: string | null;
  premium: number;
  status: string;
};

function getActivePair(pairId: string, userId: string): PairRow | "not_found" | "forbidden" | "dissolved" {
  const pair = getDb().prepare("SELECT * FROM pairs WHERE id = ?").get(pairId) as
    | PairRow
    | undefined;
  if (!pair) return "not_found";
  if (pair.status === "dissolved") return "dissolved";
  if (pair.user_a_id !== userId && pair.user_b_id !== userId) return "forbidden";
  return pair;
}

export async function todayRoutes(app: FastifyInstance): Promise<void> {
  app.get("/prompts", async (req) => {
    const q = req.query as { relationMode?: string; dailyOnly?: string };
    let sql = `SELECT * FROM prompts WHERE status = 'active' AND nsfw_flag = 0 AND intimacy_level < 4`;
    const params: string[] = [];
    if (q.relationMode === "couple") {
      sql += ` AND relation_mode IN ('couple','both')`;
    } else if (q.relationMode === "friend" || q.relationMode === "friends") {
      sql += ` AND relation_mode IN ('friend','both')`;
    }
    if (q.dailyOnly === "1") sql += ` AND daily_eligible = 1`;
    sql += ` ORDER BY id`;
    const rows = getDb().prepare(sql).all(...params);
    return { prompts: rows.map((r) => mapPrompt(r as Record<string, unknown>)) };
  });

  app.get<{
    Querystring: { pairId: string; userId: string };
  }>("/today", async (req, reply) => {
    const { pairId, userId } = req.query;
    if (!pairId || !userId) {
      return reply.code(400).send({ error: "pairId_and_userId_required" });
    }

    const pair = getActivePair(pairId, userId);
    if (pair === "not_found") return reply.code(404).send({ error: "pair_not_found" });
    if (pair === "dissolved") return reply.code(410).send({ error: "pair_dissolved" });
    if (pair === "forbidden") return reply.code(403).send({ error: "not_in_pair" });

    const db = getDb();
    const dateKey = shanghaiDateKey();
    let asg = db
      .prepare("SELECT * FROM assignments WHERE pair_id = ? AND date_key = ?")
      .get(pairId, dateKey) as Record<string, unknown> | undefined;

    if (!asg) {
      const promptId = pickDailyPromptId(db, pairId, pair.relationship_type);
      if (!promptId) return reply.code(503).send({ error: "no_prompts" });

      const newId = id("asg");
      const createdAt = new Date().toISOString();
      db.prepare(
        `INSERT INTO assignments (id, pair_id, prompt_id, date_key, status, created_at, revealed_at)
         VALUES (?, ?, ?, ?, 'assigned', ?, NULL)`,
      ).run(newId, pairId, promptId, dateKey, createdAt);
      db.prepare(
        `INSERT OR IGNORE INTO pair_prompt_history (pair_id, prompt_id, used_on) VALUES (?, ?, ?)`,
      ).run(pairId, promptId, dateKey);
      asg = db.prepare("SELECT * FROM assignments WHERE id = ?").get(newId) as Record<
        string,
        unknown
      >;
    }

    const promptRow = db
      .prepare("SELECT * FROM prompts WHERE id = ?")
      .get(String(asg.prompt_id)) as Record<string, unknown>;

    // Safety: friends must never see couple-only
    if (
      pair.relationship_type === "friends" &&
      String(promptRow.relation_mode) === "couple"
    ) {
      return reply.code(500).send({ error: "prompt_relation_mismatch" });
    }

    const answers = db
      .prepare("SELECT * FROM answers WHERE assignment_id = ?")
      .all(String(asg.id)) as Record<string, unknown>[];

    const selfRow = answers.find((a) => String(a.user_id) === userId);
    const partner = partnerId(pair, userId);
    const partnerRow = partner
      ? answers.find((a) => String(a.user_id) === partner)
      : undefined;

    const status = asg.status as AssignmentStatus;
    const reveal = buildReveal({
      assignmentId: String(asg.id),
      prompt: mapPrompt(promptRow),
      status,
      selfRow,
      partnerRow,
      revealedAt: asg.revealed_at ? String(asg.revealed_at) : null,
    });

    return {
      dateKey,
      pairId,
      relationshipType: pair.relationship_type,
      streak: pair.streak,
      premium: Boolean(pair.premium),
      assignment: mapAssignment(asg),
      reveal,
    };
  });

  /**
   * 硬规则端点：显式拉取对方答案。
   * 未双方作答 → 403，正文永不返回。
   */
  app.get<{
    Querystring: { assignmentId: string; userId: string };
  }>("/answers/partner", async (req, reply) => {
    const { assignmentId, userId } = req.query;
    if (!assignmentId || !userId) {
      return reply.code(400).send({ error: "invalid_query" });
    }
    const db = getDb();
    const asg = db
      .prepare("SELECT * FROM assignments WHERE id = ?")
      .get(assignmentId) as Record<string, unknown> | undefined;
    if (!asg) return reply.code(404).send({ error: "assignment_not_found" });

    const pair = getActivePair(String(asg.pair_id), userId);
    if (pair === "not_found") return reply.code(404).send({ error: "pair_not_found" });
    if (pair === "dissolved") return reply.code(410).send({ error: "pair_dissolved" });
    if (pair === "forbidden") return reply.code(403).send({ error: "not_in_pair" });

    const count = (
      db
        .prepare(`SELECT COUNT(*) AS c FROM answers WHERE assignment_id = ?`)
        .get(assignmentId) as { c: number }
    ).c;

    if (!canReadPartnerAnswer(count)) {
      return reply.code(403).send({
        error: "both_answered_required",
        message: "对方答案在双方都写完前不可见。",
      });
    }

    const partner = partnerId(pair, userId);
    if (!partner) return reply.code(409).send({ error: "partner_missing" });
    const row = db
      .prepare(
        `SELECT * FROM answers WHERE assignment_id = ? AND user_id = ?`,
      )
      .get(assignmentId, partner) as Record<string, unknown> | undefined;
    if (!row) return reply.code(404).send({ error: "partner_answer_missing" });
    return { answer: mapAnswer(row) };
  });

  app.post<{
    Body: {
      assignmentId: string;
      userId: string;
      body: string;
      choiceIndex?: number | null;
    };
  }>("/answers", async (req, reply) => {
    const { assignmentId, userId, body, choiceIndex } = req.body ?? {};
    if (!assignmentId || !userId || typeof body !== "string" || !body.trim()) {
      return reply.code(400).send({ error: "invalid_body" });
    }

    const db = getDb();
    const asg = db
      .prepare("SELECT * FROM assignments WHERE id = ?")
      .get(assignmentId) as Record<string, unknown> | undefined;
    if (!asg) return reply.code(404).send({ error: "assignment_not_found" });

    const pair = getActivePair(String(asg.pair_id), userId);
    if (pair === "not_found") return reply.code(404).send({ error: "pair_not_found" });
    if (pair === "dissolved") return reply.code(410).send({ error: "pair_dissolved" });
    if (pair === "forbidden") return reply.code(403).send({ error: "not_in_pair" });
    if (asg.status === "revealed") {
      return reply.code(409).send({ error: "already_revealed" });
    }

    const existing = db
      .prepare("SELECT id FROM answers WHERE assignment_id = ? AND user_id = ?")
      .get(assignmentId, userId) as { id: string } | undefined;

    const createdAt = new Date().toISOString();
    if (existing) {
      db.prepare(
        `UPDATE answers SET body = ?, choice_index = ?, created_at = ? WHERE id = ?`,
      ).run(body.trim(), choiceIndex ?? null, createdAt, existing.id);
    } else {
      db.prepare(
        `INSERT INTO answers (id, assignment_id, user_id, body, choice_index, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id("ans"), assignmentId, userId, body.trim(), choiceIndex ?? null, createdAt);
    }

    const count = (
      db
        .prepare("SELECT COUNT(*) AS c FROM answers WHERE assignment_id = ?")
        .get(assignmentId) as { c: number }
    ).c;

    const status: AssignmentStatus =
      count >= 2 ? "ready_to_reveal" : "answered_partial";
    db.prepare("UPDATE assignments SET status = ? WHERE id = ?").run(
      status,
      assignmentId,
    );

    return { ok: true, assignmentStatus: status };
  });

  app.post<{ Body: { assignmentId: string; userId: string } }>(
    "/reveal",
    async (req, reply) => {
      const { assignmentId, userId } = req.body ?? {};
      if (!assignmentId || !userId) {
        return reply.code(400).send({ error: "invalid_body" });
      }

      const db = getDb();
      const asg = db
        .prepare("SELECT * FROM assignments WHERE id = ?")
        .get(assignmentId) as Record<string, unknown> | undefined;
      if (!asg) return reply.code(404).send({ error: "assignment_not_found" });

      const pair = getActivePair(String(asg.pair_id), userId);
      if (pair === "not_found") return reply.code(404).send({ error: "pair_not_found" });
      if (pair === "dissolved") return reply.code(410).send({ error: "pair_dissolved" });
      if (pair === "forbidden") return reply.code(403).send({ error: "not_in_pair" });

      const answers = db
        .prepare("SELECT * FROM answers WHERE assignment_id = ?")
        .all(assignmentId) as Record<string, unknown>[];
      if (answers.length < 2) {
        return reply.code(403).send({
          error: "both_answered_required",
          message: "双方都写完才能揭晓。",
        });
      }

      const dateKey = String(asg.date_key);
      let streak = pair.streak;
      const revealedAt =
        asg.revealed_at ? String(asg.revealed_at) : new Date().toISOString();

      if (asg.status !== "revealed") {
        const next = nextStreak(pair.streak, pair.last_streak_date, dateKey);
        streak = next.streak;
        db.prepare(
          `UPDATE assignments SET status = 'revealed', revealed_at = ? WHERE id = ?`,
        ).run(revealedAt, assignmentId);
        db.prepare(
          `UPDATE pairs SET streak = ?, last_streak_date = ? WHERE id = ?`,
        ).run(next.streak, next.lastStreakDate, pair.id);
      }

      const prompt = db
        .prepare("SELECT * FROM prompts WHERE id = ?")
        .get(String(asg.prompt_id)) as Record<string, unknown>;
      const selfRow = answers.find((a) => String(a.user_id) === userId)!;
      const partnerRow = answers.find((a) => String(a.user_id) !== userId)!;

      const reveal: Reveal = buildReveal({
        assignmentId,
        prompt: mapPrompt(prompt),
        status: "revealed",
        selfRow,
        partnerRow,
        revealedAt,
      });

      return { reveal, streak };
    },
  );

  /** 回忆墙：已揭晓归档 */
  app.get<{ Querystring: { pairId: string; userId: string } }>(
    "/memory",
    async (req, reply) => {
      const { pairId, userId } = req.query;
      if (!pairId || !userId) {
        return reply.code(400).send({ error: "pairId_and_userId_required" });
      }
      const pair = getActivePair(pairId, userId);
      if (pair === "not_found") return reply.code(404).send({ error: "pair_not_found" });
      if (pair === "dissolved") return reply.code(410).send({ error: "pair_dissolved" });
      if (pair === "forbidden") return reply.code(403).send({ error: "not_in_pair" });

      const db = getDb();
      const rows = db
        .prepare(
          `SELECT a.id AS assignment_id, a.date_key, a.revealed_at, p.prompt,
                  sa.body AS self_body, pa.body AS partner_body
           FROM assignments a
           JOIN prompts p ON p.id = a.prompt_id
           JOIN answers sa ON sa.assignment_id = a.id AND sa.user_id = ?
           JOIN answers pa ON pa.assignment_id = a.id AND pa.user_id != ?
           WHERE a.pair_id = ? AND a.status = 'revealed'
           ORDER BY a.date_key DESC`,
        )
        .all(userId, userId, pairId) as Record<string, unknown>[];

      return {
        items: rows.map((r) => ({
          assignmentId: String(r.assignment_id),
          dateKey: String(r.date_key),
          prompt: String(r.prompt),
          selfAnswer: String(r.self_body),
          partnerAnswer: String(r.partner_body),
          revealedAt: String(r.revealed_at),
          relationshipType: pair.relationship_type,
        })),
      };
    },
  );

  /** 软付费 stub：不锁已揭晓；仅题量/牌组门槛说明 */
  app.get<{ Querystring: { pairId: string; userId: string } }>(
    "/paywall",
    async (req, reply) => {
      const { pairId, userId } = req.query;
      if (!pairId || !userId) {
        return reply.code(400).send({ error: "pairId_and_userId_required" });
      }
      const pair = getActivePair(pairId, userId);
      if (typeof pair === "string") {
        return reply.code(pair === "forbidden" ? 403 : 404).send({ error: pair });
      }
      const info: SoftPaywallInfo = {
        dailyRevealFree: true,
        premiumRequiredForExtraDecks: true,
        premium: Boolean(pair.premium),
        message: pair.premium
          ? "双人会员已开启：主题牌组与每日多题可用；已揭晓内容始终可回看。"
          : "每日一题揭晓永久免费。主题牌组与超额题量可开通双人会员（支付闭环 Phase 2）。",
      };
      return { paywall: info };
    },
  );
}
