import type { DatabaseSync } from "node:sqlite";
import type { BilingualText, SourceLang } from "@half-island/shared";
import { createHash } from "node:crypto";

export function detectSourceLang(text: string): SourceLang {
  const cleaned = text.replace(/\s+/g, "");
  if (!cleaned) return "en";
  const cjk = (cleaned.match(/[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/g) || []).join(
    "",
  ).length;
  const ratio = cjk / cleaned.length;
  if (ratio >= 0.2) return "zh";
  if (ratio > 0 && ratio < 0.2) return "mixed";
  return "en";
}

function looksAlreadyBilingual(text: string): boolean {
  // 已含中英并列（换行或 / 分隔）则去重
  const hasCjk = /[\u3400-\u9fff]/.test(text);
  const hasLatin = /[A-Za-z]{3,}/.test(text);
  if (hasCjk && hasLatin && (text.includes("\n") || text.includes(" / ") || text.includes("\n"))) {
    return true;
  }
  return false;
}

function splitBilingual(text: string): { zh: string; en: string } | null {
  if (!looksAlreadyBilingual(text)) return null;
  const parts = text
    .split(/\n+| \/ /)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const zh = parts.find((p) => detectSourceLang(p) === "zh") ?? parts[0]!;
  const en = parts.find((p) => detectSourceLang(p) === "en") ?? parts[1]!;
  if (zh === en) return null;
  return { zh, en };
}

function cacheKey(text: string, sourceLang: SourceLang): string {
  return createHash("sha256").update(`${sourceLang}::${text}`).digest("hex");
}

function readCache(
  db: DatabaseSync | null,
  answerId: string | null,
  text: string,
  sourceLang: SourceLang,
): BilingualText | null {
  if (!db) return null;
  try {
    if (answerId) {
      const byAns = db
        .prepare(
          `SELECT zh, en, source_lang, needs_review FROM answer_translations WHERE answer_id = ?`,
        )
        .get(answerId) as
        | { zh: string; en: string; source_lang: string; needs_review: number }
        | undefined;
      if (byAns) {
        return {
          zh: byAns.zh,
          en: byAns.en,
          sourceLang: byAns.source_lang as SourceLang,
          needsReview: Boolean(byAns.needs_review),
        };
      }
    }
    const key = cacheKey(text, sourceLang);
    const row = db
      .prepare(
        `SELECT zh, en, source_lang, needs_review FROM answer_translations WHERE cache_key = ?`,
      )
      .get(key) as
      | { zh: string; en: string; source_lang: string; needs_review: number }
      | undefined;
    if (!row) return null;
    return {
      zh: row.zh,
      en: row.en,
      sourceLang: row.source_lang as SourceLang,
      needsReview: Boolean(row.needs_review),
    };
  } catch {
    return null;
  }
}

function writeCache(
  db: DatabaseSync | null,
  opts: {
    answerId: string | null;
    text: string;
    result: BilingualText;
  },
): void {
  if (!db) return;
  try {
    const key = cacheKey(opts.text, opts.result.sourceLang);
    db.prepare(
      `INSERT INTO answer_translations (cache_key, answer_id, source_lang, zh, en, needs_review, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         answer_id = COALESCE(excluded.answer_id, answer_translations.answer_id),
         zh = excluded.zh,
         en = excluded.en,
         needs_review = excluded.needs_review`,
    ).run(
      key,
      opts.answerId,
      opts.result.sourceLang,
      opts.result.zh,
      opts.result.en,
      opts.result.needsReview ? 1 : 0,
      new Date().toISOString(),
    );
  } catch {
    // cache best-effort
  }
}

async function callTranslateApi(
  text: string,
  target: "zh" | "en",
): Promise<string | null> {
  const url = process.env.TRANSLATE_API_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.TRANSLATE_API_KEY
          ? { Authorization: `Bearer ${process.env.TRANSLATE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        text,
        target,
        model: process.env.TRANSLATE_MODEL || "gpt-4o-mini",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { translation?: string; text?: string };
    return (data.translation || data.text || "").trim() || null;
  } catch {
    return null;
  }
}

async function callGoogleTranslate(
  text: string,
  to: "zh-CN" | "en",
): Promise<string | null> {
  if (process.env.TRANSLATE_DISABLE_GOOGLE === "1") return null;
  try {
    const mod = (await import("@vitalets/google-translate-api")) as unknown as {
      translate: (
        text: string,
        opts: { to: string },
      ) => Promise<{ text?: string }>;
    };
    const result = await mod.translate(text, { to });
    const out = (result?.text || "").trim();
    return out || null;
  } catch {
    return null;
  }
}

function stubBilingual(text: string, sourceLang: SourceLang): BilingualText {
  const split = splitBilingual(text);
  if (split) {
    return { zh: split.zh, en: split.en, sourceLang: "mixed", needsReview: false };
  }
  if (sourceLang === "zh") {
    return {
      zh: text,
      en: text,
      sourceLang,
      needsReview: true,
    };
  }
  if (sourceLang === "en") {
    return {
      zh: text,
      en: text,
      sourceLang,
      needsReview: true,
    };
  }
  return { zh: text, en: text, sourceLang: "mixed", needsReview: true };
}

/**
 * 将自由文本转为中英双语。
 * 优先：已双语去重 → 缓存 → TRANSLATE_API_URL → google-translate-api → stub（needsReview）。
 */
export async function translateToBilingual(
  text: string,
  opts: {
    db?: DatabaseSync | null;
    answerId?: string | null;
    /** 选择题：已有题库英译，跳过机翻 */
    choicePair?: { zh: string; en: string } | null;
  } = {},
): Promise<BilingualText> {
  const trimmed = text.trim();
  if (opts.choicePair?.zh && opts.choicePair.en) {
    return {
      zh: opts.choicePair.zh,
      en: opts.choicePair.en,
      sourceLang: detectSourceLang(opts.choicePair.zh),
      needsReview: false,
    };
  }

  const sourceLang = detectSourceLang(trimmed);
  const cached = readCache(opts.db ?? null, opts.answerId ?? null, trimmed, sourceLang);
  if (cached) return cached;

  const split = splitBilingual(trimmed);
  if (split) {
    const result: BilingualText = {
      zh: split.zh,
      en: split.en,
      sourceLang: "mixed",
      needsReview: false,
    };
    writeCache(opts.db ?? null, {
      answerId: opts.answerId ?? null,
      text: trimmed,
      result,
    });
    return result;
  }

  let zh = trimmed;
  let en = trimmed;
  let needsReview = true;

  if (sourceLang === "zh" || sourceLang === "mixed") {
    const viaApi = await callTranslateApi(trimmed, "en");
    const viaGoogle = viaApi ?? (await callGoogleTranslate(trimmed, "en"));
    if (viaGoogle && viaGoogle !== trimmed) {
      en = viaGoogle;
      needsReview = false;
    }
  } else {
    const viaApi = await callTranslateApi(trimmed, "zh");
    const viaGoogle = viaApi ?? (await callGoogleTranslate(trimmed, "zh-CN"));
    if (viaGoogle && viaGoogle !== trimmed) {
      zh = viaGoogle;
      needsReview = false;
    }
  }

  const result: BilingualText =
    needsReview && zh === en
      ? stubBilingual(trimmed, sourceLang)
      : { zh, en, sourceLang, needsReview };

  writeCache(opts.db ?? null, {
    answerId: opts.answerId ?? null,
    text: trimmed,
    result,
  });
  return result;
}

/** 同步路径：仅缓存 / 选择题 / stub（揭晓 map 用） */
export function translateToBilingualSync(
  text: string,
  opts: {
    db?: DatabaseSync | null;
    answerId?: string | null;
    choicePair?: { zh: string; en: string } | null;
  } = {},
): BilingualText {
  const trimmed = text.trim();
  if (opts.choicePair?.zh && opts.choicePair.en) {
    return {
      zh: opts.choicePair.zh,
      en: opts.choicePair.en,
      sourceLang: detectSourceLang(opts.choicePair.zh),
      needsReview: false,
    };
  }
  const sourceLang = detectSourceLang(trimmed);
  const cached = readCache(opts.db ?? null, opts.answerId ?? null, trimmed, sourceLang);
  if (cached) return cached;
  const split = splitBilingual(trimmed);
  if (split) {
    const result: BilingualText = {
      zh: split.zh,
      en: split.en,
      sourceLang: "mixed",
      needsReview: false,
    };
    writeCache(opts.db ?? null, {
      answerId: opts.answerId ?? null,
      text: trimmed,
      result,
    });
    return result;
  }
  const result = stubBilingual(trimmed, sourceLang);
  writeCache(opts.db ?? null, {
    answerId: opts.answerId ?? null,
    text: trimmed,
    result,
  });
  return result;
}
