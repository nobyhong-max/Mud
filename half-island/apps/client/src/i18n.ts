import { bilingualLine, UI_COPY } from "@half-island/shared";

export { bilingualLine, UI_COPY };

export function dual(zh: string, en: string): string {
  return bilingualLine(zh, en);
}

/** 题目/选项：中文主、英文辅（上下） */
export function promptLines(zh: string, en?: string | null): { zh: string; en: string | null } {
  if (!en || en === zh) return { zh, en: null };
  return { zh, en };
}
