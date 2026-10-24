"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Check, CheckCircle2, Minus, ShieldAlert, type LucideIcon } from "lucide-react";
import { HP_TONES, HpAvatar, HpPill, HpSkeleton, hpEase, type HpTone } from "@/components/portal/kit";
import { cn } from "@/lib/utils";
import type { CohortStudent } from "@/types/cohort";
import { EngagementPill, SolvedCount, lastPracticeText } from "./cohortProgress";

/**
 * The small, presentational pieces of a student roster row — identity, readiness ring, practice, status, eligibility,
 * the select box and filter chip — shared by the TPO's Student Cohort page and the Section Coordinator's roster so the two
 * screens look and read the same. Pure rendering: every number comes from StudentCohortService.
 */

/** Tier → tone: emerald only for the positive outcome, sky (the TPO identity) for in-flight, amber for attention. */
export const TIER_TONE: Record<CohortStudent["readiness_tier"], HpTone> = {
  "Placement Ready": "emerald",
  "In Progress": "sky",
  "Needs Training": "amber",
};

/** Same 75 / 45 cut-offs the roster's readiness bar has always used. */
export const scoreTone = (score: number): HpTone => (score >= 75 ? "emerald" : score >= 45 ? "sky" : "amber");

export function MeterBar({ value, tone, className }: { value: number; tone: HpTone; className?: string }) {
  const reduce = useReducedMotion();
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return (
    <span className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-elevated", className)} aria-hidden>
      <motion.span
        className={cn("block h-full rounded-full", HP_TONES[tone].bar)}
        initial={reduce ? false : { width: 0 }}
        animate={{ width }}
        transition={{ duration: 0.8, ease: hpEase }}
      />
    </span>
  );
}

/**
 * Static SVG readiness ring for roster rows. Deliberately not the animated
 * HpRing — a cohort can run to four figures, and one motion value per row
 * isn't worth the cost in a table.
 */
export function ScoreRing({ value, size = 40 }: { value: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const tone = scoreTone(v);
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={`Readiness score ${v}/100`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border-subtle" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={HP_TONES[tone].hex}
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
        />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-2xs font-extrabold text-primary">
        <span className="sr-only">Readiness </span>
        {v}
      </span>
    </span>
  );
}

/** A real (visually hidden) checkbox with the kit's painted box — keeps keyboard + screen-reader semantics. */
export function SelectBox({
  checked,
  indeterminate = false,
  onChange,
  label,
  visibleLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  label: string;
  visibleLabel?: string;
}) {
  const on = checked || indeterminate;
  return (
    <label className="group/check inline-flex cursor-pointer items-center gap-2.5">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={onChange}
        aria-label={label}
        aria-checked={indeterminate ? "mixed" : checked}
      />
      <span
        aria-hidden
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-500 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))]",
          on
            ? "border-transparent bg-gradient-to-b from-indigo-500 to-violet-600 text-white shadow-[0_4px_10px_-4px_rgba(79,70,229,0.7)]"
            : "border-border-strong bg-[rgb(var(--bg-surface-rgb))] group-hover/check:border-indigo-500/50"
        )}
      >
        {indeterminate ? (
          <Minus className="h-3 w-3" strokeWidth={3.2} />
        ) : (
          <Check className={cn("h-3 w-3 transition-transform duration-200", checked ? "scale-100" : "scale-0")} strokeWidth={3.2} />
        )}
      </span>
      {visibleLabel && <span className="text-2xs font-semibold text-text-secondary">{visibleLabel}</span>}
    </label>
  );
}

export function FilterChip({
  active,
  tone,
  icon: Icon,
  onClick,
  title,
  children,
}: {
  active: boolean;
  tone: "emerald" | "rose" | "amber";
  icon: LucideIcon;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-2xs font-semibold ring-1 ring-inset transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95",
        active
          ? tone === "emerald"
            ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/30 shadow-[0_4px_12px_-6px_rgba(16,185,129,0.6)] dark:text-emerald-300"
            : tone === "amber"
              ? "bg-amber-500/10 text-amber-700 ring-amber-500/30 shadow-[0_4px_12px_-6px_rgba(245,158,11,0.6)] dark:text-amber-300"
              : "bg-rose-500/10 text-rose-700 ring-rose-500/30 shadow-[0_4px_12px_-6px_rgba(244,63,94,0.6)] dark:text-rose-300"
          : "bg-[rgb(var(--bg-surface-rgb))] text-text-secondary ring-border-subtle hover:bg-elevated hover:text-primary hover:ring-border-strong"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

export function StudentIdentity({ student: s, onOpen }: { student: CohortStudent; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/name flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))]"
    >
      <HpAvatar name={s.name} size="md" />
      <span className="min-w-0">
        <span className="block truncate text-13 font-bold text-primary transition-colors group-hover/name:text-indigo-600 dark:group-hover/name:text-indigo-300">
          {s.name}
        </span>
        <span className="block truncate font-mono text-3xs text-text-muted">{s.roll_number ?? s.email}</span>
      </span>
    </button>
  );
}

