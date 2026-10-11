import type { DatabaseSync } from "node:sqlite";
import type {
  AssignmentComment,
  CommentReaction,
  RelationshipType,
} from "@half-island/shared";
import { COMMENT_PLACEHOLDER, COMMENT_REACTIONS } from "@half-island/shared";
import { getDb } from "../db/client.js";
import { id } from "../lib/ids.js";
import { translateToBilingual, translateToBilingualSync } from "./translate.js";

const MAX_BODY = 120;

export function isCommentReaction(v: unknown): v is CommentReaction {
  return typeof v === "string" && (COMMENT_REACTIONS as readonly string[]).includes(v);
}

export function commentPlaceholder(relationshipType: RelationshipType): {
  zh: string;
  en: string;
} {
  return COMMENT_PLACEHOLDER[relationshipType];
}

export function mapComment(
  row: Record<string, unknown>,
  db: DatabaseSync | null = getDb(),
): AssignmentComment {
  const body = String(row.body);
  const bilingual = translateToBilingualSync(body, { db, answerId: null });
  return {
    id: String(row.id),
    assignmentId: String(row.assignment_id),
    userId: String(row.user_id),
    body,
    reaction: row.reaction ? (String(row.reaction) as CommentReaction) : null,
    bilingual,
    createdAt: String(row.created_at),
  };
}

export function listComments(
  assignmentId: string,
  db: DatabaseSync = getDb(),
): AssignmentComment[] {
  const rows = db
    .prepare(
      `SELECT * FROM comments WHERE assignment_id = ? ORDER BY created_at ASC`,
    )
    .all(assignmentId) as Record<string, unknown>[];
  return rows.map((r) => mapComment(r, db));
}

export async function upsertComment(opts: {
  assignmentId: string;
  userId: string;
  body: string;
  reaction?: CommentReaction | null;
}): Promise<
  | { ok: true; comment: AssignmentComment }
  | { error: "empty" | "too_long" | "bad_reaction" }
> {
  const trimmed = opts.body.trim();
  if (!trimmed && !opts.reaction) return { error: "empty" };
  if (trimmed.length > MAX_BODY) return { error: "too_long" };
  if (opts.reaction != null && !isCommentReaction(opts.reaction)) {
    return { error: "bad_reaction" };
  }

  const db = getDb();
  const existing = db
    .prepare(`SELECT id FROM comments WHERE assignment_id = ? AND user_id = ?`)
    .get(opts.assignmentId, opts.userId) as { id: string } | undefined;

  const createdAt = new Date().toISOString();
  const commentId = existing?.id ?? id("cmt");
  const body = trimmed || (opts.reaction ?? "");

  if (existing) {
    db.prepare(
      `UPDATE comments SET body = ?, reaction = ?, created_at = ? WHERE id = ?`,
    ).run(body, opts.reaction ?? null, createdAt, existing.id);
  } else {
    db.prepare(
      `INSERT INTO comments (id, assignment_id, user_id, body, reaction, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      commentId,
      opts.assignmentId,
      opts.userId,
      body,
      opts.reaction ?? null,
      createdAt,
    );
  }

  await translateToBilingual(body, { db, answerId: null });

  const row = db
    .prepare(`SELECT * FROM comments WHERE id = ?`)
    .get(commentId) as Record<string, unknown>;
  return { ok: true, comment: mapComment(row, db) };
}
