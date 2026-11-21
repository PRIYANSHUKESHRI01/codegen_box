"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MODULES_CHANGED_EVENT } from "@/lib/planSync";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Hourglass, Loader2, Mic, PlayCircle, RotateCcw, Search, X, AlertCircle, Trophy, Sparkles, Target, BarChart3 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CARD, Rise, isLive, roleIconOf, shortName, stackIconOf, themeOf } from "./curatedKit";
import type { MockCatalogResponse, MockParentSet, MockRole, MockRound, MockStack, MockStartResponse } from "@/types/mockInterview";

/** Where the student is in the steps, and a way back to any step already passed. */
function StepNav({
  step,
  role,
  stack,
  activeSet,
  single = false,
  onRoles,
  onStacks,
  onParentSets,
}: {
  step: 1 | 2 | 3 | 4;
  role: MockRole | null;
  stack: MockStack | null;
  activeSet: MockParentSet | null;
  single?: boolean;
  onRoles: () => void;
  onStacks: () => void;
  onParentSets?: () => void;
}) {
  const steps = [
    { n: 1, label: single ? "Start" : "All domains", sub: single ? "Open the card" : "Choose a domain", go: onRoles },
    { n: 2, label: role ? role.title : "Tech stack", sub: `Choose a ${role?.terms?.stack ?? (single ? "exam" : "tech stack")}`, go: onStacks },
    { n: 3, label: stack ? stack.name : "Interview series", sub: "Choose an interview series", go: onParentSets },
    ...(activeSet
      ? [
          {
            n: 4 as const,
            label: `Series ${activeSet.set_number}: ${activeSet.level}`,
            sub: "Practise interview rounds",
            go: undefined,
          },
        ]
      : []),
  ] as const;

  return (
    <nav aria-label="Mock interview steps" className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs sm:gap-2">
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
                "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                current
                  ? "border-accent-primary/40 bg-accent-primary/10 text-primary shadow-subtle"
                  : done
                    ? "border-emerald-500/30 bg-emerald-500/[0.06] text-text-secondary hover:border-emerald-500/50 hover:text-primary"
                    : "border-border-subtle bg-surface text-text-muted"
              )}
            >
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold", current ? "bg-accent-primary text-white" : done ? "bg-emerald-500 text-white" : "bg-elevated text-text-muted")}>
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
function StatusChip({ stack }: { stack: MockStack }) {
  if (isLive(stack)) {
    return <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">Open</span>;
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
      <Hourglass className="h-3 w-3" aria-hidden /> Coming soon
    </span>
  );
}

function RoundCard({ round, unit, compact, starting, disabled, onStart }: { round: MockRound; unit: string; compact: boolean; starting: boolean; disabled: boolean; onStart: () => void }) {
  const { my } = round;
  const action = my.open_status === "in_progress" ? "Resume" : my.open_status === "ready" ? "Start" : my.attempts > 0 ? "Practise again" : "Start practice";
  const ActionIcon = my.open_status === "in_progress" ? PlayCircle : my.attempts > 0 && !my.open_status ? RotateCcw : Mic;

  return (
    <article className={cn("flex h-full flex-col gap-3 rounded-2xl border bg-surface p-5 shadow-subtle", round.ready ? "border-border-subtle" : "border-dashed border-border-strong")} aria-label={round.title}>
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold", round.ready ? "bg-accent-primary/10 text-accent-primary" : "bg-elevated text-text-muted")}>{unit.charAt(0).toUpperCase()}{round.round_number}</span>
        {round.ready ? (
          <span className="inline-flex items-start gap-1 text-left text-3xs font-bold leading-snug text-text-muted">
            <Clock className="mt-px h-3 w-3 shrink-0" aria-hidden />
            {(round.sitting_questions ?? round.question_count) < round.question_count ? (
              <span>
                ~{round.duration_minutes} min · {round.sitting_questions} questions
                <span className="block font-medium">a sitting, from a bank of {round.question_count}</span>
              </span>
            ) : (
              <span>
                ~{round.duration_minutes} min · {round.question_count} questions
              </span>
            )}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-3xs font-extrabold uppercase text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
            <Hourglass className="h-3 w-3" aria-hidden /> Coming soon
          </span>
        )}
      </div>

      <div>
        <h4 className="text-sm font-extrabold text-primary">{round.title}</h4>
        {!compact && <p className="mt-1 text-xs leading-relaxed text-text-secondary">{round.description}</p>}
      </div>

      <div className="mt-auto space-y-3">
        {(my.attempts > 0 || my.scoring) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-secondary">
            <span className="inline-flex items-center gap-1">
              <Trophy className="h-3 w-3 text-amber-500" aria-hidden />
              {my.best_score !== null ? (
                <>
                  Best <strong className="tabular font-bold text-primary">{my.best_score}%</strong>
                </>
              ) : (
                "Scoring your answers…"
              )}
            </span>
            {/* Study sets keep every sitting's score: the newest one and how it moved from the one before. */}
            {my.last_score != null && my.attempts > 1 && (
              <span data-testid="set-last-score">
                Last <strong className="tabular font-bold text-primary">{my.last_score}%</strong>
                {my.previous_score != null && my.last_score !== my.previous_score && (
                  <span className={my.last_score > my.previous_score ? "ml-1 font-bold text-status-success" : "ml-1 font-bold text-status-danger"}>
                    {my.last_score > my.previous_score ? "▲" : "▼"}
                    {Math.abs(my.last_score - my.previous_score)}
                  </span>
                )}
              </span>
            )}
            <span>
              {my.attempts} {my.attempts === 1 ? "sitting" : "sittings"}
            </span>
          </p>
        )}

        <button
          type="button"
          onClick={onStart}
          disabled={!round.ready || disabled}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-control px-4 py-2.5 text-xs font-bold transition-colors disabled:cursor-not-allowed",
            round.ready ? "bg-accent-primary text-white hover:bg-accent-primary-hover disabled:opacity-60" : "border border-border-subtle bg-elevated text-text-muted"
          )}
        >
          {starting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Getting your interview ready…
            </>
          ) : round.ready ? (
            <>
              <ActionIcon className="h-3.5 w-3.5" aria-hidden /> {action}
            </>
          ) : (
            "Questions on the way"
          )}
        </button>
      </div>
    </article>
  );
}

