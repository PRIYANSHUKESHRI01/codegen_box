"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Swords,
  Plus,
  Trash2,
  CheckCircle2,
  Trophy,
  CalendarClock,
  Timer,
  Users,
  Radio,
  ListChecks,
  Rocket,
  Flag,
  PenLine,
  Ban,
  SearchX,
  Code2,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ContestParticipantsModal } from "@/components/dashboard/ContestParticipantsModal";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";
import type { ProblemSummary } from "@/types/problem";
import { Modal } from "@/components/ui/Modal";
import {
  HpButton,
  HpCard,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpPill,
  HpProgress,
  HpSearch,
  HpSkeletonCards,
  HpStagger,
  HpStatCard,
  HpTabs,
  HpToast,
  hpInput,
  hpLabel,
  type HpTone,
} from "@/components/portal/kit";
import {
  ScDateTile,
  ScIconButton,
  ScInlineEmpty,
  ScMeta,
  ScNotice,
  ScReveal,
  ScSkeletonList,
  formatRelative,
  formatSpan,
} from "@/components/portal/screeningKit";

interface TpoContest {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  start_at: string;
  end_at: string;
  status: "draft" | "published" | "cancelled";
  finalized_at: string | null;
  participants_count: number;
}

interface TpoContestProblem {
  id: number;
  points: number;
  display_order: number;
  problem: { id: number; slug: string; title: string; difficulty: string };
}

/* ── Presentation-only derivations (no data is invented here) ───────────── */

/** Where a mock contest sits on its timeline, derived purely from status + start/end/finalized_at. */
type Phase = "draft" | "cancelled" | "scheduled" | "live" | "ended" | "finalized";

function phaseOf(contest: TpoContest, now: Date): Phase {
  if (contest.status === "draft") return "draft";
  if (contest.status === "cancelled") return "cancelled";
  if (contest.finalized_at) return "finalized";
  if (now < new Date(contest.start_at)) return "scheduled";
  if (new Date(contest.end_at) < now) return "ended";
  return "live";
}

/** Live uses sky — the TPO portal's identity colour — so "happening now" reads as this portal's pulse. */
const PHASE_META: Record<Phase, { label: string; tone: HpTone; dot?: boolean; pulse?: boolean; icon?: LucideIcon }> = {
  draft: { label: "Draft", tone: "slate", icon: PenLine },
  cancelled: { label: "Cancelled", tone: "rose", icon: Ban },
  scheduled: { label: "Scheduled", tone: "indigo", dot: true },
  live: { label: "Live now", tone: "sky", dot: true, pulse: true },
  ended: { label: "Ended", tone: "amber", dot: true },
  finalized: { label: "Finalized", tone: "emerald", icon: CheckCircle2 },
};

type FilterId = "all" | "live" | "upcoming" | "draft" | "completed";

const FILTER_PHASES: Record<FilterId, Phase[] | null> = {
  all: null,
  live: ["live"],
  upcoming: ["scheduled"],
  draft: ["draft"],
  completed: ["ended", "finalized"],
};

/** Coding-difficulty tones: teal reads as "approachable" without spending emerald (reserved for outcomes). */
const DIFFICULTY_TONE: Record<string, HpTone> = { easy: "teal", medium: "amber", hard: "rose" };

const DATE_TIME: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };
const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };

/**
 * A college TPO's own private "mock" contests — practice rounds visible only
 * to their own students, entirely separate from Mellow's platform-run
 * contests (General/Company/Daily, managed at /admin/contests). Never rated
 * — see TpoContestController's docblock on the backend for why.
 */
