"use client";

import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { HpCard, HpIconTile, type HpTone } from "@/components/portal/kit";
import { cn } from "@/lib/utils";

export interface OverviewStat {
  id: string;
  label: string;
  /** A number counts up as it scrolls into view; text ("—", "Tier 2") shows as given. */
  value: number | string;
  suffix?: string;
  icon: LucideIcon;
  tone: HpTone;
  hint?: string;
  /** Where the full version of this number lives. The whole card leads there. */
  href: string;
  /** Tooltip / screen-reader sentence for the card's destination. */
  goTo: string;
}

/**
 * The few numbers that say "how am I doing" at a glance, built from the same card, glass icon tile and counter the TPO and
 * Hiring Partner portals use. Each card is a link to the page that owns its number - the strip is a set of doors, not a
 * readout - and lifts, lights its border and slides its arrow in on hover.
 */
export function OverviewStats({ stats, className }: { stats: OverviewStat[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:gap-4", stats.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3", className)}>
      {stats.map((s) => {
        const placeholder = typeof s.value === "string" && /^[\s—–-]*$/.test(s.value);
        return (
          <li key={s.id}>
            <Link
              href={s.href}
              title={s.goTo}
              aria-label={`${s.label}: ${s.value}${s.suffix ? ` ${s.suffix}` : ""}. ${s.goTo}`}
              className="group block h-full rounded-[20px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <HpCard interactive className="flex h-full flex-col p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-text-muted sm:text-xs">{s.label}</span>
                  <HpIconTile icon={s.icon} tone={s.tone} size="md" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" />
                </div>

                <div className="mt-4 flex items-baseline gap-1.5">
                  <span className={cn("tabular text-[28px] font-extrabold leading-none tracking-tight sm:text-[32px]", placeholder ? "text-text-muted" : "text-primary")}>
                    {typeof s.value === "number" ? <AnimatedCounter target={s.value} /> : s.value}
                  </span>
                  {s.suffix && !placeholder && <span className="text-xs font-semibold text-text-muted">{s.suffix}</span>}
                </div>

                <div className="mt-2 flex items-end justify-between gap-2">
                  <span className="text-2xs leading-snug text-text-muted">{s.hint}</span>
                  <ArrowUpRight className="hidden h-4 w-4 shrink-0 -translate-x-1 translate-y-1 text-indigo-500 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100 sm:block" aria-hidden />
                </div>
              </HpCard>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
