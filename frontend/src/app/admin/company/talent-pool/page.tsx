"use client";
import { SessionLoader } from "@/components/ui/SessionLoader";

import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Award,
  Loader2,
  GraduationCap,
  Star,
  CheckCircle2,
  CalendarClock,
  Briefcase,
  Send,
  Video,
  MapPin,
  Linkedin,
  Github,
  FileText,
  Download,
  Gauge,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Handshake,
  IndianRupee,
  SearchX,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trophy,
  Users,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { localDatetimeInputToUtcIso } from "@/lib/datetime";
import { Modal } from "@/components/ui/Modal";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import {
  HP_TONES,
  HpAvatar,
  HpButton,
  HpCard,
  HpCompanyLogo,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpPill,
  HpProgress,
  HpRing,
  HpSearch,
  HpSectionHeader,
  HpSkeleton,
  HpSkeletonRows,
  HpStagger,
  HpTabs,
  HpToast,
  hpBtn,
  hpEase,
  hpInput,
  hpLabel,
  type HpTone,
} from "@/components/portal/kit";

interface CollegeOption {
  id: number;
  name: string;
  short_code: string;
}

/** The recruiter-facing profile fields — see StudentProfileController/User::computeProfileCompletion() on the backend. Shared shape between the browse card and the detail view. */
interface RecruiterProfileFields {
  bio: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  skills: string[] | null;
  has_resume: boolean;
  profile_completion_percent: number;
}

interface TalentPoolCandidateCard {
  id: number;
  score_percent: string;
  qualified_at: string;
  my_inquiry_status: string | null;
  user:
    | ({
        id: number;
        name: string;
        branch: string | null;
        cgpa: string | null;
        current_rating: number;
        rated_contests_count: number;
        college: { id: number; name: string; short_code: string } | null;
      } & RecruiterProfileFields)
    | null;
}

interface TalentPoolCandidateDetail {
  id: number;
  score_percent: string;
  qualified_at: string;
  my_inquiry_status: string | null;
  source_contest: { id: number; title: string; slug: string; start_at: string } | null;
  user:
    | ({
        id: number;
        name: string;
        branch: string | null;
        cgpa: string | null;
        backlogs: number | null;
        current_rating: number;
        rated_contests_count: number;
        college: { id: number; name: string; short_code: string; city: string | null; state: string | null } | null;
      } & RecruiterProfileFields)
    | null;
}

interface InquiryMessage {
  id: number;
  message: string;
  created_at: string;
  sender: { id: number; name: string } | null;
}

interface Inquiry {
  id: number;
  status: string;
  interview_scheduled_at: string | null;
  interview_mode: string | null;
  interview_location: string | null;
  interview_notes: string | null;
  ctc_offered: string | null;
  messages?: InquiryMessage[];
}

interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
}

const STATUS_LABEL: Record<string, string> = {
  interested: "Interested",
  interview_scheduled: "HR Interview Scheduled",
  interview_completed: "Interview Completed",
  hired: "Hired",
  declined_by_company: "Declined by You",
  declined_by_candidate: "Declined by Candidate",
  withdrawn: "Withdrawn",
};

/** Engagement status → pill tone. Amber = needs attention (an interview on the calendar), emerald = the one positive outcome, rose = the candidate said no. */
const STATUS_TONE: Record<string, HpTone> = {
  interested: "violet",
  interview_scheduled: "amber",
  interview_completed: "sky",
  hired: "emerald",
  declined_by_company: "slate",
  declined_by_candidate: "rose",
  withdrawn: "slate",
};

/** Quick presets for the min-score filter — they write the same `minScore` value the number field does. */
const SCORE_PRESETS = [
  { value: "", label: "Any" },
  { value: "80", label: "80+" },
  { value: "90", label: "90+" },
  { value: "95", label: "95+" },
];

type ToastTone = "emerald" | "rose";

/** Hairline dividers for the 2×2 (mobile) → 1×4 (sm+) engagement strip. */
const STRIP_CELL_BORDERS = ["border-b border-r sm:border-b-0", "border-b sm:border-b-0 sm:border-r", "border-r", ""] as const;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Score → ring tone: teal (hiring identity) for the strongest scores, indigo for solid, slate below. */
function scoreTone(score: number): HpTone {
  if (score >= 90) return "teal";
  if (score >= 75) return "indigo";
  return "slate";
}

