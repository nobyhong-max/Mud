import type { FastifyInstance } from "fastify";
import type {
  DeckSummary,
  RelationMode,
  SoftPaywallInfo,
} from "@half-island/shared";
import { DECK_TITLES, DECK_TITLES_EN } from "@half-island/shared";
import { getDb } from "../db/client.js";
import { id, shanghaiDateKey } from "../lib/ids.js";
import { trackEvent } from "../services/events.js";
import { sendNudge } from "../services/nudge.js";
import { getActivePair, pairError } from "../services/pair-access.js";
import {
  buildPaywallInfo,
  canStartExtraDeck,
  deckRequiresPremium,
} from "../services/paywall.js";
import { assertPromptAllowedForPair } from "../services/prompt-picker.js";
import { mapPrompt } from "../services/reveal.js";

export async function growthRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { pairId: string; userId: string } }>(
    "/paywall",
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
      trackEvent("paywall_view", { pairId, userId, payload: { premium: Boolean(pair.premium) } });
      const paywall: SoftPaywallInfo = buildPaywallInfo(pair);
      return { paywall };
    },
  );

  /** 假开通/关闭会员（无真实支付） */
  app.post<{ Body: { pairId: string; userId: string; premium: boolean } }>(
    "/premium/toggle",
    async (req, reply) => {
      const { pairId, userId, premium } = req.body ?? {};
      if (!pairId || !userId || typeof premium !== "boolean") {
        return reply.code(400).send({ error: "invalid_body" });
      }
      const pair = getActivePair(pairId, userId);
      if (typeof pair === "string") {
        const e = pairError(pair);
        return reply.code(e.code).send({ error: e.error });
      }
      getDb()
        .prepare(`UPDATE pairs SET premium = ? WHERE id = ?`)
        .run(premium ? 1 : 0, pairId);
      trackEvent("paywall_view", {
        pairId,
        userId,
        payload: { action: "toggle", premium },
      });
      const updated = getActivePair(pairId, userId);
      if (typeof updated === "string") {
        return reply.code(500).send({ error: "pair_refresh_failed" });
      }
      return { paywall: buildPaywallInfo(updated) };
    },
  );

  app.get<{ Querystring: { pairId: string; userId: string } }>(
    "/decks",
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

      const modeFilter =
        pair.relationship_type === "friends"
          ? `relation_mode IN ('friend','both')`
          : `relation_mode IN ('couple','both')`;

      const rows = getDb()
        .prepare(
          `SELECT deck, relation_mode, COUNT(*) AS c
           FROM prompts
           WHERE status = 'active' AND nsfw_flag = 0 AND intimacy_level < 4
             AND ${modeFilter}
           GROUP BY deck, relation_mode`,
        )
        .all() as { deck: string; relation_mode: string; c: number }[];

      const byDeck = new Map<string, { count: number; modes: Set<string> }>();
      for (const r of rows) {
        const cur = byDeck.get(r.deck) ?? { count: 0, modes: new Set<string>() };
        cur.count += Number(r.c);
        cur.modes.add(r.relation_mode);
        byDeck.set(r.deck, cur);
      }

      const decks: DeckSummary[] = [...byDeck.entries()].map(([deckId, info]) => {
        const locked = deckRequiresPremium(deckId) && !pair.premium;
        return {
          id: deckId,
          title: DECK_TITLES[deckId] ?? deckId,
          titleEn: DECK_TITLES_EN[deckId] ?? deckId,
          count: info.count,
          locked,
          relationModes: [...info.modes] as RelationMode[],
        };
      });

      decks.sort((a, b) => a.id.localeCompare(b.id));
      return { decks, paywall: buildPaywallInfo(pair) };
    },
  );

  /** 开始主题牌组加练（非会员锁主题包） */
  app.post<{
    Body: { pairId: string; userId: string; deckId: string };
  }>("/decks/start", async (req, reply) => {
    const { pairId, userId, deckId } = req.body ?? {};
    if (!pairId || !userId || !deckId) {
      return reply.code(400).send({ error: "invalid_body" });
    }
    const pair = getActivePair(pairId, userId);
    if (typeof pair === "string") {
      const e = pairError(pair);
      return reply.code(e.code).send({ error: e.error });
    }

    if (!canStartExtraDeck(pair, deckId)) {
      trackEvent("deck_locked_tap", { pairId, userId, payload: { deckId } });
      return reply.code(402).send({
        error: "premium_required",
        message: "主题牌组需双人会员。每日免费题与已揭晓回看不受影响。",
        paywall: buildPaywallInfo(pair),
      });
    }

    const db = getDb();
    const modes =
      pair.relationship_type === "friends"
        ? ["friend", "both"]
        : ["couple", "both"];
    const placeholders = modes.map(() => "?").join(",");
    const prompt = db
      .prepare(
        `SELECT * FROM prompts
         WHERE status = 'active' AND nsfw_flag = 0 AND intimacy_level < 4
           AND deck = ? AND relation_mode IN (${placeholders})
         ORDER BY RANDOM() LIMIT 1`,
      )
      .get(deckId, ...modes) as Record<string, unknown> | undefined;

    if (!prompt) return reply.code(404).send({ error: "no_prompt_in_deck" });
    if (!assertPromptAllowedForPair(pair.relationship_type, String(prompt.relation_mode))) {
      return reply.code(500).send({ error: "prompt_relation_mismatch" });
    }

    const asgId = id("asg");
    const dateKey = shanghaiDateKey();
    const createdAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO assignments (id, pair_id, prompt_id, date_key, status, created_at, revealed_at, kind, deck_id)
       VALUES (?, ?, ?, ?, 'assigned', ?, NULL, 'extra', ?)`,
    ).run(asgId, pairId, String(prompt.id), dateKey, createdAt, deckId);

    return {
      assignmentId: asgId,
      prompt: mapPrompt(prompt),
      kind: "extra" as const,
    };
  });

  app.post<{ Body: { pairId: string; userId: string } }>(
    "/nudge",
    async (req, reply) => {
      const { pairId, userId } = req.body ?? {};
      if (!pairId || !userId) return reply.code(400).send({ error: "invalid_body" });
      const pair = getActivePair(pairId, userId);
      if (typeof pair === "string") {
        const e = pairError(pair);
        return reply.code(e.code).send({ error: e.error });
      }
      if (!pair.user_b_id) {
        return reply.code(409).send({ error: "partner_missing" });
      }

      const result = sendNudge({
        pairId,
        fromUserId: userId,
        relationshipType: pair.relationship_type,
      });
      if ("error" in result) {
        return reply.code(429).send({
          error: "nudge_limit",
          message: "今天已经轻轻戳过 3 次了，留给岛一点安静。",
          remaining: 0,
        });
      }
      trackEvent("nudge_sent", {
        pairId,
        userId,
        payload: { remaining: result.remaining },
      });
      return result;
    },
  );

  /** 简易 Admin：题库列表/上下架（开发令牌） */
  app.get("/admin/prompts", async (req, reply) => {
    const token = (req.headers["x-admin-token"] as string) || "";
    if (token !== (process.env.ADMIN_TOKEN || "dev-admin")) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const rows = getDb()
      .prepare(
        `SELECT id, deck, relation_mode, intimacy_level, type, prompt, status, audience, daily_eligible
         FROM prompts ORDER BY id LIMIT 500`,
      )
      .all();
    return { prompts: rows };
  });

  app.patch<{
    Params: { id: string };
    Body: { status?: "active" | "archived" | "draft" };
  }>("/admin/prompts/:id", async (req, reply) => {
    const token = (req.headers["x-admin-token"] as string) || "";
    if (token !== (process.env.ADMIN_TOKEN || "dev-admin")) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const status = req.body?.status;
    if (!status) return reply.code(400).send({ error: "status_required" });
    const info = getDb()
      .prepare(`UPDATE prompts SET status = ? WHERE id = ?`)
      .run(status, req.params.id);
    if (info.changes === 0) return reply.code(404).send({ error: "not_found" });
    return { ok: true, id: req.params.id, status };
  });

  app.get("/admin/events", async (req, reply) => {
    const token = (req.headers["x-admin-token"] as string) || "";
    if (token !== (process.env.ADMIN_TOKEN || "dev-admin")) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const rows = getDb()
      .prepare(`SELECT * FROM events ORDER BY created_at DESC LIMIT 100`)
      .all();
    return { events: rows };
  });
}
