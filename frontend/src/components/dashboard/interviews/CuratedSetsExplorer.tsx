"use client";

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Server,
  Layout,
  Layers,
  Brain,
  Cloud,
  Code2,
  Terminal,
  Cpu,
  Sparkles,
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
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Aurora, ScoreRing, VAULT_EASE, VaSkeleton } from "@/components/dashboard/vaultAi/vaultKit";
import type {
  CuratedCatalogResponse,
  CuratedInterviewSetSummary,
  CuratedRole,
  CuratedStack,
  QualificationSetDetail,
  VaultQualificationStatusResponse,
} from "@/types/curatedInterviewSets";

const ROLE_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  backend: Server,
  frontend: Layout,
  fullstack: Layers,
  ai_ml: Brain,
  devops: Cloud,
};

const STACK_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  laravel: Code2,
  nodejs: Terminal,
  python: Cpu,
  java: Server,
  golang: Cpu,
  react_nextjs: Layout,
  typescript: Code2,
  mern: Layers,
  nextjs_fullstack: Sparkles,
  llm_rag: Brain,
  deeplearning_pytorch: Brain,
  docker_k8s: Cloud,
};

/** A role's colour, as the whole class strings Tailwind needs to see (it cannot build `from-${color}-500` at runtime). */
const ROLE_THEMES: Record<string, { tile: string; glow: string; text: string; ring: string; chip: string }> = {
  indigo: {
    tile: "from-indigo-500 to-violet-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(99,102,241,0.6)]",
    text: "group-hover:text-indigo-600 dark:group-hover:text-indigo-300",
    ring: "group-hover:border-indigo-500/40",
    chip: "bg-indigo-500/10 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
  },
  emerald: {
    tile: "from-emerald-500 to-teal-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(16,185,129,0.6)]",
    text: "group-hover:text-emerald-600 dark:group-hover:text-emerald-300",
    ring: "group-hover:border-emerald-500/40",
    chip: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  },
  cyan: {
    tile: "from-cyan-500 to-sky-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(6,182,212,0.6)]",
    text: "group-hover:text-cyan-600 dark:group-hover:text-cyan-300",
    ring: "group-hover:border-cyan-500/40",
    chip: "bg-cyan-500/10 text-cyan-700 ring-cyan-500/25 dark:text-cyan-300",
  },
  violet: {
    tile: "from-violet-500 to-fuchsia-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(139,92,246,0.6)]",
    text: "group-hover:text-violet-600 dark:group-hover:text-violet-300",
    ring: "group-hover:border-violet-500/40",
    chip: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
  },
  amber: {
    tile: "from-amber-500 to-orange-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(245,158,11,0.6)]",
    text: "group-hover:text-amber-600 dark:group-hover:text-amber-300",
    ring: "group-hover:border-amber-500/40",
    chip: "bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  },
  rose: {
    tile: "from-rose-500 to-pink-600",
    glow: "group-hover:shadow-[0_22px_50px_-22px_rgba(244,63,94,0.6)]",
    text: "group-hover:text-rose-600 dark:group-hover:text-rose-300",
    ring: "group-hover:border-rose-500/40",
    chip: "bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300",
  },
};
const themeOf = (color: string | undefined) => ROLE_THEMES[color ?? "indigo"] ?? ROLE_THEMES.indigo;

/** The benchmark a series average has to reach (mirrors VaultInterviewQualification::PASSING_THRESHOLD). */
const BENCHMARK = 60;

/** A card that rises into place, staggered by its position; plain (no motion) for people who ask for reduced motion. */
function Rise({ i = 0, children, className }: { i?: number; children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: VAULT_EASE, delay: reduce ? 0 : Math.min(i, 8) * 0.06 }}
    >
      {children}
    </motion.div>
  );
}

