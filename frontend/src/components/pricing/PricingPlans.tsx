"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import { ApiError } from "@/lib/api";
import { isRedeemable, limitBullets } from "@/lib/pricing";
import { notifySubscriptionChanged } from "@/lib/projectLab";
import { PayuRedirectError, readPayuAttempt } from "@/lib/payu";
import { RazorpayLoadError } from "@/lib/razorpay";
import { useCheckout } from "@/lib/useCheckout";
import type { CheckoutOutcome } from "@/lib/checkout";
import { refreshPlans, usePublicPlans } from "@/lib/usePublicPlans";
import { PriceTag } from "@/components/pricing/PriceTag";
import { AcademyCard } from "@/components/pricing/AcademyCard";
import { TalkToTeamModal } from "@/components/marketing-site/TalkToTeamModal";
import { CheckoutOverlay } from "@/components/billing/CheckoutOverlay";
import { PhonePrompt } from "@/components/billing/PhonePrompt";
import { SubscriptionCoverage } from "@/types/subscription";
import type { CheckoutInfo, PaymentReturnResult } from "@/types/payments";
import type { PublicPlan } from "@/types/pricing";
import { INDIVIDUAL_PLANS, PricingPlan } from "@/data/pricing";
import {
  Terminal,
  Rocket,
  Crown,
  CheckCircle2,
  ArrowRight,
  BadgeCheck,
  Loader2,
  Lock,
  X,
  RefreshCw,
  Gift,
} from "lucide-react";

interface PricingPlansProps {
  /** The signed-in viewer's current plan coverage, or null if signed out / not yet loaded. */
  coverage?: SubscriptionCoverage | null;
  /** Fired after a payment has been confirmed and the plan is active, with the fresh coverage and the plan's display name. */
  onSubscribed?: (coverage: SubscriptionCoverage, planName: string) => void;
  /** Whether payments are switched on (the server has its payment gateway's credentials), which gateway that is, and whether it is in test mode. From GET /me/subscription. */
  checkout?: CheckoutInfo | null;
}

const ICON_MAP: Record<string, typeof Terminal> = {
  Terminal,
  Rocket,
  Crown,
};

/** Plans in the order they are sold: the higher the index, the higher the tier. -1 for a code that is not an individual plan. */
const planIndexOf = (code: string | null | undefined): number => INDIVIDUAL_PLANS.findIndex((p) => p.id === code);

/** What the Buy button says while a purchase is under way. */
const PHASE_LABEL: Record<string, string> = {
  creating: "Opening secure checkout…",
  awaiting_payment: "Waiting for payment…",
  redirecting: "Taking you to the payment page…",
  confirming: "Confirming…",
  redeeming: "Redeeming your offer…",
};

/** The hints the server puts in the return address (…&result=…) that the page understands. */
const RETURN_HINTS: ReadonlySet<string> = new Set<PaymentReturnResult>(["paid", "processing", "failed", "cancelled", "pending", "invalid", "unknown"]);

/** A plan with this many days or fewer left shows a Renew button. */
const RENEW_WINDOW_DAYS = 30;

/** A feature line: real text, or — for a numeric bullet whose plan data hasn't arrived yet — a placeholder bar that holds its place. */
type FeatureLine = { key: string; text: string | null };

/** Fills the {practice}/{interviews} markers with the plan's real limits (see lib/pricing.ts limitBullets). */
function featureLines(plan: PricingPlan, live: PublicPlan | undefined): FeatureLine[] {
  const bullets = live ? limitBullets(live.entitlements) : null;
  return plan.features.map((feature, index) => {
    if (feature === "{practice}") return { key: `practice-${index}`, text: bullets?.practice ?? null };
    if (feature === "{interviews}") return { key: `interviews-${index}`, text: bullets?.interviews ?? null };
    return { key: `${index}-${feature}`, text: feature };
  });
}

