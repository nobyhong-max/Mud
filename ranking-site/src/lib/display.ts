import { taglinesEn } from "./taglines-en";
import type { Locale } from "@/i18n/routing";
import type { SeedProject } from "./types";
import { formatNumber, formatUsd } from "./utils";

export function projectTagline(project: SeedProject, locale: Locale): string {
  if (locale === "en") {
    return taglinesEn[project.slug] ?? project.tagline;
  }
  return project.tagline;
}

export function formatPrimaryMetric(
  labelKey: string,
  value: number | null,
): string {
  if (value == null) return "—";
  if (labelKey === "metric.mrr") return formatUsd(value, true);
  if (labelKey === "metric.stars") return `⭐ ${formatNumber(value)}`;
  if (labelKey === "metric.rating") return `${value.toFixed(1)} / 5`;
  if (labelKey === "metric.growth") return `${value}%`;
  return formatNumber(value);
}
