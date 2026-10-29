"use client";

import Link from "next/link";
import { ArrowRight, LucideIcon } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { HpCard, HpIconTile, type HpTone } from "@/components/portal/kit";
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

/** The student pages' tone names, mapped onto the portal kit's (the same card, glass icon tile and counter the TPO and Hiring Partner portals use). */
const TONE: Record<NonNullable<StatTileProps["tone"]>, { kit: HpTone; action: string }> = {
  primary: { kit: "indigo", action: "text-indigo-600 dark:text-indigo-300" },
  secondary: { kit: "sky", action: "text-sky-700 dark:text-sky-300" },
  success: { kit: "emerald", action: "text-emerald-700 dark:text-emerald-300" },
  warning: { kit: "amber", action: "text-amber-700 dark:text-amber-300" },
  danger: { kit: "rose", action: "text-rose-700 dark:text-rose-300" },
};

export function StatTile({ label, value, suffix, icon, hint, tone = "primary", action, className }: StatTileProps) {
  const t = TONE[tone];
  // A dash placeholder set at 32px/800 reads as a broken element, not as "no value yet" — so it is muted, and detected rather than flagged.
  const isPlaceholder = typeof value === "string" && /^[\s—–-]*$/.test(value);

  return (
    <HpCard interactive={!!action} className={cn("group flex flex-col overflow-hidden", className)}>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-text-muted sm:text-xs">{label}</span>
          <HpIconTile icon={icon} tone={t.kit} size="md" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" />
        </div>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className={cn("tabular text-[28px] font-extrabold leading-none tracking-tight sm:text-[32px]", isPlaceholder ? "text-text-muted" : "text-primary")}>
            {typeof value === "number" ? <AnimatedCounter target={value} /> : value}
          </span>
          {suffix && !isPlaceholder && <span className="text-xs font-semibold text-text-muted">{suffix}</span>}
        </div>

        {hint && <p className="mt-2 text-2xs leading-snug text-text-muted">{hint}</p>}
      </div>

      {action && (
        <Link
          href={action.href}
          className={cn(
            "flex items-center gap-1.5 border-t border-border-subtle bg-elevated/40 px-4 py-3 text-2xs font-bold transition-colors hover:bg-elevated/80 sm:px-5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
            t.action
          )}
        >
          <span>{action.label}</span>
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}
    </HpCard>
  );
}
