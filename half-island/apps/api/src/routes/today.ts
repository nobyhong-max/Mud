import type { FastifyInstance } from "fastify";
import type {
  Answer,
  Assignment,
  AssignmentStatus,
  DailyPrompt,
  PromptAudience,
  PromptType,
  Reveal,
  RevealPhase,
} from "@half-island/shared";
import { getDb } from "../db/client.js";
import { id, shanghaiDateKey } from "../lib/ids.js";

function mapPrompt(row: Record<string, unknown>): DailyPrompt {
  return {
    id: String(row.id),
    type: row.type as PromptType,
    prompt: String(row.prompt),
    choices: row.choices_json ? (JSON.parse(String(row.choices_json)) as string[]) : null,
    intimacyLevel: Number(row.intimacy_level) as DailyPrompt["intimacyLevel"],
    audience: row.audience as PromptAudience,
    nsfwFlag: Boolean(row.nsfw_flag),
    status: row.status as DailyPrompt["status"],
  };
}

function mapAssignment(row: Record<string, unknown>): Assignment {
  return {
    id: String(row.id),
    pairId: String(row.pair_id),
    promptId: String(row.prompt_id),
    dateKey: String(row.date_key),
    status: row.status as AssignmentStatus,
    createdAt: String(row.created_at),
  };
}

function mapAnswer(row: Record<string, unknown>): Answer {
  return {
    id: String(row.id),
    assignmentId: String(row.assignment_id),
    userId: String(row.user_id),
    body: String(row.body),
    choiceIndex: row.choice_index === null || row.choice_index === undefined
      ? null
      : Number(row.choice_index),
    createdAt: String(row.created_at),
  };
}

function partnerId(
  pair: { user_a_id: string; user_b_id: string | null },
  userId: string,
): string | null {
  if (pair.user_a_id === userId) return pair.user_b_id;
  if (pair.user_b_id === userId) return pair.user_a_id;
  return null;
}

function computePhase(
  selfAnswered: boolean,
  partnerAnswered: boolean,
  status: AssignmentStatus,
): RevealPhase {
  if (status === "revealed" || (selfAnswered && partnerAnswered)) {
    if (status === "revealed") return "revealed";
    return "ready_to_reveal";
  }
  if (!selfAnswered) return "pending_self";
  return "pending_partner";
}

