"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api } from "@/lib/api";
import { MySubscriptionResponse, SubscriptionCoverage } from "@/types/subscription";

/**
 * The authenticated "Upgrade Plan" destination — everything a signed-in
 * student needs to self-serve upgrade, inside the dashboard shell instead of
 * the public marketing /pricing page. Reuses PricingPlans as-is: it already
 * handles the current-plan badge, self-serve POST /me/subscription, and the
 * "included via your college" banner for institution-covered students.
 */
export default function BillingPage() {
  const { status } = useAuthGuard(["user"]);
  const [coverage, setCoverage] = useState<SubscriptionCoverage | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "ready") return;
    let cancelled = false;

    api
      .get<MySubscriptionResponse>("/me/subscription")
      .then((res) => {
        if (!cancelled) setCoverage(res.coverage);
      })
      .catch(() => {
        if (!cancelled) setCoverage(null);
      })
      .finally(() => {
        if (!cancelled) setCoverageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [status]);

  const triggerToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const handleSubscribed = useCallback(
    (newCoverage: SubscriptionCoverage, planName: string) => {
      setCoverage(newCoverage);
      triggerToast(`You're now on the ${planName} plan.`);
    },
    [triggerToast]
  );

  if (status !== "ready") {
    return <SessionLoader />;
  }

  return (
    <DashboardShell role="user" title="Your Plan" subtitle="Manage your AptRun subscription">
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <Check className="w-4 h-4 text-status-success shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {coverageLoading ? (
        <div className="p-10 flex items-center justify-center text-xs text-text-muted">Loading your plan...</div>
      ) : (
        <PricingPlans audience="individual" billingCycle="monthly" coverage={coverage} onSubscribed={handleSubscribed} />
      )}
    </DashboardShell>
  );
}
