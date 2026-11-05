import type { LandingData } from "@/types/landing";
import type { PublicPlan } from "@/types/pricing";

/**
 * Fixtures for the tests of every page that reads GET /public/landing (the landing page and the Colleges, Students, Rewards and Vault pages).
 * Every value is chosen so that it is NOT a default the page could print on its own: a 65% Vault bar, a 9:30 PM contest, 90 minutes, so a
 * passing test proves the page is quoting the backend.
 */
export const HOUR = 3_600_000;
export const inFuture = (ms: number) => new Date(Date.now() + ms).toISOString();

/** Values chosen so that none of them is a default the page could have printed on its own: a 65% bar, a 9:30 PM contest, 90 minutes. */
export function landing(overrides: Partial<LandingData> = {}): LandingData {
  return {
    generated_at: new Date().toISOString(),
    policy: {
      vault_bar: 65,
      daily: { name: "AptRun Daily Challenge", start_label: "9:30 PM IST", duration_minutes: 90, problems: 3, points: 600, timezone: "Asia/Kolkata" },
      week: { resets_on: "Monday", timezone: "Asia/Kolkata" },
    },
    stats: {
      depth: {
        problems: 2105,
        test_cases: 15432,
        languages: 19,
        interview_questions: 5200,
        interview_stacks: 40,
        interview_domains: 12,
        assessment_questions: 4225,
        company_packs: 9,
        company_questions: 378,
        departments: 4,
        branches: 31,
      },
      adoption: { students: null, colleges: null, contests_held: null, solutions_judged: null, vouchers_sent: null },
    },
    contest: { title: "AptRun Daily Challenge — 05 Nov 2026", start_at: inFuture(3 * HOUR), ends_at: inFuture(4.5 * HOUR), is_live: false, registration: "open", registered: null },
    rewards: {
      live: true,
      week: { key: "2026-11-02", starts_at: inFuture(-2 * 24 * HOUR), resets_at: inFuture(4 * 24 * HOUR) },
      prizes: [
        { rank: 1, brand: "Burger King", amount: 499, logo: "/rewards/burger-king.svg", color: "#D62300", tagline: "A Whopper meal on us" },
        { rank: 2, brand: "Domino's", amount: 299, logo: "/rewards/dominos.svg", color: "#006491", tagline: "Pizza night, sorted" },
      ],
      next: null,
      participants: null,
      shelf: [
        { key: "burger_king", brand: "Burger King", logo: "/rewards/burger-king.svg", color: "#D62300" },
        { key: "dominos", brand: "Domino's", logo: "/rewards/dominos.svg", color: "#006491" },
        { key: "amazon", brand: "Amazon", logo: "/rewards/amazon.svg", color: "#FF9900" },
      ],
    },
    companies: [
      { name: "Infosys", slug: "infosys", industry: "IT Services", questions: 42 },
      { name: "Wipro", slug: "wipro", industry: "IT Services", questions: 42 },
    ],
    departments: [
      { code: "engineering", name: "Engineering & Technology", short: "Engineering", description: "CSE, IT, ECE, EEE, Mechanical and Civil.", accent: "indigo", icon: "cpu", disciplines: 9 },
      { code: "management", name: "Management & Business Administration", short: "Management", description: "BBA, MBA and allied programmes.", accent: "violet", icon: "briefcase", disciplines: 3 },
    ],
    ...overrides,
  };
}

export const plan = (code: string, name: string, list: number, pct: number, extra: Partial<PublicPlan> = {}): PublicPlan => {
  const discount = pct === 0 ? 0 : list - Math.round((list * (100 - pct)) / 100);
  return {
    code,
    name,
    list_price: list,
    discount_percent: pct,
    discount_amount: discount,
    sale_price: list - discount,
    term_days: list === 0 ? null : 365,
    term_unit: list === 0 ? null : "year",
    is_free: list === 0,
    contact_only: false,
    entitlements: {
      practice_problems_per_day: 1,
      mock_interviews_per_day: null,
      free_trial_uses: 1,
      drive_access: true,
      hackathon_access: code !== "coder",
      vault_access: code !== "coder",
      project_lab_access: code !== "coder",
      workspace_hours_per_month: null,
      active_projects: null,
    },
    ...extra,
  };
};
export const PLANS = [plan("coder", "Coder", 0, 0), plan("expert", "Expert", 1999, 40), plan("grandmaster", "Grandmaster", 0, 0, { contact_only: true })];

/** Answers each endpoint a landing-backed page reads. `null` for the landing answer = the backend is down. */
export function answers(data: LandingData | null) {
  return (path: string) => {
    if (path === "/public/landing") return data ? Promise.resolve(data) : Promise.reject(new Error("offline"));
    if (path === "/public/plans") return Promise.resolve({ currency: "INR", plans: PLANS });
    return Promise.resolve({});
  };
}