function levelStyle(level: string) {
  const l = level.toLowerCase();
  if (l.includes("foundational")) {
    return {
      chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25",
      badge: "Foundational",
      glow: "hover:border-emerald-500/40 hover:shadow-emerald-500/5",
    };
  }
  if (l.includes("intermediate")) {
    return {
      chip: "bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/25",
      badge: "Intermediate",
      glow: "hover:border-blue-500/40 hover:shadow-blue-500/5",
    };
  }
  if (l.includes("applied") || l.includes("production")) {
    return {
      chip: "bg-purple-500/10 text-purple-700 dark:text-purple-300 ring-purple-500/25",
      badge: "Applied Production",
      glow: "hover:border-purple-500/40 hover:shadow-purple-500/5",
    };
  }
  if (l.includes("event-driven")) {
    return {
      chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/25",
      badge: "Event-Driven",
      glow: "hover:border-indigo-500/40 hover:shadow-indigo-500/5",
    };
  }
  if (l.includes("data engineering")) {
    return {
      chip: "bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-teal-500/25",
      badge: "Data Engineering",
      glow: "hover:border-teal-500/40 hover:shadow-teal-500/5",
    };
  }
  if (l.includes("sre") || l.includes("cloud")) {
    return {
      chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/25",
      badge: "SRE / Cloud Native",
      glow: "hover:border-sky-500/40 hover:shadow-sky-500/5",
    };
  }
  if (l.includes("security")) {
    return {
      chip: "bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/25",
      badge: "Security Arch",
      glow: "hover:border-red-500/40 hover:shadow-red-500/5",
    };
  }
  if (l.includes("advanced")) {
    return {
      chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/25",
      badge: "Advanced",
      glow: "hover:border-amber-500/40 hover:shadow-amber-500/5",
    };
  }
  return {
    chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/25",
    badge: "FAANG / Staff",
    glow: "hover:border-rose-500/40 hover:shadow-rose-500/5",
  };
}

