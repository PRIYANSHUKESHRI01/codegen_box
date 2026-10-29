"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Search,
  Timer,
  ChevronDown,
  Loader2,
  Mic,
  CheckCircle2,
  X,
  AlertCircle,
  Trophy,
  Lock,
  Clock,
  RotateCcw,
  Target,
  RefreshCw,
  History,
  Flame,
  Bell,
  BellRing,
  Hourglass,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CARD, Rise, isLive, roleIconOf, shortName, stackIconOf, themeOf } from "./curatedKit";
import { Aurora, ScoreRing, VaSkeleton } from "@/components/dashboard/vaultAi/vaultKit";
import type {
  CuratedCatalogResponse,
  CuratedInterviewSetSummary,
  CuratedRole,
  CuratedStack,
  QualificationSetDetail,
  VaultQualificationComingSoonResponse,
  VaultQualificationStatusResponse,
} from "@/types/curatedInterviewSets";

/** The benchmark a series average has to reach (mirrors VaultInterviewQualification::PASSING_THRESHOLD). */
const BENCHMARK = 60;

/** Where the student is in the three steps, and a way back to any step already passed. */
function StepNav({ step, role, stack, onRoles, onStacks }: { step: 1 | 2 | 3; role: CuratedRole | null; stack: CuratedStack | null; onRoles: () => void; onStacks: () => void }) {
  const steps = [
    { n: 1, label: "All Roles", sub: role?.title ?? "Choose a role", go: onRoles },
    { n: 2, label: role ? role.title : "Stack", sub: stack?.name ?? "Choose a stack", go: onStacks },
    { n: 3, label: stack ? stack.name : "Qualify", sub: "Sit the 3 sets", go: undefined },
  ] as const;

  return (
    <nav aria-label="Curated Sets Trail" className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs sm:gap-2">
      {steps.map((s, idx) => {
        const done = s.n < step;
        const current = s.n === step;
        const clickable = done && s.go;
        return (
          <div key={s.n} className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={s.go}
              aria-current={current ? "step" : undefined}
              className={cn(
                "group/step flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                current
                  ? "border-accent-primary/40 bg-accent-primary/10 text-primary shadow-subtle"
                  : done
                    ? "border-emerald-500/30 bg-emerald-500/[0.06] text-text-secondary hover:border-emerald-500/50 hover:text-primary"
                    : "border-border-subtle bg-surface text-text-muted"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold transition-colors",
                  current ? "bg-accent-primary text-white" : done ? "bg-emerald-500 text-white" : "bg-elevated text-text-muted"
                )}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : s.n}
              </span>
              <span className="max-w-[9rem] truncate">{done || current ? s.label : s.sub}</span>
            </button>
            {idx < steps.length - 1 && <span aria-hidden className={cn("h-px w-4 sm:w-8", done ? "bg-emerald-500/50" : "bg-border-subtle")} />}
          </div>
        );
      })}
    </nav>
  );
}

/** "Open" / "Coming soon" at a glance. */
function StackStatusChip({ stack }: { stack: CuratedStack }) {
  if (isLive(stack)) {
    return <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">Open</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
      <Hourglass className="h-3 w-3" aria-hidden /> Coming soon
    </span>
  );
}

/**
 * A track whose questions are not written yet. It says so plainly, shows what the three rounds will assess (so the student can
 * already prepare), and lets them ask to be told the moment it opens. Nothing here can be started.
 */
function ComingSoonPanel({ stack, interested, busy, error, onToggle }: { stack: CuratedStack; interested: boolean; busy: boolean; error: string | null; onToggle: () => void }) {
  const rounds = stack.series?.[0]?.sets ?? stack.sets.slice(0, 3);
  const ready = stack.ready_sets ?? 0;
  const total = stack.total_sets ?? 9;

  return (
    <div className="space-y-5">
      <Rise>
        <div className="space-y-4 rounded-3xl border border-amber-500/30 bg-amber-500/[0.05] p-6 shadow-subtle md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30 ring-1 ring-inset ring-white/25">
              <Hourglass className="h-7 w-7" aria-hidden />
            </div>
            <div className="space-y-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-3xs font-black uppercase tracking-wider text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">Coming soon</span>
              <h4 className="text-base font-black text-primary sm:text-lg">The {stack.name} interview is being prepared</h4>
              <p className="text-xs leading-relaxed text-text-secondary sm:text-sm">
                We are finishing the question bank for this track. When it opens you will sit <strong className="font-bold text-primary">3 sets</strong> per series (up to 3 series), and a series average of{" "}
                <strong className="font-bold text-primary">{BENCHMARK}% or higher</strong> qualifies you for Mellow Vault.
              </p>
              {ready > 0 && (
                <p className="text-2xs font-semibold text-text-muted">
                  {ready} of {total} rounds ready
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onToggle}
              disabled={busy}
              aria-pressed={interested}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold shadow-subtle transition-all disabled:opacity-60",
                interested ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300" : "bg-accent-primary text-white hover:-translate-y-0.5 hover:bg-accent-primary-hover hover:shadow-card"
              )}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : interested ? <BellRing className="h-3.5 w-3.5" aria-hidden /> : <Bell className="h-3.5 w-3.5" aria-hidden />}
              {interested ? "You'll be notified — tap to undo" : "Notify me when it opens"}
            </button>
            <Link href="/dashboard/interviews" className="text-xs font-bold text-accent-primary hover:underline">
              Practise with a mock AI interview meanwhile →
            </Link>
          </div>
          {error && (
            <p role="alert" className="text-xs font-semibold text-status-danger">
              {error}
            </p>
          )}
        </div>
      </Rise>

      <div className="space-y-3">
        <h5 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-text-muted">
          <Target className="h-3.5 w-3.5 text-accent-primary" aria-hidden />
          <span>What you will be assessed on</span>
        </h5>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {rounds.map((set, i) => (
            <Rise key={set.id} i={i} className="h-full">
              <div className={cn(CARD, "gap-2 hover:translate-y-0")}>
                <span className="w-fit rounded-md border border-border-subtle bg-elevated px-2 py-0.5 font-mono text-3xs uppercase text-text-muted">Set {set.set_number ?? i + 1}</span>
                <h6 className="text-sm font-bold text-primary">{set.title.replace(/^Set \d+:\s*/, "")}</h6>
                <p className="text-xs leading-relaxed text-text-secondary">{set.description}</p>
              </div>
            </Rise>
          ))}
        </div>
        {(stack.aliases ?? []).length > 0 && (
          <p className="text-2xs text-text-muted">
            Covers the Mellow Vault domain{(stack.aliases ?? []).length === 1 ? "" : "s"}: <span className="font-semibold text-text-secondary">{(stack.aliases ?? []).join(" · ")}</span>
          </p>
        )}
      </div>
    </div>
  );
}

