"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { BoardId } from "@/lib/types";
import { parseFiltersFromSearchParams, rankProjects } from "@/lib/projects";

export function RankingsResultCount({ board }: { board: BoardId }) {
  const t = useTranslations("rankings");
  const searchParams = useSearchParams();
  const sp = Object.fromEntries(searchParams.entries());
  const filters = parseFiltersFromSearchParams(sp);
  const items = rankProjects(board, filters);

  return (
    <p className="mt-2 text-sm text-zinc-500">
      {t("results", { count: items.length })}
    </p>
  );
}
