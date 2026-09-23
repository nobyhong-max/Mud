import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { MAIN_BOARD_IDS } from "@/lib/boards";
import { getLastRefreshedAt } from "@/lib/projects";

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("methodology");
  const tBoards = await getTranslations("boards");
  const tDesc = await getTranslations("boardDesc");

  return (
    <article className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">{t("title")}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{t("intro")}</p>
      <p className="text-sm text-zinc-500">
        {t("snapshot")}: {getLastRefreshedAt()}
      </p>
      <section>
        <h2 className="text-xl font-semibold">{t("boardsTitle")}</h2>
        <ul className="mt-3 space-y-3">
          {MAIN_BOARD_IDS.map((id) => (
            <li
              key={id}
              className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <p className="font-medium">{tBoards(id)}</p>
              <p className="text-sm text-zinc-500">{tDesc(id)}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
