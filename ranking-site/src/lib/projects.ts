import seedData from "../../data/seed.json";
import {
  defaultSortBoardForSegment,
  isSegmentBoard,
  segmentTagFilter,
} from "./boards";
import type {
  BoardId,
  FilterState,
  MainBoardId,
  ProjectScores,
  RankedProject,
  SeedData,
  SeedProject,
} from "./types";

const data = seedData as unknown as SeedData;

export function getLastRefreshedAt(): string {
  return data.generated_at;
}

export function getAllProjects(): SeedProject[] {
  return data.projects;
}

export function getProjectBySlug(slug: string): SeedProject | undefined {
  return data.projects.find((p) => p.slug === slug);
}

function revenueSortValue(scores: ProjectScores): number {
  if (scores.mrr_usd != null && scores.mrr_usd > 0) return scores.mrr_usd;
  if (scores.revenue_30d_usd) return scores.revenue_30d_usd * 0.8;
  if (scores.revenue_4mo_usd) return (scores.revenue_4mo_usd / 4) * 0.8;
  if (scores.revenue_5mo_usd) return (scores.revenue_5mo_usd / 5) * 0.8;
  if (scores.arr_usd) return (scores.arr_usd / 12) * 0.8;
  return scores.mrr_usd ?? 0;
}

function growthEligible(p: SeedProject): boolean {
  const s = p.scores;
  const mrr = s.mrr_usd ?? 0;
  const stars = s.github_stars ?? 0;
  return mrr >= 500 || stars >= 500;
}

function compareConfidence(a: SeedProject, b: SeedProject, key: string): number {
  const rank = (c?: string) =>
    c === "verified" ? 3 : c === "reported" ? 2 : c === "estimated" ? 1 : 0;
  return rank(b.confidence?.[key]) - rank(a.confidence?.[key]);
}

function sortProjects(
  projects: SeedProject[],
  board: MainBoardId,
): SeedProject[] {
  const sorted = [...projects];
  sorted.sort((a, b) => {
    let diff = 0;
    switch (board) {
      case "revenue":
        diff = revenueSortValue(b.scores) - revenueSortValue(a.scores);
        if (diff === 0) diff = compareConfidence(a, b, "mrr_usd");
        break;
      case "buzz":
        diff = (b.scores.buzz_score ?? 0) - (a.scores.buzz_score ?? 0);
        break;
      case "growth": {
        const ga =
          a.scores.growth_mom_pct ?? a.scores.stars_delta_30d_pct ?? -1;
        const gb =
          b.scores.growth_mom_pct ?? b.scores.stars_delta_30d_pct ?? -1;
        diff = gb - ga;
        break;
      }
      case "oss-stars":
        diff = (b.scores.github_stars ?? 0) - (a.scores.github_stars ?? 0);
        break;
      case "maker-love":
        diff = (b.scores.maker_rating ?? 0) - (a.scores.maker_rating ?? 0);
        break;
    }
    if (diff === 0) diff = a.slug.localeCompare(b.slug);
    return diff;
  });
  return sorted;
}

export function applyFilters(
  projects: SeedProject[],
  filters: FilterState,
): SeedProject[] {
  let result = projects;

  if (filters.tags?.length) {
    result = result.filter((p) =>
      filters.tags!.every((t) => p.tags.includes(t)),
    );
  }

  if (filters.region && filters.region !== "all") {
    result = result.filter((p) => p.region === filters.region);
  }

  if (filters.openSource === true) {
    result = result.filter((p) => p.is_open_source === true);
  }

  if (filters.bootstrapped === true) {
    result = result.filter((p) => p.funding === "bootstrapped");
  }

  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    result = result.filter((p) => {
      const hay = [
        p.name,
        p.slug,
        p.founder_x_handle ?? "",
        ...p.tags,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  return result;
}

function primaryForBoard(
  project: SeedProject,
  board: MainBoardId,
): { labelKey: string; value: number | null; trend?: number | null } {
  const s = project.scores;
  switch (board) {
    case "revenue":
      return {
        labelKey: "metric.mrr",
        value: revenueSortValue(s) || null,
        trend: s.growth_mom_pct ?? null,
      };
    case "buzz":
      return {
        labelKey: "metric.buzz",
        value: s.buzz_score ?? null,
        trend: null,
      };
    case "growth":
      return {
        labelKey: "metric.growth",
        value: s.growth_mom_pct ?? s.stars_delta_30d_pct ?? null,
        trend: null,
      };
    case "oss-stars":
      return {
        labelKey: "metric.stars",
        value: s.github_stars ?? null,
        trend: s.stars_delta_30d_pct ?? null,
      };
    case "maker-love":
      return {
        labelKey: "metric.rating",
        value: s.maker_rating ?? null,
        trend: null,
      };
  }
}

export function rankProjects(
  board: BoardId,
  filters: FilterState = {},
  limit?: number,
): RankedProject[] {
  const sortBoard: MainBoardId = isSegmentBoard(board)
    ? defaultSortBoardForSegment()
    : board;

  let pool = getAllProjects();

  if (isSegmentBoard(board)) {
    const match = segmentTagFilter(board);
    pool = pool.filter((p) => match(p.tags));
  }

  if (sortBoard === "growth") {
    pool = pool.filter(growthEligible);
  }

  if (sortBoard === "oss-stars") {
    pool = pool.filter((p) => (p.scores.github_stars ?? 0) > 0);
  }

  if (sortBoard === "maker-love") {
    pool = pool.filter((p) => (p.scores.maker_rating ?? 0) > 0);
  }

  pool = applyFilters(pool, filters);
  const sorted = sortProjects(pool, sortBoard);

  const slice = limit ? sorted.slice(0, limit) : sorted;

  return slice.map((project, index) => {
    const primary = primaryForBoard(project, sortBoard);
    return {
      project,
      rank: index + 1,
      primaryMetric: primary.labelKey,
      primaryValue: primary.value,
      trend: primary.trend,
    };
  });
}

export function parseFiltersFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): FilterState {
  const get = (key: string) => {
    const v = params[key];
    if (Array.isArray(v)) return v[0];
    return v;
  };

  const tagsRaw = get("tags");
  const tags = tagsRaw ? tagsRaw.split(",").filter(Boolean) : undefined;

  return {
    tags,
    region: get("region") ?? undefined,
    openSource: get("openSource") === "1" ? true : undefined,
    bootstrapped: get("bootstrapped") === "1" ? true : undefined,
    q: get("q") ?? undefined,
  };
}

export function filtersToSearchParams(filters: FilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (filters.tags?.length) sp.set("tags", filters.tags.join(","));
  if (filters.region && filters.region !== "all")
    sp.set("region", filters.region);
  if (filters.openSource) sp.set("openSource", "1");
  if (filters.bootstrapped) sp.set("bootstrapped", "1");
  if (filters.q) sp.set("q", filters.q);
  return sp;
}
