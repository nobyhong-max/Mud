"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { FilterState } from "@/lib/types";
import { filtersToSearchParams } from "@/lib/projects";
import { cn } from "@/lib/utils";

const REGIONS = ["all", "Global", "US", "EU", "CN", "JP"] as const;

export function FiltersBar({ allTags }: { allTags: string[] }) {
  const t = useTranslations("filters");
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const current: FilterState = {
    tags: searchParams.get("tags")?.split(",").filter(Boolean),
    region: searchParams.get("region") ?? undefined,
    openSource: searchParams.get("openSource") === "1" ? true : undefined,
    bootstrapped: searchParams.get("bootstrapped") === "1" ? true : undefined,
    q: searchParams.get("q") ?? undefined,
  };

  const pushFilters = useCallback(
    (next: FilterState) => {
      const sp = filtersToSearchParams(next);
      const qs = sp.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [pathname, router],
  );

  const toggleTag = (tag: string) => {
    const set = new Set(current.tags ?? []);
    if (set.has(tag)) set.delete(tag);
    else set.add(tag);
    pushFilters({ ...current, tags: [...set] });
  };

  return (
    <div
      className={cn(
        "space-y-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40",
        pending && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">{t("region")}</span>
          <select
            className="h-9 rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"
            value={current.region ?? "all"}
            onChange={(e) =>
              pushFilters({
                ...current,
                region: e.target.value === "all" ? undefined : e.target.value,
              })
            }
          >
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r === "all" ? t("regionAll") : r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!current.openSource}
            onChange={(e) =>
              pushFilters({
                ...current,
                openSource: e.target.checked ? true : undefined,
              })
            }
          />
          {t("openSource")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!current.bootstrapped}
            onChange={(e) =>
              pushFilters({
                ...current,
                bootstrapped: e.target.checked ? true : undefined,
              })
            }
          />
          {t("bootstrapped")}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => pushFilters({ q: current.q })}
        >
          {t("clear")}
        </Button>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          {t("tags")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map((tag) => {
            const active = current.tags?.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition",
                  active
                    ? "border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
