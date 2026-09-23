import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FiltersBar } from "@/components/filters-bar";
import { ProjectCard } from "@/components/project-card";
import { SearchForm } from "@/components/search-form";
import type { Locale } from "@/i18n/routing";
import { ALL_BOARD_IDS, isBoardId, isSegmentBoard } from "@/lib/boards";
import {
  getAllProjects,
  parseFiltersFromSearchParams,
  rankProjects,
} from "@/lib/projects";

export function generateStaticParams() {
  return ALL_BOARD_IDS.flatMap((board) =>
    ["zh", "en"].map((locale) => ({ locale, board })),
  );
}

export default async function RankingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; board: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale, board } = await params;
  if (!isBoardId(board)) notFound();

  setRequestLocale(locale);
  const t = await getTranslations();
  const sp = await searchParams;
  const filters = parseFiltersFromSearchParams(sp);
  const items = rankProjects(board, filters);
  const allTags = [
    ...new Set(getAllProjects().flatMap((p) => p.tags)),
  ].sort();

  const descKey = isSegmentBoard(board)
    ? "boardDesc.segment"
    : `boardDesc.${board}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t(`boards.${board}`)}</h1>
        <p className="mt-1 text-zinc-500">{t(descKey)}</p>
        <p className="mt-2 text-sm text-zinc-500">
          {t("rankings.results", { count: items.length })}
        </p>
      </div>

      <Suspense fallback={null}>
        <SearchForm defaultBoard={board} />
      </Suspense>

      <Suspense fallback={null}>
        <FiltersBar allTags={allTags} />
      </Suspense>

      {items.length === 0 ? (
        <p className="text-zinc-500">{t("rankings.empty")}</p>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <ProjectCard key={item.project.slug} item={item} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}
