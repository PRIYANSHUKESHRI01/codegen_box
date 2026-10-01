"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Trophy,
  Percent,
  Activity,
  Target,
  Building2,
  CheckCircle2,
  Sparkles,
  BarChart3,
  Code2,
  Flame,
  Gauge,
  Mic,
  Brain,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { StatTile } from "@/components/dashboard/student/StatTile";
import { RatingChart } from "@/components/dashboard/student/RatingChart";
import { VerdictDonut } from "@/components/dashboard/student/VerdictDonut";
import { TopicMasteryList } from "@/components/dashboard/student/TopicMasteryList";
import { RatingBadge } from "@/components/dashboard/student/RatingBadge";
import { ReadinessBreakdown } from "@/components/dashboard/student/ReadinessBreakdown";
import { SubmissionHistoryList } from "@/components/dashboard/student/SubmissionHistoryList";
import { CodeViewModal, type CodeViewData } from "@/components/dashboard/CodeViewModal";
import { cn, withMinDelay } from "@/lib/utils";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { useMyStats } from "@/lib/useMyStats";
import { api, ApiError } from "@/lib/api";
import { RatingHistoryPoint } from "@/types/studentStats";
import type { SubmissionHistoryRow, StudentReportInterview } from "@/types/studentReport";
import type { SoftSkillHistoryEntry } from "@/types/softSkill";

interface ApiDriveSummary {
  company: { name: string };
  role_title: string;
  ctc_range: string | null;
  student_eligibility: { status: "eligible" | "not_eligible" | "unknown" };
}

const INTERVIEW_STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  in_progress: "In Progress",
  completed: "Completed",
};

/** Collapsed default for a catalog-wide list — matches the same instinct as SubmissionHistoryList's internal max-height, just for a flat count instead of a scroll area. */
const TOPIC_MASTERY_COLLAPSED_COUNT = 20;