export function BranchChip({ branch, className }: { branch: string | null; className?: string }) {
  if (!branch) {
    return <span className="text-3xs font-semibold italic text-text-muted">No branch on file</span>;
  }
  return (
    <span
      title={branch}
      className={cn(
        "inline-flex max-w-[13rem] items-center rounded-md bg-sky-500/[0.08] px-1.5 py-px text-3xs font-bold text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300",
        className
      )}
    >
      <span className="truncate">{branch}</span>
    </span>
  );
}

export function SectionChip({ section }: { section: string | null }) {
  return (
    <span className="inline-flex items-center rounded-md bg-elevated px-1.5 py-px text-3xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle">
      {section ? `Sec ${section}` : "No section"}
    </span>
  );
}

export function CgpaCell({ student: s }: { student: CohortStudent }) {
  return (
    <div className="min-w-[4.5rem]">
      <div className="tabular text-13 font-extrabold text-primary">
        {s.cgpa ?? <span className="font-semibold text-text-muted">—</span>}
      </div>
      {(s.backlogs ?? 0) > 0 && (
        <div className="mt-0.5 inline-flex items-center gap-1 text-3xs font-semibold text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-2.5 w-2.5" aria-hidden />
          {s.backlogs} {s.backlogs === 1 ? "backlog" : "backlogs"}
        </div>
      )}
    </div>
  );
}

export function ReadinessCell({ score, practice }: { score: number; practice: number }) {
  return (
    <div className="flex items-center gap-3">
      <ScoreRing value={score} />
      <div className="hidden min-w-[5.5rem] 2xl:block">
        <div className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">7-day practice</div>
        <div className="mt-1 flex items-center gap-2">
          <MeterBar value={practice} tone="violet" className="w-14" />
          <span className="tabular text-3xs font-bold text-text-secondary">{practice}%</span>
        </div>
      </div>
    </div>
  );
}

/** How actively a student practises: the engagement pill, when they last did, and how many problems they've solved. */
export function PracticeCell({ student: s, inline = false }: { student: CohortStudent; inline?: boolean }) {
  return (
    <div className={cn("flex min-w-[8.5rem] gap-1", inline ? "flex-row flex-wrap items-center gap-x-2.5" : "flex-col items-start")}>
      <EngagementPill engagement={s.activity.engagement} />
      <span className="text-3xs font-medium text-text-muted">{lastPracticeText(s)}</span>
      <SolvedCount solved={s.solved} />
    </div>
  );
}

export function EligibilityCell({ student: s }: { student: CohortStudent }) {
  if (s.eligible_for_active_drive === null) {
    return (
      <HpPill tone="slate" size="sm">
        No Active Drives
      </HpPill>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <HpPill tone={s.eligible_for_active_drive ? "emerald" : "rose"} icon={s.eligible_for_active_drive ? CheckCircle2 : AlertTriangle} size="sm">
        {s.eligible_for_active_drive ? "Eligible" : "Not eligible"}
      </HpPill>
      {s.active_drive_count > 1 && (
        <span
          className="tabular text-3xs font-semibold text-text-muted"
          title={`Eligible for ${s.eligible_drive_count} of ${s.active_drive_count} currently active drives mapped to your college`}
        >
          {s.eligible_drive_count}/{s.active_drive_count}
          <span className="sr-only"> active drives</span>
        </span>
      )}
    </span>
  );
}

export function StatusCell({ student: s }: { student: CohortStudent }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <HpPill tone={TIER_TONE[s.readiness_tier]} dot size="sm">
        {s.readiness_tier}
      </HpPill>
      {s.is_blocked && (
        <span title={s.blocked?.reason ? `Blocked${s.blocked.by_coordinator ? " by a section coordinator" : ""}: ${s.blocked.reason}` : undefined}>
          <HpPill tone="rose" icon={ShieldAlert} size="sm">
            Blocked
          </HpPill>
        </span>
      )}
    </span>
  );
}

export function RosterSkeleton() {
  return (
    <div className="divide-y divide-border-subtle" role="status" aria-label="Loading cohort">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <HpSkeleton className="h-[18px] w-[18px] rounded-[6px]" />
          <HpSkeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <HpSkeleton className="h-3.5 w-1/3 max-w-[12rem]" />
            <HpSkeleton className="h-3 w-1/4 max-w-[8rem]" />
          </div>
          <HpSkeleton className="hidden h-6 w-24 rounded-md md:block" />
          <HpSkeleton className="h-10 w-10 rounded-full" />
          <HpSkeleton className="hidden h-6 w-24 rounded-full sm:block" />
          <HpSkeleton className="hidden h-8 w-36 rounded-[10px] lg:block" />
        </div>
      ))}
    </div>
  );
}
