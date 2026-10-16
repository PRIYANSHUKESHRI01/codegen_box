import type { SoftSkillListStatus, SoftSkillSetUsageState } from "@/types/softSkill";

/** How many sets / tests one page holds unless the user picks "Show all". */
export const DEFAULT_PER_PAGE = 20;

export type PerPage = typeof DEFAULT_PER_PAGE | "all";

/**
 * Compact pagination: first, last, a window around the current page, "ellipsis" for gaps — so 3 pages show
 * `1 2 3` and 40 pages show `1 … 19 20 21 … 40`.
 */
export function pageNumbersWithEllipsis(current: number, total: number): (number | "ellipsis")[] {
  const keep = new Set<number>([1, total]);
  for (let d = -1; d <= 1; d++) {
    const p = current + d;
    if (p >= 1 && p <= total) keep.add(p);
  }
  const sorted = Array.from(keep).sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push("ellipsis");
    result.push(p);
    prev = p;
  }
  return result;
}

/** What the student's library page remembers in the address bar, so a refresh, a shared link or Back lands on the same view. */
export interface LibraryViewState {
  q: string;
  status: SoftSkillListStatus;
  page: number;
  perPage: PerPage;
}

export const DEFAULT_VIEW: LibraryViewState = { q: "", status: "all", page: 1, perPage: DEFAULT_PER_PAGE };

const STATUSES: SoftSkillListStatus[] = ["all", "not_attempted", "in_progress", "completed"];

/** Reads a view out of a query string; anything unrecognised falls back to the default rather than breaking the page. */
export function parseLibraryView(search: string): LibraryViewState {
  const params = new URLSearchParams(search);
  const status = params.get("status") as SoftSkillListStatus | null;
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: (params.get("q") ?? "").slice(0, 100),
    status: status && STATUSES.includes(status) ? status : "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    perPage: params.get("per") === "all" ? "all" : DEFAULT_PER_PAGE,
  };
}

/** The inverse — omits everything that is at its default, so the plain page keeps a clean URL. */
export function libraryViewToSearch(view: LibraryViewState): string {
  const params = new URLSearchParams();
  if (view.q.trim()) params.set("q", view.q.trim());
  if (view.status !== "all") params.set("status", view.status);
  if (view.perPage === "all") params.set("per", "all");
  else if (view.page > 1) params.set("page", String(view.page));
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** The API query for a view (`scope` says which list: the AptRun sets, or the tests scheduled for the student). */
export function libraryViewToApiQuery(scope: "sets" | "assigned", view: LibraryViewState): string {
  const params = new URLSearchParams({ scope, per_page: String(view.perPage), page: String(view.perPage === "all" ? 1 : view.page) });
  if (view.q.trim()) params.set("q", view.q.trim());
  if (view.status !== "all") params.set("status", view.status);
  return params.toString();
}

/** "12 Oct 2026" for a usage marker. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export const USAGE_LABELS: Record<SoftSkillSetUsageState, string> = {
  unused: "Not used yet",
  published: "Already published",
  draft: "In a draft test",
  cancelled: "Used in a cancelled test",
};

/**
 * The one-line "where has this set been used" sentence for a set's usage, e.g.
 * `Published in “Round 1” on 12 Oct 2026 (+1 more test)`. Empty for an unused set.
 */
export function describeUsage(usage: { state: SoftSkillSetUsageState; count: number; tests: { title: string; status: string | null; added_at: string | null }[] }): string {
  if (usage.state === "unused" || usage.tests.length === 0) return "";
  // Lead with the most relevant test: a published one beats a draft beats a cancelled one.
  const rank: Record<string, number> = { published: 0, draft: 1, cancelled: 2 };
  const lead = [...usage.tests].sort((a, b) => (rank[a.status ?? "cancelled"] ?? 3) - (rank[b.status ?? "cancelled"] ?? 3))[0];
  const verb = lead.status === "published" ? "Published in" : lead.status === "draft" ? "In draft test" : "Used in cancelled test";
  const when = shortDate(lead.added_at);
  const more = usage.count - 1;
  return `${verb} “${lead.title}”${when ? ` · added ${when}` : ""}${more > 0 ? ` (+${more} more)` : ""}`;
}
