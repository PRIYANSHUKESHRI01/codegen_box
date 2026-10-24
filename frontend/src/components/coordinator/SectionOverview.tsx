"use client";

import { motion } from "framer-motion";
import { Activity, CalendarClock, Gauge, LifeBuoy, NotebookPen, Siren, UserRound, Users, CheckCircle2 } from "lucide-react";
import { HP_TONES, HpAvatar, HpCard, HpPill, HpSectionHeader, HpStatCard, hpBtn, hpEase, type HpTone } from "@/components/portal/kit";
import { TIER_TONE } from "@/components/dashboard/tpo/cohortCells";
import { cn } from "@/lib/utils";
import type { AttentionItem, CoordinatorSummary } from "@/types/coordinator";
import type { CohortStudent } from "@/types/cohort";

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** The numbers a coordinator opens the page for — all straight from the server's summary, so they match the table and the e-mail. */
export function SectionKpis({ summary, attentionCount, scopeLabel }: { summary: CoordinatorSummary; attentionCount: number; scopeLabel: string }) {
  const due = summary.overdue_follow_ups;

  return (
    <section aria-label="Section at a glance" className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
      <HpStatCard label="Students" value={summary.size} icon={Users} tone="sky" hint={scopeLabel} />
      <HpStatCard label="Avg readiness" value={summary.avg_readiness} suffix="/100" icon={Gauge} tone="violet" hint={`${summary.tiers.placement_ready} placement ready`} />
      <HpStatCard label="Practising now" value={summary.engagement.active} icon={Activity} tone="emerald" hint={`${pct(summary.engagement.active, summary.size)}% practised this week`} />
      <HpStatCard
        label="Need attention"
        value={attentionCount}
        icon={LifeBuoy}
        tone={attentionCount > 0 ? "amber" : "emerald"}
        hint={`${summary.at_risk} below 60 readiness`}
        className="col-span-1"
      />
      <HpStatCard
        label="Follow-ups"
        value={summary.open_follow_ups}
        icon={CalendarClock}
        tone={due > 0 ? "rose" : "indigo"}
        delta={due > 0 ? { label: `${due} overdue`, positive: false } : undefined}
        hint={due > 0 ? undefined : "open on your log"}
        className="col-span-2 lg:col-span-1"
      />
    </section>
  );
}

const REASON_TONE: Record<string, HpTone> = {
  locked_out: "rose",
  follow_up_overdue: "rose",
  follow_up_due: "amber",
  never_signed_in: "amber",
  dormant: "rose",
  not_started: "amber",
  slipping: "amber",
  needs_training: "sky",
  at_risk: "slate",
  follow_up_scheduled: "indigo",
};

/**
 * The students most worth a conversation this week — ranked on the server, each with the reasons in plain words. One click
 * logs a call; one click opens the full profile.
 */
