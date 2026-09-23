import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FiltersBar } from "@/components/filters-bar";
import { RankingsProjectList } from "@/components/rankings-project-list";
import { RankingsResultCount } from "@/components/rankings-result-count";
import { SearchForm } from "@/components/search-form";
import type { Locale } from "@/i18n/routing";
import { ALL_BOARD_IDS, isBoardId, isSegmentBoard } from "@/lib/boards";
import { getAllProjects } from "@/lib/projects";

export function generateStaticParams() {
  return ALL_BOARD_IDS.flatMap((board) =>
    ["zh", "en"].map((locale) => ({ locale, board })),
  );
}

export default async function RankingsPage({
  params,
}: {
  params: Promise<{ locale: Locale; board: string }>;
}) {
  const { locale, board } = await params;
  if (!isBoardId(board)) notFound();

  setRequestLocale(locale);
  const t = await getTranslations();
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
        <Suspense fallback={null}>
          <RankingsResultCount board={board} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <SearchForm defaultBoard={board} />
      </Suspense>

      <Suspense fallback={null}>
        <FiltersBar allTags={allTags} />
      </Suspense>

      <Suspense fallback={null}>
        <RankingsProjectList board={board} locale={locale} />
      </Suspense>
    </div>
  );
}
