"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Target } from "lucide-react";
import { ReadinessRing } from "@/components/dashboard/student/ReadinessRing";
import { ReadinessBreakdown } from "@/components/dashboard/student/ReadinessBreakdown";
import { VaultLine } from "@/components/dashboard/student/VaultLine";
import { HpCard, HpPill, HpSectionHeader, hpBtn, type HpTone } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import type { MyStats } from "@/types/studentStats";

/**
 * Readiness tiers are the three the backend actually emits (ReadinessStats["tier"]). Each gets its own pill colour and a
 * sentence saying what the number means - a bare "13%" with no verdict beside it is a score without a diagnosis.
 */
function toneFor(tier: string | undefined, codes: boolean): { tone: HpTone; blurb: string } {
  switch (tier) {
    case "Placement Ready":
      return { tone: "emerald", blurb: "You’re clearing the bar placement cells and employers screen on. Keep showing up to hold it." };
    case "In Progress":
      return {
        tone: "amber",
        blurb: codes
          ? "Close. A few more interviews, tests and contests — and showing up on more days — will move you into the ready band."
          : "Close. A few more interviews and tests — and showing up on more days — will move you into the ready band.",
      };
    case "Needs Training":
      return {
        tone: "rose",
        blurb: codes
          ? "Start with an AI mock interview, a soft-skills test and a daily contest — every one of them moves this score."
          : "Start with an AI mock interview, a soft-skills test and a Learning Centre session — every one of them moves this score.",
      };
    default:
      return { tone: "slate", blurb: "Take part in a few things on AptRun to generate your readiness score." };
  }
}

/** The student's one score and what is driving it. The full roadmap lives on the Performance Report; this is the headline. */
export function ReadinessCard({ stats, codes, className }: { stats: MyStats | null; codes: boolean; className?: string }) {
  const verdict = toneFor(stats?.readiness.tier, codes);

  return (
    <HpCard featured aria-labelledby="readiness-heading" className={cn("relative flex flex-col overflow-hidden p-5 sm:p-6", className)}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[rgb(var(--hp-id)/0.18)] blur-3xl" />

      <div className="relative">
        <HpSectionHeader icon={Target} tone="violet" title={<span id="readiness-heading">Placement readiness</span>} subtitle="One score for everything you do" />
      </div>

      {/* The ring and the verdict sit side by side: the number needs the words next to it to mean anything. */}
      <div className="relative mt-5 flex items-center gap-4">
        <ReadinessRing value={stats?.readiness.score ?? 0} label={stats?.readiness.tier ?? "Ready"} size={112} stroke={9} showLabel={false} />
        <div className="min-w-0">
          <HpPill tone={verdict.tone} dot>
            {stats?.readiness.tier ?? "—"}
          </HpPill>
          <p className="mt-2 text-xs font-medium leading-relaxed text-text-secondary">{verdict.blurb}</p>
        </div>
      </div>

      {stats && stats.readiness.components.length > 0 && (
        <div className="relative mt-5 flex-1">
          <ReadinessBreakdown components={stats.readiness.components} nextSteps={stats.readiness.next_steps} decay={stats.readiness.decay} override={stats.readiness.override} compact />
        </div>
      )}

      {stats && <VaultLine score={stats.readiness.score} vault={stats.readiness.vault} className="relative mt-5" />}

      <Link href="/dashboard/reports" className={hpBtn("soft", "md", "group relative mt-5 w-full justify-between")}>
        <span>See the full roadmap</span>
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
      </Link>

      <p className="relative mt-3 flex items-start gap-2 text-2xs text-text-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
        <span>The same score your placement cell sees on your profile.</span>
      </p>
    </HpCard>
  );
}