export default function MockContestsPage() {
  const { status } = useAuthGuard(["admin_tpo"]);
  const [contests, setContests] = useState<TpoContest[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managingContest, setManagingContest] = useState<TpoContest | null>(null);
  const [viewingParticipantsOf, setViewingParticipantsOf] = useState<TpoContest | null>(null);
  // View-only list controls (client-side filtering of the already-loaded list).
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadContests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ contests: TpoContest[] }>("/tpo/contests");
      setContests(res.contests);
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to load mock contests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ready") loadContests();
  }, [status, loadContests]);

  if (status !== "ready") {
    return (
      <SessionLoader />
    );
  }

  const handleFinalize = async (contest: TpoContest) => {
    try {
      const res = await api.post<{ finalized?: boolean; already_finalized?: boolean; participants_ranked?: number }>(
        `/tpo/contests/${contest.slug}/finalize`
      );
      triggerToast(res.already_finalized ? "Already finalized." : `Finalized — ${res.participants_ranked} participant(s) ranked.`);
      loadContests();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to finalize.");
    }
  };

  const handlePublish = async (contest: TpoContest) => {
    try {
      await api.post(`/tpo/contests/${contest.slug}`, { status: "published" });
      triggerToast(`"${contest.title}" is now published.`);
      loadContests();
    } catch (err) {
      triggerToast(err instanceof ApiError ? err.message : "Failed to publish.");
    }
  };

  const now = new Date();
  const withPhase = contests.map((contest) => ({ contest, phase: phaseOf(contest, now) }));
  const countOf = (phases: Phase[] | null) => (phases ? withPhase.filter((c) => phases.includes(c.phase)).length : withPhase.length);
  const liveCount = countOf(["live"]);
  const upcomingCount = countOf(["scheduled"]);
  const draftCount = countOf(["draft"]);
  const needsFinalizeCount = countOf(["ended"]);
  const registeredTotal = contests.reduce((sum, c) => sum + c.participants_count, 0);

  const q = query.trim().toLowerCase();
  const visible = withPhase.filter(({ contest, phase }) => {
    const phases = FILTER_PHASES[filter];
    if (phases && !phases.includes(phase)) return false;
    if (!q) return true;
    return contest.title.toLowerCase().includes(q) || (contest.description ?? "").toLowerCase().includes(q);
  });

  const hasAny = contests.length > 0;

  return (
    <DashboardShell
      role="admin_tpo"
      currentTpoView="tpo"
      title="Mock Contests"
      subtitle="Private practice rounds for your own students only — never rated, never visible to any other college."
      actionButton={{ label: "New Mock Contest", icon: Plus, onClick: () => setShowCreate(true) }}
    >
      <HpToast message={toastMessage} />

      <HpStagger className="space-y-6">
        {(loading || hasAny) && (
          <HpItem>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <HpStatCard
                label="Mock contests"
                value={contests.length}
                icon={Swords}
                tone="indigo"
                loading={loading}
                hint={draftCount > 0 ? `${draftCount} in draft` : "All published"}
              />
              <HpStatCard label="Live now" value={liveCount} icon={Radio} tone="sky" loading={loading} hint={`${upcomingCount} upcoming`} />
              <HpStatCard label="Registered" value={registeredTotal} icon={Users} tone="violet" loading={loading} hint="Across all rounds" />
              <HpStatCard
                label="To finalize"
                value={needsFinalizeCount}
                icon={Flag}
                tone={needsFinalizeCount > 0 ? "amber" : "slate"}
                loading={loading}
                hint={needsFinalizeCount > 0 ? "Ended, not yet ranked" : "All caught up"}
              />
            </div>
          </HpItem>
        )}

        {hasAny && (
          <HpItem>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <HpTabs<FilterId>
                value={filter}
                onChange={setFilter}
                tabs={[
                  { id: "all", label: "All", count: contests.length },
                  { id: "live", label: "Live", count: liveCount },
                  { id: "upcoming", label: "Upcoming", count: upcomingCount },
                  { id: "draft", label: "Drafts", count: draftCount },
                  { id: "completed", label: "Completed", count: countOf(FILTER_PHASES.completed) },
                ]}
              />
              <HpSearch
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search mock contests"
                aria-label="Search mock contests"
                wrapperClassName="w-full sm:w-72"
              />
            </div>
          </HpItem>
        )}

        <HpItem>
          {loading ? (
            <HpSkeletonCards count={4} className="md:grid-cols-1 xl:grid-cols-2" />
          ) : !hasAny ? (
            <HpEmptyState
              icon={Swords}
              tone="sky"
              title="No mock contests yet"
              description="Create a private practice round, add problems from the catalog, then publish — only your own students will ever see it, and it never touches their platform rating."
              action={
                <HpButton leftIcon={<Plus className="h-4 w-4" />} onClick={() => setShowCreate(true)}>
                  New Mock Contest
                </HpButton>
              }
            />
          ) : visible.length === 0 ? (
            <HpEmptyState
              icon={SearchX}
              tone="slate"
              title="Nothing matches"
              description="No mock contests fit this filter or search. Try another view, or clear the search."
              action={
                <HpButton
                  variant="secondary"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                >
                  Clear filters
                </HpButton>
              }
            />
          ) : (
            <div className="relative grid grid-cols-1 gap-4 xl:grid-cols-2">
              <AnimatePresence mode="popLayout" initial={false}>
                {visible.map(({ contest, phase }, index) => (
                  <ScReveal key={contest.id} index={index} className="h-full">
                    <MockContestCard
                      contest={contest}
                      phase={phase}
                      now={now}
                      onParticipants={() => setViewingParticipantsOf(contest)}
                      onManage={() => setManagingContest(contest)}
                      onPublish={() => handlePublish(contest)}
                      onFinalize={() => handleFinalize(contest)}
                    />
                  </ScReveal>
                ))}
              </AnimatePresence>
            </div>
          )}
        </HpItem>
      </HpStagger>

      {showCreate && (
        <CreateMockContestModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            loadContests();
          }}
        />
      )}

      {managingContest && (
        <ManageMockProblemsModal
          contest={managingContest}
          onClose={() => setManagingContest(null)}
          onToast={triggerToast}
        />
      )}

      {viewingParticipantsOf && (
        <ContestParticipantsModal
          basePath="/tpo/contests"
          contestSlug={viewingParticipantsOf.slug}
          contestTitle={viewingParticipantsOf.title}
          onClose={() => setViewingParticipantsOf(null)}
        />
      )}
    </DashboardShell>
  );
}