/** Cursor spotlight for a <button> styled as an hp-card (HpCard itself is a div). */
function trackSpotlight(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

/**
 * A hiring partner's window into the shared Talent Pool — candidates Mellow
 * itself already tested and scored, independent of any job opening this
 * company created. Browse → View Profile → Express Interest / Schedule HR
 * Interview / Hire / Send a Message, all mediated by the platform (never a
 * raw candidate email/phone in any response here — see
 * CompanyTalentPoolController's docblock on the backend).
 */
export default function CompanyTalentPoolPage() {
  const { status } = useAuthGuard(["admin_company"]);
  const [tab, setTab] = useState<"browse" | "engagements">("browse");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<ToastTone>("emerald");
  const [viewingCandidateId, setViewingCandidateId] = useState<number | null>(null);

  const triggerToast = (msg: string, tone: ToastTone = "emerald") => {
    setToastTone(tone);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  if (status !== "ready") return <SessionLoader />;

  return (
    <DashboardShell
      role="admin_company"
      title="Talent Pool"
      subtitle="Candidates Mellow already tested and scored — browse, express interest, schedule an HR interview, or hire directly."
    >
      <MotionConfig reducedMotion="user">
        <HpToast message={toastMessage} tone={toastTone} />

        <HpStagger className="space-y-6">
          <HpItem>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <HpTabs
                tabs={[
                  { id: "browse", label: "Browse Candidates", icon: Users },
                  { id: "engagements", label: "My Engagements", icon: Handshake },
                ]}
                value={tab}
                onChange={setTab}
                className="self-start"
              />
              <p className="flex items-center gap-2 text-2xs text-text-muted">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-teal-700 dark:text-teal-300" />
                Contact details stay private — every touchpoint goes through Mellow.
              </p>
            </div>
          </HpItem>

          <HpItem>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: hpEase }}
              >
                {tab === "browse" ? (
                  <BrowseTab onToast={triggerToast} onView={(id) => setViewingCandidateId(id)} />
                ) : (
                  <EngagementsTab onView={(id) => setViewingCandidateId(id)} onBrowse={() => setTab("browse")} />
                )}
              </motion.div>
            </AnimatePresence>
          </HpItem>
        </HpStagger>

        {viewingCandidateId !== null && (
          <CandidateProfileModal
            candidateId={viewingCandidateId}
            onClose={() => setViewingCandidateId(null)}
            onToast={triggerToast}
          />
        )}
      </MotionConfig>
    </DashboardShell>
  );
}

/* ── Browse ─────────────────────────────────────────────────────────────── */

function BrowseTab({ onToast, onView }: { onToast: (msg: string, tone?: ToastTone) => void; onView: (id: number) => void }) {
  const [result, setResult] = useState<Paginated<TalentPoolCandidateCard> | null>(null);
  const [colleges, setColleges] = useState<CollegeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.get<{ colleges: CollegeOption[] }>("/company/colleges").then((res) => setColleges(res.colleges)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (minScore) params.set("min_score", minScore);
      if (collegeId) params.set("college_id", collegeId);
      params.set("page", String(page));
      const res = await api.get<{ candidates: Paginated<TalentPoolCandidateCard> }>(`/company/talent-pool?${params.toString()}`);
      setResult(res.candidates);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load the Talent Pool.", "rose");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, minScore, collegeId, page]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const hasFilters = !!(search || minScore || collegeId);
  const clearFilters = () => {
    setPage(1);
    setSearch("");
    setMinScore("");
    setCollegeId("");
  };
  const hasCards = !!result && result.data.length > 0;

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <HpCard spotlight={false} className="p-3 sm:p-4">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
          <HpSearch
            value={search}
            onChange={(e) => { setPage(1); setSearch(e.target.value); }}
            placeholder="Search by name or skill..."
            aria-label="Search candidates by name or skill"
            wrapperClassName="min-w-0 flex-1"
            className="text-[13px]"
          />
          <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-[minmax(0,1fr)_9.5rem] lg:flex lg:items-center">
            <label className="group relative block lg:w-64">
              <span className="sr-only">Filter by college</span>
              <GraduationCap className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-indigo-500" />
              <select
                value={collegeId}
                onChange={(e) => { setPage(1); setCollegeId(e.target.value); }}
                className={cn(hpInput, "h-10 cursor-pointer appearance-none truncate py-0 pl-10 pr-9 text-[13px]")}
              >
                <option value="">All Colleges</option>
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            </label>
            <label className="group relative block lg:w-40">
              <span className="sr-only">Minimum score percent</span>
              <Gauge className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-indigo-500" />
              <input
                type="number"
                min={1}
                max={100}
                value={minScore}
                onChange={(e) => { setPage(1); setMinScore(e.target.value); }}
                placeholder="Min score"
                className={cn(hpInput, "tabular h-10 py-0 pl-10 pr-8 text-[13px]")}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-muted">%</span>
            </label>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
          <span className="mr-1 flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
            <SlidersHorizontal className="h-3 w-3" />
            Score
          </span>
          {SCORE_PRESETS.map((p) => {
            const active = minScore === p.value;
            return (
              <button
                key={p.label}
                type="button"
                aria-pressed={active}
                onClick={() => { setPage(1); setMinScore(p.value); }}
                className={cn(
                  "tabular rounded-full px-3 py-1 text-2xs font-semibold ring-1 ring-inset transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95",
                  active
                    ? "bg-indigo-500/10 text-indigo-700 ring-indigo-500/30 shadow-[0_4px_12px_-6px_rgba(99,102,241,0.6)] dark:text-indigo-300"
                    : "text-text-muted ring-border-subtle hover:bg-elevated hover:text-primary hover:ring-border-strong"
                )}
              >
                {p.label}
              </button>
            );
          })}
          <AnimatePresence>
            {hasFilters && (
              <motion.button
                type="button"
                onClick={clearFilters}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, ease: hpEase }}
                className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold text-text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-rose-300"
              >
                <X className="h-3 w-3" />
                Clear filters
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </HpCard>

      {/* Result meta */}
      <div className="flex min-h-[20px] flex-wrap items-center justify-between gap-2 px-1" aria-live="polite">
        <p className="text-xs text-text-muted">
          {result ? (
            <>
              <span className="tabular font-bold text-primary">{result.total}</span>{" "}
              {result.total === 1 ? "candidate" : "candidates"}
              {hasFilters ? " match your filters" : " in the pool"}
            </>
          ) : loading ? (
            "Searching the pool…"
          ) : null}
        </p>
        {loading && result ? (
          <span className="inline-flex items-center gap-1.5 text-2xs font-semibold text-indigo-600 dark:text-indigo-300">
            <Loader2 className="h-3 w-3 animate-spin" />
            Updating
          </span>
        ) : result && result.last_page > 1 ? (
          <span className="tabular text-2xs text-text-muted">
            Page {result.current_page} of {result.last_page}
          </span>
        ) : null}
      </div>

      {/* Results */}
      {loading && !hasCards ? (
        <CandidateGridSkeleton />
      ) : !hasCards ? (
        <HpEmptyState
          icon={SearchX}
          tone="teal"
          title="No candidates match these filters yet"
          description={
            hasFilters
              ? "Try a lower score threshold, a different college, or a broader search term."
              : "New candidates join the pool as they qualify on Mellow assessments — check back soon."
          }
          action={
            hasFilters ? (
              <HpButton variant="secondary" size="sm" onClick={clearFilters} leftIcon={<X className="h-3.5 w-3.5" />}>
                Clear filters
              </HpButton>
            ) : undefined
          }
        />
      ) : (
        <div
          aria-busy={loading}
          className={cn(
            "grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4 transition-opacity duration-300",
            loading && "pointer-events-none opacity-55"
          )}
        >
          {result!.data.map((c, i) => (
            <CandidateCard key={c.id} candidate={c} index={i} onView={onView} />
          ))}
        </div>
      )}

      {result && result.last_page > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-1">
          <HpButton
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            leftIcon={<ChevronLeft className="h-4 w-4" />}
          >
            Prev
          </HpButton>
          <span className="tabular text-xs text-text-muted">
            Page <span className="font-bold text-primary">{result.current_page}</span> of {result.last_page}
          </span>
          <HpButton
            variant="secondary"
            size="sm"
            disabled={page >= result.last_page}
            onClick={() => setPage((p) => p + 1)}
            rightIcon={<ChevronRight className="h-4 w-4" />}
          >
            Next
          </HpButton>
        </nav>
      )}
    </div>
  );
}