export function PricingPlans({ coverage, onSubscribed, checkout }: PricingPlansProps) {
  const { user, status } = useAuth();
  const [subscribingCode, setSubscribingCode] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  /** A neutral message (not an error): e.g. the student cancelled on the gateway's page. */
  const [notice, setNotice] = useState<string | null>(null);
  /** The plan the student is buying while the gateway's mobile-number question is open. */
  const [phonePrompt, setPhonePrompt] = useState<{ plan: PricingPlan; livePlan: PublicPlan } | null>(null);
  /** The Mellow Academy enquiry form (the Grandmaster card's "Contact our team"). */
  const [academyOpen, setAcademyOpen] = useState(false);
  const handledReturn = useRef(false);
  const live = usePublicPlans();
  const flow = useCheckout();
  const { resume, recover } = flow;

  // An individual plan the superadmin has switched off disappears from the page; while the list is
  // still loading every plan shows, with its price as a placeholder.
  const plans = useMemo(() => {
    if (live.plans === null) return INDIVIDUAL_PLANS;
    return INDIVIDUAL_PLANS.filter((plan) => live.plans?.some((p) => p.code === plan.id));
  }, [live.plans]);

  const isSignedInStudent = status === "ready" && user?.role === "user";

  const coveredByInstitution =
    isSignedInStudent && coverage?.source === "institution" && (coverage.days_remaining ?? 0) > 0;

  // Which individual plan the student holds and whether it still has days on it. null days = never expires (the free plan).
  const coverageKnown = coverage != null;
  const heldPlanCode = coverage?.source === "individual" ? (coverage.plan?.code ?? "coder") : "coder";
  const daysLeft = coverage?.source === "individual" ? (coverage.days_remaining ?? null) : null;
  const heldPlanIsLive = coverage?.source === "individual" && (daysLeft === null || daysLeft > 0);

  // Whether any plan on the page is a free offer right now, and whether any still has to be paid for: they decide which
  // payment messages (gateway not set up yet, "secure payment by …") are true of this page.
  const offerOpen = (live.plans ?? []).some((p) => isRedeemable(p));
  const hasPaidPlan = live.plans === null || live.plans.some((p) => !p.is_free && !p.contact_only && !isRedeemable(p));

  // What happened when a purchase ended: say so, and refresh whatever depends on the plan.
  const applyOutcome = (outcome: CheckoutOutcome | null, planName: string) => {
    if (outcome === null) return;
    if (outcome.kind === "redeemed") {
      notifySubscriptionChanged();
      if (outcome.state.coverage) onSubscribed?.(outcome.state.coverage, planName || outcome.state.redemption.plan_name);
    } else if (outcome.kind === "paid") {
      notifySubscriptionChanged();
      // Coming back from the gateway's page the plan's name is only known from the receipt.
      if (outcome.state.coverage) onSubscribed?.(outcome.state.coverage, planName || outcome.state.payment?.description || "your new");
    } else if (outcome.kind === "failed") {
      setActionError(outcome.message);
    }
    // "dismissed": they closed the window, nothing to say. "pending": the overlay explains and offers "Check again".
    // "redirecting": the browser is leaving for the gateway's page; the student comes back to /dashboard/billing.
  };

  const handleSelfServeSubscribe = async (plan: PricingPlan, livePlan: PublicPlan, phone?: string) => {
    setActionError(null);
    setNotice(null);
    setSubscribingCode(plan.id);
    let leaving = false;
    try {
      // The total the buyer is looking at goes with the request: if the superadmin changed the price in
      // the meantime the server refuses (409) rather than charge something that was never shown.
      const outcome = await flow.start({ planCode: plan.id, expectedTotal: livePlan.sale_price, phone }, plan.name);
      leaving = outcome?.kind === "redirecting";
      applyOutcome(outcome, plan.name);
      setPhonePrompt(null);
    } catch (err) {
      if (err instanceof ApiError && err.code === "phone_required") {
        // The gateway cannot take a payment without a mobile number and the profile has none: ask, then carry on.
        setPhonePrompt({ plan, livePlan });
        return;
      }

      setPhonePrompt(null);

      if (err instanceof ApiError && err.code === "price_changed") {
        await refreshPlans();
        setActionError("The price just changed. Please check the updated price on the card and confirm again.");
      } else if (err instanceof RazorpayLoadError || err instanceof PayuRedirectError) {
        setActionError(err.message);
      } else {
        setActionError(err instanceof ApiError ? err.message : "We couldn't start the payment. You haven't been charged. Please try again.");
      }
    } finally {
      // While the window is on its way to the gateway's page the button keeps saying so (and stays locked).
      if (!leaving) setSubscribingCode(null);
    }
  };

  /**
   * "Redeem offer" on a plan that is free right now. No gateway, no redirect, no phone number: one request, and the plan is
   * active when it answers. The server prices it again and refuses anything that is not ₹0 any more, so a card that is a
   * poll behind can never get a plan for free that has become paid.
   */
  const handleRedeem = async (plan: PricingPlan) => {
    setActionError(null);
    setNotice(null);
    setSubscribingCode(plan.id);
    try {
      applyOutcome(await flow.redeem(plan.id), plan.name);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "price_changed" || err.code === "payment_required")) {
        await refreshPlans();
        setActionError("This offer just changed, so nothing was activated. Please check the price on the card and try again.");
      } else if (err instanceof ApiError && err.code === "already_on_plan") {
        // Usually a second click or a retry after a dropped connection: the plan is already theirs. Make the page say so.
        notifySubscriptionChanged();
        setNotice(err.message);
      } else {
        setActionError(err instanceof ApiError ? err.message : "We couldn't redeem the offer just now. Nothing was changed — please try again.");
      }
    } finally {
      setSubscribingCode(null);
    }
  };

  // The browser's Back button can restore this page frozen mid-redirect (see useCheckout): unlock the card too.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setSubscribingCode(null);
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  // Back from the gateway's own page (PayU): /dashboard/billing?payment=<reference>&result=<hint>. The API has
  // already settled the order; this reads how it ended, tells the student, and cleans the address bar.
  // Without those parameters, a purchase this tab sent away and never heard back about is looked at once, quietly
  // (the Back button, or a payment finished in another window).
  useEffect(() => {
    if (handledReturn.current || !isSignedInStudent || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const reference = params.get("payment");
    const rawHint = params.get("result");
    const hint = rawHint && RETURN_HINTS.has(rawHint) ? (rawHint as PaymentReturnResult) : null;
    const attempt = readPayuAttempt();

    if (!reference && !hint && !attempt) return;

    handledReturn.current = true;

    if (reference || hint) window.history.replaceState(null, "", window.location.pathname);

    if (reference) {
      const planName = attempt?.reference === reference ? attempt.planName : "";

      void resume(reference, hint, planName)
        .then((outcome) => {
          if (outcome?.kind === "dismissed") setNotice("You cancelled the payment, so you haven't been charged. You can pick a plan again whenever you're ready.");
          else applyOutcome(outcome, planName);
        })
        .catch(() => setActionError("We couldn't check on your payment just now. If money was deducted it will activate on its own — see your payment history below."));
    } else if (hint === "unknown") {
      setNotice("We couldn't match that payment to an order. If money was deducted it will be refunded or your plan will activate shortly — check your payment history below.");
    } else if (attempt) {
      void recover(attempt.reference).then((outcome) => applyOutcome(outcome, attempt.planName));
    }
    // applyOutcome only reads props and setters; the effect must run once per page load, which handledReturn guarantees.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedInStudent, resume, recover]);

  const handleRecheck = async () => {
    const planName = flow.pending?.planName ?? "";
    try {
      applyOutcome(await flow.recheck(), planName);
    } catch {
      /* still can't reach the server; the notice stays and they can try again */
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

          {isSignedInStudent && !coveredByInstitution && checkout?.available === false && !offerOpen && (
            <div className="mb-6 p-4 rounded-panel bg-status-warning/10 border border-status-warning/30 flex items-center gap-3 text-sm">
              <Lock className="w-5 h-5 text-status-warning shrink-0" />
              <span className="text-text-secondary">
                Online payments are being switched on. You&apos;ll be able to upgrade here very soon.
              </span>
            </div>
          )}

          {actionError && (
            <div className="mb-6 p-4 rounded-panel bg-status-danger/10 border border-status-danger/30 text-sm text-status-danger">
              {actionError}
            </div>
          )}

          {notice && (
            <div role="status" className="mb-6 p-4 rounded-panel bg-surface border border-border-strong text-sm text-text-secondary">
              {notice}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-7 items-start">
          {plans.map((plan) => {
            const Icon = ICON_MAP[plan.icon] ?? Terminal;
            const isInternalRoute = plan.ctaHref.startsWith("/");

            // The plan that governs this student right now. A paid plan whose days have run out no longer
            // does (the server already treats them as free), so the free plan is "current" again and the
            // paid card turns into a Renew button.
            const holdsPaidPlan = planIndexOf(heldPlanCode) > 0 && heldPlanIsLive;
            const effectivePlanCode = holdsPaidPlan ? heldPlanCode : "coder";
            const isCurrentIndividualPlan = isSignedInStudent && !coveredByInstitution && coverageKnown && plan.id === effectivePlanCode;
            const isLowerThanCurrent = isSignedInStudent && !coveredByInstitution && coverageKnown && planIndexOf(plan.id) < planIndexOf(effectivePlanCode);
            const lapsedThisPlan = isSignedInStudent && coverageKnown && heldPlanCode === plan.id && !heldPlanIsLive && planIndexOf(plan.id) > 0;
            const canRenew = isCurrentIndividualPlan && planIndexOf(plan.id) > 0 && daysLeft !== null && daysLeft <= RENEW_WINDOW_DAYS;

            // Grandmaster / Mellow Academy is arranged with our team: no price, no Buy button, its own card.
            if (plan.contactOnly) {
              return (
                <AcademyCard
                  key={plan.id}
                  isCurrent={isCurrentIndividualPlan}
                  daysLeft={isCurrentIndividualPlan ? daysLeft : null}
                  onContact={() => setAcademyOpen(true)}
                />
              );
            }

            // Only a signed-in, not-institution-covered student pays here; everyone else keeps the original
            // link-based CTA (signup for individuals, mailto for institutions). The free plan is never "bought".
            const useSelfServeAction =
              isSignedInStudent && coverageKnown && !coveredByInstitution && !isCurrentIndividualPlan && !isLowerThanCurrent && planIndexOf(plan.id) > 0;
            const isSubscribingThis = subscribingCode === plan.id;

            // The live plan behind an individual card: its price and its real limits.
            const livePlan = live.plans?.find((p) => p.code === plan.id);

            // A plan discounted to ₹0 is redeemed, not bought: it never needs the payment gateway, so a gateway that
            // is not set up yet does not lock its button.
            const redeemable = livePlan !== undefined && isRedeemable(livePlan);
            const paymentsOff = checkout?.available === false && !redeemable;
            const buyLabel = redeemable ? (lapsedThisPlan ? `Renew ${plan.name} free` : "Redeem offer") : lapsedThisPlan ? `Renew ${plan.name}` : plan.ctaLabel;
            const lines = featureLines(plan, livePlan);
            // A signed-in student can't buy until the price they'd be agreeing to is on screen.
            const priceKnown = livePlan !== undefined;

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

                  <div className="mb-6 pb-6 border-b border-border-subtle min-h-[112px]">
                    {livePlan ? (
                      <PriceTag plan={livePlan} />
                    ) : live.status === "error" ? (
                      <div className="flex items-center gap-2 text-sm text-text-muted">
                        <span>Price unavailable</span>
                        <button
                          type="button"
                          onClick={() => void refreshPlans()}
                          className="inline-flex items-center gap-1 text-xs font-bold text-accent-primary hover:underline"
                        >
                          <RefreshCw className="w-3 h-3" /> Retry
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5" aria-busy="true" aria-label="Loading price">
                        <div className="h-4 w-24 animate-pulse rounded bg-elevated" />
                        <div className="h-9 w-40 animate-pulse rounded bg-elevated" />
                      </div>
                    )}
                    {isCurrentIndividualPlan && (coverage?.days_remaining ?? null) !== null && (coverage?.days_remaining ?? 0) > 0 && !livePlan?.is_free && (
                      <p className="mt-2 text-xs font-semibold text-status-success">
                        {coverage?.days_remaining} day{coverage?.days_remaining === 1 ? "" : "s"} left on your plan
                      </p>
                    )}
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-3 mb-7 flex-1">
                    {lines.map(({ key, text: feature }) => {
                      if (feature === null) {
                        // A numeric bullet whose plan data is still loading: hold its place.
                        return (
                          <li key={key} className="flex items-start gap-2.5" aria-hidden="true">
                            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-border-strong" />
                            <span className="mt-1 h-3.5 w-48 max-w-full animate-pulse rounded bg-elevated" />
                          </li>
                        );
                      }
                      const isHeader = feature.endsWith(":");
                      return (
                        <li
                          key={key}
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

                    {/* What this plan does not have — shown, not hidden, so the step up is visible. */}
                    {plan.excluded && plan.excluded.length > 0 && (
                      <>
                        <li className="pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Not included:</li>
                        {plan.excluded.map((feature) => (
                          <li key={feature} className="flex items-start gap-2.5 text-sm text-text-muted">
                            <X className="w-4 h-4 mt-0.5 shrink-0 text-text-muted/70" aria-label="Not included" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </>
                    )}
                  </ul>

                  {/* CTA */}
                  {coveredByInstitution || isCurrentIndividualPlan ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-center gap-2 w-full py-3 rounded-btn text-sm font-bold bg-elevated text-text-muted border border-border-subtle cursor-default">
                        <BadgeCheck className="w-4 h-4" />
                        <span>{isCurrentIndividualPlan ? "Your Current Plan" : "Included via your college"}</span>
                      </div>
                      {canRenew && (
                        <button
                          type="button"
                          onClick={() => (redeemable ? void handleRedeem(plan) : livePlan && handleSelfServeSubscribe(plan, livePlan))}
                          disabled={flow.busy || paymentsOff || !priceKnown}
                          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-btn text-xs font-bold text-accent-primary border border-accent-primary/40 hover:bg-accent-primary/10 transition-all disabled:opacity-60"
                        >
                          {isSubscribingThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                          <span>{redeemable ? "Renew free for another year" : "Renew for another year"}</span>
                        </button>
                      )}
                    </div>
                  ) : isLowerThanCurrent ? (
                    <div
                      title="You already have a higher plan with time left on it. You can switch once it ends."
                      className="flex items-center justify-center gap-2 w-full py-3 rounded-btn text-sm font-bold bg-elevated text-text-muted border border-border-subtle cursor-default"
                    >
                      <span>Available when your plan ends</span>
                    </div>
                  ) : isSignedInStudent && !coverageKnown ? (
                    <div className="h-[46px] w-full animate-pulse rounded-btn bg-elevated" aria-busy="true" aria-label="Checking your current plan" />
                  ) : useSelfServeAction ? (
                    <button
                      type="button"
                      onClick={() => (redeemable ? void handleRedeem(plan) : livePlan && handleSelfServeSubscribe(plan, livePlan))}
                      disabled={flow.busy || paymentsOff || !priceKnown}
                      title={paymentsOff ? "Online payments are being switched on. This will be available shortly." : undefined}
                      className={cn(
                        "flex items-center justify-center gap-2 w-full py-3 rounded-btn text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed",
                        plan.featured
                          ? "bg-accent-primary text-white hover:bg-accent-primary-hover shadow-subtle hover:shadow-glow"
                          : "bg-elevated text-primary border border-border-strong hover:bg-surface-hover"
                      )}
                    >
                      {isSubscribingThis ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>{PHASE_LABEL[flow.phase] ?? "Please wait…"}</span>
                        </>
                      ) : paymentsOff ? (
                        <span>Payments launching soon</span>
                      ) : (
                        <>
                          {redeemable && <Gift className="w-4 h-4" aria-hidden />}
                          <span>{buyLabel}</span>
                          {!redeemable && <ArrowRight className="w-4 h-4" />}
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

          {/* What a student paying here can rely on — shown only to the people who can pay. */}
          {isSignedInStudent && !coveredByInstitution && (
            <div className="mt-8 flex flex-col items-center gap-2 text-center text-xs text-text-muted">
              {hasPaidPlan && (
                <p className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5" aria-hidden /> Secure payment by {checkout?.gateway_name ?? "our payment partner"}
                  </span>
                  <span>UPI, cards, netbanking &amp; more</span>
                  <span>Receipt emailed instantly</span>
                </p>
              )}
              {offerOpen && (
                <p className="inline-flex items-center gap-1.5">
                  <Gift className="h-3.5 w-3.5" aria-hidden /> Free offers are activated instantly — no payment details needed
                </p>
              )}
              {hasPaidPlan && checkout?.test_mode && checkout.available && (
                <p className="rounded-full border border-status-warning/30 bg-status-warning/10 px-3 py-1 font-semibold text-status-warning">
                  Test mode: payments are simulated and no real money is charged.
                </p>
              )}
            </div>
          )}
        </div>
      </Container>

      {phonePrompt && (
        <PhonePrompt
          planName={phonePrompt.plan.name}
          gatewayName={checkout?.gateway_name ?? "our payment partner"}
          busy={subscribingCode !== null}
          onSubmit={(phone) => void handleSelfServeSubscribe(phonePrompt.plan, phonePrompt.livePlan, phone)}
          onClose={() => setPhonePrompt(null)}
        />
      )}

      <TalkToTeamModal
        open={academyOpen}
        onClose={() => setAcademyOpen(false)}
        defaultAudience="academy"
        prefill={isSignedInStudent && user ? { name: user.name, email: user.email, phone: user.phone ?? undefined } : undefined}
      />

      <CheckoutOverlay
        confirming={flow.phase === "confirming"}
        pending={flow.pending}
        onRecheck={handleRecheck}
        onClose={flow.dismissPending}
      />
    </section>
  );
}