/* ── Mock contest card ──────────────────────────────────────────────────── */

function MockContestCard({
  contest,
  phase,
  now,
  onParticipants,
  onManage,
  onPublish,
  onFinalize,
}: {
  contest: TpoContest;
  phase: Phase;
  now: Date;
  onParticipants: () => void;
  onManage: () => void;
  onPublish: () => void;
  onFinalize: () => void;
}) {
  const meta = PHASE_META[phase];
  const start = new Date(contest.start_at);
  const end = new Date(contest.end_at);
  const hasEnded = end < now;
  const sameDay = start.toDateString() === end.toDateString();
  const windowMs = end.getTime() - start.getTime();
  const elapsedPct = phase === "live" && windowMs > 0 ? ((now.getTime() - start.getTime()) / windowMs) * 100 : 0;

  const relative =
    phase === "scheduled"
      ? `Starts ${formatRelative(start, now)}`
      : phase === "live"
      ? `Ends ${formatRelative(end, now)}`
      : phase === "ended" || phase === "finalized"
      ? `Ended ${formatRelative(end, now)}`
      : phase === "draft"
      ? start > now
        ? `Starts ${formatRelative(start, now)} once published`
        : `Scheduled start was ${formatRelative(start, now)}`
      : "Cancelled";

  const canFinalize = contest.status === "published" && hasEnded && !contest.finalized_at;
  const noParticipants = contest.participants_count === 0;

  return (
    <HpCard className="hp-card-hover group flex h-full flex-col p-5 sm:p-6">
      <div className="flex-1">
        <div className="flex items-start gap-3.5">
          <HpIconTile
            icon={Swords}
            tone={meta.tone === "slate" ? "sky" : meta.tone}
            size="lg"
            className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
              <h3 className="min-w-0 line-clamp-2 text-15 font-bold leading-snug tracking-tight text-primary">{contest.title}</h3>
              <HpPill tone={meta.tone} dot={meta.dot} pulse={meta.pulse} icon={meta.icon} className="shrink-0">
                {meta.label}
              </HpPill>
            </div>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <ScMeta icon={GraduationCap}>Your students only</ScMeta>
              <HpPill tone="slate" icon={ShieldCheck} size="sm">
                Unrated
              </HpPill>
              {contest.finalized_at && phase !== "finalized" && (
                <HpPill tone="emerald" icon={CheckCircle2} size="sm">
                  Finalized
                </HpPill>
              )}
            </div>
          </div>
        </div>

        {contest.description && <p className="mt-3.5 line-clamp-2 text-13 leading-relaxed text-text-secondary">{contest.description}</p>}

        {/* Schedule */}
        <div className="mt-4 rounded-2xl border border-border-subtle bg-elevated/40 p-3.5 transition-colors duration-300 group-hover:bg-elevated/60">
          <div className="flex items-center gap-3.5">
            <ScDateTile date={start} tone={meta.tone === "slate" ? "sky" : meta.tone} />
            <div className="min-w-0 flex-1">
              <p className="tabular text-13 font-semibold leading-snug text-primary">
                {start.toLocaleString("en-IN", DATE_TIME)}
                <span className="mx-1.5 text-text-muted" aria-hidden>
                  →
                </span>
                <span className="sr-only"> to </span>
                {end.toLocaleString("en-IN", sameDay ? TIME_ONLY : DATE_TIME)}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <ScMeta icon={Timer}>{formatSpan(windowMs)} window</ScMeta>
                <ScMeta icon={phase === "live" ? Radio : CalendarClock} className={cn(phase === "live" && "text-sky-700 dark:text-sky-300")}>
                  {relative}
                </ScMeta>
              </div>
            </div>
          </div>
          {phase === "live" && (
            <div className="mt-3.5">
              <HpProgress value={elapsedPct} tone="sky" />
              <div className="tabular mt-1.5 flex justify-between text-3xs font-semibold text-text-muted">
                <span>{Math.round(elapsedPct)}% elapsed</span>
                <span>{formatSpan(end.getTime() - now.getTime())} left</span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <ScMeta icon={Users}>
            <span className="tabular font-bold text-primary">{contest.participants_count}</span> registered
          </ScMeta>
          {phase === "finalized" && contest.finalized_at && (
            <ScMeta icon={Trophy}>Ranked {formatRelative(new Date(contest.finalized_at), now)}</ScMeta>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
        {/* Who registered, how they ranked, and — drilling in — their
            actual per-problem code. Previously the only signal here was the
            bare "N registered" count above. */}
        <HpButton
          variant="secondary"
          size="sm"
          leftIcon={<Trophy className="h-3.5 w-3.5" />}
          onClick={onParticipants}
          disabled={noParticipants}
          title={noParticipants ? "No one has registered yet" : undefined}
        >
          Participants
        </HpButton>
        <HpButton variant="ghost" size="sm" leftIcon={<ListChecks className="h-3.5 w-3.5" />} onClick={onManage}>
          Manage Problems
        </HpButton>
        {(contest.status === "draft" || canFinalize) && (
          <div className="ml-auto flex items-center gap-2">
            {contest.status === "draft" && (
              <HpButton size="sm" leftIcon={<Rocket className="h-3.5 w-3.5" />} onClick={onPublish}>
                Publish
              </HpButton>
            )}
            {canFinalize && (
              <HpButton variant="success" size="sm" leftIcon={<Flag className="h-3.5 w-3.5" />} onClick={onFinalize}>
                Finalize
              </HpButton>
            )}
          </div>
        )}
      </div>
    </HpCard>
  );
}

/* ── Create modal ───────────────────────────────────────────────────────── */

function CreateMockContestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/tpo/contests", {
        title,
        description: description || undefined,
        start_at: localDatetimeInputToUtcIso(startAt),
        end_at: localDatetimeInputToUtcIso(endAt),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create mock contest.");
    } finally {
      setSaving(false);
    }
  };

  // Display-only preview of the window the two pickers describe.
  const windowMs = startAt && endAt ? new Date(endAt).getTime() - new Date(startAt).getTime() : NaN;

  return (
    <Modal
      variant="premium"
      onClose={onClose}
      title="New Mock Contest"
      subtitle="A private, unrated practice round for your students"
      icon={Swords}
      size="lg"
      footer={
        <>
          <HpButton type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </HpButton>
          <HpButton type="submit" form="create-mock-contest-form" isLoading={saving} leftIcon={<Plus className="h-4 w-4" />}>
            {saving ? "Creating..." : "Create Draft"}
          </HpButton>
        </>
      }
    >
      <ScNotice tone="indigo" className="mb-5">
        Only your own students can ever see this. Starts as a draft, and never affects platform ratings.
      </ScNotice>

      <form id="create-mock-contest-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="mc-title" className={hpLabel}>
            Title *
          </label>
          <input
            id="mc-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Pre-Placement Mock Round 1"
            className={hpInput}
          />
        </div>
        <div>
          <label htmlFor="mc-desc" className={hpLabel}>
            Description
          </label>
          <textarea id="mc-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={cn(hpInput, "resize-y")} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mc-start" className={hpLabel}>
              Start *
            </label>
            <input id="mc-start" required type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={hpInput} />
          </div>
          <div>
            <label htmlFor="mc-end" className={hpLabel}>
              End *
            </label>
            <input id="mc-end" required type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={hpInput} />
          </div>
        </div>
        {Number.isFinite(windowMs) && windowMs > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-2xs text-text-muted">
            <HpPill tone="sky" icon={Timer} size="sm">
              {formatSpan(windowMs)} window
            </HpPill>
            <span>Students can start any time inside this window.</span>
          </div>
        )}

        {error && <ScNotice tone="rose">{error}</ScNotice>}
      </form>
    </Modal>
  );
}

