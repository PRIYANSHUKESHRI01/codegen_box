"use client";

import Link from "next/link";
import { ArrowRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string | number;
  suffix?: string;
  icon: LucideIcon;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "danger" | "secondary";
  /**
   * Optional next step for this metric, rendered as a footer link under a
   * hairline. A KPI on its own only tells you where you stand; pairing it
   * with the one action that moves it ("Unrated" → "Enter a contest") is
   * what turns the strip from a readout into a place you act from.
   */
  action?: { label: string; href: string };
  className?: string;
}

/**
 * Each tone carries the tile's whole colour story: the icon chip, a very
 * faint wash down the card, the footer hairline and the action link.
 *
 * `tint` is a GRADIENT, deliberately — `bg-surface` sets background-color
 * and the gradient sets background-image, so the two stack on one element
 * and the tile keeps a real white (or, in dark mode, a real elevated) base
 * underneath the colour instead of needing an extra overlay node. Kept
 * around 7% at the top and gone by the bottom so the strip still reads as
 * white cards on the page tint rather than five competing colour blocks.
 */
const TONE: Record<
  NonNullable<StatTileProps["tone"]>,
  { chip: string; tint: string; rule: string; action: string }
> = {
  primary: {
    chip: "bg-accent-primary/10 text-accent-primary",
    tint: "from-accent-primary/[0.07] via-accent-primary/[0.02] to-transparent",
    rule: "border-accent-primary/[0.14]",
    action: "text-accent-primary",
  },
  secondary: {
    chip: "bg-accent-secondary/10 text-accent-secondary",
    tint: "from-accent-secondary/[0.07] via-accent-secondary/[0.02] to-transparent",
    rule: "border-accent-secondary/[0.14]",
    action: "text-accent-secondary",
  },
  success: {
    chip: "bg-status-success/10 text-status-success",
    tint: "from-status-success/[0.07] via-status-success/[0.02] to-transparent",
    rule: "border-status-success/[0.14]",
    action: "text-status-success",
  },
  warning: {
    chip: "bg-status-warning/10 text-status-warning",
    tint: "from-status-warning/[0.08] via-status-warning/[0.02] to-transparent",
    rule: "border-status-warning/[0.14]",
    action: "text-status-warning",
  },
  danger: {
    chip: "bg-status-danger/10 text-status-danger",
    tint: "from-status-danger/[0.07] via-status-danger/[0.02] to-transparent",
    rule: "border-status-danger/[0.14]",
    action: "text-status-danger",
  },
};

export function StatTile({
  label,
  value,
  suffix,
  icon: Icon,
  hint,
  tone = "primary",
  action,
  className,
}: StatTileProps) {
  const t = TONE[tone];
  const isPlaceholder = typeof value === "string" && /^[\s—–-]*$/.test(value);

  return (
    <div
      className={cn(
        "group flex flex-col rounded-panel border border-border-subtle bg-surface bg-gradient-to-b shadow-subtle transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card",
        t.tint,
        className
      )}
    >
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Icon leads, label follows. The icon is the fastest thing to
            recognise at a glance across a four-up strip, so it anchors the
            left edge and the tiles scan as a row rather than four
            independent boxes. */}
        <div className="flex items-center gap-2.5">
          <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", t.chip)}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
          </span>
          <span className="text-2xs font-bold uppercase leading-tight tracking-[0.08em] text-text-muted">
            {label}
          </span>
        </div>

        <div className="mt-3.5 flex items-baseline gap-1.5">
          {/* A dash placeholder set at 28px/900 renders as a solid black bar
              that reads as a broken element or a stuck loading skeleton, not
              as "no value yet". Detected rather than passed as a flag so no
              caller has to remember to say so. */}
          <span
            className={cn(
              "text-[26px] leading-none tracking-tight sm:text-[28px]",
              isPlaceholder ? "font-bold text-text-muted" : "font-black text-primary"
            )}
          >
            {value}
          </span>
          {suffix && !isPlaceholder && (
            <span className="text-xs font-semibold text-text-muted">{suffix}</span>
          )}
        </div>

        {hint && <p className="mt-1.5 text-2xs font-medium leading-snug text-text-muted">{hint}</p>}
      </div>

      {action && (
        <Link
          href={action.href}
          className={cn(
            "flex items-center gap-1.5 border-t px-4 py-3 text-2xs font-bold transition-colors sm:px-5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary",
            t.rule,
            t.action
          )}
        >
          <span>{action.label}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
