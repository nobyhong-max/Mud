"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { ProjectCard } from "@/components/project-card";
import type { Locale } from "@/i18n/routing";
import type { BoardId } from "@/lib/types";
import { parseFiltersFromSearchParams, rankProjects } from "@/lib/projects";

export function RankingsProjectList({
  board,
  locale,
}: {
  board: BoardId;
  locale: Locale;
}) {
  const t = useTranslations("rankings");
  const searchParams = useSearchParams();
  const sp = Object.fromEntries(searchParams.entries());
  const filters = parseFiltersFromSearchParams(sp);
  const items = rankProjects(board, filters);

  if (items.length === 0) {
    return <p className="text-zinc-500">{t("empty")}</p>;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <ProjectCard key={item.project.slug} item={item} locale={locale} />
      ))}
    </div>
  );
}
