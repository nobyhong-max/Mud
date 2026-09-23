export type Confidence = "verified" | "reported" | "estimated";

export type Funding =
  | "bootstrapped"
  | "seed"
  | "series_a"
  | "enterprise";

export interface ProjectScores {
  mrr_usd?: number | null;
  revenue_30d_usd?: number;
  revenue_4mo_usd?: number;
  revenue_5mo_usd?: number;
  revenue_lifetime_usd?: number;
  arr_usd?: number;
  buzz_score?: number;
  growth_mom_pct?: number;
  stars_delta_30d_pct?: number;
  github_stars?: number | null;
  maker_rating?: number;
  ph_upvotes?: number;
  ph_day_rank?: number;
}

export interface SeedProject {
  slug: string;
  name: string;
  tagline: string;
  tags: string[];
  region: string;
  website_url?: string;
  github_url?: string;
  product_hunt_url?: string;
  founder_name?: string;
  founder_x_handle?: string;
  team_size_max?: number;
  funding?: Funding;
  is_open_source?: boolean;
  launched_at?: string;
  scores: ProjectScores;
  score_sources?: Record<string, string>;
  confidence?: Record<string, Confidence>;
  editorial_note?: string;
}

export interface SeedData {
  schema_version: number;
  generated_at: string;
  projects: SeedProject[];
}

export type MainBoardId =
  | "revenue"
  | "buzz"
  | "growth"
  | "oss-stars"
  | "maker-love";

export type SegmentBoardId =
  | "vibe-coding"
  | "ai-media"
  | "ai-agents"
  | "local-ai"
  | "cn-indie"
  | "micro-saas";

export type BoardId = MainBoardId | SegmentBoardId;

export interface FilterState {
  tags?: string[];
  region?: string;
  openSource?: boolean;
  bootstrapped?: boolean;
  q?: string;
}

export interface RankedProject {
  project: SeedProject;
  rank: number;
  primaryMetric: string;
  primaryValue: number | null;
  trend?: number | null;
}
