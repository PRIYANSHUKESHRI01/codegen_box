"use client";

import { useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { PlanComparison } from "@/components/pricing/PlanComparison";
import { VaultExplainer } from "@/components/pricing/VaultExplainer";
import { PaymentHistory } from "@/components/billing/PaymentHistory";
import { PlanStatusCard } from "@/components/billing/PlanStatusCard";
import { BillingFaq } from "@/components/billing/BillingFaq";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useMyPlan } from "@/lib/useMyPlan";
import { SubscriptionCoverage } from "@/types/subscription";
import { useToast } from "@/lib/toast";

/**
 * "Plans & Billing" — the student's one page for everything about their plan:
 * where they stand (PlanStatusCard), the plans they can move to and how to pay
 * (PricingPlans — PayU or Razorpay checkout, priced live by the superadmin), what they have
 * paid, a side-by-side comparison, and the billing questions people actually ask.
 *
 * It follows the plan live (useMyPlan): a purchase made here, or a plan a superadmin
 * grants, extends or ends while the page is open, redraws it without a reload.
 * Reached from the sidebar's "Plans & Billing", the plan chip in the header, and
 * every "Upgrade" prompt in the product.
 */
export default function BillingPage() {
  const { status } = useAuthGuard(["user"]);
  const { plan: subscription, loading, refresh } = useMyPlan(status === "ready");

  const triggerToast = useToast();

  const handleSubscribed = useCallback(
    (_coverage: SubscriptionCoverage, planName: string) => {
      triggerToast(`You're now on the ${planName} plan.`);
      // Everything on the page (status card, current-plan badge, history) is drawn from the server's answer.
      void refresh();
    },
    [triggerToast, refresh]
  );

  if (status !== "ready") {
    return <SessionLoader />;
  }

  return (
    <DashboardShell role="user" title="Plans & Billing" subtitle="Your plan, what it includes, and how to upgrade">
      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading your plan">
          <div className="h-44 animate-pulse rounded-panel border border-border-subtle bg-surface" />
          <div className="h-80 animate-pulse rounded-panel border border-border-subtle bg-surface" />
        </div>
      ) : (
        <>
          {subscription ? (
            <PlanStatusCard subscription={subscription} />
          ) : (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-panel border border-status-warning/30 bg-status-warning/10 p-4 text-sm text-text-secondary">
              <span>We couldn&apos;t load your current plan. The plans below are still accurate.</span>
              <button type="button" onClick={() => void refresh()} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline">
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          )}

          <div id="plans" className="scroll-mt-24">
            <PricingPlans coverage={subscription?.coverage ?? null} checkout={subscription?.checkout ?? null} onSubscribed={handleSubscribed} />
          </div>
          <PaymentHistory />
          <PlanComparison />
          <VaultExplainer />
          <BillingFaq />
        </>
      )}
    </DashboardShell>
  );
}
