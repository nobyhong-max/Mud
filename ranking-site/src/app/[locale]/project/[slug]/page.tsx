import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { projectTagline } from "@/lib/display";
import { getAllProjects, getProjectBySlug } from "@/lib/projects";
import { formatNumber, formatUsd } from "@/lib/utils";

export function generateStaticParams() {
  const slugs = getAllProjects().map((p) => p.slug);
  return slugs.flatMap((slug) =>
    ["zh", "en"].map((locale) => ({ locale, slug })),
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ locale: Locale; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const scores = project.scores;

  return (
    <div className="space-y-8">
      <Link
        href="/rankings/buzz"
        className="text-sm text-teal-600 hover:underline dark:text-teal-400"
      >
        ← {t("project.back")}
      </Link>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{project.name}</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          {projectTagline(project, locale)}
        </p>
        <div className="flex flex-wrap gap-2">
          {project.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scores.mrr_usd != null && (
          <MetricCard label={t("metric.mrr")} value={formatUsd(scores.mrr_usd, true)} />
        )}
        {scores.buzz_score != null && (
          <MetricCard label={t("metric.buzz")} value={String(scores.buzz_score)} />
        )}
        {scores.github_stars != null && (
          <MetricCard
            label={t("metric.stars")}
            value={formatNumber(scores.github_stars)}
          />
        )}
        {scores.growth_mom_pct != null && (
          <MetricCard
            label={t("metric.growth")}
            value={`${scores.growth_mom_pct}% MoM`}
          />
        )}
        {scores.maker_rating != null && (
          <MetricCard
            label={t("metric.rating")}
            value={`${scores.maker_rating} / 5`}
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t("project.links")}</h2>
        <ul className="space-y-1 text-sm">
          {project.website_url && (
            <li>
              <a
                href={project.website_url}
                className="text-teal-600 hover:underline dark:text-teal-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("project.website")}
              </a>
            </li>
          )}
          {project.github_url && (
            <li>
              <a
                href={project.github_url}
                className="text-teal-600 hover:underline dark:text-teal-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("project.github")}
              </a>
            </li>
          )}
          {project.product_hunt_url && (
            <li>
              <a
                href={project.product_hunt_url}
                className="text-teal-600 hover:underline dark:text-teal-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("project.productHunt")}
              </a>
            </li>
          )}
        </ul>
      </section>

      {(project.region || project.funding || project.team_size_max) && (
        <section className="grid gap-2 text-sm sm:grid-cols-3">
          {project.region && (
            <p>
              <span className="text-zinc-500">{t("project.region")}: </span>
              {project.region}
            </p>
          )}
          {project.funding && (
            <p>
              <span className="text-zinc-500">{t("project.funding")}: </span>
              {project.funding}
            </p>
          )}
          {project.team_size_max != null && (
            <p>
              <span className="text-zinc-500">{t("project.team")}: </span>
              ≤{project.team_size_max}
            </p>
          )}
        </section>
      )}

      {project.score_sources && Object.keys(project.score_sources).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">{t("project.sources")}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            {Object.entries(project.score_sources).map(([key, note]) => (
              <li key={key}>
                <span className="font-mono text-xs">{key}</span>: {note}
                {project.confidence?.[key] && (
                  <span className="ml-2 text-zinc-500">
                    ({t(`confidence.${project.confidence[key]}`)})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {project.editorial_note && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <h2 className="font-semibold">{t("project.editorial")}</h2>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {project.editorial_note}
          </p>
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
