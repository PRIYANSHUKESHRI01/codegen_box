"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatInr, hasDiscount, isRedeemable, monthlyEquivalent, termSuffix } from "@/lib/pricing";
import type { PlanPricing } from "@/types/pricing";

interface PriceTagProps {
  plan: PlanPricing;
  /** "card" is the big price on a plan card; "compact" is the one-line price in an upgrade prompt. */
  size?: "card" | "compact";
  className?: string;
}

/**
 * One plan's price, the way every surface shows it: the real price struck
 * through, the price actually charged, the percentage saved, and — for a yearly
 * plan — what that works out to a month. The numbers come straight from the
 * server's price block (Plan::pricing()), never computed here, so the pricing
 * page, the upgrade prompts and the checkout cannot disagree.
 *
 * The sale price re-animates when it changes, so a superadmin's edit is visible
 * to someone looking at the page rather than silently swapping a number.
 */
export function PriceTag({ plan, size = "card", className }: PriceTagProps) {
  const compact = size === "compact";

  // A plan sold by our team has no price, and its figures are zero: never draw them as ₹0.
  if (plan.contact_only) {
    return (
      <div className={cn("flex flex-wrap items-baseline gap-x-1.5", className)}>
        <span className={cn("font-black tracking-tight text-primary", compact ? "text-lg" : "text-3xl sm:text-4xl")}>Let&apos;s talk</span>
        <span className="text-sm font-medium text-text-muted">priced by our team</span>
      </div>
    );
  }

  if (plan.is_free) {
    return (
      <div className={cn("flex items-baseline gap-1.5", className)}>
        <span className={cn("font-black tracking-tight text-primary font-mono", compact ? "text-xl" : "text-3xl sm:text-4xl")}>₹0</span>
        <span className="text-sm font-medium text-text-muted">forever</span>
      </div>
    );
  }

  // A priced plan the superadmin has discounted to nothing: claimed with one click, never paid for. It is a "Free" plan
  // for as long as the offer lasts, with the real price still shown struck through so the saving is visible.
  if (isRedeemable(plan)) {
    return (
      <div className={className}>
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className={cn("font-mono font-semibold text-text-muted", compact ? "text-sm" : "text-lg")}>
            <span className="sr-only">Original price </span>
            <del className="decoration-status-danger/70 decoration-2">{formatInr(plan.list_price)}</del>
          </span>
          <span className="rounded-full border border-status-success/30 bg-status-success/15 px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-status-success">
            100% off
          </span>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="sr-only">Now </span>
          <motion.span
            key="free"
            initial={{ opacity: 0.2, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className={cn("font-black tracking-tight text-primary", compact ? "text-2xl" : "text-3xl sm:text-4xl")}
          >
            Free
          </motion.span>
          <span className="text-sm font-medium text-text-muted">{plan.term_unit ? `for a ${plan.term_unit}` : ""}</span>
        </div>

        {!compact && <p className="mt-1.5 text-xs text-text-muted">Redeem it in one click — no payment needed</p>}
      </div>
    );
  }

  const onSale = hasDiscount(plan);
  const perMonth = monthlyEquivalent(plan);

  return (
    <div className={className}>
      {onSale && (
        <div className="mb-1.5 flex flex-wrap items-center gap-2">
          <span className={cn("font-mono font-semibold text-text-muted", compact ? "text-sm" : "text-lg")}>
            <span className="sr-only">Original price </span>
            <del className="decoration-status-danger/70 decoration-2">{formatInr(plan.list_price)}</del>
          </span>
          <span className="rounded-full border border-status-success/30 bg-status-success/15 px-2 py-0.5 text-3xs font-bold uppercase tracking-wide text-status-success">
            {plan.discount_percent}% off
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-baseline gap-x-1.5">
        {onSale && <span className="sr-only">Now </span>}
        <motion.span
          key={plan.sale_price}
          initial={{ opacity: 0.2, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className={cn("font-black tracking-tight text-primary font-mono", compact ? "text-2xl" : "text-3xl sm:text-4xl")}
        >
          {formatInr(plan.sale_price)}
        </motion.span>
        <span className="text-sm font-medium text-text-muted">{termSuffix(plan)}</span>
      </div>

      {perMonth !== null && !compact && (
        <p className="mt-1.5 text-xs text-text-muted">
          That&apos;s just <strong className="font-mono text-text-secondary">{formatInr(perMonth)}</strong> a month, billed once a year
        </p>
      )}
    </div>
  );
}
