// Mirrors the JSON shape returned by GET/POST /api/me/subscription and
// POST /api/admin/colleges/{college}/subscription (see backend
// SubscriptionController::formatCoverage).

import type { ProjectLabSummary } from "./projectLab";

export type SubscriptionScope = "individual" | "institution" | "internal";
export type CoverageSource = "individual" | "institution" | "none";

export interface CoveragePlan {
  code: string;
  name: string;
  audience: "individual" | "institution";
}

export interface SubscriptionCoverage {
  source: CoverageSource;
  days_remaining: number | null;
  /** True when this period's length was a superadmin-chosen demo length rather than the plan's normal duration — see SubscriptionService::activate()'s $trialDays param. */
  is_trial: boolean;
  status: "active" | "expired" | "canceled" | null;
  started_at: string | null;
  current_period_end: string | null;
  plan: CoveragePlan | null;
}

/**
 * The plan-tier limits AND today's usage against them — only meaningful for
 * `scope: "individual"` (a student), null limits mean unlimited. See
 * SubscriptionController::entitlementsWithUsage() on the backend.
 */
export interface Entitlements {
  max_practice_problems_per_day: number | null;
  practice_problems_used_today: number;
  max_mock_interviews_per_day: number | null;
  mock_interviews_used_today: number;
  drive_access: boolean;
}

/** An active add-on (e.g. Project Lab) the student holds alongside their plan. */
export interface AddonSubscription {
  code: string;
  name: string;
  days_remaining: number | null;
  current_period_end: string | null;
  /** What was actually charged for it (a bundled add-on is discounted). */
  price_paid: number | null;
}

export interface MySubscriptionResponse {
  scope: SubscriptionScope;
  coverage: SubscriptionCoverage | null;
  entitlements?: Entitlements;
  /** Individual scope only. */
  addons?: AddonSubscription[];
  project_lab?: ProjectLabSummary;
}
