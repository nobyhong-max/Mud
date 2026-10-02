import type { FastifyInstance } from "fastify";
import type { AssignmentStatus, Reveal } from "@half-island/shared";
import { getDb } from "../db/client.js";
import { id, shanghaiDateKey } from "../lib/ids.js";
import { trackEvent } from "../services/events.js";
import { getActivePair, pairError } from "../services/pair-access.js";
import { buildPaywallInfo } from "../services/paywall.js";
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
import { translateToBilingual } from "../services/translate.js";

export async function todayRoutes(app: FastifyInstance): Promise<void> {
  app.get("/prompts", async (req) => {
    const q = req.query as { relationMode?: string; dailyOnly?: string };
    let sql = `SELECT * FROM prompts WHERE status = 'active' AND nsfw_flag = 0 AND intimacy_level < 4`;
    if (q.relationMode === "couple") {
      sql += ` AND relation_mode IN ('couple','both')`;
    } else if (q.relationMode === "friend" || q.relationMode === "friends") {
      sql += ` AND relation_mode IN ('friend','both')`;
    }
    if (q.dailyOnly === "1") sql += ` AND daily_eligible = 1`;
    sql += ` ORDER BY id`;
    const rows = getDb().prepare(sql).all();
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
    if (typeof pair === "string") {
      const e = pairError(pair);
      return reply.code(e.code).send({ error: e.error });
    }

    const db = getDb();
    const dateKey = shanghaiDateKey();
    let asg = db
      .prepare(
        `SELECT * FROM assignments WHERE pair_id = ? AND date_key = ? AND kind = 'daily'`,
      )
      .get(pairId, dateKey) as Record<string, unknown> | undefined;

    if (!asg) {
      const promptId = pickDailyPromptId(db, pairId, pair.relationship_type);
      if (!promptId) return reply.code(503).send({ error: "no_prompts" });

      const newId = id("asg");
      const createdAt = new Date().toISOString();
      db.prepare(
        `INSERT INTO assignments (id, pair_id, prompt_id, date_key, status, created_at, revealed_at, kind, deck_id)
         VALUES (?, ?, ?, ?, 'assigned', ?, NULL, 'daily', NULL)`,
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
      db,
    });

    return {
      dateKey,
      pairId,
      relationshipType: pair.relationship_type,
      streak: pair.streak,
      premium: Boolean(pair.premium),
      assignment: mapAssignment(asg),
      reveal,
      paywall: buildPaywallInfo(pair),
    };
  });

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
    if (typeof pair === "string") {
      const e = pairError(pair);
      return reply.code(e.code).send({ error: e.error });
    }

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
      .prepare(`SELECT * FROM answers WHERE assignment_id = ? AND user_id = ?`)
      .get(assignmentId, partner) as Record<string, unknown> | undefined;
    if (!row) return reply.code(404).send({ error: "partner_answer_missing" });
    const promptRow = db
      .prepare("SELECT * FROM prompts WHERE id = ?")
      .get(String(asg.prompt_id)) as Record<string, unknown>;
    return { answer: mapAnswer(row, { db, prompt: mapPrompt(promptRow) }) };
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
    if (typeof pair === "string") {
      const e = pairError(pair);
      return reply.code(e.code).send({ error: e.error });
    }
    if (asg.status === "revealed") {
      return reply.code(409).send({ error: "already_revealed" });
    }

    const existing = db
      .prepare("SELECT id FROM answers WHERE assignment_id = ? AND user_id = ?")
      .get(assignmentId, userId) as { id: string } | undefined;

    const createdAt = new Date().toISOString();
    const answerId = existing?.id ?? id("ans");
    if (existing) {
      db.prepare(
        `UPDATE answers SET body = ?, choice_index = ?, created_at = ? WHERE id = ?`,
      ).run(body.trim(), choiceIndex ?? null, createdAt, existing.id);
    } else {
      db.prepare(
        `INSERT INTO answers (id, assignment_id, user_id, body, choice_index, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(answerId, assignmentId, userId, body.trim(), choiceIndex ?? null, createdAt);
    }

    const promptRow = db
      .prepare("SELECT * FROM prompts WHERE id = ?")
      .get(String(asg.prompt_id)) as Record<string, unknown>;
    const prompt = mapPrompt(promptRow);
    const idx = choiceIndex ?? null;
    const choicePair =
      idx !== null && prompt.choices?.[idx] && prompt.choicesEn?.[idx]
        ? { zh: prompt.choices[idx]!, en: prompt.choicesEn[idx]! }
        : null;

    // 预填双语缓存，揭晓时同步读取
    await translateToBilingual(body.trim(), {
      db,
      answerId,
      choicePair,
    });

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

    trackEvent("prompt_answered", {
      pairId: String(asg.pair_id),
      userId,
      payload: { assignmentId, status },
    });

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
      if (typeof pair === "string") {
        const e = pairError(pair);
        return reply.code(e.code).send({ error: e.error });
      }

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
        trackEvent("revealed", { pairId: pair.id, userId, payload: { assignmentId } });
        if (next.streak > pair.streak || pair.streak === 0) {
          trackEvent("streak_increment", {
            pairId: pair.id,
            userId,
            payload: { streak: next.streak },
          });
        }
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
        db,
      });

      return { reveal, streak };
    },
  );

  app.get<{ Querystring: { pairId: string; userId: string } }>(
    "/memory",
    async (req, reply) => {
      const { pairId, userId } = req.query;
      if (!pairId || !userId) {
        return reply.code(400).send({ error: "pairId_and_userId_required" });
      }
      const pair = getActivePair(pairId, userId);
      if (typeof pair === "string") {
        const e = pairError(pair);
        return reply.code(e.code).send({ error: e.error });
      }

      const db = getDb();
      const rows = db
        .prepare(
          `SELECT a.id AS assignment_id, a.date_key, a.revealed_at, a.kind,
                  p.prompt, p.prompt_en, p.deck, p.followup, p.followup_en,
                  p.choices_json, p.choices_en_json,
                  sa.id AS self_id, sa.body AS self_body, sa.choice_index AS self_choice,
                  pa.id AS partner_id, pa.body AS partner_body, pa.choice_index AS partner_choice
           FROM assignments a
           JOIN prompts p ON p.id = a.prompt_id
           JOIN answers sa ON sa.assignment_id = a.id AND sa.user_id = ?
           JOIN answers pa ON pa.assignment_id = a.id AND pa.user_id != ?
           WHERE a.pair_id = ? AND a.status = 'revealed'
           ORDER BY a.revealed_at DESC, a.date_key DESC`,
        )
        .all(userId, userId, pairId) as Record<string, unknown>[];

      return {
        /** 已揭晓对免费用户永久可回看 */
        freeRevealArchive: true as const,
        streak: pair.streak,
        items: rows.map((r) => {
          const prompt = mapPrompt({
            id: "mem",
            type: "open_text",
            prompt: r.prompt,
            prompt_en: r.prompt_en,
            choices_json: r.choices_json,
            choices_en_json: r.choices_en_json,
            intimacy_level: 0,
            audience: "neutral",
            relation_mode: "both",
            deck: r.deck,
            tags_json: "[]",
            followup: r.followup,
            followup_en: r.followup_en,
            daily_eligible: 1,
            nsfw_flag: 0,
            status: "active",
          });
          const self = mapAnswer(
            {
              id: r.self_id,
              assignment_id: r.assignment_id,
              user_id: userId,
              body: r.self_body,
              choice_index: r.self_choice,
              created_at: r.revealed_at,
            },
            { db, prompt },
          );
          const partner = mapAnswer(
            {
              id: r.partner_id,
              assignment_id: r.assignment_id,
              user_id: "partner",
              body: r.partner_body,
              choice_index: r.partner_choice,
              created_at: r.revealed_at,
            },
            { db, prompt },
          );
          return {
            assignmentId: String(r.assignment_id),
            dateKey: String(r.date_key),
            prompt: String(r.prompt),
            promptEn: r.prompt_en ? String(r.prompt_en) : String(r.prompt),
            selfAnswer: String(r.self_body),
            partnerAnswer: String(r.partner_body),
            selfBilingual: self.bilingual,
            partnerBilingual: partner.bilingual,
            revealedAt: String(r.revealed_at),
            relationshipType: pair.relationship_type,
            deck: String(r.deck ?? "daily_bits"),
            followup: r.followup ? String(r.followup) : null,
            followupEn: r.followup_en ? String(r.followup_en) : null,
            kind: String(r.kind ?? "daily"),
          };
        }),
      };
    },
  );
}