export default function PerformanceReportPage() {
  const { user, status } = useAuthGuard(["user"]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [ratingHistory, setRatingHistory] = useState<RatingHistoryPoint[]>([]);
  const [drives, setDrives] = useState<ApiDriveSummary[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionHistoryRow[]>([]);
  const [interviews, setInterviews] = useState<StudentReportInterview[]>([]);
  const [softSkills, setSoftSkills] = useState<SoftSkillHistoryEntry[]>([]);
  const [viewingCode, setViewingCode] = useState<CodeViewData | null>(null);
  const [showAllTopics, setShowAllTopics] = useState(false);

  const { stats, loading: statsLoading } = useMyStats(status === "ready");

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    if (status !== "ready") return;
    api
      .get<{ history: RatingHistoryPoint[] }>("/me/rating-history")
      .then((res) => setRatingHistory(res.history))
      .catch(() => setRatingHistory([]));
    api
      .get<{ drives: ApiDriveSummary[] }>("/drives")
      .then((res) => setDrives(res.drives))
      .catch(() => setDrives([]));
    api
      .get<{ submissions: SubmissionHistoryRow[] }>("/submissions")
      .then((res) => setSubmissions(res.submissions))
      .catch(() => setSubmissions([]));
    api
      .get<{ interviews: StudentReportInterview[] }>("/me/interviews")
      .then((res) => setInterviews(res.interviews))
      .catch(() => setInterviews([]));
    api
      .get<{ soft_skills: SoftSkillHistoryEntry[] }>("/me/soft-skills")
      .then((res) => setSoftSkills(res.soft_skills))
      .catch(() => setSoftSkills([]));
  }, [status]);

  // Same instant-open-then-fetch shape as the TPO/Admin/Coordinator report
  // page's openSubmissionCode() — the modal opens immediately with every
  // field the row already carries, and only the code itself (deliberately
  // excluded from Submission::$hidden's default JSON) is fetched separately.
  const openSubmissionCode = async (row: SubmissionHistoryRow) => {
    setViewingCode({
      title: row.problem_title,
      subtitle: row.contest_title ? `${row.contest_title} — contest submission` : "Practice submission",
      language: row.language,
      status: row.status,
      submittedAt: row.submitted_at,
      runtimeMs: row.runtime_ms,
      memoryKb: row.memory_kb,
      code: undefined,
    });

    try {
      const path = row.kind === "practice" ? `/submissions/${row.id}` : `/contest-submissions/${row.id}`;
      const res = await withMinDelay(api.get<{ submission: { code: string | null } }>(path), 350);
      setViewingCode((prev) => (prev ? { ...prev, code: res.submission.code } : prev));
    } catch (err) {
      setViewingCode(null);
      window.alert(err instanceof ApiError ? err.message : "Failed to load submitted code.");
    }
  };

  // Split deliberately: `status !== "ready"` is the shared, app-wide session
  // check (SessionLoader's own docblock) — no user/role known yet, so a
  // bare full-screen loader is correct there, same as everywhere else.
  // But once THAT'S resolved, this page has its own extra data to wait on
  // (useMyStats + 4 more calls above), and blocking the whole shell behind
  // those too made every navigation to this specific page look like a full
  // browser reload — the entire sidebar/header vanish behind that same
  // bare loader, since this app has no persistent layout across /dashboard/*
  // routes (each page mounts DashboardShell itself). Once role/user are
  // known, the shell renders immediately and only the content area waits —
  // exactly the pattern admin/students/report/page.tsx already uses.
  if (status !== "ready") {
    return <SessionLoader />;
  }

  if (statsLoading || !stats) {
    return (
      <DashboardShell role="user" title="Performance Report">
        <div className="flex items-center justify-center gap-2 rounded-panel border border-border-subtle bg-surface p-10 text-xs text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your report...
        </div>
      </DashboardShell>
    );
  }

  const isRated = stats.rating.rated_contests_count > 0;
  const chartData = ratingHistory.map((h) => ({
    contest: h.contest_title,
    date: new Date(h.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    rating: h.rating,
    change: h.change,
    rank: h.rank,
  }));
  const netRating = chartData.reduce((s, p) => s + p.change, 0);

  const totalSubs = stats.verdict_stats.reduce((s, v) => s + v.count, 0);
  const accepted = stats.verdict_stats.find((v) => v.status === "accepted")?.count ?? 0;
  const acceptanceRate = totalSubs > 0 ? Math.round((accepted / totalSubs) * 100) : 0;

  const eligibleCount = drives.filter((d) => d.student_eligibility.status === "eligible").length;

  const visibleTopics = showAllTopics ? stats.topic_mastery : stats.topic_mastery.slice(0, TOPIC_MASTERY_COLLAPSED_COUNT);

  // Simple, real insights generated from the already-fetched topic mastery —
  // no backend round trip needed, and no fabricated strength/focus copy.
  const attempted = stats.topic_mastery.filter((t) => t.solved > 0 || t.total > 0);
  const strongest = [...attempted].filter((t) => t.solved > 0).sort((a, b) => b.accuracy - a.accuracy)[0];
  const weakest = [...attempted].filter((t) => t.solved < t.total).sort((a, b) => a.accuracy - b.accuracy)[0];

  const handleDownload = async () => {
    // jsPDF + autoTable (~300kB) only ever loaded when the student actually
    // clicks Download, not bundled into every visit to this report page.
    const { generateReportPdf } = await import("@/lib/generateReportPdf");
    generateReportPdf({
      studentName: user?.name ?? "Student",
      college: user?.college?.name,
      ratingLabel: stats.rating.display_rating,
      solvedTotal: stats.solved.total_solved,
      streakCurrent: stats.streak.current,
      streakMax: stats.streak.max,
      readinessScore: stats.readiness.score,
      readinessTier: stats.readiness.tier,
      acceptanceRate,
      accepted,
      totalSubmissions: totalSubs,
      verdictStats: stats.verdict_stats,
      languageUsage: stats.language_usage,
      topicMastery: stats.topic_mastery,
      recentSubmissions: stats.recent_submissions,
      driveEligibility: drives.map((d) => ({
        company: d.company.name,
        role: d.role_title,
        ctcRange: d.ctc_range,
        status: d.student_eligibility.status,
      })),
    });
    triggerToast("Your performance report PDF has downloaded.");
  };

  return (
    <DashboardShell
      role="user"
      title="Performance Report"
      subtitle="A full breakdown of your real solved history, accuracy, topic mastery, interview performance and submitted code."
      actionButton={{ label: "Download PDF", icon: Download, onClick: handleDownload }}
    >
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-3 rounded-panel bg-surface border border-accent-primary/40 shadow-card flex items-center gap-3 text-xs font-semibold text-primary max-w-sm"
          >
            <div className="w-2 h-2 rounded-full bg-accent-primary animate-ping shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Acceptance Rate"
          value={`${acceptanceRate}%`}
          icon={Percent}
          tone="success"
          hint={`${accepted} of ${totalSubs} submissions`}
        />
        <StatTile
          label="Problems Solved"
          value={stats.solved.total_solved}
          icon={Trophy}
          tone="primary"
          hint={`${stats.solved.hard.solved} hard problems`}
        />
        <StatTile
          label="Current Streak"
          value={stats.streak.current}
          suffix="days"
          icon={Flame}
          tone="warning"
          hint={`Best: ${stats.streak.max} days`}
        />
        <StatTile
          label="Drives Eligible"
          value={eligibleCount}
          suffix={`/ ${drives.length}`}
          icon={Building2}
          tone="secondary"
          hint="By your academic profile on file"
        />
      </div>

      {/* Readiness breakdown */}
      <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
              <Gauge className="w-4 h-4 text-accent-primary" />
              <span>Placement Readiness</span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              What&apos;s driving your score — and the fastest way to move it.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-black text-primary font-mono leading-none">{stats.readiness.score}%</div>
            <div className="text-3xs uppercase tracking-wider text-text-muted font-semibold mt-1">{stats.readiness.tier}</div>
          </div>
        </div>

        <ReadinessBreakdown components={stats.readiness.components} nextSteps={stats.readiness.next_steps} />
      </section>

      {/* Rating trend */}
      <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2 flex-wrap">
              <Activity className="w-4 h-4 text-accent-primary" />
              <span>Rating Trend</span>
              {isRated && <RatingBadge rating={stats.rating.current_rating} showRating showDivision />}
            </h2>
            {isRated && (
              <p className="text-xs text-text-muted mt-0.5">
                Net change: <strong className={cn(netRating >= 0 ? "text-status-success" : "text-status-danger")}>
                  {netRating >= 0 ? "+" : ""}
                  {netRating}
                </strong>
              </p>
            )}
          </div>
        </div>

        {isRated ? (
          <RatingChart data={chartData} height={280} />
        ) : (
          <p className="text-xs text-text-muted text-center py-10">
            You haven&apos;t entered a rated contest yet — your rating trend will appear here once you do.
          </p>
        )}
      </section>

      {/* Accuracy + languages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-5">
            <BarChart3 className="w-4 h-4 text-accent-primary" />
            <span>Verdict Distribution</span>
          </h2>
          {stats.verdict_stats.length > 0 ? (
            <>
              <VerdictDonut data={stats.verdict_stats} />
              <p className="mt-5 pt-4 border-t border-border-subtle text-2xs text-text-muted">
                Based on all {totalSubs} of your submissions.
              </p>
            </>
          ) : (
            <p className="text-xs text-text-muted text-center py-8">No submissions yet.</p>
          )}
        </section>

        <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-5">
            <Code2 className="w-4 h-4 text-accent-secondary" />
            <span>Language Usage</span>
          </h2>

          {stats.language_usage.length > 0 ? (
            <div className="space-y-4">
              {stats.language_usage.map((lang) => {
                const share = totalSubs > 0 ? Math.round((lang.count / totalSubs) * 100) : 0;
                return (
                  <div key={lang.language} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary font-mono">{lang.language}</span>
                      <span className="text-text-muted font-mono">
                        {lang.count} submissions · {share}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-elevated overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-primary to-accent-secondary transition-all"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-8">No submissions yet.</p>
          )}
        </section>
      </div>

      {/* Topic mastery full */}
      <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
              <Target className="w-4 h-4 text-accent-primary" />
              <span>Topic Mastery</span>
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Accuracy and coverage across every algorithmic category in the catalog.</p>
          </div>
        </div>

        {stats.topic_mastery.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
              <TopicMasteryList topics={visibleTopics.slice(0, Math.ceil(visibleTopics.length / 2))} />
              <TopicMasteryList topics={visibleTopics.slice(Math.ceil(visibleTopics.length / 2))} />
            </div>
            {stats.topic_mastery.length > TOPIC_MASTERY_COLLAPSED_COUNT && (
              <button
                onClick={() => setShowAllTopics((v) => !v)}
                className="mt-5 w-full py-2 rounded-btn bg-elevated hover:bg-surface-hover border border-border-subtle text-xs font-bold text-primary transition-colors flex items-center justify-center gap-1.5"
              >
                <span>{showAllTopics ? "Show Less" : `See All ${stats.topic_mastery.length} Topics`}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showAllTopics && "rotate-180")} />
              </button>
            )}
          </>
        ) : (
          <p className="text-xs text-text-muted text-center py-8">No problems in the catalog yet.</p>
        )}
      </section>

      {/* Insights — generated from the real topic mastery above, not fabricated copy */}
      {(strongest || weakest) && (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {strongest && (
            <div className="p-5 sm:p-6 rounded-panel bg-surface border border-status-success/25 shadow-subtle">
              <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-status-success" />
                <span>What&apos;s Working</span>
              </h2>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-primary">{strongest.topic}</div>
                  <p className="text-2xs text-text-secondary leading-relaxed mt-0.5">
                    {strongest.accuracy}% accuracy, {strongest.solved}/{strongest.total} solved — your strongest topic so far.
                  </p>
                </div>
              </div>
            </div>
          )}

          {weakest && (
            <div className="p-5 sm:p-6 rounded-panel bg-surface border border-status-warning/25 shadow-subtle">
              <h2 className="font-bold text-sm text-primary flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-status-warning" />
                <span>Where To Focus</span>
              </h2>
              <div className="flex items-start gap-2.5">
                <Target className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-primary">{weakest.topic}</div>
                  <p className="text-2xs text-text-secondary leading-relaxed mt-0.5">
                    {weakest.accuracy}% accuracy, {weakest.solved}/{weakest.total} solved — worth extra practice here.
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Interview performance — every interview invited to or taken, with
          the score the plain /interviews list deliberately never shows (see
          InterviewController::history()'s docblock). Each row links straight
          into the existing per-interview page, which already renders the
          full question-by-question transcript once completed — no separate
          transcript UI duplicated here. */}
      <section className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3 sm:px-5">
          <Mic className="h-4 w-4 text-accent-primary" />
          <h2 className="text-sm font-bold text-primary">Interview Performance</h2>
          <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-3xs font-bold text-text-muted">{interviews.length}</span>
        </div>

        {interviews.length === 0 ? (
          <p className="px-4 py-6 text-center text-2xs text-text-muted sm:px-5">You haven&apos;t taken any interview yet.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {interviews.map((iv) => (
              <Link
                key={iv.session_id}
                href={`/dashboard/interviews/view?slug=${iv.slug}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/60 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-primary">{iv.title}</p>
                  <p className="mt-0.5 text-3xs text-text-muted">
                    {INTERVIEW_STATUS_LABEL[iv.status] ?? iv.status}
                    {iv.round_name ? ` · ${iv.round_name}` : ""}
                    {iv.company_name ? ` · ${iv.company_name}` : ""}
                    {iv.question_count > 0 && ` · ${iv.answered_count}/${iv.question_count} answered`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {iv.has_score ? (
                    <p className="font-mono text-xs font-bold text-primary">{iv.composite_score_percent}%</p>
                  ) : iv.status === "completed" ? (
                    <p className="text-3xs text-text-muted">Awaiting score</p>
                  ) : (
                    <p className="text-3xs text-text-muted">{INTERVIEW_STATUS_LABEL[iv.status] ?? iv.status}</p>
                  )}
                  <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Soft Skills performance — every completed aptitude/reasoning/
          English/situational-judgment attempt, most recent first. Mirrors
          the Interview Performance section above exactly; each row links
          into the same per-attempt review screen the student sees right
          after finishing (question-by-question, with explanations). */}
      <section className="overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle">
        <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3 sm:px-5">
          <Brain className="h-4 w-4 text-accent-primary" />
          <h2 className="text-sm font-bold text-primary">Soft Skills Performance</h2>
          <span className="rounded-full bg-elevated px-2 py-0.5 font-mono text-3xs font-bold text-text-muted">{softSkills.length}</span>
        </div>

        {softSkills.length === 0 ? (
          <p className="px-4 py-6 text-center text-2xs text-text-muted sm:px-5">You haven&apos;t completed a Soft Skills test yet.</p>
        ) : (
          <div className="divide-y divide-border-subtle">
            {softSkills.map((s) => (
              <Link
                key={s.session_id}
                href={`/dashboard/soft-skills/view?sessionId=${s.session_id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/60 sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-primary">{s.title}</p>
                  <p className="mt-0.5 text-3xs text-text-muted">{new Date(s.completed_at).toLocaleDateString()}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <p className={cn("font-mono text-xs font-bold", s.passed ? "text-status-success" : "text-primary")}>
                    {Math.round(s.score_percent)}%
                  </p>
                  <ChevronRight className="h-3.5 w-3.5 text-text-muted" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Every practice + contest submission you've ever made, and the
          actual code behind any of them — the same detailed view a TPO/
          coordinator/Mellow staff member sees when looking at your report,
          just for yourself. See SubmissionHistoryList's docblock. */}
      <SubmissionHistoryList submissions={submissions} onOpenCode={openSubmissionCode} maxHeightClassName="max-h-[640px]" />

      <CodeViewModal data={viewingCode} onClose={() => setViewingCode(null)} />
    </DashboardShell>
  );
}