function CandidateCard({ candidate: c, index, onView }: { candidate: TalentPoolCandidateCard; index: number; onView: (id: number) => void }) {
  const u = c.user;
  const name = u?.name ?? "Candidate";
  const score = Number(c.score_percent);
  const skills = u?.skills ?? [];
  const completion = u?.profile_completion_percent ?? 0;
  const rated = !!u && u.rated_contests_count > 0;
  const meta = [u?.branch, u?.cgpa ? `CGPA ${u.cgpa}` : null].filter(Boolean).join(" · ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: hpEase, delay: Math.min(index, 9) * 0.04 }}
      className="h-full"
    >
      <button
        type="button"
        onClick={() => onView(c.id)}
        onMouseMove={trackSpotlight}
        className="hp-card hp-spot hp-card-hover group relative flex h-full w-full flex-col rounded-[20px] p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg-surface-rgb))]"
      >
        {/* hover hairline */}
        <span aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-teal-400/70 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="relative flex items-start gap-3.5">
          <HpAvatar name={name} size="lg" />
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="truncate text-[15px] font-bold tracking-tight text-primary transition-colors duration-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
              {name}
            </div>
            <div className="tabular mt-0.5 truncate text-2xs text-text-muted">{meta || `Qualified ${fmtDate(c.qualified_at)}`}</div>
          </div>
          <div className="shrink-0" title={`Assessment score ${c.score_percent}%`}>
            <HpRing value={score} size={54} stroke={5} tone={scoreTone(score)}>
              <span className="tabular text-xs font-extrabold text-primary">
                <span className="sr-only">Score </span>
                {Math.round(score)}
                <span className="text-3xs font-bold text-text-muted">%</span>
              </span>
            </HpRing>
          </div>
        </div>

        <div className="relative mt-4 flex items-center gap-2.5 rounded-xl bg-elevated/60 px-2.5 py-2 ring-1 ring-inset ring-border-subtle">
          <CollegeMark name={u?.college?.name ?? null} />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-text-secondary">{u?.college?.name ?? "Mellow Direct"}</span>
          {u?.college?.short_code && (
            <span className="shrink-0 text-3xs font-bold uppercase tracking-wider text-text-muted">{u.college.short_code}</span>
          )}
        </div>

        {skills.length > 0 && (
          <div className="relative mt-3 flex flex-wrap items-center gap-1.5">
            {skills.slice(0, 3).map((skill) => (
              <HpPill key={skill} tone="teal" size="sm">
                {skill}
              </HpPill>
            ))}
            {skills.length > 3 && (
              <span className="rounded-full bg-elevated px-2 py-0.5 text-3xs font-semibold text-text-muted">+{skills.length - 3} more</span>
            )}
          </div>
        )}

        <div className="relative mt-auto grid grid-cols-2 gap-2 pt-4">
          <div className="rounded-xl bg-elevated/60 px-3 py-2 ring-1 ring-inset ring-border-subtle">
            <div className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">Rating</div>
            <div className="mt-0.5 flex items-center gap-1 text-[13px] font-bold text-primary">
              {rated ? (
                <>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  <span className="tabular">{u!.current_rating}</span>
                </>
              ) : (
                <span className="font-semibold text-text-muted">Unrated</span>
              )}
            </div>
          </div>
          <div className="rounded-xl bg-elevated/60 px-3 py-2 ring-1 ring-inset ring-border-subtle">
            <div className="flex items-center justify-between text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
              <span>Profile</span>
              <span className="tabular text-text-secondary">{completion}%</span>
            </div>
            <HpProgress value={completion} tone={completion >= 100 ? "emerald" : "teal"} className="mt-2" />
          </div>
        </div>

        <div className="relative mt-4 flex items-center justify-between gap-2 border-t border-border-subtle pt-3.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {c.my_inquiry_status ? (
              <StatusPill status={c.my_inquiry_status} size="sm" />
            ) : (
              <span className="truncate text-2xs text-text-muted">Qualified {fmtDate(c.qualified_at)}</span>
            )}
            {u?.has_resume && (
              <span title="Resume on file" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-elevated px-1.5 py-0.5 text-3xs font-semibold text-text-muted">
                <FileText className="h-3 w-3" />
                CV
              </span>
            )}
          </div>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-2xs font-bold text-indigo-600 transition-[gap] duration-300 group-hover:gap-1.5 dark:text-indigo-300">
            View profile
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px" />
          </span>
        </div>
      </button>
    </motion.div>
  );
}

