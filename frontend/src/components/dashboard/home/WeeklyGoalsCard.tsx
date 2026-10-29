"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, ListChecks } from "lucide-react";
import { HpCard, HpPill, HpProgress, HpSectionHeader, hpBtn } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import { WEEKLY_PACES, choiceLabel } from "@/lib/studentPreferences";
import type { WeeklyGoals } from "@/types/studentStats";

/** This week's two targets, set by the pace the student chose in onboarding. Coding programmes only. */
export function WeeklyGoalsCard({ goals, pace }: { goals: WeeklyGoals | undefined; pace: string | null | undefined }) {
  const rows = [
    { label: "Problems solved", ...(goals?.solved_this_week ?? { current: 0, target: 20 }) },
    { label: "Hard problems solved", ...(goals?.hard_solved_this_week ?? { current: 0, target: 5 }) },
  ];

  return (
    <HpCard aria-labelledby="weekly-goals" className="flex flex-col p-5 sm:p-6">
      <HpSectionHeader
        icon={ListChecks}
        tone="emerald"
        title={<span id="weekly-goals">This week</span>}
        subtitle="Targets that follow your pace"
        action={
          // The targets follow the pace they chose in onboarding - say so, and make it one click to change.
          <Link href="/settings?tab=preferences" title="Change your weekly pace in Settings" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            <HpPill tone="slate" size="sm">
              {choiceLabel(WEEKLY_PACES, pace) ?? "Steady"} pace
            </HpPill>
          </Link>
        }
      />

      <div className="mt-5 space-y-4">
        {rows.map((g) => {
          const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
          const done = g.target > 0 && g.current >= g.target;
          return (
            <div key={g.label} className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium text-text-secondary">
                  {done && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden />}
                  {g.label}
                </span>
                <span className={cn("tabular font-bold", done ? "text-emerald-600 dark:text-emerald-300" : "text-primary")}>
                  {g.current}/{g.target}
                </span>
              </div>
              <HpProgress value={pct} tone={done ? "emerald" : "indigo"} className="h-2" />
            </div>
          );
        })}
      </div>

      <Link href="/dashboard/practice" className={hpBtn("secondary", "md", "group mt-5 w-full")}>
        Solve a problem
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </HpCard>
  );
}
