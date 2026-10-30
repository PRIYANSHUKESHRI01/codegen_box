/** Shapes and helpers shared by the Partner Universities screen and its cards / dialogs. */

export type CollegeTier = "Academic Enterprise" | "Pro Campus" | "Standard" | "Custom";

export interface ApiCollege {
  id: number;
  name: string;
  short_code: string;
  city?: string | null;
  state?: string | null;
  tier: CollegeTier;
  placement_rate: string;
  is_active: boolean;
  active_students_count?: number;
  created_at: string;
  users?: { id: number; name: string; email: string; is_blocked: boolean }[];
  subscription_days_remaining?: number | null;
  subscription_status?: string | null;
  subscription_is_trial?: boolean;
  /** Null = unlimited (Academic Enterprise, or a custom plan negotiated as unlimited). */
  plan_max_students?: number | null;
  /** The departments the college runs (Engineering, Management, Commerce, Arts …). */
  departments?: string[] | null;
}

export type CollegeStatus = "Active" | "Pending" | "Suspended";

export interface College {
  id: string;
  name: string;
  shortCode: string;
  city: string;
  state: string;
  tpoName: string;
  tpoEmail: string;
  activeStudents: number;
  tier: CollegeTier;
  placementRate: number;
  status: CollegeStatus;
  joinedDate: string;
  /** Epoch ms of onboarding — what "newest first" sorts on. */
  createdAt: number;
  tpoUserId?: number;
  tpoBlocked?: boolean;
  subscriptionDaysRemaining: number | null;
  subscriptionStatus: string | null;
  subscriptionIsTrial: boolean;
  planMaxStudents: number | null;
  departments: string[];
}

export function mapCollegeFromApi(college: ApiCollege): College {
  const tpo = college.users?.[0];
  return {
    id: String(college.id),
    name: college.name,
    shortCode: college.short_code,
    city: college.city ?? "",
    state: college.state ?? "",
    tpoName: tpo?.name ?? "Unassigned",
    tpoEmail: tpo?.email ?? "—",
    activeStudents: college.active_students_count ?? 0,
    tier: college.tier,
    placementRate: Number(college.placement_rate),
    status: tpo?.is_blocked ? "Suspended" : college.is_active ? "Active" : "Pending",
    joinedDate: new Date(college.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    createdAt: new Date(college.created_at).getTime() || 0,
    tpoUserId: tpo?.id,
    tpoBlocked: tpo?.is_blocked ?? false,
    subscriptionDaysRemaining: college.subscription_days_remaining ?? null,
    subscriptionStatus: college.subscription_status ?? null,
    subscriptionIsTrial: college.subscription_is_trial ?? false,
    planMaxStudents: college.plan_max_students ?? null,
    departments: college.departments && college.departments.length > 0 ? college.departments : ["engineering"],
  };
}

export const PLAN_CODE_BY_TIER: Record<"Academic Enterprise" | "Pro Campus" | "Standard", string> = {
  Standard: "standard",
  "Pro Campus": "pro-campus",
  "Academic Enterprise": "academic-enterprise",
};

export const TIER_STYLE: Record<CollegeTier, string> = {
  "Academic Enterprise": "bg-purple-500/10 text-purple-500 border-purple-500/25",
  "Pro Campus": "bg-cyan-500/10 text-cyan-500 border-cyan-500/25",
  Custom: "bg-rose-500/10 text-rose-500 border-rose-500/25",
  Standard: "bg-amber-500/10 text-amber-500 border-amber-500/25",
};

/** A plan with this many days or fewer left is shown as "renew soon". */
export const RENEW_SOON_DAYS = 14;

export type CollegeFilter = "all" | "active" | "suspended" | "renewing" | "no-plan";

export function matchesFilter(c: College, filter: CollegeFilter): boolean {
  switch (filter) {
    case "active":
      return c.status === "Active";
    case "suspended":
      return c.status === "Suspended";
    case "renewing":
      return c.subscriptionDaysRemaining !== null && c.subscriptionDaysRemaining <= RENEW_SOON_DAYS;
    case "no-plan":
      return c.subscriptionDaysRemaining === null;
    default:
      return true;
  }
}

export type SortKey = "newest" | "name" | "students" | "placement" | "plan";
export type SortDir = "asc" | "desc";

/** Which way each column sorts the first time it is clicked: names A to Z, numbers biggest first, plan by soonest expiry. */
export const DEFAULT_DIR: Record<SortKey, SortDir> = { newest: "desc", name: "asc", students: "desc", placement: "desc", plan: "asc" };

export const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest first",
  name: "Name",
  students: "Students",
  placement: "Placement rate",
  plan: "Plan expiry",
};

export function compareColleges(a: College, b: College, key: SortKey, dir: SortDir): number {
  const sign = dir === "asc" ? 1 : -1;
  const byName = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

  switch (key) {
    case "name":
      return sign * byName;
    case "students":
      return sign * (a.activeStudents - b.activeStudents) || byName;
    case "placement":
      return sign * (a.placementRate - b.placementRate) || byName;
    case "plan": {
      // A college with no running plan is the most urgent row in the list, so it sorts as "expires first" ascending.
      const da = a.subscriptionDaysRemaining ?? -1;
      const db = b.subscriptionDaysRemaining ?? -1;
      return sign * (da - db) || byName;
    }
    default:
      return sign * (a.createdAt - b.createdAt) || byName;
  }
}

/** Seat usage as a whole percentage, or null when there is no fixed seat count (unlimited / no plan). */
export function seatPercent(c: College): number | null {
  return c.planMaxStudents ? Math.min(100, Math.round((c.activeStudents / c.planMaxStudents) * 100)) : null;
}

export function seatTone(pct: number | null): string {
  return pct === null ? "" : pct >= 100 ? "bg-status-danger" : pct >= 85 ? "bg-status-warning" : "bg-accent-primary";
}