/* ── Manage problems modal ──────────────────────────────────────────────── */

function ManageMockProblemsModal({
  contest,
  onClose,
  onToast,
}: {
  contest: TpoContest;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [problems, setProblems] = useState<TpoContestProblem[]>([]);
  const [catalog, setCatalog] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pointsInput, setPointsInput] = useState("100");
  const [addingId, setAddingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [problemsRes, catalogRes] = await Promise.all([
        api.get<{ problems: TpoContestProblem[] }>(`/tpo/contests/${contest.slug}/problems`),
        api.get<{ problems: ProblemSummary[] }>("/problems"),
      ]);
      setProblems(problemsRes.problems);
      setCatalog(catalogRes.problems);
    } catch {
      onToast("Failed to load problems.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contest.slug]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (problemId: number) => {
    setAddingId(problemId);
    try {
      await api.post(`/tpo/contests/${contest.slug}/problems`, {
        problem_id: problemId,
        points: Number(pointsInput) || 100,
      });
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to add problem.");
    } finally {
      setAddingId(null);
    }
  };

  const handleRemove = async (contestProblemId: number) => {
    try {
      await api.delete(`/tpo/contests/${contest.slug}/problems/${contestProblemId}`);
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to remove problem.");
    }
  };

  const availableProblems = useMemo(() => {
    const notAdded = catalog.filter((p) => !problems.some((cp) => cp.problem.id === p.id));
    const query = search.trim().toLowerCase();
    if (!query) return notAdded;
    return notAdded.filter((p) => p.title.toLowerCase().includes(query) || p.difficulty.toLowerCase().includes(query));
  }, [catalog, problems, search]);

  const totalPoints = problems.reduce((sum, cp) => sum + cp.points, 0);

  return (
    <Modal
      variant="premium"
      onClose={onClose}
      title="Manage Problems"
      subtitle={contest.title}
      icon={ListChecks}
      size="2xl"
      bodyClassName="px-6 py-5 text-xs space-y-6"
    >
      {loading ? (
        <ScSkeletonList rows={4} />
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h4 className="text-13 font-bold tracking-tight text-primary">In this mock contest</h4>
                <p className="text-2xs text-text-muted">The problems your students will solve, in order.</p>
              </div>
              {problems.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <HpPill tone="indigo" size="sm" icon={Code2}>
                    <span className="tabular">{problems.length}</span> problem{problems.length === 1 ? "" : "s"}
                  </HpPill>
                  <HpPill tone="violet" size="sm" icon={ClipboardCheck}>
                    <span className="tabular">{totalPoints}</span> pts
                  </HpPill>
                </div>
              )}
            </div>

            {problems.length === 0 ? (
              <ScInlineEmpty
                icon={Code2}
                tone="sky"
                title="No problems added yet"
                description="Pick from the catalog below — each one is judged by the same engine as every other contest on the platform."
              />
            ) : (
              <div className="relative space-y-2">
                <AnimatePresence mode="popLayout" initial={false}>
                  {problems.map((cp, i) => (
                    <ScReveal key={cp.id} index={i}>
                      <div className="group flex items-center gap-3 rounded-2xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-3 py-2.5 transition-all duration-200 hover:border-indigo-500/25 hover:bg-elevated/40 sm:px-3.5">
                        <span className="tabular hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-elevated text-2xs font-bold text-text-muted sm:flex">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-13 font-semibold text-primary">{cp.problem.title}</p>
                          <HpPill tone={DIFFICULTY_TONE[cp.problem.difficulty] ?? "slate"} size="sm" className="mt-1 capitalize">
                            {cp.problem.difficulty}
                          </HpPill>
                        </div>
                        <span className="tabular shrink-0 text-right text-sm font-extrabold text-indigo-600 dark:text-indigo-300">
                          {cp.points}
                          <span className="ml-0.5 text-3xs font-bold text-text-muted">pts</span>
                        </span>
                        <ScIconButton icon={Trash2} label={`Remove ${cp.problem.title}`} tone="danger" onClick={() => handleRemove(cp.id)} />
                      </div>
                    </ScReveal>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>

          <section className="space-y-3 border-t border-border-subtle pt-5">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h4 className="text-13 font-bold tracking-tight text-primary">Add from catalog</h4>
                <p className="text-2xs text-text-muted">
                  <span className="tabular">{availableProblems.length}</span> available · each is added at the points value on the right
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <HpSearch
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search problems by name or difficulty..."
                aria-label="Search problems"
                wrapperClassName="flex-1"
              />
              <label className="flex shrink-0 items-center gap-2">
                <span className="text-2xs font-semibold text-text-secondary">Points</span>
                <input
                  type="number"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                  className={cn(hpInput, "tabular h-10 w-24 py-0")}
                  placeholder="Points"
                />
              </label>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {availableProblems.length === 0 ? (
                <p className="py-6 text-center text-2xs text-text-muted">
                  {search ? "No problems match your search." : "No more problems available to add."}
                </p>
              ) : (
                availableProblems.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2 transition-all duration-200 hover:border-border-subtle hover:bg-elevated/50"
                  >
                    <HpPill tone={DIFFICULTY_TONE[p.difficulty] ?? "slate"} size="sm" className="w-[58px] shrink-0 justify-center capitalize">
                      {p.difficulty}
                    </HpPill>
                    <span className="min-w-0 flex-1 truncate text-13 text-primary">{p.title}</span>
                    <HpButton
                      variant="soft"
                      size="sm"
                      onClick={() => handleAdd(p.id)}
                      isLoading={addingId === p.id}
                      leftIcon={<Plus className="h-3.5 w-3.5" />}
                      className="shrink-0"
                      aria-label={`Add ${p.title}`}
                    >
                      Add
                    </HpButton>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
    </Modal>
  );
}