function StackPracticeProgressHUD({
  stack,
  role,
  onSelectSeries,
}: {
  stack: MockStack;
  role: MockRole;
  onSelectSeries: (setNumber: number) => void;
}) {
  const sets = stack.parent_sets ?? [];
  const totalSets = sets.length;
  const completedSets = sets.filter((s) => s.status === "completed").length;
  const inProgressSets = sets.filter((s) => s.status === "in_progress").length;
  const unattemptedSets = Math.max(0, totalSets - completedSets - inProgressSets);
  const percent = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;

  const bestScores = sets.map((s) => s.best_score).filter((b): b is number => b !== null);
  const topScore = bestScores.length > 0 ? Math.max(...bestScores) : null;
  const avgScore = bestScores.length > 0 ? Math.round(bestScores.reduce((a, b) => a + b, 0) / bestScores.length) : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-gradient-to-br from-surface via-surface to-accent-primary/[0.04] p-5 sm:p-6 shadow-subtle space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-primary/10 px-2.5 py-0.5 text-3xs font-extrabold uppercase tracking-wide text-accent-primary ring-1 ring-inset ring-accent-primary/20">
              <Sparkles className="h-3 w-3" /> Practice Mastery Track
            </span>
            <span className="text-3xs font-bold text-text-muted">
              {role.title} · {stack.name}
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-black text-primary tracking-tight">
            Curriculum Practice Progress ({completedSets}/{totalSets} Completed)
          </h3>
          <p className="text-xs text-text-secondary max-w-xl">
            Progress through all {totalSets} comprehensive interview series to build placement-level interview confidence.
          </p>
        </div>

        {/* Counter Metric Card */}
        <div className="flex items-center gap-3.5 bg-surface-elevated/80 backdrop-blur-sm rounded-xl border border-border-subtle p-3 px-4 shadow-xs self-start sm:self-auto">
          <div className="space-y-0.5 text-right">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-2xl font-black text-accent-primary tabular">{completedSets}</span>
              <span className="text-xs font-bold text-text-muted">/ {totalSets}</span>
            </div>
            <p className="text-3xs font-semibold uppercase tracking-wider text-text-muted">
              Completed
            </p>
          </div>

          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-black text-xs ring-1 ring-inset",
              percent === 100
                ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/30"
                : percent > 0
                  ? "bg-accent-primary/15 text-accent-primary ring-accent-primary/30"
                  : "bg-slate-200/60 dark:bg-slate-800 text-text-muted ring-border-subtle"
            )}
          >
            {percent}%
          </div>
        </div>
      </div>

      {/* Visual Multi-Segment Progress Bar */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between text-2xs font-semibold text-text-muted">
          <span className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-accent-primary" /> Series Mastery Bar
          </span>
          <span className="font-bold text-primary">{completedSets} of {totalSets} series completed</span>
        </div>

        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 h-3.5">
          {sets.map((s) => {
            const isCompleted = s.status === "completed";
            const isInProgress = s.status === "in_progress";
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSeries(s.set_number)}
                title={`Series ${s.set_number}: ${s.title} (${isCompleted ? `Completed · Best ${s.best_score}%` : isInProgress ? 'In Progress' : 'Not Attempted'})`}
                className={cn(
                  "relative h-full rounded-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-accent-primary group",
                  isCompleted
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-xs shadow-emerald-500/30 hover:opacity-90"
                    : isInProgress
                      ? "bg-amber-500 animate-pulse ring-2 ring-amber-400/40 hover:opacity-90"
                      : "bg-slate-200/70 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700"
                )}
              >
                <span className="sr-only">Series {s.set_number}</span>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity text-white">
                  {s.set_number}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Badges & Guidance */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-subtle/80 text-2xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> {completedSets} Completed
          </span>
          <span className="text-border-subtle">·</span>
          <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
            <PlayCircle className="h-3.5 w-3.5" /> {inProgressSets} In Progress
          </span>
          <span className="text-border-subtle">·</span>
          <span className="inline-flex items-center gap-1 text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> {unattemptedSets} Remaining
          </span>
          {topScore !== null && (
            <>
              <span className="text-border-subtle">·</span>
              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                <Trophy className="h-3.5 w-3.5 text-amber-500" /> Top Score: {topScore}%
              </span>
            </>
          )}
          {avgScore !== null && (
            <>
              <span className="text-border-subtle">·</span>
              <span className="font-semibold text-text-secondary">
                Avg: {avgScore}%
              </span>
            </>
          )}
        </div>

        <p className="text-3xs font-medium text-text-muted italic">
          {completedSets === 0 && inProgressSets === 0
            ? "Tip: Start with Series 1 to establish your foundations."
            : completedSets === totalSets
              ? "🏆 Full curriculum mastered! You are interview-ready."
              : `${totalSets - completedSets} series remaining to achieve 10/10 mastery.`}
        </p>
      </div>
    </div>
  );
}

function formatSeriesTitle(setNumber: number, title: string): string {
  const clean = title.replace(/^Parent Set \d+:\s*/i, "").replace(/^Set \d+:\s*/i, "").replace(/^Series \d+:\s*/i, "");
  return `Series ${setNumber}: ${clean}`;
}

function SeriesCard({
  set,
  totalSets,
  onOpen,
  i,
}: {
  set: MockParentSet;
  totalSets: number;
  onOpen: () => void;
  i: number;
}) {
  const lvl = levelStyle(set.level);
  const action = set.status === "in_progress" ? "Resume series" : set.status === "completed" ? "Practise again" : "Start series";
  const ActionIcon = set.status === "in_progress" ? PlayCircle : set.status === "completed" ? RotateCcw : ArrowRight;

  return (
    <Rise i={i} className="h-full">
      <article
        className={cn(
          "flex h-full flex-col gap-3 rounded-2xl border bg-surface p-5 shadow-subtle transition-all duration-200 hover:border-accent-primary/40",
          set.ready ? "border-border-subtle" : "border-dashed border-border-strong"
        )}
        aria-label={`Series ${set.set_number}: ${set.title}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-primary/10 text-xs font-extrabold text-accent-primary">
              S{set.set_number}
            </span>
            <span className={cn("rounded-full px-2.5 py-0.5 text-3xs font-extrabold uppercase tracking-wide ring-1 ring-inset", lvl.chip)}>
              {lvl.badge}
            </span>
          </div>

          <span className="inline-flex items-start gap-1 text-right text-3xs font-bold leading-snug text-text-muted">
            <Clock className="mt-px h-3 w-3 shrink-0" aria-hidden />
            <span>
              ~45 min · 3 rounds
              <span className="block font-medium">{set.total_questions} questions</span>
            </span>
          </span>
        </div>

        <div>
          <h4 className="text-sm font-extrabold text-primary">
            {formatSeriesTitle(set.set_number, set.title)}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary line-clamp-3">
            {set.description}
          </p>
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-2xs text-text-secondary">
            {set.status === "completed" ? (
              <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <Trophy className="h-3 w-3 text-amber-500" aria-hidden />
                {set.best_score !== null ? (
                  <>
                    Best <strong className="tabular font-bold text-primary">{set.best_score}%</strong>
                  </>
                ) : (
                  "Completed"
                )}
                <span className="text-text-muted font-normal">
                  · {set.attempts} {set.attempts === 1 ? "sitting" : "sittings"}
                </span>
              </span>
            ) : set.status === "in_progress" ? (
              <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                <PlayCircle className="h-3 w-3" aria-hidden />
                <span>
                  In progress ({set.attempts} {set.attempts === 1 ? "sitting" : "sittings"})
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-text-muted font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
                Not attempted
              </span>
            )}

            <span className="text-3xs font-semibold text-text-muted">
              Series {set.set_number} of {totalSets}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpen}
            className="inline-flex w-full items-center justify-center gap-2 rounded-control px-4 py-2.5 text-xs font-bold transition-colors bg-accent-primary text-white hover:bg-accent-primary-hover shadow-subtle"
          >
            <ActionIcon className="h-3.5 w-3.5" aria-hidden /> {action}
          </button>
        </div>
      </article>
    </Rise>
  );
}

const DEFAULT_BASE = "/dashboard/interviews";

/**
 * The Mock AI Interview's practice area: Step 1 choose a domain, Step 2 choose a tech stack, Step 3 practise one of its three rounds —
 * the same shape as the Vault AI Interview, minus the qualification (no attempts to lose, no pass mark, practise as often as the plan
 * allows). A stack whose questions have not been written yet shows as "Coming soon" with what its rounds will cover.
 */
export function MockInterviewExplorer({
  className,
  basePath = DEFAULT_BASE,
  onlyDomain,
  launchFrom,
}: {
  className?: string;
  /** The page the explorer lives on: its steps are kept in that page's address (?domain=&stack=). */
  basePath?: string;
  /** Show only this domain (the Merchant Navy page): its one card is Step 1, the exams are Step 2, the sets Step 3. No search, no domain filter. */
  onlyDomain?: string;
  /** Where a started interview should lead back to ("merchant-navy"); added to the interview's address as ?from=. */
  launchFrom?: string;
}) {
  const router = useRouter();
  const BASE = basePath;
  const [catalog, setCatalog] = useState<MockCatalogResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Where the student is lives in the address (?domain=…&stack=…&set=…), so the header's back arrow, the browser's Back button, a refresh and a shared link
  // all land on the same step - and the page around the explorer can show only what belongs to the domain that is open.
  const params = useSearchParams();
  const roleKey = params.get("domain");
  const stackKey = params.get("stack");
  const setParam = params.get("set");
  const selectedSetNumber = setParam ? parseInt(setParam, 10) : null;

  const go = (domain: string | null, stackKeyNext: string | null = null, setNext: number | null = null) => {
    const q = new URLSearchParams();
    if (domain) q.set("domain", domain);
    if (domain && stackKeyNext) q.set("stack", stackKeyNext);
    if (domain && stackKeyNext && setNext) q.set("set", String(setNext));
    const qs = q.toString();
    router.push(qs ? `${BASE}?${qs}` : BASE);
  };
  const sectionRef = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  const [query, setQuery] = useState("");
  const [openOnly, setOpenOnly] = useState(false);

  const [startingId, setStartingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ message: string; upgrade: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    setLoadError(null);
    api
      .get<MockCatalogResponse>("/mock-interviews/catalog")
      .then((res) => live && setCatalog(res))
      .catch((err) => live && setLoadError(err instanceof ApiError ? err.message : "Couldn't load the mock interviews."));
    return () => {
      live = false;
    };
  }, [reloadKey]);

  // The superadmin switched a whole domain (Merchant Navy) on or off while this page is open: ask the server again, quietly (the old tree stays up until the new one lands).
  useEffect(() => {
    const onModules = () => setReloadKey((k) => k + 1);
    window.addEventListener(MODULES_CHANGED_EVENT, onModules);
    return () => window.removeEventListener(MODULES_CHANGED_EVENT, onModules);
  }, []);

  const roles = useMemo(() => (catalog?.roles ?? []).filter((r) => !onlyDomain || r.key === onlyDomain), [catalog, onlyDomain]);
  const role = useMemo(() => roles.find((r) => r.key === roleKey) ?? null, [roles, roleKey]);
  const stack = useMemo(() => role?.stacks.find((s) => s.key === stackKey) ?? null, [role, stackKey]);
  const activeParentSet = useMemo(() => {
    if (!stack?.parent_sets || !selectedSetNumber) return null;
    return stack.parent_sets.find((ps) => ps.set_number === selectedSetNumber) ?? null;
  }, [stack, selectedSetNumber]);
  const step: 1 | 2 | 3 | 4 = !role ? 1 : !stack ? 2 : activeParentSet ? 4 : 3;
  // A stack split into many sets (the Merchant Navy orals) gets compact cards and its one shared description shown once above them.
  const setsLayout = !!stack && stack.rounds.length > 6 && new Set(stack.rounds.map((r) => r.description)).size === 1;

  // A link to a domain or stack that does not exist (a stale bookmark) drops back to the nearest step that does.
  useEffect(() => {
    if (!catalog) return;
    if (roleKey && !role) router.replace(BASE);
    else if (stackKey && role && !stack) router.replace(`${BASE}?domain=${encodeURIComponent(role.key)}`);
    else if (setParam && stack && !activeParentSet) router.replace(`${BASE}?domain=${encodeURIComponent(role?.key ?? "")}&stack=${encodeURIComponent(stack.key)}`);
  }, [catalog, roleKey, stackKey, setParam, role, stack, activeParentSet, router, BASE]);

  // Opening or leaving a card brings the explorer back into view - the card that was clicked may have been far down the page.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    sectionRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [roleKey, stackKey, setParam]);

  // Search is across every stack and its Mellow Vault domain names ("Laravel Developer", "ML/DL", ...).
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return null;
    return roles.flatMap((r) =>
      r.stacks
        .filter((s) => [s.name, s.blurb, ...(s.aliases ?? []), ...(s.tags ?? []), r.title].some((text) => text.toLowerCase().includes(q)))
        .map((s) => ({ role: r, stack: s }))
    );
  }, [roles, query]);

  const start = async (round: MockRound) => {
    if (startingId) return;
    setStartingId(round.id);
    setActionError(null);
    try {
      const res = await api.post<MockStartResponse>(`/mock-interviews/rounds/${encodeURIComponent(round.id)}/start`);
      router.push(`/dashboard/interviews/view?slug=${encodeURIComponent(res.interview.slug)}${launchFrom ? `&from=${encodeURIComponent(launchFrom)}` : ""}`);
    } catch (err) {
      setActionError({ message: err instanceof ApiError ? err.message : "Something went wrong starting this interview. Please try again.", upgrade: err instanceof ApiError && err.status === 402 });
      setStartingId(null);
    }
  };

  if (loadError) {
    return (
      <div role="alert" className={cn("flex items-center justify-between gap-3 rounded-2xl border border-status-danger/30 bg-status-danger/10 p-5 text-sm text-status-danger", className)}>
        <span>{loadError}</span>
        <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="text-xs font-bold hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (!catalog) {
    return (
      <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)} aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl border border-border-subtle bg-surface" />
        ))}
      </div>
    );
  }

  const theme = themeOf(role?.color);

  return (
    <section ref={sectionRef} className={cn("space-y-5 scroll-mt-20", className)} aria-label="Practise a mock interview by domain">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepNav
          step={step}
          role={role}
          stack={stack}
          activeSet={activeParentSet}
          single={!!onlyDomain}
          onRoles={() => go(null)}
          onStacks={() => go(roleKey)}
          onParentSets={() => go(roleKey, stackKey)}
        />
        {!onlyDomain && (
        <label className="relative w-full sm:w-72">
          <span className="sr-only">Search domains and tech stacks</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a domain or tech stack…"
            className="w-full rounded-full border border-border-subtle bg-surface py-2 pl-9 pr-8 text-xs text-primary outline-none focus:border-accent-primary"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
        )}
      </div>

      {results === null && step > 1 && role && (
        <button
          type="button"
          onClick={() => {
            if (activeParentSet) {
              go(role.key, stack?.key ?? null);
            } else if (step === 3) {
              go(role.key);
            } else {
              go(null);
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-accent-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />{" "}
          {activeParentSet
            ? `Back to all ${stack?.parent_sets?.length ?? 5} interview series for ${stack?.name}`
            : step === 3
            ? `Back to ${role.title} ${role.terms?.stacks ?? "tech stacks"}`
            : onlyDomain
            ? "Back to the start"
            : "Back to all domains"}
        </button>
      )}

      {actionError && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-2xl border border-status-danger/30 bg-status-danger/10 p-4 text-xs text-status-danger">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p className="font-semibold">
              {actionError.message}
              {actionError.upgrade && (
                <Link href="/dashboard/billing" className="ml-2 underline">
                  See plans
                </Link>
              )}
            </p>
          </div>
          <button type="button" onClick={() => setActionError(null)} className="shrink-0 text-2xs text-text-muted hover:text-primary">
            Dismiss
          </button>
        </div>
      )}

      {results !== null ? (
        <div className="space-y-4">
          <p className="text-xs text-text-muted">
            Found <strong className="font-bold text-primary">{results.length}</strong> {results.length === 1 ? "tech stack" : "tech stacks"} matching &ldquo;{query}&rdquo;
          </p>
          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-10 text-center text-xs text-text-muted">
              Nothing matched &ldquo;{query}&rdquo;. Try a domain like &ldquo;Data Analytics&rdquo;, &ldquo;Cyber Security&rdquo; or a stack like &ldquo;Laravel&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {results.map(({ role: r, stack: s }, i) => (
                <StackCard
                  key={s.key}
                  i={i}
                  role={r}
                  stack={s}
                  onOpen={() => {
                    setQuery("");
                    go(r.key, s.key);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      ) : step === 1 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-primary">{onlyDomain ? "Practise for your oral exam" : "Step 1: Choose your domain"}</h3>
              <p className="text-xs text-text-secondary">
                {onlyDomain ? "Open the card to choose your exam, then work through a set of questions." : "Pick the field you are preparing for to see what you can practise."}
              </p>
            </div>
            {!onlyDomain && (
            <div role="group" aria-label="Filter domains" className="inline-flex rounded-full border border-border-subtle bg-surface p-0.5 text-2xs font-bold shadow-subtle">
              {[
                { v: false, label: "All domains" },
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
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles
              .filter((r) => !openOnly || r.live_stacks_count > 0)
              .map((r, i) => {
                const RoleIcon = roleIconOf(r);
                const t = themeOf(r.color);
                return (
                  <Rise key={r.key} i={i} className="h-full">
                    <button type="button" onClick={() => go(r.key)} className={cn(CARD, t.glow, t.ring)}>
                      <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-30", t.tile)} />
                      <div className="relative flex items-start justify-between gap-2">
                        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3", t.tile)}>
                          <RoleIcon className="h-6 w-6" />
                        </div>
                        {r.badge && <span className={cn("rounded-full px-2.5 py-1 text-3xs font-extrabold uppercase tracking-wide ring-1 ring-inset", t.chip)}>{r.badge}</span>}
                      </div>
                      <div className="relative">
                        <h4 className={cn("text-15 font-extrabold text-primary transition-colors", t.text)}>{r.title}</h4>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{r.blurb}</p>
                      </div>
                      <div className="relative mt-auto flex flex-wrap gap-1.5 pt-1">
                        {r.stacks.slice(0, 4).map((s) => (
                          <span key={s.key} className={cn("rounded-full border border-border-subtle bg-elevated/60 px-2.5 py-0.5 text-3xs font-medium", isLive(s) ? "text-text-secondary" : "text-text-muted")}>
                            {shortName(s.name)}
                          </span>
                        ))}
                        {r.stacks.length > 4 && <span className="rounded-full border border-border-subtle bg-elevated/60 px-2.5 py-0.5 text-3xs font-medium text-text-muted">+{r.stacks.length - 4} more</span>}
                      </div>
                      <div className="relative flex items-center justify-between border-t border-border-subtle pt-3 text-2xs text-text-muted">
                        <span className={cn("font-bold", r.live_stacks_count > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-text-muted")}>
                          {r.live_stacks_count > 0 ? `${r.live_stacks_count} of ${r.stacks_count} open` : "Coming soon"}
                        </span>
                        <span className="inline-flex items-center gap-1 font-bold text-accent-primary transition-transform group-hover:translate-x-0.5">
                          Choose <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </button>
                  </Rise>
                );
              })}
          </div>

          {openOnly && roles.every((r) => r.live_stacks_count === 0) && (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-10 text-center text-xs text-text-muted">
              No domain is open for mock interviews yet — the question banks are being written. Switch to &ldquo;All domains&rdquo; to see what is coming.
            </div>
          )}
        </div>
      ) : step === 2 && role ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-primary">Step 2: Choose your {role.terms?.stack ?? "tech stack"} in {role.title}</h3>
            <p className="text-xs text-text-secondary">{role.terms?.rounds ? `Each ${role.terms.stack} is split into practice ${role.terms.rounds}.` : "Each tech stack features 5 curated parent interview sets with progressive career tiers."} Those marked Coming soon are still being prepared.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {role.stacks.map((s, i) => (
              <StackCard key={s.key} i={i} role={role} stack={s} onOpen={() => go(role.key, s.key)} />
            ))}
          </div>
        </div>
      ) : role && stack ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {(() => {
                const StackIcon = stackIconOf(stack);
                return (
                  <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25", isLive(stack) ? theme.tile : "from-slate-400 to-slate-500")}>
                    <StackIcon className="h-6 w-6" />
                  </span>
                );
              })()}
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-primary">{stack.name}</h3>
                <p className="text-3xs font-semibold uppercase tracking-wider text-text-muted">{role.title}</p>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-text-secondary">{stack.blurb}</p>
              </div>
            </div>
            <StatusChip stack={stack} />
          </div>

          {!isLive(stack) && (
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-4 text-xs leading-relaxed text-text-secondary">
              <strong className="font-bold text-primary">Mock interviews for {stack.name} are coming soon.</strong> The questions are being written. Here is what the {role.terms?.rounds ?? "three rounds"} will cover, so you can start preparing.
            </div>
          )}

          {/* When stack has interview series (5 Series) */}
          {stack.parent_sets && stack.parent_sets.length > 0 ? (
            activeParentSet ? (
              /* Specific series is open: render switcher + active series banner + its 3 rounds */
              <div className="space-y-5">
                {/* Quick series switcher pills bar */}
                <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border-subtle bg-surface p-2.5 shadow-subtle">
                  <span className="px-2 text-3xs font-extrabold uppercase tracking-wider text-text-muted">Interview Series:</span>
                  {stack.parent_sets.map((ps) => {
                    const active = ps.set_number === activeParentSet.set_number;
                    const pLvl = levelStyle(ps.level);
                    return (
                      <button
                        key={ps.id}
                        type="button"
                        onClick={() => go(role.key, stack.key, ps.set_number)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                          active
                            ? "bg-accent-primary text-white shadow-sm ring-1 ring-inset ring-white/20"
                            : "text-text-secondary hover:bg-elevated hover:text-primary"
                        )}
                      >
                        <span>Series {ps.set_number}</span>
                        <span className={cn("text-3xs font-medium opacity-85", active ? "text-white/90" : "text-text-muted")}>
                          ({pLvl.badge})
                        </span>
                        {ps.status === "completed" && <CheckCircle2 className={cn("h-3 w-3", active ? "text-white" : "text-emerald-500")} />}
                        {ps.status === "in_progress" && <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", active ? "bg-white" : "bg-amber-500")} />}
                      </button>
                    );
                  })}
                </div>

                {/* Active series header banner */}
                <div className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-subtle space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-primary/10 text-sm font-black text-accent-primary ring-1 ring-inset ring-accent-primary/25">
                        S{activeParentSet.set_number}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-3xs font-bold uppercase tracking-wider text-text-muted">
                            Series {activeParentSet.set_number} of {stack.parent_sets.length}
                          </span>
                          <span className={cn("rounded-full px-2 py-0.5 text-3xs font-extrabold ring-1 ring-inset", levelStyle(activeParentSet.level).chip)}>
                            {activeParentSet.level}
                          </span>
                        </div>
                        <h4 className="mt-0.5 text-base font-extrabold text-primary">{formatSeriesTitle(activeParentSet.set_number, activeParentSet.title)}</h4>
                      </div>
                    </div>

                    {/* Attempt Status Badge */}
                    {activeParentSet.status === "completed" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-300">
                        <Trophy className="h-3.5 w-3.5 text-amber-500" aria-hidden /> Completed · Best {activeParentSet.best_score}% ({activeParentSet.attempts} {activeParentSet.attempts === 1 ? "sitting" : "sittings"})
                      </span>
                    ) : activeParentSet.status === "in_progress" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-500/30 dark:text-amber-300">
                        <PlayCircle className="h-3.5 w-3.5" aria-hidden /> In progress ({activeParentSet.attempts} {activeParentSet.attempts === 1 ? "sitting" : "sittings"})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-3 py-1 text-xs font-semibold text-text-muted ring-1 ring-inset ring-border-subtle">
                        Not attempted yet · Start with Round 1 below
                      </span>
                    )}
                  </div>
                  <p className="max-w-3xl text-xs leading-relaxed text-text-secondary">{activeParentSet.description}</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-primary">Practice Rounds in Series {activeParentSet.set_number} ({activeParentSet.rounds.length} rounds)</h3>
                  <p className="text-xs text-text-secondary">Complete the 3 rounds in sequence or practise any round directly. Voice interview powered by AI.</p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {activeParentSet.rounds.map((round, i) => (
                    <Rise key={round.id} i={i} className="h-full">
                      <RoundCard round={round} unit={role.terms?.round ?? "round"} compact={false} starting={startingId === round.id} disabled={startingId !== null} onStart={() => void start(round)} />
                    </Rise>
                  ))}
                </div>
              </div>
            ) : (
              /* No series chosen: render the Practice Progress HUD and the 10 Series Cards! */
              <div className="space-y-6">
                <StackPracticeProgressHUD
                  stack={stack}
                  role={role}
                  onSelectSeries={(setNum) => go(role.key, stack.key, setNum)}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-primary">All {stack.parent_sets.length} Interview Series</h3>
                      <p className="text-xs text-text-secondary">
                        Select a series to practise. Each series features 3 specialized rounds with voice AI evaluation.
                      </p>
                    </div>
                    <span className="text-2xs font-semibold text-text-muted">
                      {stack.parent_sets.filter((s) => s.status === "completed").length} of {stack.parent_sets.length} Completed
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {stack.parent_sets.map((pset, i) => (
                      <SeriesCard
                        key={pset.id}
                        set={pset}
                        totalSets={stack.parent_sets!.length}
                        i={i}
                        onOpen={() => go(role.key, stack.key, pset.set_number)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Fallback for stacks without parent sets */
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-primary">Step 3: Practise a mock interview</h3>
              {setsLayout && <p className="max-w-3xl text-xs leading-relaxed text-text-secondary">{stack.rounds[0]?.description}</p>}
              <div className={cn("grid gap-4", setsLayout ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 md:grid-cols-3")}>
                {stack.rounds.map((round, i) => (
                  <Rise key={round.id} i={i} className="h-full">
                    <RoundCard round={round} unit={role.terms?.round ?? "round"} compact={setsLayout} starting={startingId === round.id} disabled={startingId !== null} onStart={() => void start(round)} />
                  </Rise>
                ))}
              </div>
            </div>
          )}
          <p className="text-2xs text-text-muted">
            {stack.counts_toward_readiness === false
              ? "This is exam preparation: your sittings here are for practice and do not change your placement readiness score."
              : "Your scores here count towards the AI interviews part of your readiness score. To get listed on Mellow Vault straight away, sit the Vault AI Interview."}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function StackCard({ role, stack, i, onOpen }: { role: MockRole; stack: MockStack; i: number; onOpen: () => void }) {
  const StackIcon = stackIconOf(stack);
  const t = themeOf(role.color);
  const open = isLive(stack);

  return (
    <Rise i={i} className="h-full">
      <button type="button" onClick={onOpen} className={cn(CARD, "gap-3.5", open ? [t.glow, t.ring] : "hover:border-border-strong")}>
        <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-30", t.tile)} />
        <div className="relative flex items-start justify-between gap-2">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover:scale-110", open ? t.tile : "from-slate-400 to-slate-500")}>
            <StackIcon className="h-5 w-5" />
          </div>
          <StatusChip stack={stack} />
        </div>
        <div className="relative">
          <h4 className={cn("text-15 font-extrabold text-primary transition-colors", t.text)}>{stack.name}</h4>
          <p className="mt-0.5 text-3xs font-semibold uppercase tracking-wider text-text-muted">{role.title}</p>
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-text-secondary">{stack.blurb}</p>
        </div>
        <div className="relative mt-auto flex items-center justify-between border-t border-border-subtle pt-3 text-2xs text-text-muted">
          <span className={cn("text-3xs font-bold", open ? "text-emerald-600 dark:text-emerald-400" : "text-text-muted")}>
            {open
              ? stack.parent_sets && stack.parent_sets.length > 0
                ? `${stack.parent_sets.length} interview series · ${stack.ready_rounds} rounds ready`
                : `${stack.ready_rounds} of ${stack.total_rounds} ${role.terms?.rounds ?? "rounds"} ready`
              : `${stack.total_rounds} ${role.terms?.rounds ?? "rounds"} · questions on the way`}
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-accent-primary transition-transform group-hover:translate-x-0.5">
            {open ? "Practise" : `See ${role.terms?.rounds ?? "rounds"}`} <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </button>
    </Rise>
  );
}
