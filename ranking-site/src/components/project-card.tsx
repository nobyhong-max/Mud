import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatPrimaryMetric, projectTagline } from "@/lib/display";
import type { RankedProject } from "@/lib/types";
import { cn } from "@/lib/utils";

export async function ProjectCard({
  item,
  locale,
  compact,
}: {
  item: RankedProject;
  locale: Locale;
  compact?: boolean;
}) {
  const t = await getTranslations();
  const { project, rank, primaryMetric, primaryValue, trend } = item;
  const hasVerified = Object.values(project.confidence ?? {}).includes(
    "verified",
  );

  return (
    <Link
      href={`/project/${project.slug}`}
      className={cn(
        "group block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-teal-500/50 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-teal-500/40",
        compact && "p-3",
      )}
    >
      <div className="flex items-start gap-3">
        <RankBadge rank={rank} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="truncate font-semibold text-zinc-900 group-hover:text-teal-600 dark:text-zinc-50 dark:group-hover:text-teal-400">
              {project.name}
            </h3>
            <span className="shrink-0 text-lg font-semibold tabular-nums text-teal-600 dark:text-teal-400">
              {formatPrimaryMetric(primaryMetric, primaryValue)}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-zinc-500">
            {projectTagline(project, locale)}
          </p>
          {trend != null && trend !== 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              {trend > 0
                ? t("metric.trendUp", { pct: trend })
                : t("metric.trendDown", { pct: Math.abs(trend) })}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.is_open_source && (
              <Badge variant="secondary">{t("badges.openSource")}</Badge>
            )}
            {project.funding === "bootstrapped" && (
              <Badge variant="secondary">{t("badges.bootstrapped")}</Badge>
            )}
            {hasVerified && (
              <Badge variant="verified">{t("badges.verified")}</Badge>
            )}
            {project.tags.slice(0, compact ? 2 : 4).map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "text-amber-500"
      : rank === 2
        ? "text-zinc-400"
        : rank === 3
          ? "text-orange-600"
          : "text-zinc-400";
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-bold tabular-nums dark:bg-zinc-900",
        medal,
      )}
    >
      #{rank}
    </span>
  );
}
