// Mirrors the JSON of GET /api/public/landing (PublicLandingController → LandingDataService). Every fact the marketing page quotes
// arrives here; a block the server could not build comes back null and the page leaves it out.

export interface LandingPolicy {
  /** Readiness score at which Mellow Vault opens (config vault.enter_score). */
  vault_bar: number;
  daily: {
    name: string;
    /** "8:00 PM IST" */
    start_label: string;
    duration_minutes: number;
    problems: number;
    points: number;
    timezone: string;
  };
  week: { resets_on: string; timezone: string };
}

/** What a student gets: always returned, always true. */
export interface LandingDepth {
  problems: number;
  test_cases: number;
  languages: number;
  interview_questions: number;
  interview_stacks: number;
  interview_domains: number;
  assessment_questions: number;
  company_packs: number;
  company_questions: number;
  departments: number;
  branches: number;
}

/** How many use it: null until the figure is worth printing (config/landing.php floors). */
export interface LandingAdoption {
  students: number | null;
  colleges: number | null;
  contests_held: number | null;
  solutions_judged: number | null;
  vouchers_sent: number | null;
}

export interface LandingContest {
  title: string;
  start_at: string;
  ends_at: string;
  is_live: boolean;
  registration: "not_open" | "open" | "closed" | null;
  registered: number | null;
}

export interface LandingPrize {
  rank: number;
  brand: string;
  amount: number;
  /** A file in /public/rewards. */
  logo: string;
  color: string;
  tagline: string;
}

export interface LandingShelfBrand {
  key: string;
  brand: string;
  logo: string;
  color: string;
}

export interface LandingRewards {
  /** False in a week with nothing on offer; the page then shows the shelf and says the lineup is announced weekly. */
  live: boolean;
  week: { key: string; starts_at: string; resets_at: string };
  prizes: LandingPrize[];
  /** Next week's lineup, once the superadmin has chosen it. */
  next: { week: { key: string; starts_at: string; resets_at: string }; prizes: LandingPrize[] } | null;
  participants: number | null;
  shelf: LandingShelfBrand[];
}

export interface LandingCompany {
  name: string;
  slug: string;
  industry: string | null;
  questions: number;
}

export interface LandingDepartment {
  code: string;
  name: string;
  short: string;
  description: string;
  /** A tone name the landing page already draws (indigo, violet, emerald, rose …). */
  accent: string;
  /** "cpu", "briefcase", "calculator", "landmark" — the department's own icon name. */
  icon: string;
  disciplines: number;
}

export interface LandingData {
  generated_at: string;
  policy: LandingPolicy;
  stats: { depth: LandingDepth; adoption: LandingAdoption } | null;
  contest: LandingContest | null;
  rewards: LandingRewards | null;
  companies: LandingCompany[];
  departments: LandingDepartment[];
}
