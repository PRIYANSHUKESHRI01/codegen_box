import type { PlanEntitlements, PlanPricing } from "@/types/pricing";

/** The plan every locked-feature prompt sells: the Hack Arena, Project Lab and the Vault come with Expert. */
export const EXPERT_PLAN_CODE = "expert";

/** Grandmaster is Mellow Academy: every AptRun feature for three years plus the Academy programme, arranged with our team and never bought online. */
export const ACADEMY_PLAN_CODE = "grandmaster";

/** The highest tiers a student can hold. From either there is nothing left to upgrade to — Grandmaster is not a step up they buy online. */
export function isTopPlan(code: string | null | undefined): boolean {
  return code === EXPERT_PLAN_CODE || code === ACADEMY_PLAN_CODE;
}

/** ₹1,99,999 — whole rupees with Indian digit grouping. */
export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** "/ year", "/ month", "/ 90 days" for a price's billing term; "" for a plan that never expires. */
export function termSuffix(plan: Pick<PlanPricing, "term_unit">): string {
  return plan.term_unit ? `/ ${plan.term_unit}` : "";
}

/**
 * What a yearly (or any longer-than-a-month) price works out to per month, for
 * the "just ₹100 a month, billed yearly" line. null when there is nothing to
 * spread: a free plan, a plan with no term, or one billed monthly already.
 */
export function monthlyEquivalent(plan: Pick<PlanPricing, "sale_price" | "term_days" | "is_free">): number | null {
  if (plan.is_free || !plan.term_days || plan.term_days <= 31) return null;
  return Math.round(plan.sale_price / (plan.term_days / 30.4375));
}

/** Whether a price is on sale — a discount that actually takes something off. */
export function hasDiscount(plan: Pick<PlanPricing, "discount_percent" | "discount_amount">): boolean {
  return plan.discount_percent > 0 && plan.discount_amount > 0;
}

/**
 * The discount arithmetic, mirrored from the server (Plan::discountFor) so the
 * superadmin's editor can preview a price as they type. The server stays the
 * authority — it recomputes on save, and checkout re-prices on every purchase.
 */
export function previewSalePrice(listPrice: number, discountPercent: number): { discountAmount: number; salePrice: number } {
  const percent = Math.max(0, Math.min(100, discountPercent));
  const discountAmount = percent === 0 || listPrice <= 0 ? 0 : listPrice - Math.round((listPrice * (100 - percent)) / 100);
  return { discountAmount, salePrice: listPrice - discountAmount };
}

/** What each plan's numeric promises read as, derived from the plan's real limits so the page can't drift from the server. */
export function limitBullets(e: PlanEntitlements): { practice: string; interviews: string } {
  const practice =
    e.practice_problems_per_day === null
      ? "Unlimited coding problems — no daily cap"
      : `Solve ${e.practice_problems_per_day} coding problem${e.practice_problems_per_day === 1 ? "" : "s"} every day`;

  const interviews =
    e.free_trial_uses !== null
      ? `Try every AI feature ${e.free_trial_uses === 1 ? "once" : `${e.free_trial_uses} times`} — AI mock interview, Speaking, Listening and Vocabulary labs`
      : e.mock_interviews_per_day === null
        ? "Unlimited AI mock interviews, scored instantly"
        : `${e.mock_interviews_per_day} AI mock interviews per day, scored instantly`;

  return { practice, interviews };
}
