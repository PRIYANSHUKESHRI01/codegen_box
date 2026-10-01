"use client";

import { useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { api, ApiError } from "@/lib/api";
import { MySubscriptionResponse, SubscriptionCoverage } from "@/types/subscription";
import {
  BillingCycle,
  INDIVIDUAL_PLANS,
  INSTITUTION_PLANS,
  PricingAudience,
  PricingPlan,
} from "@/data/pricing";
import {
  Terminal,
  Rocket,
  Crown,
  Building2,
  GraduationCap,
  Landmark,
  CheckCircle2,
  ArrowRight,
  BadgeCheck,
  Loader2,
} from "lucide-react";

interface PricingPlansProps {
  audience: PricingAudience;
  billingCycle: BillingCycle;
  /** The signed-in viewer's current plan coverage, or null if signed out / not yet loaded. */
  coverage?: SubscriptionCoverage | null;
  /** Fired after a successful self-serve activation, with the fresh coverage and the plan's display name. */
  onSubscribed?: (coverage: SubscriptionCoverage, planName: string) => void;
}

const ICON_MAP: Record<string, typeof Terminal> = {
  Terminal,
  Rocket,
  Crown,
  Building2,
  GraduationCap,
  Landmark,
};

function formatInr(amount: number): string {
  return amount.toLocaleString("en-IN");
}

function PriceDisplay({ plan, billingCycle, isInstitution }: { plan: PricingPlan; billingCycle: BillingCycle; isInstitution: boolean }) {
  if (isInstitution) {
    if (plan.annualPrice === undefined) {
      return (
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl sm:text-4xl font-black text-primary tracking-tight">Custom</span>
        </div>
      );
    }
    return (
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-3xl sm:text-4xl font-black text-primary tracking-tight font-mono">
          ₹{formatInr(plan.annualPrice)}
        </span>
        <span className="text-sm text-text-muted font-medium">/ year</span>
      </div>
    );
  }

  const price = billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;

  if (price === 0) {
    return (
      <div className="flex items-baseline gap-1.5">
        <span className="text-3xl sm:text-4xl font-black text-primary tracking-tight font-mono">₹0</span>
        <span className="text-sm text-text-muted font-medium">forever</span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-3xl sm:text-4xl font-black text-primary tracking-tight font-mono">
        ₹{formatInr(price ?? 0)}
      </span>
      <span className="text-sm text-text-muted font-medium">/ {billingCycle === "monthly" ? "month" : "year"}</span>
    </div>
  );
}

export function PricingPlans({ audience, billingCycle, coverage, onSubscribed }: PricingPlansProps) {
  const { user, status } = useAuth();
  const [subscribingCode, setSubscribingCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isInstitution = audience === "institution";
  const plans = isInstitution ? INSTITUTION_PLANS : INDIVIDUAL_PLANS;

  const isSignedInStudent = status === "ready" && user?.role === "user";
  const isSignedInTpo = status === "ready" && user?.role === "admin_tpo";

  const coveredByInstitution =
    !isInstitution && isSignedInStudent && coverage?.source === "institution" && (coverage.days_remaining ?? 0) > 0;

  const handleSelfServeSubscribe = async (plan: PricingPlan) => {
    setActionError(null);
    setSubscribingCode(plan.id);
    try {
      const res = await api.post<MySubscriptionResponse>("/me/subscription", { plan_code: plan.id });
      if (res.coverage) onSubscribed?.(res.coverage, plan.name);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Couldn't activate that plan. Please try again.");
    } finally {
      setSubscribingCode(null);
    }
  };

  return (
    <section className="py-10 sm:py-14">
      <Container size="xl">
        <div className="max-w-6xl mx-auto">
          {/* Coverage banners — read-only status, no extra marketing content */}
          {coveredByInstitution && (
            <div className="mb-6 p-4 rounded-panel bg-status-success/10 border border-status-success/30 flex items-center gap-3 text-sm">
              <BadgeCheck className="w-5 h-5 text-status-success shrink-0" />
              <span className="text-text-secondary">
                Your college <strong className="text-primary">{user?.college?.name}</strong> already includes full
                access · <strong className="text-primary">{coverage?.days_remaining} days</strong> remaining. No need
                to subscribe individually.
              </span>
            </div>
          )}

          {isInstitution && isSignedInTpo && (
            <div className="mb-6 p-4 rounded-panel bg-surface border border-border-strong flex items-center gap-3 text-sm">
              <BadgeCheck
                className={cn("w-5 h-5 shrink-0", coverage?.source === "institution" ? "text-status-success" : "text-text-muted")}
              />
              {coverage?.source === "institution" ? (
                <span className="text-text-secondary">
                  Your college is on the <strong className="text-primary">{coverage.plan?.name}</strong> plan ·{" "}
                  <strong className="text-primary">{coverage.days_remaining} days</strong> remaining.
                </span>
              ) : (
                <span className="text-text-secondary">
                  Your college doesn&apos;t have an active plan yet — talk to sales below to activate one.
                </span>
              )}
            </div>
          )}

          {actionError && (
            <div className="mb-6 p-4 rounded-panel bg-status-danger/10 border border-status-danger/30 text-sm text-status-danger">
              {actionError}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-7 items-start">
          {plans.map((plan) => {
            const Icon = ICON_MAP[plan.icon] ?? Terminal;
            const isInternalRoute = plan.ctaHref.startsWith("/");

            const isCurrentIndividualPlan =
              !isInstitution && isSignedInStudent && coverage?.source === "individual" && coverage.plan?.code === plan.id;

            // Only a signed-in, not-institution-covered student self-serve
            // activates directly here — everyone else keeps the original
            // link-based CTA (signup for individuals, mailto for institutions).
            const useSelfServeAction = !isInstitution && isSignedInStudent && !coveredByInstitution && !isCurrentIndividualPlan;
            const isSubscribingThis = subscribingCode === plan.id;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-panel border transition-all duration-200 flex flex-col h-full",
                  plan.featured
                    ? "bg-surface border-accent-primary/50 shadow-glow lg:-translate-y-3 lg:scale-[1.03] z-10"
                    : "bg-surface border-border-subtle shadow-subtle hover:border-border-strong hover:-translate-y-1 hover:shadow-card"
                )}
              >
                {plan.featured && (
                  <div className="absolute -top-0.5 inset-x-0 h-1 rounded-t-panel bg-gradient-to-r from-accent-primary via-indigo-400 to-accent-secondary" />
                )}

                <div className="p-6 sm:p-7 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-control flex items-center justify-center border",
                        plan.featured
                          ? "bg-accent-primary/15 border-accent-primary/30 text-accent-primary"
                          : "bg-elevated border-border-subtle text-text-secondary"
                      )}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    {isCurrentIndividualPlan ? (
                      <span className="px-2.5 py-1 text-3xs font-bold uppercase tracking-wide rounded-full border bg-status-success/15 text-status-success border-status-success/30">
                        Current Plan
                      </span>
                    ) : (
                      plan.badge && (
                        <span
                          className={cn(
                            "px-2.5 py-1 text-3xs font-bold uppercase tracking-wide rounded-full border",
                            plan.featured
                              ? "bg-accent-primary/15 text-accent-primary border-accent-primary/30"
                              : "bg-elevated text-text-muted border-border-subtle"
                          )}
                        >
                          {plan.badge}
                        </span>
                      )
                    )}
                  </div>

                  <h3 className="text-xl font-extrabold text-primary tracking-tight mb-1.5">{plan.name}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed mb-6 min-h-[40px]">{plan.tagline}</p>

                  <div className="mb-6 pb-6 border-b border-border-subtle">
                    <PriceDisplay plan={plan} billingCycle={billingCycle} isInstitution={isInstitution} />
                    {!isInstitution && billingCycle === "annual" && (plan.monthlyPrice ?? 0) > 0 && (
                      <p className="text-xs text-text-muted mt-1.5 font-mono">
                        billed ₹{formatInr(plan.annualPrice ?? 0)} yearly
                      </p>
                    )}
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-3 mb-7 flex-1">
                    {plan.features.map((feature) => {
                      const isHeader = feature.endsWith(":");
                      return (
                        <li
                          key={feature}
                          className={cn(
                            "flex items-start gap-2.5 text-sm",
                            isHeader
                              ? "text-text-muted font-semibold text-xs uppercase tracking-wide pt-1"
                              : "text-text-secondary"
                          )}
                        >
                          {!isHeader && (
                            <CheckCircle2
                              className={cn(
                                "w-4 h-4 mt-0.5 shrink-0",
                                plan.featured ? "text-accent-primary" : "text-emerald-500"
                              )}
                            />
                          )}
                          <span>{feature}</span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* CTA */}
                  {coveredByInstitution || isCurrentIndividualPlan ? (
                    <div className="flex items-center justify-center gap-2 w-full py-3 rounded-btn text-sm font-bold bg-elevated text-text-muted border border-border-subtle cursor-default">
                      <BadgeCheck className="w-4 h-4" />
                      <span>{isCurrentIndividualPlan ? "Your Current Plan" : "Included via your college"}</span>
                    </div>
                  ) : useSelfServeAction ? (
                    <button
                      type="button"
                      onClick={() => handleSelfServeSubscribe(plan)}
                      disabled={isSubscribingThis}
                      className={cn(
                        "flex items-center justify-center gap-2 w-full py-3 rounded-btn text-sm font-bold transition-all disabled:opacity-60",
                        plan.featured
                          ? "bg-accent-primary text-white hover:bg-accent-primary-hover shadow-subtle hover:shadow-glow"
                          : "bg-elevated text-primary border border-border-strong hover:bg-surface-hover"
                      )}
                    >
                      {isSubscribingThis ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>{plan.ctaLabel}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  ) : isInternalRoute ? (
                    <Link
                      href={plan.ctaHref}
                      className={cn(
                        "flex items-center justify-center gap-2 w-full py-3 rounded-btn text-sm font-bold transition-all",
                        plan.featured
                          ? "bg-accent-primary text-white hover:bg-accent-primary-hover shadow-subtle hover:shadow-glow"
                          : "bg-elevated text-primary border border-border-strong hover:bg-surface-hover"
                      )}
                    >
                      <span>{plan.ctaLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <a
                      href={plan.ctaHref}
                      className={cn(
                        "flex items-center justify-center gap-2 w-full py-3 rounded-btn text-sm font-bold transition-all",
                        plan.featured
                          ? "bg-accent-primary text-white hover:bg-accent-primary-hover shadow-subtle hover:shadow-glow"
                          : "bg-elevated text-primary border border-border-strong hover:bg-surface-hover"
                      )}
                    >
                      <span>{plan.ctaLabel}</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </Container>
    </section>
  );
}