export async function todayRoutes(app: FastifyInstance): Promise<void> {
  app.get("/prompts", async () => {
    const rows = getDb().prepare("SELECT * FROM prompts WHERE status = 'active'").all();
    return { prompts: rows.map((r) => mapPrompt(r as Record<string, unknown>)) };
  });

  /** 今日题：按 pair + 用户视角返回状态（不泄对方答案） */
  app.get<{
    Querystring: { pairId: string; userId: string };
  }>("/today", async (req, reply) => {
    const { pairId, userId } = req.query;
    if (!pairId || !userId) return reply.code(400).send({ error: "pairId_and_userId_required" });

    const db = getDb();
    const pair = db.prepare("SELECT * FROM pairs WHERE id = ?").get(pairId) as
      | {
          id: string;
          user_a_id: string;
          user_b_id: string | null;
          relationship_type: string;
          streak: number;
        }
      | undefined;
    if (!pair) return reply.code(404).send({ error: "pair_not_found" });
    if (pair.user_a_id !== userId && pair.user_b_id !== userId) {
      return reply.code(403).send({ error: "not_in_pair" });
    }

    const dateKey = shanghaiDateKey();
    let asg = db
      .prepare("SELECT * FROM assignments WHERE pair_id = ? AND date_key = ?")
      .get(pairId, dateKey) as Record<string, unknown> | undefined;

    // 懒创建今日 assignment（Phase 0：按关系类型抽题）
    if (!asg) {
      const audienceFilter =
        pair.relationship_type === "friends"
          ? `audience IN ('friends', 'neutral')`
          : `audience IN ('couple', 'neutral')`;
      const prompt = db
        .prepare(
          `SELECT * FROM prompts WHERE status = 'active' AND nsfw_flag = 0 AND ${audienceFilter} ORDER BY RANDOM() LIMIT 1`,
        )
        .get() as Record<string, unknown> | undefined;
      if (!prompt) return reply.code(503).send({ error: "no_prompts" });

      const newId = id("asg");
      const createdAt = new Date().toISOString();
      db.prepare(
        `INSERT INTO assignments (id, pair_id, prompt_id, date_key, status, created_at)
         VALUES (?, ?, ?, ?, 'assigned', ?)`,
      ).run(newId, pairId, String(prompt.id), dateKey, createdAt);
      asg = db.prepare("SELECT * FROM assignments WHERE id = ?").get(newId) as Record<
        string,
        unknown
      >;
    }

    const prompt = db
      .prepare("SELECT * FROM prompts WHERE id = ?")
      .get(String(asg.prompt_id)) as Record<string, unknown>;
    const answers = db
      .prepare("SELECT * FROM answers WHERE assignment_id = ?")
      .all(String(asg.id)) as Record<string, unknown>[];

    const selfRow = answers.find((a) => String(a.user_id) === userId);
    const partner = partnerId(pair, userId);
    const partnerRow = partner
      ? answers.find((a) => String(a.user_id) === partner)
      : undefined;

    const status = asg.status as AssignmentStatus;
    const phase = computePhase(Boolean(selfRow), Boolean(partnerRow), status);
    const both = Boolean(selfRow && partnerRow);

    const reveal: Reveal = {
      assignmentId: String(asg.id),
      prompt: mapPrompt(prompt),
      phase: both && status !== "revealed" ? "ready_to_reveal" : phase,
      selfAnswer: selfRow ? mapAnswer(selfRow) : null,
      // 硬规则预留：未双答前不返回对方正文
      partnerAnswer: both ? (partnerRow ? mapAnswer(partnerRow) : null) : null,
      revealedAt: status === "revealed" ? String(asg.created_at) : null,
    };

    return {
      dateKey,
      pairId,
      relationshipType: pair.relationship_type,
      streak: pair.streak,
      assignment: mapAssignment(asg),
      reveal,
    };
  });

  /** 提交答案（幂等：同用户同 assignment 覆盖） */
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

    const pair = db.prepare("SELECT * FROM pairs WHERE id = ?").get(String(asg.pair_id)) as {
      user_a_id: string;
      user_b_id: string | null;
    };
    if (pair.user_a_id !== userId && pair.user_b_id !== userId) {
      return reply.code(403).send({ error: "not_in_pair" });
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

    let status: AssignmentStatus = "answered_partial";
    if (count >= 2) status = "ready_to_reveal";
    db.prepare("UPDATE assignments SET status = ? WHERE id = ?").run(status, assignmentId);

    return { ok: true, assignmentStatus: status };
  });

  /** 揭晓：双方完成后锁定 revealed */
  app.post<{ Body: { assignmentId: string; userId: string } }>(
    "/reveal",
    async (req, reply) => {
      const { assignmentId, userId } = req.body ?? {};
      if (!assignmentId || !userId) return reply.code(400).send({ error: "invalid_body" });

      const db = getDb();
      const asg = db
        .prepare("SELECT * FROM assignments WHERE id = ?")
        .get(assignmentId) as Record<string, unknown> | undefined;
      if (!asg) return reply.code(404).send({ error: "assignment_not_found" });

      const pair = db.prepare("SELECT * FROM pairs WHERE id = ?").get(String(asg.pair_id)) as {
        id: string;
        user_a_id: string;
        user_b_id: string | null;
        streak: number;
      };
      if (pair.user_a_id !== userId && pair.user_b_id !== userId) {
        return reply.code(403).send({ error: "not_in_pair" });
      }

      const answers = db
        .prepare("SELECT * FROM answers WHERE assignment_id = ?")
        .all(assignmentId) as Record<string, unknown>[];
      if (answers.length < 2) {
        return reply.code(403).send({ error: "both_answered_required" });
      }

      if (asg.status !== "revealed") {
        db.prepare("UPDATE assignments SET status = 'revealed' WHERE id = ?").run(assignmentId);
        db.prepare("UPDATE pairs SET streak = streak + 1 WHERE id = ?").run(pair.id);
      }

      const prompt = db
        .prepare("SELECT * FROM prompts WHERE id = ?")
        .get(String(asg.prompt_id)) as Record<string, unknown>;
      const selfRow = answers.find((a) => String(a.user_id) === userId)!;
      const partnerRow = answers.find((a) => String(a.user_id) !== userId)!;

      const reveal: Reveal = {
        assignmentId,
        prompt: mapPrompt(prompt),
        phase: "revealed",
        selfAnswer: mapAnswer(selfRow),
        partnerAnswer: mapAnswer(partnerRow),
        revealedAt: new Date().toISOString(),
      };
      return { reveal, streak: pair.streak + (asg.status === "revealed" ? 0 : 1) };
    },
  );
}
