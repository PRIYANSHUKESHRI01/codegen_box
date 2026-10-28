// Mirrors the JSON shape returned by GET/POST /api/me/subscription and
// POST /api/admin/colleges/{college}/subscription (see backend
// SubscriptionController::formatCoverage).

import type { CheckoutInfo } from "./payments";
import type { ProjectLabSummary } from "./projectLab";

/**
 * The free plan's one-time tries of each AI practice feature (see PlanGate on
 * the backend): how many each feature allows and how many this student has
 * spent. null on `Entitlements.feature_trial` for every plan without a cap.
 */
export interface FeatureTrial {
  uses_per_feature: number;
  used: { mock_interview: number; speaking: number; listening: number; vocabulary: number };
}

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
  /** Hack Arena: register and submit. Browsing the lobby is open to everyone. */
  hackathon_access: boolean;
  /** Being listed in the Vault and hired through Mellow Vault (earning the readiness score is open to everyone). */
  vault_access: boolean;
  /** Core Prep: practice answered per day (null = unlimited), timed tests, and whether Core Prep exists for this student at all. */
  max_core_practice_per_day?: number | null;
  core_practice_used_today?: number;
  core_tests_access?: boolean;
  core_prep?: { available: boolean; discipline: string | null; family: boolean; live: boolean; pilot?: boolean; has_content: boolean };
  feature_trial: FeatureTrial | null;
}

/** An active add-on the student holds alongside their plan. Project Lab was one before it became part of Expert; rows bought back then run to the end of their period. */
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
  /** Individual scope only: whether the Buy buttons can work (the server has its payment gateway's credentials), which gateway that is, and in which mode. */
  checkout?: CheckoutInfo;
}

/**
 * GET /me/plan-signal — the cheap "did my plan change?" check every open
 * dashboard polls (see lib/planSync.ts). `signature` changes whenever anything
 * that decides what the account may do changes: the plan, its end date, an
 * add-on, or the plan's own limits being edited.
 */
export interface PlanSignal {
  signature: string;
  /** What the college has filed about a student (year, section) — moves when a TPO edits it; null for staff. Separate from `signature`: it is never a plan change. */
  academic_signature?: string | null;
  source: CoverageSource;
  /** The plan the account is on right now; null when none is running. */
  plan: { code: string; name: string } | null;
  days_remaining: number | null;
}