export function AttentionQueue({
  items,
  total,
  onOpen,
  onLog,
  onShowAll,
  showingAll,
}: {
  items: AttentionItem[];
  /** How many students are in the queue in all (the list may be capped). */
  total: number;
  onOpen: (studentId: number) => void;
  onLog: (studentId: number) => void;
  onShowAll: () => void;
  showingAll: boolean;
}) {
  return (
    <HpCard spotlight={false} className="flex flex-col p-4 sm:p-5">
      <HpSectionHeader
        title="Needs your attention"
        subtitle="Ranked by what is going on — the students most worth a call this week"
        icon={Siren}
        tone="amber"
        action={
          items.length > 0 ? (
            <button type="button" onClick={onShowAll} aria-pressed={showingAll} className={cn(hpBtn(showingAll ? "soft" : "secondary", "sm", "h-8 px-2.5"))}>
              {showingAll ? "Showing in roster" : "Show in roster"}
            </button>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border-subtle px-4 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5" aria-hidden />
          </span>
          <p className="text-sm font-bold text-primary">Nobody needs chasing right now</p>
          <p className="max-w-xs text-2xs leading-relaxed text-text-muted">Everyone is practising, signed in and on track. This list refills the moment someone slips.</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border-subtle" aria-label="Students needing attention">
          {items.map((item, index) => (
            <motion.li
              key={item.student_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: hpEase, delay: Math.min(index, 8) * 0.03 }}
              className="flex flex-col gap-2.5 py-3 sm:flex-row sm:items-center sm:gap-3"
            >
              <button type="button" onClick={() => onOpen(item.student_id)} className="group flex min-w-0 flex-1 items-start gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                <HpAvatar name={item.name} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="truncate text-13 font-bold text-primary transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{item.name}</span>
                    <span className="tabular shrink-0 text-3xs font-semibold text-text-muted">Readiness {item.readiness_score}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {item.reasons.map((r) => (
                      <HpPill key={r.code} tone={REASON_TONE[r.code] ?? "slate"} size="sm" className="whitespace-normal text-left">
                        {r.label}
                      </HpPill>
                    ))}
                  </span>
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1.5 pl-[52px] sm:pl-0">
                <button type="button" onClick={() => onLog(item.student_id)} className={hpBtn("soft", "sm", "h-8 px-2.5")} aria-label={`Log a follow-up for ${item.name}`}>
                  <NotebookPen className="h-3.5 w-3.5" /> Log call
                </button>
                <button type="button" onClick={() => onOpen(item.student_id)} className={hpBtn("secondary", "sm", "h-8 px-2.5")} aria-label={`Open ${item.name}'s profile`}>
                  <UserRound className="h-3.5 w-3.5" /> Profile
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      )}

      {total > items.length && <p className="mt-3 border-t border-border-subtle pt-3 text-2xs text-text-muted">Showing the top {items.length} of {total}.</p>}
    </HpCard>
  );
}

const TIERS = ["Placement Ready", "In Progress", "Needs Training"] as const;

/** How the section splits by readiness tier; a row filters the roster. */
export function ReadinessMix({ summary, active, onSelect }: { summary: CoordinatorSummary; active: CohortStudent["readiness_tier"] | "ALL"; onSelect: (tier: CohortStudent["readiness_tier"] | "ALL") => void }) {
  const counts: Record<(typeof TIERS)[number], number> = {
    "Placement Ready": summary.tiers.placement_ready,
    "In Progress": summary.tiers.in_progress,
    "Needs Training": summary.tiers.needs_training,
  };

  return (
    <HpCard spotlight={false} className="flex flex-col p-4 sm:p-5">
      <HpSectionHeader title="Readiness mix" subtitle={`Section average ${summary.avg_readiness}/100`} icon={Gauge} tone="violet" />

      <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-elevated [&>*+*]:border-l-2 [&>*+*]:border-[rgb(var(--bg-surface-rgb))]" aria-hidden>
        {TIERS.map((t) =>
          counts[t] > 0 ? (
            <motion.div key={t} className={cn("h-full", HP_TONES[TIER_TONE[t]].fill)} initial={{ width: 0 }} animate={{ width: `${pct(counts[t], summary.size)}%` }} transition={{ duration: 0.8, ease: hpEase }} />
          ) : null
        )}
      </div>

      <ul className="mt-4 space-y-1">
        {TIERS.map((t) => {
          const selected = active === t;
          return (
            <li key={t}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(selected ? "ALL" : t)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  selected ? "bg-indigo-500/[0.08] ring-1 ring-inset ring-indigo-500/25" : "hover:bg-elevated/70"
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", HP_TONES[TIER_TONE[t]].fill)} />
                  <span className="truncate text-xs font-semibold text-text-secondary">{t}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="tabular text-3xs font-semibold text-text-muted">{pct(counts[t], summary.size)}%</span>
                  <span className="tabular w-8 text-right text-sm font-extrabold text-primary">{counts[t]}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-auto pt-4 text-2xs leading-relaxed text-text-muted">Select a tier to focus the roster on it.</p>
    </HpCard>
  );
}