const CARD =
  "group relative flex h-full w-full flex-col gap-4 overflow-hidden rounded-2xl border border-border-subtle bg-surface p-5 text-left shadow-subtle transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

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
  const [qualification, setQualification] = useState<VaultQualificationStatusResponse | null>(null);
  const [loadingQualification, setLoadingQualification] = useState(false);

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

  // 2. Fetch qualification status when stack is selected
  useEffect(() => {
    if (!selectedStackKey) {
      setQualification(null);
      return;
    }

    let alive = true;
    setLoadingQualification(true);

    api
      .get<VaultQualificationStatusResponse>(`/vault-qualification/status?stack=${encodeURIComponent(selectedStackKey)}`)
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
  }, [selectedStackKey]);

  const roles = catalog?.roles ?? [];
  const currentRole = useMemo(() => roles.find((r) => r.key === selectedRoleKey) ?? null, [roles, selectedRoleKey]);
  const currentStack = useMemo(() => currentRole?.stacks.find((s) => s.key === selectedStackKey) ?? null, [currentRole, selectedStackKey]);

  // Search matches across entire catalog when search is active
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || !catalog) return null;

    const matches: Array<{ role: CuratedRole; stack: CuratedStack; set: CuratedInterviewSetSummary }> = [];

    for (const r of catalog.roles) {
      for (const s of r.stacks) {
        for (const st of s.sets) {
          const matchRole = r.title.toLowerCase().includes(q);
          const matchStack = s.name.toLowerCase().includes(q);
          const matchSet = st.title.toLowerCase().includes(q) || st.description.toLowerCase().includes(q) || st.tags.some((t) => t.toLowerCase().includes(q));

          if (matchRole || matchStack || matchSet) {
            matches.push({ role: r, stack: s, set: st });
          }
        }
      }
    }

    return matches;
  }, [catalog, searchQuery]);

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
          <span>{catalog.stats.total_stacks} stacks</span>
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
            placeholder="Search stack, role, or tag..."
            aria-label="Search stacks, roles and tags"
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
              Found <strong className="font-bold text-primary">{searchResults.length}</strong> sets matching &ldquo;{searchQuery}&rdquo;
            </span>
            <button onClick={() => setSearchQuery("")} className="font-medium text-accent-primary hover:underline">
              Clear search
            </button>
          </div>

          {searchResults.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-10 text-center text-xs text-text-muted">
              No interview sets matched &ldquo;{searchQuery}&rdquo;. Try searching for &ldquo;Laravel&rdquo;, &ldquo;React&rdquo;, &ldquo;Docker&rdquo;, or &ldquo;Python&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {searchResults.map(({ role, stack, set }, i) => (
                <Rise key={set.id} i={i}>
                  <div className={cn(CARD, "gap-3")}>
                    <div className="flex items-center justify-between">
                      <span className="rounded-md border border-border-subtle bg-elevated px-2 py-0.5 font-mono text-3xs uppercase text-text-muted">Set {set.set_number ?? 1}</span>
                      <span className="text-3xs text-text-muted">
                        ~{set.duration_minutes} min • {set.question_count} Qs
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-primary">{set.title}</h4>
                    <p className="line-clamp-2 text-xs text-text-secondary">{set.description}</p>
                    <div className="mt-auto flex items-center justify-between border-t border-border-subtle pt-3">
                      <span className="text-3xs text-text-muted">{stack.name}</span>
                      <button
                        onClick={() => {
                          setSelectedRoleKey(role.key);
                          setSelectedStackKey(stack.key);
                          setSearchQuery("");
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-accent-primary hover:underline"
                      >
                        Enter Series <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </Rise>
              ))}
            </div>
          )}
        </div>
      ) : !selectedRoleKey ? (
        /* STEP 1 — CHOOSE ENGINEERING ROLE */
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-primary">Step 1: Choose Engineering Role</h3>
            <p className="text-xs text-text-secondary">Select your target engineering domain to view technical tracks.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role, i) => {
              const RoleIcon = ROLE_ICONS[role.key] ?? Server;
              const theme = themeOf(role.color);
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
                      {role.stacks.map((stack) => (
                        <span key={stack.key} className="rounded-full border border-border-subtle bg-elevated/60 px-2.5 py-0.5 text-3xs font-medium text-text-secondary">
                          {stack.name.split(" ")[0]}
                        </span>
                      ))}
                    </div>

                    <div className="relative flex items-center justify-between border-t border-border-subtle pt-3 text-2xs text-text-muted">
                      <span>{role.stacks_count} Stacks • 3 Sets per Series</span>
                      <span className="inline-flex items-center gap-1 font-bold text-accent-primary transition-transform group-hover:translate-x-0.5">
                        Explore Stacks <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </button>
                </Rise>
              );
            })}
          </div>
        </div>
      ) : !selectedStackKey && currentRole ? (
        /* STEP 2 — TECH STACK PICKER */
        <div className="space-y-4">
          <div>
            <button onClick={resetToRoles} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-accent-primary hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to all roles
            </button>
            <h3 className="text-sm font-bold text-primary">Step 2: Choose Your Stack in {currentRole.title}</h3>
            <p className="text-xs text-text-secondary">Select the programming framework to begin your Mellow Vault qualification assessment.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {currentRole.stacks.map((stack, i) => {
              const StackIcon = STACK_ICONS[stack.key] ?? Code2;
              const theme = themeOf(currentRole.color);
              return (
                <Rise key={stack.key} i={i} className="h-full">
                  <button type="button" onClick={() => setSelectedStackKey(stack.key)} className={cn(CARD, "gap-3.5", theme.glow, theme.ring)}>
                    <div aria-hidden className={cn("pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br opacity-[0.12] blur-2xl transition-opacity duration-300 group-hover:opacity-30", theme.tile)} />
                    <div className="relative flex items-start justify-between gap-2">
                      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ring-1 ring-inset ring-white/25 transition-transform duration-300 group-hover:scale-110", theme.tile)}>
                        <StackIcon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full border border-border-subtle bg-elevated/70 px-2.5 py-1 text-3xs font-bold uppercase tracking-wider text-text-secondary">3 Rounds</span>
                    </div>

                    <div className="relative">
                      <h4 className={cn("text-15 font-extrabold text-primary transition-colors", theme.text)}>{stack.name}</h4>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">{stack.blurb}</p>
                    </div>

                    <div className="relative mt-auto flex items-center justify-between border-t border-border-subtle pt-3 text-2xs text-text-muted">
                      <span className="inline-flex items-center gap-1 text-3xs font-bold text-emerald-600 dark:text-emerald-400">Set 1 • Set 2 • Set 3</span>
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-600 transition-transform group-hover:translate-x-0.5 dark:text-emerald-400">
                        Launch Circuit <ArrowRight className="h-3 w-3" />
                      </span>
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
                  const Icon = STACK_ICONS[currentStack.key] ?? Code2;
                  return (
                    <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ring-1 ring-inset ring-white/25", themeOf(currentRole.color).tile)}>
                      <Icon className="h-6 w-6" />
                    </span>
                  );
                })()}
                <div>
                  <h3 className="text-lg font-black text-primary sm:text-xl">
                    <span>{currentStack.name} Qualification Track</span>
                  </h3>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    Complete all 3 Sets below. Your overall series average must reach <strong className="font-bold text-primary">60% or higher</strong> to unlock Mellow Vault listing.
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

          {loadingQualification ? (
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