function CandidateGridSkeleton() {
  return (
    <div role="status" aria-label="Loading candidates" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <HpCard key={i} spotlight={false} className="p-5">
          <div className="flex items-start gap-3.5">
            <HpSkeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <HpSkeleton className="h-3.5 w-3/5" />
              <HpSkeleton className="h-3 w-2/5" />
            </div>
            <HpSkeleton className="h-[54px] w-[54px] rounded-full" />
          </div>
          <HpSkeleton className="mt-4 h-10 w-full rounded-xl" />
          <div className="mt-3 flex gap-1.5">
            <HpSkeleton className="h-5 w-14 rounded-full" />
            <HpSkeleton className="h-5 w-16 rounded-full" />
            <HpSkeleton className="h-5 w-12 rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <HpSkeleton className="h-[52px] rounded-xl" />
            <HpSkeleton className="h-[52px] rounded-xl" />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3.5">
            <HpSkeleton className="h-5 w-24 rounded-full" />
            <HpSkeleton className="h-3.5 w-20" />
          </div>
        </HpCard>
      ))}
    </div>
  );
}

/* ── Engagements ────────────────────────────────────────────────────────── */

function EngagementsTab({ onView, onBrowse }: { onView: (id: number) => void; onBrowse?: () => void }) {
  const [inquiries, setInquiries] = useState<(Inquiry & { candidate: TalentPoolCandidateCard })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ inquiries: (Inquiry & { candidate: TalentPoolCandidateCard })[] }>("/company/talent-pool/inquiries")
      .then((res) => setInquiries(res.inquiries))
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const by = (statuses: string[]) => inquiries.filter((i) => statuses.includes(i.status)).length;
    return {
      active: by(["interested", "interview_scheduled", "interview_completed"]),
      interviews: by(["interview_scheduled"]),
      hired: by(["hired"]),
      closed: by(["declined_by_company", "declined_by_candidate", "withdrawn"]),
    };
  }, [inquiries]);

  if (loading) {
    return (
      <div className="space-y-5">
        <HpCard spotlight={false} className="grid grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4 sm:p-5">
              <HpSkeleton className="h-8 w-8 rounded-[10px]" />
              <div className="space-y-1.5">
                <HpSkeleton className="h-5 w-8" />
                <HpSkeleton className="h-2.5 w-14" />
              </div>
            </div>
          ))}
        </HpCard>
        <HpSkeletonRows rows={5} />
      </div>
    );
  }

  if (inquiries.length === 0) {
    return (
      <HpEmptyState
        icon={Handshake}
        tone="violet"
        title="No engagements yet"
        description="Express interest in a candidate from the Browse tab to start one — every conversation, interview and hire you start shows up here."
        action={
          onBrowse ? (
            <HpButton variant="primary" size="sm" onClick={onBrowse} leftIcon={<Users className="h-3.5 w-3.5" />}>
              Browse candidates
            </HpButton>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Pipeline strip — straight counts of the engagements listed below. */}
      <HpCard spotlight={false} className="grid grid-cols-2 overflow-hidden sm:grid-cols-4">
        {(
          [
            { label: "Active", title: "Interested, interview scheduled or completed", value: counts.active, icon: Handshake, tone: "violet" },
            { label: "Interviews", title: "HR interviews currently scheduled", value: counts.interviews, icon: CalendarClock, tone: "amber" },
            { label: "Hired", title: "Hired through the Talent Pool", value: counts.hired, icon: Trophy, tone: "emerald" },
            { label: "Closed", title: "Declined or withdrawn", value: counts.closed, icon: XCircle, tone: "slate" },
          ] as const
        ).map((s, i) => (
          <div
            key={s.label}
            title={s.title}
            className={cn("group flex items-center gap-3 border-border-subtle p-4 transition-colors duration-200 hover:bg-elevated/40 sm:p-5", STRIP_CELL_BORDERS[i])}
          >
            <HpIconTile icon={s.icon} tone={s.tone} size="sm" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" />
            <div className="min-w-0">
              <div className="tabular text-xl font-extrabold leading-none tracking-tight text-primary">
                <AnimatedCounter target={s.value} />
              </div>
              <div className="mt-1 truncate text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">{s.label}</div>
            </div>
          </div>
        ))}
      </HpCard>

      <HpCard spotlight={false} className="overflow-hidden">
        <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
          <HpSectionHeader
            title="Engagements"
            subtitle={`${inquiries.length} ${inquiries.length === 1 ? "candidate" : "candidates"} you've engaged through the Talent Pool`}
            icon={Handshake}
            tone="violet"
          />
        </div>
        <ul className="divide-y divide-border-subtle">
          {inquiries.map((inq, i) => {
            const name = inq.candidate.user?.name ?? "Candidate";
            return (
              <motion.li
                key={inq.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: hpEase, delay: Math.min(i, 10) * 0.03 }}
              >
                <button
                  type="button"
                  onClick={() => onView(inq.candidate.id)}
                  className="group flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors duration-200 hover:bg-indigo-500/[0.04] focus-visible:bg-indigo-500/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:px-5"
                >
                  <HpAvatar name={name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-primary transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-300">{name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-text-muted">
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <GraduationCap className="h-3 w-3 shrink-0" />
                        <span className="truncate">{inq.candidate.user?.college?.name ?? "Mellow Direct"}</span>
                      </span>
                      <span className="tabular">{inq.candidate.score_percent}% score</span>
                      {inq.interview_scheduled_at && (
                        <span className="tabular inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                          <CalendarClock className="h-3 w-3" />
                          HR interview {fmtDateTime(inq.interview_scheduled_at)}
                        </span>
                      )}
                      {inq.ctc_offered && (
                        <span className="tabular inline-flex items-center gap-0.5 font-semibold text-text-secondary">
                          <IndianRupee className="h-3 w-3" />
                          {Number(inq.ctc_offered).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 sm:hidden">
                      <StatusPill status={inq.status} size="sm" />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden sm:inline-flex">
                      <StatusPill status={inq.status} />
                    </span>
                    <ChevronRight className="h-4 w-4 text-text-muted transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                  </div>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </HpCard>
    </div>
  );
}

/* ── Shared bits ────────────────────────────────────────────────────────── */

function StatusPill({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  return (
    <HpPill tone={STATUS_TONE[status] ?? "slate"} dot pulse={status === "interview_scheduled"} size={size}>
      {STATUS_LABEL[status] ?? status}
    </HpPill>
  );
}

/** Small college identity tile — a deterministic monogram, or a teal "Mellow" mark for candidates with no college. */
function CollegeMark({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span
        className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-gradient-to-br from-teal-400 to-cyan-600 text-white ring-1 ring-inset ring-white/25"
        aria-hidden
      >
        <Sparkles className="h-3 w-3" strokeWidth={2.4} />
      </span>
    );
  }
  return <HpCompanyLogo name={name} size="sm" className="h-6 w-6 rounded-[7px] text-[16px] shadow-none" />;
}

function FormError({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: hpEase }}
          className="flex items-start gap-2.5 rounded-xl bg-rose-500/[0.08] px-3.5 py-2.5 text-2xs font-medium text-rose-700 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          <span className="leading-relaxed">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProfileStat({
  icon: Icon,
  label,
  value,
  tone = "indigo",
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: HpTone;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] p-3.5 shadow-[var(--hp-edge)] transition-colors duration-200 hover:border-indigo-500/25">
      <div className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", HP_TONES[tone].text)} />
        <span className="truncate">{label}</span>
      </div>
      <div className="tabular mt-1.5 break-words text-sm font-bold leading-snug text-primary">{value}</div>
      {children}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading profile">
      <div className="flex items-center gap-4 rounded-[20px] border border-border-subtle p-5">
        <HpSkeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2.5">
          <HpSkeleton className="h-5 w-1/2" />
          <HpSkeleton className="h-3.5 w-2/3" />
        </div>
        <HpSkeleton className="h-[84px] w-[84px] rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <HpSkeleton key={i} className="h-[72px] rounded-2xl" />
        ))}
      </div>
      <HpSkeleton className="h-28 w-full rounded-[20px]" />
      <HpSkeleton className="h-12 w-full rounded-2xl" />
    </div>
  );
}

/* ── Profile modal ──────────────────────────────────────────────────────── */

function CandidateProfileModal({ candidateId, onClose, onToast }: { candidateId: number; onClose: () => void; onToast: (msg: string, tone?: ToastTone) => void }) {
  const [detail, setDetail] = useState<{ candidate: TalentPoolCandidateDetail; readiness_score: number | null; display_rating: string | null; inquiry: Inquiry | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [showHireForm, setShowHireForm] = useState(false);
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<typeof detail>(`/company/talent-pool/${candidateId}`);
      setDetail(res);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to load candidate profile.", "rose");
      onClose();
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleInterest = async () => {
    setBusy(true);
    try {
      await api.post(`/company/talent-pool/${candidateId}/interest`);
      onToast("Marked interest — the candidate has been notified.");
      load();
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to express interest.", "rose");
    } finally {
      setBusy(false);
    }
  };

  const handleResumeDownload = async () => {
    setDownloadingResume(true);
    try {
      const blob = await api.getFile(`/company/talent-pool/${candidateId}/resume`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${detail?.candidate.user?.name ?? "candidate"}-resume.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      onToast(err instanceof ApiError ? err.message : "Failed to download resume.", "rose");
    } finally {
      setDownloadingResume(false);
    }
  };

  const inquiry = detail?.inquiry;
  const isTerminal = inquiry && ["hired", "declined_by_company", "declined_by_candidate", "withdrawn"].includes(inquiry.status);

  const user = detail?.candidate.user;
  const score = detail ? Number(detail.candidate.score_percent) : 0;
  const completion = user?.profile_completion_percent ?? 0;
  const location = [user?.college?.city, user?.college?.state].filter(Boolean).join(", ");

  const footer =
    !loading && detail && !isTerminal ? (
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        <HpButton variant="ghost" size="sm" className="h-9 px-3.5" onClick={() => setShowMessageForm(true)} leftIcon={<Send className="h-3.5 w-3.5" />}>
          Send Message
        </HpButton>
        <HpButton variant="secondary" size="sm" className="h-9 px-3.5" onClick={() => setShowInterviewForm(true)} leftIcon={<CalendarClock className="h-3.5 w-3.5" />}>
          Schedule HR Interview
        </HpButton>
        <HpButton variant="success" size="sm" className="h-9 px-3.5" onClick={() => setShowHireForm(true)} leftIcon={<Briefcase className="h-3.5 w-3.5" />}>
          Hire
        </HpButton>
        {!inquiry && (
          <HpButton
            variant="primary"
            size="sm"
            className="h-9 px-3.5"
            onClick={handleInterest}
            disabled={busy}
            isLoading={busy}
            leftIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
          >
            Express Interest
          </HpButton>
        )}
      </div>
    ) : undefined;

  return (
    <>
      <Modal
        onClose={onClose}
        title="Talent Pool Profile"
        subtitle="Tested and scored by Mellow"
        icon={Award}
        variant="premium"
        size="2xl"
        footer={footer}
      >
        {loading || !detail ? (
          <ProfileSkeleton />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: hpEase }}
            className="space-y-5"
          >
            {/* Identity */}
            <div className="relative overflow-hidden rounded-[20px] border border-border-subtle bg-elevated/40 p-5">
              <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_130%_at_0%_0%,rgba(20,184,166,0.12),transparent_60%),radial-gradient(60%_120%_at_100%_0%,rgba(99,102,241,0.12),transparent_60%)]" />
              <div aria-hidden className="hp-dots pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(55%_80%_at_100%_0%,#000,transparent)]" />
              <div className="relative flex items-center gap-4">
                <HpAvatar name={user?.name ?? "Candidate"} size="lg" className="h-14 w-14 text-base sm:h-16 sm:w-16 sm:text-lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-extrabold tracking-tight text-primary sm:text-xl">{user?.name}</div>
                  <div className="mt-1.5 flex min-w-0 items-center gap-2 text-xs text-text-secondary">
                    <CollegeMark name={user?.college?.name ?? null} />
                    <span className="truncate">{user?.college?.name ?? "Mellow Direct (no college)"}</span>
                  </div>
                  {location && (
                    <div className="mt-1 flex items-center gap-1 text-2xs text-text-muted">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{location}</span>
                    </div>
                  )}
                </div>
                <div className="shrink-0" title={`Assessment score ${detail.candidate.score_percent}%`}>
                  <HpRing value={score} size={84} stroke={7} tone={scoreTone(score)}>
                    <div className="text-center leading-none">
                      <div className="tabular text-sm font-extrabold text-primary">{detail.candidate.score_percent}%</div>
                      <div className="mt-1 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Score</div>
                    </div>
                  </HpRing>
                </div>
              </div>
            </div>

            {/* Key facts */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <ProfileStat icon={BookOpen} label="Branch" value={user?.branch ?? "—"} tone="sky" />
              <ProfileStat icon={GraduationCap} label="CGPA" value={user?.cgpa ?? "—"} tone="indigo" />
              <ProfileStat icon={Star} label="Platform Rating" value={detail.display_rating ?? "Unrated"} tone="amber" />
              <ProfileStat icon={Gauge} label="Readiness Score" value={`${detail.readiness_score ?? "—"}/100`} tone="teal">
                {detail.readiness_score !== null && <HpProgress value={detail.readiness_score} tone="teal" className="mt-2" />}
              </ProfileStat>
            </div>

            {/* Recruiter profile */}
            {(user?.bio || user?.linkedin_url || user?.github_url || (user?.skills?.length ?? 0) > 0 || user?.has_resume) && (
              <section className="space-y-3.5 rounded-[20px] border border-border-subtle p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">Recruiter Profile</span>
                  {user && completion > 0 && (
                    <HpPill tone={completion >= 100 ? "emerald" : "teal"} size="sm">
                      <span className="tabular">{completion}% complete</span>
                    </HpPill>
                  )}
                </div>
                {user && completion > 0 && <HpProgress value={completion} tone={completion >= 100 ? "emerald" : "teal"} />}

                {user?.bio && <p className="text-[13px] leading-relaxed text-text-secondary">{user.bio}</p>}

                {user?.skills && user.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {user.skills.map((skill) => (
                      <HpPill key={skill} tone="teal">
                        {skill}
                      </HpPill>
                    ))}
                  </div>
                )}

                {(user?.linkedin_url || user?.github_url || user?.has_resume) && (
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    {user?.linkedin_url && (
                      <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer" className={hpBtn("secondary", "sm")}>
                        <Linkedin className="h-3.5 w-3.5" />
                        LinkedIn
                        <ArrowUpRight className="h-3 w-3 opacity-60" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    )}
                    {user?.github_url && (
                      <a href={user.github_url} target="_blank" rel="noopener noreferrer" className={hpBtn("secondary", "sm")}>
                        <Github className="h-3.5 w-3.5" />
                        GitHub
                        <ArrowUpRight className="h-3 w-3 opacity-60" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    )}
                    {user?.has_resume && (
                      <HpButton
                        variant="soft"
                        size="sm"
                        onClick={handleResumeDownload}
                        disabled={downloadingResume}
                        isLoading={downloadingResume}
                        leftIcon={<FileText className="h-3.5 w-3.5" />}
                        rightIcon={<Download className="h-3 w-3" />}
                      >
                        {downloadingResume ? "Downloading..." : "Resume"}
                      </HpButton>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Provenance */}
            <div className="flex items-start gap-3 rounded-2xl bg-teal-500/[0.06] p-3.5 ring-1 ring-inset ring-teal-500/15">
              <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
              <p className="text-2xs leading-relaxed text-text-secondary">
                Qualified via &quot;{detail.candidate.source_contest?.title ?? "a Mellow assessment"}&quot; on{" "}
                {fmtDate(detail.candidate.qualified_at)}.
                Contact details are never shared directly — every action below notifies the candidate through Mellow.
              </p>
            </div>

            {/* Engagement */}
            {inquiry && (
              <section className="space-y-3 rounded-[20px] border border-border-subtle bg-elevated/40 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-bold text-primary">
                    <Handshake className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                    Your Engagement
                  </span>
                  <StatusPill status={inquiry.status} />
                </div>

                {inquiry.interview_scheduled_at && (
                  <div className="flex items-center gap-3 rounded-xl bg-[rgb(var(--bg-surface-rgb))] p-3 ring-1 ring-inset ring-border-subtle">
                    <HpIconTile icon={inquiry.interview_mode === "offline" ? MapPin : Video} tone="amber" size="sm" />
                    <div className="min-w-0 text-2xs">
                      <div className="tabular flex items-center gap-1.5 font-bold text-primary">
                        <CalendarClock className="h-3 w-3 text-text-muted" />
                        {fmtDateTime(inquiry.interview_scheduled_at)}
                      </div>
                      <div className="mt-0.5 truncate text-text-muted">
                        <span className="capitalize">{inquiry.interview_mode}</span> · {inquiry.interview_location}
                      </div>
                    </div>
                  </div>
                )}

                {inquiry.ctc_offered && (
                  <div className="flex items-center gap-2 text-2xs text-text-secondary">
                    <IndianRupee className="h-3.5 w-3.5 text-text-muted" />
                    Offered CTC:{" "}
                    <span className="tabular font-bold text-primary">₹{Number(inquiry.ctc_offered).toLocaleString("en-IN")}</span>
                  </div>
                )}

                {inquiry.messages && inquiry.messages.length > 0 && (
                  <ul className="space-y-2.5 border-t border-border-subtle pt-3">
                    {inquiry.messages.map((m) => (
                      <li key={m.id} className="flex items-start gap-2.5">
                        <HpAvatar name={m.sender?.name ?? "You"} size="xs" className="mt-0.5" />
                        <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-[rgb(var(--bg-surface-rgb))] px-3 py-2 ring-1 ring-inset ring-border-subtle">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-3xs font-bold text-text-secondary">{m.sender?.name ?? "You"}</span>
                            <span className="tabular shrink-0 text-3xs text-text-muted">
                              {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                          <p className="mt-0.5 break-words text-2xs leading-relaxed text-text-muted">{m.message}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </motion.div>
        )}
      </Modal>

      {showInterviewForm && (
        <ScheduleInterviewForm candidateId={candidateId} onClose={() => setShowInterviewForm(false)} onDone={(msg) => { onToast(msg); setShowInterviewForm(false); load(); }} />
      )}
      {showHireForm && (
        <HireForm candidateId={candidateId} onClose={() => setShowHireForm(false)} onDone={(msg) => { onToast(msg); setShowHireForm(false); load(); }} />
      )}
      {showMessageForm && (
        <MessageForm candidateId={candidateId} onClose={() => setShowMessageForm(false)} onDone={(msg) => { onToast(msg); setShowMessageForm(false); load(); }} />
      )}
    </>
  );
}

/* ── Action forms ───────────────────────────────────────────────────────── */

function ModeOption({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-[0.98]",
        active
          ? "border-indigo-500/50 bg-indigo-500/[0.07] shadow-[0_0_0_4px_rgba(99,102,241,0.10)]"
          : "border-border-strong hover:border-indigo-500/30 hover:bg-elevated/60"
      )}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] transition-colors duration-200",
          active ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_6px_14px_-6px_rgba(99,102,241,0.7)]" : "bg-elevated text-text-muted"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold text-primary">{label}</span>
        <span className="block truncate text-3xs text-text-muted">{hint}</span>
      </span>
    </button>
  );
}

function ScheduleInterviewForm({ candidateId, onClose, onDone }: { candidateId: number; onClose: () => void; onDone: (msg: string) => void }) {
  const [scheduledAt, setScheduledAt] = useState("");
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/company/talent-pool/${candidateId}/interview`, {
        scheduled_at: localDatetimeInputToUtcIso(scheduledAt),
        mode,
        location,
        notes: notes || undefined,
      });
      onDone("HR interview scheduled — the candidate has been notified.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to schedule the interview.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Schedule HR Interview"
      subtitle="The candidate is notified through Mellow"
      icon={CalendarClock}
      variant="premium"
      size="md"
      footer={
        <>
          <HpButton type="button" variant="ghost" size="sm" className="h-9 px-4" onClick={onClose} disabled={saving}>
            Cancel
          </HpButton>
          <HpButton type="submit" form="schedule-hr-interview-form" variant="primary" size="sm" className="h-9 px-4" disabled={saving} isLoading={saving}>
            {saving ? "Scheduling..." : "Schedule"}
          </HpButton>
        </>
      }
    >
      <form id="schedule-hr-interview-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="tp-interview-when" className={hpLabel}>When *</label>
          <input
            id="tp-interview-when"
            required
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={cn(hpInput, "tabular text-[13px]")}
          />
        </div>
        <fieldset>
          <legend className={hpLabel}>Mode *</legend>
          <div className="grid grid-cols-2 gap-2.5">
            <ModeOption active={mode === "online"} onClick={() => setMode("online")} icon={Video} label="Online" hint="Video meeting link" />
            <ModeOption active={mode === "offline"} onClick={() => setMode("offline")} icon={MapPin} label="In Person" hint="At your office" />
          </div>
        </fieldset>
        <div>
          <label htmlFor="tp-interview-location" className={hpLabel}>{mode === "online" ? "Meeting Link *" : "Location *"}</label>
          <input
            id="tp-interview-location"
            required
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={mode === "online" ? "https://meet.example.com/..." : "Office address"}
            className={cn(hpInput, "text-[13px]")}
          />
        </div>
        <div>
          <label htmlFor="tp-interview-note" className={hpLabel}>Note</label>
          <textarea
            id="tp-interview-note"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cn(hpInput, "resize-y text-[13px]")}
          />
        </div>
        <FormError message={error} />
      </form>
    </Modal>
  );
}

function HireForm({ candidateId, onClose, onDone }: { candidateId: number; onClose: () => void; onDone: (msg: string) => void }) {
  const [ctc, setCtc] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/company/talent-pool/${candidateId}/hire`, { ctc_offered: ctc ? Number(ctc) : undefined, notes: notes || undefined });
      onDone("Candidate hired — they've been notified and removed from other partners' search.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to hire this candidate.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Hire This Candidate"
      subtitle="Confirm the offer details"
      icon={Briefcase}
      variant="premium"
      size="md"
      footer={
        <>
          <HpButton type="button" variant="ghost" size="sm" className="h-9 px-4" onClick={onClose} disabled={saving}>
            Cancel
          </HpButton>
          <HpButton type="submit" form="hire-candidate-form" variant="success" size="sm" className="h-9 px-4" disabled={saving} isLoading={saving}>
            {saving ? "Hiring..." : "Confirm Hire"}
          </HpButton>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-amber-500/[0.08] px-3.5 py-2.5 ring-1 ring-inset ring-amber-500/25">
        <AlertTriangle className="mt-px h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <p className="text-2xs leading-relaxed text-text-secondary">
          This is final — the candidate is notified immediately and removed from every other partner&apos;s Talent Pool search.
        </p>
      </div>
      <form id="hire-candidate-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="tp-hire-ctc" className={hpLabel}>CTC Offered (₹/year)</label>
          <div className="group relative">
            <IndianRupee className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted transition-colors group-focus-within:text-indigo-500" />
            <input
              id="tp-hire-ctc"
              type="number"
              min={0}
              value={ctc}
              onChange={(e) => setCtc(e.target.value)}
              placeholder="e.g. 1200000"
              className={cn(hpInput, "tabular pl-10 pr-16 text-[13px]")}
            />
            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-2xs font-semibold text-text-muted">/ year</span>
          </div>
          {ctc && Number(ctc) > 0 && (
            <p className="tabular mt-1.5 text-3xs text-text-muted">₹{Number(ctc).toLocaleString("en-IN")} per year</p>
          )}
        </div>
        <div>
          <label htmlFor="tp-hire-note" className={hpLabel}>Note</label>
          <textarea id="tp-hire-note" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={cn(hpInput, "resize-y text-[13px]")} />
        </div>
        <FormError message={error} />
      </form>
    </Modal>
  );
}

function MessageForm({ candidateId, onClose, onDone }: { candidateId: number; onClose: () => void; onDone: (msg: string) => void }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/company/talent-pool/${candidateId}/notify`, { message });
      onDone("Message sent via email.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send message.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title="Send a Message"
      subtitle="Delivered to the candidate by email through Mellow"
      icon={Send}
      variant="premium"
      size="md"
      footer={
        <>
          <HpButton type="button" variant="ghost" size="sm" className="h-9 px-4" onClick={onClose} disabled={saving}>
            Cancel
          </HpButton>
          <HpButton
            type="submit"
            form="send-message-form"
            variant="primary"
            size="sm"
            className="h-9 px-4"
            disabled={saving}
            isLoading={saving}
            leftIcon={<Send className="h-3.5 w-3.5" />}
          >
            {saving ? "Sending..." : "Send"}
          </HpButton>
        </>
      }
    >
      <form id="send-message-form" onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="tp-message" className="sr-only">Message</label>
        <textarea
          id="tp-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message to the candidate..."
          className={cn(hpInput, "resize-y text-[13px] leading-relaxed")}
        />
        <div className="tabular text-right text-3xs text-text-muted">{message.length} characters</div>
        <FormError message={error} />
      </form>
    </Modal>
  );
}