/** Three small markers for the three attempts: past (missed the line), the one in play, and the ones still ahead. */
function AttemptMarkers({ current, max, failed }: { current: number; max: number; failed: number[] }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: max }).map((_, i) => {
        const n = i + 1;
        const missed = failed.includes(n);
        const now = n === current;
        return (
          <span
            key={n}
            className={cn(
              "relative h-2.5 rounded-full transition-all duration-500",
              now ? "w-8 bg-gradient-to-r from-indigo-500 to-violet-500" : "w-2.5",
              missed ? "bg-rose-400/80" : !now && "bg-border-strong"
            )}
          >
            {now && <span className="va-ping absolute inset-0 rounded-full bg-indigo-400/50" />}
          </span>
        );
      })}
    </div>
  );
}

function SetCard({
  set,
  total,
  isStarting,
  expanded,
  onToggle,
  onStart,
  index,
}: {
  set: QualificationSetDetail;
  total: number;
  isStarting: boolean;
  expanded: boolean;
  onToggle: () => void;
  onStart: () => void;
  index: number;
}) {
  const isCompleted = set.status === "completed";
  const isInProgress = set.status === "in_progress";
  const isScoring = set.status === "scoring";
  const passed = isCompleted && set.score_percent !== null && set.score_percent >= BENCHMARK;
  const tone = isCompleted ? (passed ? "emerald" : "amber") : isInProgress ? "amber" : isScoring ? "indigo" : "slate";

  return (
    <Rise i={index} className="h-full">
      <div
        className={cn(
          "group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border bg-surface p-5 shadow-subtle transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-card",
          isCompleted ? (passed ? "border-emerald-500/35" : "border-amber-500/35") : isInProgress ? "border-amber-500/40" : isScoring ? "border-indigo-500/35" : "border-border-subtle hover:border-accent-primary/40"
        )}
      >
        {/* status hairline */}
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-0 h-[3px]",
            isCompleted ? (passed ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-amber-400 to-orange-400") : isInProgress ? "bg-gradient-to-r from-amber-400 to-orange-400" : isScoring ? "bg-gradient-to-r from-indigo-400 to-violet-400" : "bg-gradient-to-r from-border-strong/0 via-border-strong to-border-strong/0 opacity-70 transition-opacity group-hover:opacity-100"
          )}
        />
        {isCompleted && <div aria-hidden className={cn("pointer-events-none absolute inset-0", passed ? "bg-[radial-gradient(80%_80%_at_100%_0%,rgba(16,185,129,0.09),transparent_60%)]" : "bg-[radial-gradient(80%_80%_at_100%_0%,rgba(245,158,11,0.09),transparent_60%)]")} />}

        <div className="relative flex items-center justify-between gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-3xs font-extrabold uppercase tracking-wide ring-1 ring-inset",
              tone === "emerald" && "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
              tone === "amber" && "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
              tone === "indigo" && "bg-indigo-500/10 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
              tone === "slate" && "bg-elevated text-text-muted ring-border-subtle"
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold text-white",
                tone === "emerald" && "bg-emerald-500",
                tone === "amber" && "bg-amber-500",
                tone === "indigo" && "bg-indigo-500",
                tone === "slate" && "bg-slate-400"
              )}
            >
              {isCompleted ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : set.set_number}
            </span>
            <span>Round {set.set_number}</span>
          </span>

          <span className="inline-flex items-center gap-1.5 text-3xs font-semibold text-text-muted">
            <Timer className="h-3 w-3" aria-hidden />
            <span>~{set.duration_minutes}m</span>
            <span aria-hidden>•</span>
            <span>{set.question_count} Qs</span>
          </span>
        </div>

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-15 font-extrabold leading-snug text-primary">{set.title}</h4>
            <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-text-secondary">{set.description}</p>
          </div>
          {isCompleted && set.score_percent !== null && (
            <ScoreRing value={set.score_percent} size={64} stroke={6} tone={passed ? "emerald" : "amber"} label={`Round ${set.set_number} score`}>
              <span className={cn("tabular text-sm font-extrabold", passed ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300")}>{set.score_percent}%</span>
            </ScoreRing>
          )}
        </div>

        {isCompleted && set.score_percent !== null && (
          <p className={cn("relative flex items-center gap-1.5 text-2xs font-bold", passed ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300")}>
            {passed ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : <Flame className="h-3.5 w-3.5" aria-hidden />}
            {passed ? `Above the ${BENCHMARK}% line` : `Below the ${BENCHMARK}% line — the series average is what counts`}
          </p>
        )}

        {set.preview_questions && set.preview_questions.length > 0 && (
          <div className="relative border-t border-border-subtle pt-2.5">
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between py-1 text-2xs font-semibold text-text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              <span>Preview sample questions ({set.preview_questions.length})</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300", expanded && "rotate-180")} aria-hidden />
            </button>
            <div className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out", expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
              <div className="overflow-hidden">
                <ol className="mt-2 space-y-1.5 rounded-r-lg border-l-2 border-accent-primary/40 bg-elevated/50 p-2.5 pl-3 text-2xs text-text-secondary">
                  {set.preview_questions.map((q, idx) => (
                    <li key={idx} className="leading-snug">
                      <span className="mr-1 font-bold text-primary">{idx + 1}.</span> {q}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        )}

        <div className="relative mt-auto flex items-center justify-between gap-2 border-t border-border-subtle pt-3.5">
          <span className="inline-flex items-center gap-1.5 text-3xs font-semibold text-text-muted">
            {isInProgress && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500 motion-safe:animate-pulse-subtle" />}
            {isCompleted ? "Completed" : isScoring ? "Scoring…" : isInProgress ? "In Progress" : "Ready to Start"}
          </span>

          {set.interview_slug && (isCompleted || isScoring) ? (
            <Link
              href={`/dashboard/vault-interviews/view?slug=${encodeURIComponent(set.interview_slug)}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-3.5 py-2 text-xs font-bold text-primary shadow-subtle transition-all hover:-translate-y-0.5 hover:border-accent-primary hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
            >
              <span>{isScoring ? "View Result" : "View Critique"}</span>
              <ArrowRight className="h-3 w-3 text-text-muted" aria-hidden />
            </Link>
          ) : (
            <button
              type="button"
              disabled={isStarting}
              onClick={onStart}
              className={cn(
                "relative inline-flex items-center justify-center gap-1.5 overflow-hidden rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isStarting
                  ? "cursor-wait bg-indigo-500/70"
                  : "bg-gradient-to-r from-indigo-500 to-violet-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/35 active:translate-y-0 active:scale-[0.98]"
              )}
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  <span>Starting...</span>
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" aria-hidden />
                  <span>{isInProgress ? `Resume Set ${set.set_number}` : `Start Set ${set.set_number}`}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
      <span className="sr-only">{`Set ${set.set_number} of ${total}`}</span>
    </Rise>
  );
}

/** The series' three sets as a rail: filled as each one is finished, so progress is visible at a glance. */
function SeriesRail({ sets, average }: { sets: QualificationSetDetail[]; average: number | null }) {
  const done = sets.filter((s) => s.status === "completed").length;
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface p-4 shadow-subtle sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <ScoreRing value={average} size={92} stroke={9} tone={average !== null && average >= BENCHMARK ? "emerald" : "indigo"} label="Series average">
        <span className="tabular text-xl font-extrabold leading-none text-primary">{average === null ? "—" : `${Math.round(average)}%`}</span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-text-muted">average</span>
      </ScoreRing>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-13 font-bold text-primary">Series progress</p>
          <p className="tabular text-2xs font-semibold text-text-muted">
            {done} of {sets.length} sets completed · need {BENCHMARK}% average
          </p>
        </div>
        <div className="mt-3 flex items-center">
          {sets.map((s, i) => {
            const completed = s.status === "completed";
            const active = s.status === "in_progress" || s.status === "scoring";
            return (
              <div key={s.set_number} className={cn("flex items-center", i < sets.length - 1 && "flex-1")}>
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ring-2 transition-all duration-500",
                    completed ? "bg-emerald-500 text-white ring-emerald-500/30" : active ? "bg-amber-500 text-white ring-amber-500/30" : "bg-elevated text-text-muted ring-border-subtle"
                  )}
                  title={`Set ${s.set_number}: ${s.status.replace("_", " ")}`}
                >
                  {completed ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : s.set_number}
                </span>
                {i < sets.length - 1 && (
                  <span className="mx-1.5 h-1 flex-1 overflow-hidden rounded-full bg-border-subtle">
                    <span className={cn("block h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-700", completed ? "w-full" : "w-0")} />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PastAttempts({ attempts }: { attempts: VaultQualificationStatusResponse["past_attempts"] }) {
  if (attempts.length === 0) return null;
  return (
    <Rise i={3}>
      <section aria-label="Previous attempts" className="rounded-2xl border border-border-subtle bg-surface p-4 shadow-subtle sm:p-5">
        <h5 className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-text-muted">
          <History className="h-3.5 w-3.5" aria-hidden /> Previous attempts
        </h5>
        <ul className="mt-3 divide-y divide-border-subtle">
          {attempts.map((a) => (
            <li key={`${a.attempt}-${a.evaluated_at}`} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-13 font-bold text-primary">Attempt {a.attempt}</p>
                <p className="text-2xs text-text-muted">{new Date(a.evaluated_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {Object.entries(a.scores)
                  .sort(([x], [y]) => Number(x) - Number(y))
                  .map(([set, score]) => (
                    <span key={set} className="tabular rounded-lg bg-elevated px-2 py-1 text-2xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle" title={`Set ${set}`}>
                      S{set} <span className="text-primary">{score}%</span>
                    </span>
                  ))}
              </div>
              <span className={cn("tabular rounded-full px-2.5 py-1 text-2xs font-extrabold ring-1 ring-inset", a.passed ? "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300")}>
                {Math.round(a.average)}% average
              </span>
            </li>
          ))}
        </ul>
      </section>
    </Rise>
  );
}

export function CuratedSetsExplorer({ className }: { className?: string }) {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CuratedCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Navigation Drill-Down State
  const [selectedRoleKey, setSelectedRoleKey] = useState<string | null>(null);
  const [selectedStackKey, setSelectedStackKey] = useState<string | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Qualification Track State for Selected Stack
  const [qualificationOrSoon, setQualification] = useState<VaultQualificationStatusResponse | VaultQualificationComingSoonResponse | null>(null);
  const [loadingQualification, setLoadingQualification] = useState(false);
  // Only an open stack has a track; a coming-soon one answers with a different, smaller shape.
  const qualification: VaultQualificationStatusResponse | null = qualificationOrSoon && qualificationOrSoon.stack_live !== false ? qualificationOrSoon : null;

  // "Notify me when it opens": what the student has chosen this visit, over what the catalog said when it loaded.
  const [interestOverride, setInterestOverride] = useState<Record<string, boolean>>({});
  const [notifyBusy, setNotifyBusy] = useState(false);
  const [notifyError, setNotifyError] = useState<string | null>(null);

  // Show only the roles that have at least one open stack.
  const [openOnly, setOpenOnly] = useState(false);

  // Question Preview Toggles (set ID -> boolean)
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});

  // Interview Launching State
  const [startingSetNumber, setStartingSetNumber] = useState<number | null>(null);
  const [actionError, setActionError] = useState<{ message: string } | null>(null);

  // 1. Fetch initial catalog
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    api
      .get<CuratedCatalogResponse>("/curated-interview-sets")
      .then((res) => {
        if (!alive) return;
        setCatalog(res);
      })
      .catch((err) => {
        if (!alive) return;
        setLoadError(err instanceof ApiError ? err.message : "Failed to load curated interview sets.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [reloadKey]);

  // Whether the chosen stack is open, as the catalog says. A coming-soon stack has no track to fetch.
  const selectedStackOpen = useMemo(() => {
    if (!selectedStackKey || !catalog) return null;
    for (const r of catalog.roles) {
      const found = r.stacks.find((st) => st.key === selectedStackKey);
      if (found) return isLive(found);
    }
    return null;
  }, [catalog, selectedStackKey]);

  // 2. Fetch qualification status when stack is selected
  useEffect(() => {
    if (!selectedStackKey || selectedStackOpen === false) {
      setQualification(null);
      return;
    }

    let alive = true;
    setLoadingQualification(true);

    api
      .get<VaultQualificationStatusResponse | VaultQualificationComingSoonResponse>(`/vault-qualification/status?stack=${encodeURIComponent(selectedStackKey)}`)
      .then((res) => {
        if (!alive) return;
        setQualification(res);
      })
      .catch(() => {
        // Fallback gracefully
        if (!alive) return;
        setQualification(null);
      })
      .finally(() => {
        if (alive) setLoadingQualification(false);
      });

    return () => {
      alive = false;
    };
  }, [selectedStackKey, selectedStackOpen]);

  // A set that is finished but not scored yet: look again every few seconds, so its score (and the series average) appears by itself instead of
  // sitting on "scoring" until the student thinks to reload. Depends on the yes/no, not the data, so a refresh does not restart the count.
  const anySetScoring = qualification?.active_series.sets.some((set) => set.status === "scoring") ?? false;
  useEffect(() => {
    if (!anySetScoring || !selectedStackKey) return;
    let alive = true;
    let looks = 0;
    const timer = setInterval(() => {
      if (++looks > 40) return clearInterval(timer);
      api
        .get<VaultQualificationStatusResponse | VaultQualificationComingSoonResponse>(`/vault-qualification/status?stack=${encodeURIComponent(selectedStackKey)}`)
        .then((res) => alive && setQualification(res))
        .catch(() => undefined);
    }, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [anySetScoring, selectedStackKey]);

  const roles = catalog?.roles ?? [];
  const currentRole = useMemo(() => roles.find((r) => r.key === selectedRoleKey) ?? null, [roles, selectedRoleKey]);
  const currentStack = useMemo(() => currentRole?.stacks.find((s) => s.key === selectedStackKey) ?? null, [currentRole, selectedStackKey]);

  // Search is by stack: its name, its role, the Mellow Vault domains it covers ("AI/ML", "SQL Developer"), its tags and what its sets cover.
  // Open stacks come first — they are the ones a student can act on.
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !catalog) return null;

    const matches: Array<{ role: CuratedRole; stack: CuratedStack }> = [];

    for (const r of catalog.roles) {
      for (const st of r.stacks) {
        const haystack = [r.title, st.name, st.blurb, ...(st.aliases ?? []), ...(st.tags ?? [])].join(" ").toLowerCase();
        const inSets = st.sets.some((set) => set.title.toLowerCase().includes(q) || set.description.toLowerCase().includes(q));

        if (haystack.includes(q) || inSets) matches.push({ role: r, stack: st });
      }
    }

    return [...matches.filter((m) => isLive(m.stack)), ...matches.filter((m) => !isLive(m.stack))];
  }, [catalog, searchQuery]);

  const isInterested = (stack: CuratedStack) => interestOverride[stack.key] ?? (stack.interested === true);

  const handleToggleInterest = async (stack: CuratedStack) => {
    if (notifyBusy) return;
    const next = !isInterested(stack);
    setNotifyBusy(true);
    setNotifyError(null);

    try {
      if (next) await api.post("/vault-qualification/interest", { stack: stack.key });
      else await api.delete("/vault-qualification/interest", { stack: stack.key });
      setInterestOverride((prev) => ({ ...prev, [stack.key]: next }));
    } catch (err) {
      // It may have opened while they were looking: the next catalog load says so.
      setNotifyError(err instanceof ApiError ? err.message : "We couldn't save that. Please try again.");
    } finally {
      setNotifyBusy(false);
    }
  };

  const togglePreview = (setId: string) => setExpandedSets((prev) => ({ ...prev, [setId]: !prev[setId] }));

  const handleStartSet = async (setNumber: number) => {
    if (!selectedStackKey || startingSetNumber !== null) return;
    setStartingSetNumber(setNumber);
    setActionError(null);

    try {
      const res = await api.post<{ interview: { slug: string } }>("/vault-qualification/start-set", {
        stack: selectedStackKey,
        set_number: setNumber,
      });
      router.push(`/dashboard/vault-interviews/view?slug=${encodeURIComponent(res.interview.slug)}`);
    } catch (err) {
      setActionError({ message: err instanceof ApiError ? err.message : "Could not launch interview. Please try again." });
      setStartingSetNumber(null);
    }
  };

  const resetToRoles = () => {
    setSelectedRoleKey(null);
    setSelectedStackKey(null);
  };
  const resetToStacks = () => setSelectedStackKey(null);

  if (loading) {
    return (
      <div className={cn("space-y-4", className)} role="status" aria-label="Loading curated qualification sets">
        <VaSkeleton className="h-24" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <VaSkeleton key={i} className="h-56" />
          ))}
        </div>
        <span className="sr-only">Loading curated qualification sets...</span>
      </div>
    );
  }

  if (loadError || !catalog) {
    return (
      <div className={cn("flex flex-col items-center gap-3 rounded-2xl border border-status-danger/30 bg-status-danger/[0.06] p-8 text-center", className)}>
        <AlertCircle className="h-6 w-6 text-status-danger" aria-hidden />
        <p className="text-sm font-semibold text-status-danger">{loadError ?? "Unable to display curated sets."}</p>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-surface px-4 py-2 text-xs font-bold text-primary shadow-subtle transition-all hover:-translate-y-0.5 hover:shadow-card"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
        </button>
      </div>
    );
  }

  const step: 1 | 2 | 3 = !selectedRoleKey ? 1 : !selectedStackKey ? 2 : 3;

  return (
    <section aria-label="Mellow Vault AI Technical Qualification Circuit" className={cn("space-y-6", className)}>
      {/* Circuit header: a title and one line of facts (the card above already says what this is) */}
      <div>
        <h2 className="text-lg font-extrabold tracking-tight text-primary">Technical Interview Qualification Circuit</h2>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-text-muted">
          <span>{catalog.stats.total_questions} Authentic Questions</span>
          <span aria-hidden>·</span>
          <span>{catalog.stats.total_roles} roles</span>
          <span aria-hidden>·</span>
          <span>
            {catalog.stats.live_stacks ?? catalog.stats.total_stacks} of {catalog.stats.total_stacks} stacks open
          </span>
          <span aria-hidden>·</span>
          <span>3 sets per series</span>
        </p>
      </div>

      {/* Trail + search */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <StepNav step={step} role={currentRole} stack={currentStack} onRoles={resetToRoles} onStacks={resetToStacks} />

        <div className="relative w-full shrink-0 sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search a stack, role or domain..."
            aria-label="Search stacks, roles and domains"
            className="w-full rounded-xl border border-border-subtle bg-surface py-2.5 pl-10 pr-9 text-xs text-primary shadow-subtle transition-all placeholder:text-text-muted focus:border-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/20"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-primary" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div role="alert" className="va-rise flex items-start justify-between gap-3 rounded-2xl border border-status-danger/30 bg-status-danger/[0.07] p-4 text-xs text-status-danger">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="font-semibold">{actionError.message}</p>
          </div>
          <button onClick={() => setActionError(null)} className="shrink-0 text-2xs text-text-muted transition-colors hover:text-primary">
            Dismiss
          </button>
        </div>
      )}

      {/* VIEW 1: SEARCH RESULTS */}
      {searchResults !== null ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>
              Found <strong className="font-bold text-primary">{searchResults.length}</strong> {searchResults.length === 1 ? "track" : "tracks"} matching &ldquo;{searchQuery}&rdquo;
            </span>
            <button onClick={() => setSearchQuery("")} className="font-medium text-accent-primary hover:underline">
              Clear search
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-10 text-center text-xs text-text-muted">
              No track matched &ldquo;{searchQuery}&rdquo;. Try a domain like &ldquo;Data Analytics&rdquo;, &ldquo;SQL&rdquo;, &ldquo;Cyber Security&rdquo;, &ldquo;Laravel&rdquo; or &ldquo;Docker&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map(({ role, stack }, i) => {
                const StackIcon = stackIconOf(stack);
                const theme = themeOf(role.color);
                const open = isLive(stack);
                return (
                  <Rise key={stack.key} i={i} className="h-full">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRoleKey(role.key);
                        setSelectedStackKey(stack.key);
                        setSearchQuery("");
                      }}
                      className={cn(CARD, "gap-3", open ? [theme.glow, theme.ring] : "opacity-95")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-inset ring-white/25", open ? theme.tile : "from-slate-400 to-slate-500")}>
                          <StackIcon className="h-5 w-5" />
                        </div>
                        <StackStatusChip stack={stack} />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-primary">{stack.name}</h4>
                        <p className="mt-0.5 text-3xs font-semibold uppercase tracking-wider text-text-muted">{role.title}</p>
                        <p className="mt-1.5 line-clamp-2 text-xs text-text-secondary">{stack.blurb}</p>
                      </div>
                      {(stack.aliases ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(stack.aliases ?? []).slice(0, 3).map((alias) => (
                            <span key={alias} className="rounded-full border border-border-subtle bg-elevated/60 px-2 py-0.5 text-3xs font-medium text-text-secondary">
                              {alias}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-end border-t border-border-subtle pt-3 text-xs font-bold text-accent-primary">
                        <span className="inline-flex items-center gap-1">
                          {open ? "Enter Series" : "View syllabus"} <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </button>
                  </Rise>
                );
              })}
            </div>
          )}
        </div>
      ) : !selectedRoleKey ? (
        /* STEP 1 — CHOOSE ENGINEERING ROLE */
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-primary">Step 1: Choose Your Domain</h3>
              <p className="text-xs text-text-secondary">Select the role you are aiming for to see its technical tracks.</p>
            </div>
            <div role="group" aria-label="Filter roles" className="inline-flex rounded-full border border-border-subtle bg-surface p-0.5 text-2xs font-bold shadow-subtle">
              {[
                { v: false, label: "All roles" },
                { v: true, label: "Open now" },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  aria-pressed={openOnly === o.v}
                  onClick={() => setOpenOnly(o.v)}
                  className={cn("rounded-full px-3 py-1 transition-colors", openOnly === o.v ? "bg-accent-primary text-white" : "text-text-secondary hover:text-primary")}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.filter((role) => !openOnly || (role.live_stacks_count ?? role.stacks_count) > 0).map((role, i) => {
              const RoleIcon = roleIconOf(role);
              const theme = themeOf(role.color);
              const liveStacks = role.live_stacks_count ?? role.stacks_count;
              return (
                <Rise key={role.key} i={i} className="h-full">
                  <button type="button" onClick={() => setSelectedRoleKey(role.key)} className={cn(CARD, theme.glow, theme.ring)}>
                    <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-30", theme.tile)} />
                    <div className="relative flex items-start justify-between gap-2">
                      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3", theme.tile)}>
                        <RoleIcon className="h-6 w-6" />
                      </div>
                      {role.badge && <span className={cn("rounded-full px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide ring-1 ring-inset", theme.chip)}>{role.badge}</span>}
                    </div>

                    <div className="relative">
                      <h4 className={cn("text-15 font-extrabold text-primary transition-colors", theme.text)}>
                        <span>{role.title}</span>
                      </h4>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{role.blurb}</p>
                    </div>

                    <div className="relative mt-auto flex flex-wrap gap-1.5 pt-1">
                      {role.stacks.slice(0, 4).map((stack) => (
                        <span key={stack.key} className={cn("rounded-full border border-border-subtle bg-elevated/60 px-2.5 py-0.5 text-3xs font-medium", isLive(stack) ? "text-text-secondary" : "text-text-muted")}>
                          {shortName(stack.name)}
                        </span>
                      ))}
                      {role.stacks.length > 4 && <span className="rounded-full border border-border-subtle bg-elevated/60 px-2.5 py-0.5 text-3xs font-medium text-text-muted">+{role.stacks.length - 4} more</span>}
                    </div>

                    <div className="relative flex items-center justify-between border-t border-border-subtle pt-3 text-2xs text-text-muted">
                      <span>
                        {role.stacks_count} {role.stacks_count === 1 ? "Stack" : "Stacks"} • {liveStacks === 0 ? "Coming soon" : liveStacks === role.stacks_count ? "All open" : `${liveStacks} open`}
                      </span>
                      <span className="inline-flex items-center gap-1 font-bold text-accent-primary transition-transform group-hover:translate-x-0.5">
                        Explore Stacks <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </button>
                </Rise>
              );
            })}
          </div>
          {openOnly && roles.every((role) => (role.live_stacks_count ?? role.stacks_count) === 0) && (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-8 text-center text-xs text-text-muted">No track is open yet. Switch to &ldquo;All roles&rdquo; to see what is coming.</div>
          )}
        </div>
      ) : !selectedStackKey && currentRole ? (
        /* STEP 2 — TECH STACK PICKER */
        <div className="space-y-4">
          <div>
            <button onClick={resetToRoles} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-accent-primary hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to all roles
            </button>
            <h3 className="text-sm font-bold text-primary">Step 2: Choose Your Track in {currentRole.title}</h3>
            <p className="text-xs text-text-secondary">Select a track to begin your Mellow Vault qualification assessment. Tracks marked Coming soon are still being prepared — you can ask to be told when they open.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentRole.stacks.map((stack, i) => {
              const StackIcon = stackIconOf(stack);
              const theme = themeOf(currentRole.color);
              const open = isLive(stack);
              return (
                <Rise key={stack.key} i={i} className="h-full">
                  <button type="button" onClick={() => setSelectedStackKey(stack.key)} className={cn(CARD, "gap-3.5", open ? [theme.glow, theme.ring] : "hover:border-border-strong")}>
                    <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-30", theme.tile)} />
                    <div className="relative flex items-start justify-between gap-2">
                      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover:scale-110", open ? theme.tile : "from-slate-400 to-slate-500")}>
                        <StackIcon className="h-5 w-5" />
                      </div>
                      {open ? (
                        <span className="rounded-full border border-border-subtle bg-elevated/70 px-2.5 py-1 text-3xs font-bold uppercase tracking-wider text-text-secondary">3 Rounds</span>
                      ) : (
                        <StackStatusChip stack={stack} />
                      )}
                    </div>

                    <div className="relative">
                      <h4 className={cn("text-15 font-extrabold text-primary transition-colors", theme.text)}>{stack.name}</h4>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{stack.blurb}</p>
                    </div>

                    <div className="relative mt-auto flex items-center justify-between border-t border-border-subtle pt-3 text-2xs text-text-muted">
                      {open ? (
                        <>
                          <span className="inline-flex items-center gap-1 text-3xs font-bold text-emerald-600 dark:text-emerald-400">Set 1 • Set 2 • Set 3</span>
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 transition-transform group-hover:translate-x-0.5 dark:text-emerald-400">
                            Launch Circuit <ArrowRight className="h-3 w-3" />
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1 text-3xs font-bold text-text-muted">
                            {isInterested(stack) ? (
                              <>
                                <BellRing className="h-3 w-3 text-accent-primary" aria-hidden /> We&apos;ll tell you
                              </>
                            ) : (
                              "Be the first to know"
                            )}
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-accent-primary transition-transform group-hover:translate-x-0.5">
                            View syllabus <ArrowRight className="h-3 w-3" />
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                </Rise>
              );
            })}
          </div>
        </div>
      ) : currentRole && currentStack ? (
        /* STEP 3 — QUALIFICATION SERIES DASHBOARD & ATTEMPT TRACKER */
        <div className="space-y-6">
          <div>
            <button onClick={resetToStacks} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-accent-primary hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to {currentRole.title} stacks
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                {(() => {
                  const Icon = stackIconOf(currentStack);
                  return (
                    <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25", isLive(currentStack) ? themeOf(currentRole.color).tile : "from-slate-400 to-slate-500")}>
                      <Icon className="h-6 w-6" />
                    </span>
                  );
                })()}
                <div>
                  <h3 className="text-lg font-black text-primary sm:text-xl">
                    <span>{currentStack.name} Qualification Track</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {isLive(currentStack) ? (
                      <>
                        Complete all 3 Sets below. Your overall series average must reach <strong className="font-bold text-primary">60% or higher</strong> to unlock Mellow Vault listing.
                      </>
                    ) : (
                      <>This track is still being prepared. Here is what it will assess.</>
                    )}
                  </p>
                </div>
              </div>

              {qualification && (
                <div className="inline-flex shrink-0 items-center gap-3 self-start rounded-2xl border border-border-subtle bg-surface px-3.5 py-2 text-xs shadow-subtle sm:self-auto">
                  <AttemptMarkers current={qualification.current_attempt} max={qualification.max_attempts} failed={qualification.past_attempts.filter((a) => !a.passed).map((a) => a.attempt)} />
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-3xs font-black uppercase tracking-wide ring-1 ring-inset",
                      qualification.is_qualified
                        ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300"
                        : qualification.is_cooling_down
                          ? "bg-rose-500/10 text-rose-600 ring-rose-500/25 dark:text-rose-300"
                          : "bg-accent-primary/10 text-accent-primary ring-accent-primary/25"
                    )}
                  >
                    {qualification.is_qualified ? "Qualified" : qualification.is_cooling_down ? "Exhausted (3/3)" : `Attempt ${qualification.current_attempt} of ${qualification.max_attempts}`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!isLive(currentStack) ? (
            <ComingSoonPanel stack={currentStack} interested={isInterested(currentStack)} busy={notifyBusy} error={notifyError} onToggle={() => void handleToggleInterest(currentStack)} />
          ) : loadingQualification ? (
            <div role="status" className="space-y-4">
              <VaSkeleton className="h-28" />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <VaSkeleton key={i} className="h-64" />
                ))}
              </div>
              <span className="sr-only">Loading qualification record...</span>
            </div>
          ) : qualification?.is_qualified ? (
            /* OUTCOME A: QUALIFIED (>= 60%) */
            <Rise>
              <div className="relative overflow-hidden rounded-3xl border border-emerald-400/40 bg-[#06141a] p-6 text-white shadow-[0_28px_70px_-26px_rgba(16,185,129,0.6)] md:p-8">
                <Aurora tone="emerald" />
                <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3.5">
                      <div className="va-pop flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_14px_34px_-8px_rgba(16,185,129,0.85)] ring-1 ring-inset ring-white/30">
                        <Trophy className="h-7 w-7" />
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-3xs font-black uppercase tracking-wider text-emerald-200 ring-1 ring-inset ring-emerald-300/40">
                          <CheckCircle2 className="h-3 w-3" /> Mellow Vault Verified
                        </span>
                        <h4 className="mt-1 text-lg font-black md:text-xl">Congratulations! You Are Qualified for Mellow Vault</h4>
                      </div>
                    </div>
                    <p className="max-w-2xl text-13 leading-relaxed text-white/75">
                      You successfully cleared all three assessment rounds with a composite score meeting the 60% engineering benchmark. Your talent profile is officially eligible for discovery by top hiring partners on Mellow Vault.
                    </p>
                    <Link
                      href="/dashboard/vault"
                      className="va-sheen relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-emerald-300 to-teal-200 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-[0_8px_24px_rgba(16,185,129,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(16,185,129,0.6)]"
                    >
                      <span>View Your Vault Profile</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <ScoreRing value={qualification.active_series.series_average} size={130} stroke={11} tone="emerald" label="Qualifying series average" className="self-center">
                    <span className="tabular text-3xl font-extrabold leading-none">{qualification.active_series.series_average === null ? "—" : Math.round(qualification.active_series.series_average)}</span>
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/60">series avg %</span>
                  </ScoreRing>
                </div>
              </div>
            </Rise>
          ) : qualification?.is_cooling_down ? (
            /* OUTCOME B: 45-DAY COOLDOWN */
            <Rise>
              <div className="space-y-5 rounded-3xl border border-rose-500/35 bg-rose-500/[0.06] p-6 shadow-[0_22px_55px_-28px_rgba(244,63,94,0.45)] md:p-8">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30 ring-1 ring-inset ring-white/25">
                    <Clock className="h-7 w-7" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-3xs font-black uppercase tracking-wider text-rose-600 ring-1 ring-inset ring-rose-500/30 dark:text-rose-300">
                      <Lock className="h-3 w-3" /> 45-Day Preparation Cooldown Active
                    </div>
                    <h4 className="text-base font-black text-primary sm:text-lg">Vault Qualification Limit Reached (Attempt 3 of 3)</h4>
                    <p className="text-xs leading-relaxed text-text-secondary sm:text-sm">
                      Across three qualification attempts, your composite average remained below the 60% technical readiness benchmark required by hiring partners. In accordance with platform standards, a{" "}
                      <strong className="font-bold text-primary">45-day preparation cooldown</strong> is now in effect.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-3 rounded-2xl border border-rose-500/25 bg-surface p-4 shadow-subtle sm:flex-row sm:items-center">
                  <div>
                    <div className="text-3xs font-extrabold uppercase tracking-wider text-text-muted">Next Re-qualification Window Opens</div>
                    <div className="mt-0.5 text-sm font-black text-rose-600 dark:text-rose-300 sm:text-base">{qualification.cooldown_formatted_date ?? "In 45 Days"}</div>
                  </div>
                  <div className="tabular shrink-0 rounded-xl border border-rose-500/30 bg-rose-500/15 px-3.5 py-2 text-xs font-bold text-rose-600 dark:text-rose-300">{qualification.cooldown_days_remaining} Days Remaining</div>
                </div>

                <div className="space-y-2.5">
                  <h5 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-text-muted">
                    <Target className="h-3.5 w-3.5 text-accent-primary" />
                    <span>Recommended Preparation on AptRun</span>
                  </h5>
                  <p className="text-xs leading-relaxed text-text-secondary">High-bar technical interviews require muscle memory and consistent problem solving. Build your skills during this cooldown:</p>
                  <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
                    {[
                      { href: "/dashboard/practice", t: "AptRun Problem Bank", d: "Solve targeted algorithmic problems" },
                      { href: "/dashboard/drills", t: "System Drills", d: "Fast-paced technical flashcards" },
                      { href: "/dashboard/interviews", t: "Review AI Critiques", d: "Study weak spots identified by AI" },
                    ].map((l) => (
                      <Link key={l.href} href={l.href} className="group block rounded-xl border border-border-subtle bg-surface p-3.5 text-left shadow-subtle transition-all duration-200 hover:-translate-y-0.5 hover:border-accent-primary hover:shadow-card">
                        <div className="flex items-center justify-between text-xs font-bold text-primary">
                          <span>{l.t}</span>
                          <ArrowRight className="h-3 w-3 text-text-muted transition-transform group-hover:translate-x-0.5" />
                        </div>
                        <div className="mt-0.5 text-2xs text-text-muted">{l.d}</div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <PastAttempts attempts={qualification.past_attempts} />
              </div>
            </Rise>
          ) : (
            /* OUTCOME C: ACTIVE SERIES (SETS 1, 2, 3) */
            <div className="space-y-5">
              {qualification && qualification.current_attempt > 1 && (
                <Rise>
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/[0.08] p-4 text-xs text-amber-800 dark:text-amber-200">
                    <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                    <div>
                      <strong className="font-bold">
                        New Series Unlocked for Attempt {qualification.current_attempt} of {qualification.max_attempts}:
                      </strong>{" "}
                      Your previous attempt did not reach the 60% composite readiness threshold. You have been assigned <strong className="font-bold">Series {qualification.current_attempt}</strong> with a completely fresh set of authentic interview questions. Complete all 3 Sets below!
                    </div>
                  </div>
                </Rise>
              )}

              {(() => {
                const sets: QualificationSetDetail[] =
                  qualification?.active_series.sets ??
                  [
                    { set_number: 1, title: "Set 1: Core Foundations & Runtime Architecture", description: "Language internals, lifecycle, memory model, and typing.", duration_minutes: 15, question_count: 5, preview_questions: [], status: "not_started", score_percent: null, interview_slug: null, set_id: "s1" },
                    { set_number: 2, title: "Set 2: Problem Solving & Scalable Implementation", description: "Data structures, query tuning, asynchronous pipelines, and caching.", duration_minutes: 15, question_count: 5, preview_questions: [], status: "not_started", score_percent: null, interview_slug: null, set_id: "s2" },
                    { set_number: 3, title: "Set 3: Systems Design, Resilience & Edge Cases", description: "Production engineering: fault tolerance, distributed state, and failure recovery.", duration_minutes: 15, question_count: 5, preview_questions: [], status: "not_started", score_percent: null, interview_slug: null, set_id: "s3" },
                  ];
                return (
                  <>
                    <Rise>
                      <SeriesRail sets={sets} average={qualification?.active_series.series_average ?? null} />
                    </Rise>
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                      {sets.map((set, i) => (
                        <SetCard
                          key={set.set_number}
                          set={set}
                          total={sets.length}
                          index={i}
                          isStarting={startingSetNumber === set.set_number}
                          expanded={!!expandedSets[set.set_id]}
                          onToggle={() => togglePreview(set.set_id)}
                          onStart={() => handleStartSet(set.set_number)}
                        />
                      ))}
                    </div>
                  </>
                );
              })()}

              {qualification && <PastAttempts attempts={qualification.past_attempts} />}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
