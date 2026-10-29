// Mirrors the JSON of GET /api/public/plans (PublicPlanController) and the
// superadmin plan endpoints (SuperAdminPlanController). Prices are whole
// rupees. `list_price` is the "real" price (shown struck through when there is
// a discount); `sale_price` is what is actually charged.

export interface PlanEntitlements {
  /** null = unlimited. */
  practice_problems_per_day: number | null;
  /** null = unlimited (or, on the free plan, replaced by the one-time trial below). */
  mock_interviews_per_day: number | null;
  /** The free plan's one-time tries of each AI practice feature; null on every paid plan. */
  free_trial_uses: number | null;
  drive_access: boolean;
  hackathon_access: boolean;
  vault_access: boolean;
  project_lab_access: boolean;
  workspace_hours_per_month: number | null;
  active_projects: number | null;
}

export interface PlanPricing {
  code: string;
  name: string;
  list_price: number;
  discount_percent: number;
  discount_amount: number;
  sale_price: number;
  /** Length of one billing term in days (365 for the yearly plans); null = the plan never expires (free). */
  term_days: number | null;
  /** "year" | "month" | "3 years" | "N days" — null for a plan that never expires. */
  term_unit: string | null;
  is_free: boolean;
  /**
   * Sold by our team, not at checkout (Grandmaster / Mellow Academy). The price figures above are zero and
   * mean nothing: show "contact our team", never ₹0.
   */
  contact_only: boolean;
  /**
   * The superadmin has discounted this plan by 100%: students get it by redeeming the offer, never by paying, and the
   * payment gateway is not involved. Show "Free" and a Redeem button, not ₹0 and Buy. Absent on servers from before
   * the free offer existed — that means "no".
   */
  redeemable?: boolean;
}

export interface PublicPlan extends PlanPricing {
  entitlements: PlanEntitlements;
}

export interface PublicPlansResponse {
  currency: string;
  plans: PublicPlan[];
}

/** A plan as the superadmin's Plans & Pricing editor sees it. */
export interface AdminPlan extends PublicPlan {
  id: number;
  is_editable: boolean;
  is_active: boolean;
  /** Students currently on this plan (active and in date). */
  active_subscribers: number;
  /** How many times students have taken this plan through the free offer, ever. */
  redemptions?: number;
  pricing_updated_by_name: string | null;
  pricing_updated_at: string | null;
  /** What the editor started from; sent back so a concurrent change is refused instead of overwritten. */
  version: string;
  /** What the plan includes, as stored — see PlanLimits. */
  limits: PlanLimits;
  /** The limits editor's own concurrency token. */
  limits_version: string;
}

export interface AdminPlansResponse {
  currency: string;
  limits: { max_list_price: number; max_discount_percent: number };
  plans: AdminPlan[];
}

/**
 * The plan columns that decide what a student on the plan may do, exactly as
 * stored (null = unlimited). What the superadmin's "What's included" editor edits,
 * and sends back whole — an omitted field is refused rather than read as unlimited.
 */
export interface PlanLimits {
  max_practice_problems_per_day: number | null;
  max_mock_interviews_per_day: number | null;
  max_learning_centre_ai_attempts_per_day: number | null;
  /** The free plan's one-time tries of each AI feature; null = no trial cap. */
  feature_trial_uses: number | null;
  drive_access: boolean;
  hackathon_access: boolean;
  vault_access: boolean;
  project_lab_access: boolean;
  max_workspace_hours_per_month: number | null;
  max_active_projects: number | null;
  /** Core Prep topic-practice questions per day for a non-CS student; null = unlimited. */
  max_core_practice_per_day?: number | null;
  /** Timed Core tests (the free plan gets its one-time trial instead when this is off). */
  core_tests_access?: boolean;
}
