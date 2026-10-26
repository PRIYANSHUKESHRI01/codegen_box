"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { PricingHero } from "@/components/pricing/PricingHero";
import { PricingPlans } from "@/components/pricing/PricingPlans";
import { InstitutionPlans } from "@/components/pricing/InstitutionPlans";
import { PlanComparison } from "@/components/pricing/PlanComparison";
import { VaultExplainer } from "@/components/pricing/VaultExplainer";
import { PricingAudience } from "@/data/pricing";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { MySubscriptionResponse, SubscriptionCoverage } from "@/types/subscription";
import type { CheckoutInfo } from "@/types/payments";
import { useToast } from "@/lib/toast";

export function PricingPageClient() {
  const { user, status } = useAuth();
  const [audience, setAudience] = useState<PricingAudience>("individual");
  const [coverage, setCoverage] = useState<SubscriptionCoverage | null>(null);
  const [checkout, setCheckout] = useState<CheckoutInfo | null>(null);

  useEffect(() => {
    // Only signed-in students/TPOs have a subscription to show; staff and
    // signed-out visitors just see the plain marketing cards.
    if (status !== "ready" || !user) {
      setCoverage(null);
      setCheckout(null);
      return;
    }
    if (user.role !== "user" && user.role !== "admin_tpo") return;

    api
      .get<MySubscriptionResponse>("/me/subscription")
      .then((res) => {
        setCoverage(res.coverage);
        setCheckout(res.checkout ?? null);
      })
      .catch(() => setCoverage(null));
  }, [status, user]);

  const triggerToast = useToast();

  const handleSubscribed = useCallback(
    (newCoverage: SubscriptionCoverage, planName: string) => {
      setCoverage(newCoverage);
      triggerToast(`You're now on the ${planName} plan.`);
    },
    [triggerToast]
  );

  return (
    <div className="relative min-h-screen bg-background text-primary selection:bg-accent-primary/20 selection:text-accent-primary overflow-hidden">
      {/* Ambient backdrop — subtle, not a marketing hero */}
      <div className="absolute inset-0 bg-dot-pattern opacity-30 pointer-events-none" aria-hidden="true" />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[560px] h-[320px] radial-glow-dark dark:block hidden pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[560px] h-[320px] radial-glow-light dark:hidden block pointer-events-none"
        aria-hidden="true"
      />

      {/* Close — back to the landing page */}
      <Link
        href="/"
        aria-label="Back to homepage"
        className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 w-10 h-10 rounded-full bg-surface border border-border-subtle shadow-subtle flex items-center justify-center text-text-muted hover:text-primary hover:border-border-strong hover:bg-surface-hover transition-all"
      >
        <X className="w-5 h-5" />
      </Link>

      <main className="relative flex flex-col items-center pb-16 sm:pb-24">
        <PricingHero audience={audience} onAudienceChange={setAudience} />
        {audience === "institution" ? (
          <InstitutionPlans coverage={coverage} />
        ) : (
          <>
            <PricingPlans coverage={coverage} checkout={checkout} onSubscribed={handleSubscribed} />
            <PlanComparison />
            <VaultExplainer />
          </>
        )}
      </main>
    </div>
  );
}
