import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { ProjectCard } from "@/components/project-card";
import { SearchForm } from "@/components/search-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { MAIN_BOARD_IDS, SEGMENT_BOARD_IDS } from "@/lib/boards";
import { getLastRefreshedAt, rankProjects } from "@/lib/projects";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const refreshed = getLastRefreshedAt();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-sm text-teal-600 dark:text-teal-400">
          {t("home.lastRefreshed")}: {refreshed} UTC
        </p>
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          {t("home.heroTitle")}
        </h1>
        <p className="max-w-2xl text-zinc-600 dark:text-zinc-400">
          {t("home.heroSubtitle")}
        </p>
        <Suspense fallback={null}>
          <SearchForm />
        </Suspense>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t("home.segments")}</h2>
        <div className="flex flex-wrap gap-2">
          {SEGMENT_BOARD_IDS.map((id) => (
            <Link
              key={id}
              href={`/rankings/${id}`}
              className="rounded-full border border-zinc-300 px-3 py-1 text-sm hover:border-teal-500 dark:border-zinc-700"
            >
              {t(`boards.${id}`)}
            </Link>
          ))}
        </div>
      </section>

      {MAIN_BOARD_IDS.map((boardId) => {
        const items = rankProjects(boardId, {}, 10);
        return (
          <section key={boardId} className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="text-xl font-semibold">
                  {t(`boards.${boardId}`)}
                </h2>
                <p className="text-sm text-zinc-500">
                  {t(`boardDesc.${boardId}`)}
                </p>
              </div>
              <Link
                href={`/rankings/${boardId}`}
                className="text-sm font-medium text-teal-600 hover:underline dark:text-teal-400"
              >
                {t("home.viewAll")} →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <ProjectCard
                  key={item.project.slug}
                  item={item}
                  locale={locale}
                  compact
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
