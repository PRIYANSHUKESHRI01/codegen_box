"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Mail,
  Phone,
  GraduationCap,
  Trophy,
  Flame,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  Swords,
  Mic,
  Briefcase,
  Code2,
  ChevronDown,
  Loader2,
  FileCode2,
  PlayCircle,
  Building2,
  IndianRupee,
  Hash,
  BookOpen,
  LayoutGrid,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CalendarDays,
  UserX,
  Users,
  Timer,
  TrendingUp,
  TrendingDown,
  Clock,
  Minus,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { AnimatedCounter } from "@/components/ui/AnimatedCounter";
import { ActivityHeatmap } from "@/components/dashboard/student/ActivityHeatmap";
import { CodeViewModal, type CodeViewData } from "@/components/dashboard/CodeViewModal";
import { ReviewSessionsModal } from "@/components/dashboard/interviews/ReviewSessionsModal";
import { SubmissionHistoryList, SOURCE_LABEL, SOURCE_TONE } from "@/components/dashboard/student/SubmissionHistoryList";
import {
  HP_TONES,
  HpAvatar,
  HpCard,
  HpCompanyLogo,
  HpEmptyState,
  HpIconTile,
  HpItem,
  HpPill,
  HpRing,
  HpSectionHeader,
  HpSkeleton,
  HpStagger,
  HpStatCard,
  HpTabs,
  hpBtn,
  hpEase,
  type HpTabItem,
  type HpTone,
} from "@/components/portal/kit";
import { HpFormError } from "@/components/portal/pipeline-kit";
import { ScCollapse, ScDateTile, ScInlineEmpty } from "@/components/portal/screeningKit";
import { HpOverlayPortal } from "@/components/portal/cohortKit";
import { buildActivityWeeks } from "@/lib/activityGrid";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn, withMinDelay } from "@/lib/utils";
import { DRIVE_APPLICATION_STAGES, DRIVE_APPLICATION_STAGE_LABELS, DRIVE_APPLICATION_TERMINAL_STAGES, type DriveApplicationStage } from "@/types/placement";
import type {
  StudentReport,
  ContestParticipantSubmission,
  ContestType,
  StudentReportContest,
  StudentReportDriveApplication,
  StudentReportInterview,
  SubmissionHistoryRow,
} from "@/types/studentReport";

const TIER_STYLE: Record<string, string> = {
  "Placement Ready": "bg-status-success/10 text-status-success border-status-success/25",
  "In Progress": "bg-accent-secondary/10 text-accent-secondary border-accent-secondary/25",
  "Needs Training": "bg-status-warning/10 text-status-warning border-status-warning/25",
};

const VERDICT_TONE: Record<string, string> = {
  accepted: "text-status-success",
  wrong_answer: "text-status-danger",
  runtime_error: "text-status-warning",
  compile_error: "text-status-warning",
};

const VERDICT_LABEL: Record<string, string> = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  runtime_error: "Runtime Error",
  compile_error: "Compile Error",
};

const INTERVIEW_STATUS_LABEL: Record<string, string> = {
  invited: "Invited",
  in_progress: "In Progress",
  completed: "Completed",
};

export default function StudentReportPage() {
  return (
    <Suspense fallback={<SessionLoader />}>
      <StudentReportPageContent />
    </Suspense>
  );
}

function StudentReportPageContent() {
  const { user, status } = useAuthGuard(["admin_tpo", "admin_internal", "superadmin", "section_coordinator"]);
  const searchParams = useSearchParams();
  const studentId = searchParams.get("studentId") ?? "";

  // Three audiences share this one page: a TPO (their own college), a
  // section coordinator (their own section only, narrower than a TPO), and
  // Mellow staff (platform-wide, from Platform Users). Every actual
  // authorization decision is still made server-side per-endpoint — this
  // only decides which base path and which "back" link/shell chrome this
  // viewer sees, and a wrong guess here just 404s against the wrong
  // controller rather than leaking anything.
  const apiBase = user?.role === "admin_tpo" ? "/tpo" : user?.role === "section_coordinator" ? "/coordinator" : "/admin";
  const backHref = user?.role === "admin_tpo" ? "/admin/students" : user?.role === "section_coordinator" ? "/coordinator" : "/admin?view=mellow&tab=users";
  const backLabel =
    user?.role === "admin_tpo" ? "Back to Student Cohort" : user?.role === "section_coordinator" ? "Back to Section Roster" : "Back to Platform Users";
  const shellRole = user?.role ?? "admin_tpo";

  // Only a TPO renders inside the premium College TPO shell (DashboardShell
  // wraps role="admin_tpo" + currentTpoView="tpo" in the .hp-portal canvas),
  // so only a TPO gets the premium report body below. Coordinators and
  // Mellow staff keep the original markup exactly as it was.
  const premium = user?.role === "admin_tpo";

  /**
   * Whether THIS viewer can open THAT interview's transcript — not a single
   * yes/no, because the backend's own reviewer boundary is per interview
   * type, not per role (see TpoInterviewController/AdminInterviewController):
   *
   *   - A TPO reviews only their own college's `tpo_mock` interviews.
   *   - Admin/Mellow reviews every OTHER type (general/company/daily/
   *     talent_pool) — explicitly NOT `tpo_mock` (owned by the college) or
   *     `company_hiring` (owned by the hiring company) — see
   *     AdminInterviewController::guardManagedElsewhere().
   *   - `company_hiring` has no reviewer path from this page at all: only
   *     the hiring company's own CompanyInterviewController can open it, a
   *     different role/auth context entirely. Not a gap — a real boundary.
   *   - A section coordinator has never had transcript-review capability
   *     anywhere in this app; this page doesn't newly grant it.
   *
   * Getting this wrong doesn't leak anything (the endpoint 404s/403s
   * either way), but it silently opened an empty "No candidates yet" modal
   * for the one case this used to get wrong — a real find, not a guess.
   */
  const canReviewInterview = (interviewType: string): boolean => {
    if (user?.role === "admin_tpo") return interviewType === "tpo_mock";
    if (user?.role === "admin_internal" || user?.role === "superadmin") {
      return interviewType !== "tpo_mock" && interviewType !== "company_hiring";
    }
    return false;
  };

  const [report, setReport] = useState<StudentReport | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "not_found">("loading");

  const [viewingCode, setViewingCode] = useState<CodeViewData | null>(null);

  const [viewingInterview, setViewingInterview] = useState<{ basePath: string; slug: string; title: string; sessionId: number } | null>(null);

  const [expandedContestId, setExpandedContestId] = useState<number | null>(null);
  const [contestSubmissions, setContestSubmissions] = useState<Record<number, ContestParticipantSubmission[] | "loading" | "error">>({});

  useEffect(() => {
    if (status !== "ready" || !studentId) return;
    let cancelled = false;
    setLoadState("loading");

    api
      .get<StudentReport>(`${apiBase}/students/${studentId}/report`)
      .then((res) => {
        if (!cancelled) {
          setReport(res);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("not_found");
      });

    return () => {
      cancelled = true;
    };
  }, [status, studentId, apiBase]);

  const activityWeeks = useMemo(() => buildActivityWeeks(report?.activity ?? []), [report]);

  if (status !== "ready") return <SessionLoader />;

  // Contest route-model-binding resolves by SLUG, not id (Contest::getRouteKeyName())
  // — every other contest endpoint in this app is already addressed that
  // way (see mock-contests/page.tsx). `contestId` still keys the local
  // expanded/cache state, since that's an internal dictionary key with no
  // bearing on the URL.
  const toggleContest = async (contestId: number, contestSlug: string) => {
    if (expandedContestId === contestId) {
      setExpandedContestId(null);
      return;
    }
    setExpandedContestId(contestId);
    if (contestSubmissions[contestId] && contestSubmissions[contestId] !== "error") return;

    setContestSubmissions((prev) => ({ ...prev, [contestId]: "loading" }));
    try {
      const res = await api.get<{ submissions: ContestParticipantSubmission[] }>(
        `${apiBase}/contests/${contestSlug}/participants/${studentId}/submissions`
      );
      setContestSubmissions((prev) => ({ ...prev, [contestId]: res.submissions }));
    } catch {
      setContestSubmissions((prev) => ({ ...prev, [contestId]: "error" }));
    }
  };

  // One entry point for both halves of the unified submission list — `kind`
  // (set by StudentReportService::submissionHistory()) is what tells this
  // which of the two, differently-shaped code-view endpoints to call.
  //
  // The modal opens IMMEDIATELY, in the same tick as the click, with every
  // field this row already carries (title, language, verdict, timestamps —
  // the list payload has all of it) and `code: undefined`. Only the code
  // itself is unknown yet, so that's the only part of the freshly-opened
  // card that shows a loading state while the real fetch — floored at
  // 350ms via withMinDelay so it never flickers open and shut on a fast
  // connection — brings back the one field that's deliberately kept out of
  // every list response (see ContestReportService::participantSubmissions()
  // and Submission::$hidden).
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
      const path =
        row.kind === "practice"
          ? `${apiBase}/students/${studentId}/submissions/${row.id}`
          : `${apiBase}/students/${studentId}/contest-submissions/${row.id}`;
      const res = await withMinDelay(api.get<{ submission: { code: string | null } }>(path), 350);
      setViewingCode((prev) => (prev ? { ...prev, code: res.submission.code } : prev));
    } catch (err) {
      setViewingCode(null);
      window.alert(err instanceof ApiError ? err.message : "Failed to load submitted code.");
    }
  };

  /** Same instant-open-then-fetch shape as openSubmissionCode(), for a row inside one expanded contest's own submission list (which never carries `code` — see ContestReportService::participantSubmissions()). */
  const openContestSubmissionCode = async (s: ContestParticipantSubmission, contestTitle: string) => {
    setViewingCode({
      title: s.problem_title,
      subtitle: `${contestTitle} — contest submission`,
      language: s.language,
      status: s.status,
      submittedAt: s.submitted_at,
      code: undefined,
    });

    try {
      const res = await withMinDelay(
        api.get<{ submission: { code: string | null } }>(`${apiBase}/students/${studentId}/contest-submissions/${s.id}`),
        350
      );
      setViewingCode((prev) => (prev ? { ...prev, code: res.submission.code } : prev));
    } catch (err) {
      setViewingCode(null);
      window.alert(err instanceof ApiError ? err.message : "Failed to load submitted code.");
    }
  };

  const reviewInterview = (iv: StudentReportInterview) =>
    setViewingInterview({
      // The one interview type a TPO can open (tpo_mock) is exactly the one
      // type Admin is guarded OUT of, and vice versa for every other type —
      // so the reviewer base path is the INTERVIEW's own type, never just
      // "whatever apiBase this viewer uses for their own student-report
      // calls".
      basePath: iv.interview_type === "tpo_mock" ? "/tpo/interviews" : "/admin/interviews",
      slug: iv.slug,
      title: iv.title,
      sessionId: iv.session_id,
    });

  const codeModal = <CodeViewModal data={viewingCode} onClose={() => setViewingCode(null)} />;
  const reviewModal = viewingInterview && (
    <ReviewSessionsModal
      basePath={viewingInterview.basePath}
      listEndpoint="sessions"
      interviewSlug={viewingInterview.slug}
      interviewTitle={viewingInterview.title}
      initialSessionId={viewingInterview.sessionId}
      onClose={() => setViewingInterview(null)}
    />
  );

  return (
    <DashboardShell
      role={shellRole}
      currentTpoView={user?.role === "admin_tpo" ? "tpo" : undefined}
      title={report?.student.name ?? "Student Report"}
      subtitle={
        premium
          ? // Roll / branch / section live in the identity hero's chips for a
            // TPO, so the heading carries what the page is instead.
            "One student's complete placement picture — readiness, practice, contests, interviews, drives and the code behind every submission."
          : report
          ? [report.student.roll_number ?? "No roll number", report.student.branch, report.student.section && `Sec ${report.student.section}`]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
    >
      {premium ? (
        <PremiumReport
          report={report}
          view={!studentId ? "missing" : loadState}
          backHref={backHref}
          backLabel={backLabel}
          activityWeeks={activityWeeks}
          expandedContestId={expandedContestId}
          contestSubmissions={contestSubmissions}
          onToggleContest={toggleContest}
          onOpenContestSubmissionCode={openContestSubmissionCode}
          onOpenSubmissionCode={openSubmissionCode}
          canReviewInterview={canReviewInterview}
          onReviewInterview={reviewInterview}
        />
      ) : (
      <div className="space-y-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-2xs font-bold text-text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{backLabel}</span>
        </Link>

        {loadState === "loading" && (
          <div className="flex items-center justify-center gap-2 rounded-panel border border-border-subtle bg-surface p-10 text-xs text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading student report...
          </div>
        )}

        {loadState === "not_found" && (
          <div className="rounded-panel border border-border-subtle bg-surface p-10 text-center text-xs text-text-muted">
            This student couldn&apos;t be found, or isn&apos;t in your {user?.role === "section_coordinator" ? "section" : "cohort"}.
          </div>
        )}

        {loadState === "ready" && report && (
          <>
            {/* Contact + account status — the name/roll/branch/section this
                card used to repeat now lives in the page heading above (see
                the `title`/`subtitle` passed to DashboardShell), so this
                stays to what the heading can't carry. */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle sm:p-5">
              <div className="flex flex-wrap items-center gap-4 text-2xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-text-muted" />
                  {report.student.email}
                </span>
                {report.student.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-text-muted" />
                    {report.student.phone}
                  </span>
                )}
                {report.student.cgpa && (
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-text-muted" />
                    CGPA {report.student.cgpa}
                  </span>
                )}
              </div>

              <span
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-3xs font-bold uppercase tracking-wide",
                  report.student.is_blocked
                    ? "border-status-danger/25 bg-status-danger/10 text-status-danger"
                    : "border-status-success/25 bg-status-success/10 text-status-success"
                )}
              >
                {report.student.is_blocked ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                {report.student.is_blocked ? "Blocked" : "Active"}
              </span>
            </div>

            {/* Stat strip */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <ReportStat
                icon={Trophy}
                tone="primary"
                label="Rating"
                value={report.rating.display_rating}
                hint={report.rating.rated_contests_count > 0 ? `${report.rating.rated_contests_count} rated contests` : "Never entered a rated contest"}
              />
              <ReportStat
                icon={Gauge}
                tone="secondary"
                label="Readiness"
                value={`${report.readiness.score}%`}
                hint={report.readiness.tier}
              />
              <ReportStat
                icon={Code2}
                tone="success"
                label="Problems Solved"
                value={report.solved.total_solved}
                hint={`${report.solved.hard.solved} hard problems cracked`}
              />
              <ReportStat
                icon={Flame}
                tone="warning"
                label="Current Streak"
                value={`${report.streak.current}d`}
                hint={`Personal best: ${report.streak.max} days`}
              />
            </div>

            {/* Activity calendar — a day at count 0 is exactly an absent day;
                hover any cell for the exact count (see ActivityHeatmap). */}
            <div className="rounded-panel border border-border-subtle bg-surface p-5 shadow-subtle sm:p-6">
              <h2 className="mb-4 text-sm font-bold text-primary">Daily Activity</h2>
              <ActivityHeatmap weeks={activityWeeks} />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Contests */}
              <ReportSection icon={Swords} title="Contest History" count={report.contests.length}>
                {report.contests.length === 0 ? (
                  <EmptyRow>Hasn&apos;t entered any contest yet.</EmptyRow>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {report.contests.map((c) => {
                      const ratingChanged = c.rating_before !== null && c.rating_after !== null;
                      const ratingDelta = ratingChanged ? c.rating_after! - c.rating_before! : 0;
                      return (
                        <div key={c.contest_id}>
                          <button
                            onClick={() => toggleContest(c.contest_id, c.slug)}
                            className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover/60 sm:px-5"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="truncate text-xs font-bold text-primary">{c.title}</p>
                                <span
                                  className={cn(
                                    "shrink-0 rounded-full border px-1.5 py-0 text-3xs font-bold uppercase tracking-wide",
                                    SOURCE_TONE[c.contest_type]
                                  )}
                                >
                                  {SOURCE_LABEL[c.contest_type]}
                                </span>
                              </div>
                              <p className="mt-1 text-3xs text-text-muted">
                                {new Date(c.start_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                {" · "}
                                {c.problems_solved}/{c.problem_count} solved
                                {c.total_points_possible > 0 && ` of ${c.total_points_possible} pts`}
                                {c.penalty_minutes ? ` · +${c.penalty_minutes}m penalty` : ""}
                              </p>
                              {ratingChanged && (
                                <p className="mt-0.5 flex items-center gap-1 font-mono text-3xs">
                                  <span className="text-text-muted">{c.rating_before}</span>
                                  <span className="text-text-muted">→</span>
                                  <span className="font-bold text-primary">{c.rating_after}</span>
                                  <span className={cn("font-bold", ratingDelta >= 0 ? "text-status-success" : "text-status-danger")}>
                                    ({ratingDelta >= 0 ? "+" : ""}
                                    {ratingDelta})
                                  </span>
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <div className="text-right">
                                <p className="font-mono text-xs font-bold text-primary">{c.rank ? `#${c.rank}` : "Unranked"}</p>
                                <p className="font-mono text-3xs text-text-muted">{c.score ?? 0} pts</p>
                              </div>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 text-text-muted transition-transform",
                                  expandedContestId === c.contest_id && "rotate-180"
                                )}
                              />
                            </div>
                          </button>

                          {expandedContestId === c.contest_id && (
                            <div className="bg-elevated/40 px-4 py-3 sm:px-5">
                              {contestSubmissions[c.contest_id] === "loading" ? (
                                <div className="flex items-center gap-2 py-2 text-3xs text-text-muted">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Loading submissions...
                                </div>
                              ) : contestSubmissions[c.contest_id] === "error" ? (
                                <p className="py-2 text-3xs text-status-danger">Failed to load submissions.</p>
                              ) : (contestSubmissions[c.contest_id] as ContestParticipantSubmission[] | undefined)?.length ? (
                                <ul className="space-y-1.5">
                                  {(contestSubmissions[c.contest_id] as ContestParticipantSubmission[]).map((s) => (
                                    <li key={s.id} className="flex items-center justify-between gap-2 text-3xs">
                                      <span className="truncate text-text-secondary">{s.problem_title}</span>
                                      <div className="flex shrink-0 items-center gap-2">
                                        <span className={cn("font-bold", VERDICT_TONE[s.status] ?? "text-text-muted")}>
                                          {VERDICT_LABEL[s.status] ?? s.status}
                                        </span>
                                        <button
                                          onClick={() => openContestSubmissionCode(s, c.title)}
                                          className="flex items-center gap-1 rounded border border-border-subtle bg-surface px-1.5 py-0.5 font-bold text-text-secondary transition-colors hover:text-primary active:scale-95"
                                        >
                                          <FileCode2 className="h-3 w-3" />
                                          Code
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="py-2 text-3xs text-text-muted">No submissions in this contest.</p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ReportSection>

              {/* Mock interviews */}
              <ReportSection icon={Mic} title="Mock Interviews" count={report.interviews.length}>
                {report.interviews.length === 0 ? (
                  <EmptyRow>Hasn&apos;t taken any mock interview yet.</EmptyRow>
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {report.interviews.map((iv) => (
                      <div key={iv.session_id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
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
                          <div className="text-right">
                            {iv.has_score ? (
                              <p className="font-mono text-xs font-bold text-primary">{iv.composite_score_percent}%</p>
                            ) : (
                              <p className="text-3xs text-text-muted">Awaiting score</p>
                            )}
                          </div>
                          {canReviewInterview(iv.interview_type) && iv.status !== "invited" && (
                            <button
                              onClick={() => reviewInterview(iv)}
                              title="View full transcript"
                              aria-label="View full transcript"
                              className="flex h-7 w-7 items-center justify-center rounded-control border border-border-subtle bg-elevated text-text-secondary transition-colors hover:text-primary"
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ReportSection>
            </div>

            {/* Placement drives — full width: company + role + CTC needs the
                horizontal room a half-width card doesn't have. */}
            <ReportSection icon={Briefcase} title="Placement Drives" count={report.drive_applications.length} fullWidth>
              {report.drive_applications.length === 0 ? (
                <EmptyRow>Not registered for any placement drive yet.</EmptyRow>
              ) : (
                <div className="divide-y divide-border-subtle">
                  {report.drive_applications.map((d) => (
                    <div key={d.application_id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-primary">{d.drive_title}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-3xs text-text-muted">
                          {d.company_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {d.company_name}
                            </span>
                          )}
                          {d.role_title && <span>{d.role_title}</span>}
                          {(d.ctc_offered ?? d.ctc_range) && (
                            <span className="flex items-center gap-1">
                              <IndianRupee className="h-3 w-3" />
                              {d.ctc_offered ? `${d.ctc_offered} LPA offered` : d.ctc_range}
                            </span>
                          )}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-3xs font-bold",
                          DRIVE_APPLICATION_TERMINAL_STAGES.includes(d.stage)
                            ? d.stage === "offer_accepted"
                              ? "bg-status-success/15 text-status-success"
                              : "bg-status-danger/15 text-status-danger"
                            : "bg-accent-secondary/15 text-accent-secondary"
                        )}
                      >
                        {DRIVE_APPLICATION_STAGE_LABELS[d.stage]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </ReportSection>

            {/* Unified submission history — every practice AND contest
                attempt in one list, filterable by where it came from. This
                used to be two disconnected views: a practice-only list here,
                and a contest's submissions only reachable by expanding that
                one contest above. Shared with the student's own
                dashboard/reports page — see SubmissionHistoryList's docblock. */}
            <SubmissionHistoryList submissions={report.submissions} onOpenCode={openSubmissionCode} />
          </>
        )}
      </div>
      )}

      {/* The premium shell lifts <main> onto its own stacking layer (see
          HpOverlayPortal), so for a TPO the two shared modals are re-parented
          onto <body> to clear the sticky header and sidebar rail. Same
          components, same props — only where they mount changes. */}
      {premium ? (
        <HpOverlayPortal>
          {codeModal}
          {reviewModal}
        </HpOverlayPortal>
      ) : (
        <>
          {codeModal}
          {reviewModal}
        </>
      )}
    </DashboardShell>
  );
}

function ReportStat({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof Trophy;
  tone: "primary" | "secondary" | "success" | "warning";
  label: string;
  value: string | number;
  hint: string;
}) {
  const TONE: Record<string, string> = {
    primary: "bg-accent-primary/10 text-accent-primary",
    secondary: "bg-accent-secondary/10 text-accent-secondary",
    success: "bg-status-success/10 text-status-success",
    warning: "bg-status-warning/10 text-status-warning",
  };
  return (
    <div className="rounded-panel border border-border-subtle bg-surface p-4 shadow-subtle sm:p-5">
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]", TONE[tone])}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="text-3xs font-bold uppercase tracking-wide text-text-muted">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-black leading-none text-primary">{value}</p>
      <p className="mt-1.5 text-3xs text-text-muted">{hint}</p>
    </div>
  );
}

function ReportSection({
  icon: Icon,
  title,
  count,
  fullWidth = false,
  children,
}: {
  icon: typeof Trophy;
  title: string;
  count: number;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-panel border border-border-subtle bg-surface shadow-subtle",
        !fullWidth && "max-h-[420px]"
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle px-4 py-3 sm:px-5">
        <Icon className="h-4 w-4 text-accent-primary" />
        <h2 className="text-sm font-bold text-primary">{title}</h2>
        <span className="ml-auto rounded-full bg-elevated px-2 py-0.5 font-mono text-3xs font-bold text-text-muted">{count}</span>
      </div>
      {/* A fixed max-height + internal scroll on the half-width cards, not
          an unbounded list — a student with many rows was stretching one
          card to several times the height of its neighbour, throwing the
          two-column grid visibly off balance. Full-width sections (drives,
          submission history) manage their own scroll instead. */}
      <div className={cn(!fullWidth && "flex-1 overflow-y-auto")}>{children}</div>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-2xs text-text-muted sm:px-5">{children}</p>;
}

/* ══════════════════════════════════════════════════════════════════════════
   Premium (College TPO) report — presentation only. Every handler, fetch and
   permission decision is owned by StudentReportPageContent above and passed
   straight through; nothing here talks to the API or holds report data.
   ══════════════════════════════════════════════════════════════════════════ */

type ReportReadiness = StudentReport["readiness"];
type SubmissionSource = "practice" | ContestType;
type PremiumView = "loading" | "ready" | "not_found" | "missing";

/** Tier → tone: emerald only for the positive outcome, sky (the TPO identity) for in-flight, amber for attention. */
const PREMIUM_TIER_TONE: Record<ReportReadiness["tier"], HpTone> = {
  "Placement Ready": "emerald",
  "In Progress": "sky",
  "Needs Training": "amber",
};

/** Same 75 / 45 cut-offs the Student Cohort roster uses for its readiness meters. */
const scoreTone = (score: number): HpTone => (score >= 75 ? "emerald" : score >= 45 ? "sky" : "amber");

/** Where an attempt came from: sky = the college's own mock contests, teal = company-run (hiring identity). */
const SOURCE_HP_TONE: Record<SubmissionSource, HpTone> = {
  practice: "slate",
  tpo_mock: "sky",
  daily: "violet",
  general: "indigo",
  company: "teal",
  company_hiring: "teal",
  talent_pool: "amber",
};

const VERDICT_PILL: Record<string, { tone: HpTone; icon: LucideIcon }> = {
  accepted: { tone: "emerald", icon: CheckCircle2 },
  wrong_answer: { tone: "rose", icon: XCircle },
  runtime_error: { tone: "amber", icon: AlertTriangle },
  compile_error: { tone: "amber", icon: AlertTriangle },
};

const verdictLabel = (status: string) => VERDICT_LABEL[status] ?? status.replace(/_/g, " ");

const DIFFICULTY_META: Record<string, { letter: string; short: string; label: string; tone: HpTone }> = {
  easy: { letter: "E", short: "easy", label: "Easy", tone: "emerald" },
  medium: { letter: "M", short: "med", label: "Medium", tone: "amber" },
  hard: { letter: "H", short: "hard", label: "Hard", tone: "rose" },
};

const INTERVIEW_STATUS_PILL: Record<StudentReportInterview["status"], { tone: HpTone; icon?: LucideIcon; live?: boolean }> = {
  invited: { tone: "slate", icon: Mail },
  in_progress: { tone: "sky", live: true },
  completed: { tone: "emerald", icon: CheckCircle2 },
};

/** The forward path a drive application moves along — every stage except the two drop-outs. */
const DRIVE_PIPELINE: DriveApplicationStage[] = DRIVE_APPLICATION_STAGES.filter((s) => s !== "rejected" && s !== "withdrawn");

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const plural = (n: number, word: string, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

interface PremiumReportProps {
  report: StudentReport | null;
  view: PremiumView;
  backHref: string;
  backLabel: string;
  activityWeeks: ReturnType<typeof buildActivityWeeks>;
  expandedContestId: number | null;
  contestSubmissions: Record<number, ContestParticipantSubmission[] | "loading" | "error">;
  onToggleContest: (contestId: number, contestSlug: string) => void;
  onOpenContestSubmissionCode: (s: ContestParticipantSubmission, contestTitle: string) => void;
  onOpenSubmissionCode: (row: SubmissionHistoryRow) => void;
  canReviewInterview: (interviewType: string) => boolean;
  onReviewInterview: (iv: StudentReportInterview) => void;
}

function PremiumReport({
  report,
  view,
  backHref,
  backLabel,
  activityWeeks,
  expandedContestId,
  contestSubmissions,
  onToggleContest,
  onOpenContestSubmissionCode,
  onOpenSubmissionCode,
  canReviewInterview,
  onReviewInterview,
}: PremiumReportProps) {
  return (
    <div className="space-y-6">
      <Link href={backHref} className={hpBtn("ghost", "sm", "group -ml-2")}>
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden />
        {backLabel}
      </Link>

      {/* Keyed on the view so the ready report staggers in fresh once the
          skeleton resolves, instead of every section popping in at once. */}
      <HpStagger key={view} className="space-y-6">
        {view === "loading" && (
          <HpItem>
            <PremiumReportSkeleton />
          </HpItem>
        )}

        {(view === "not_found" || view === "missing") && (
          <HpItem>
            <HpEmptyState
              icon={UserX}
              tone="sky"
              title={view === "missing" ? "No student selected" : "Student not found"}
              description={
                view === "missing"
                  ? "Open a report from the Student Cohort to see one student's full activity."
                  : "This student couldn't be found, or isn't in your cohort."
              }
              action={
                <Link href={backHref} className={hpBtn("primary", "md")}>
                  <Users className="h-4 w-4" aria-hidden />
                  Open Student Cohort
                </Link>
              }
            />
          </HpItem>
        )}

        {view === "ready" && report && (
          <>
            <HpItem>
              <IdentityHero report={report} />
            </HpItem>

            <HpItem>
              <PremiumStats report={report} />
            </HpItem>

            {(report.readiness.components ?? []).length > 0 && (
              <HpItem>
                <ReadinessBreakdown readiness={report.readiness} />
              </HpItem>
            )}

            <HpItem>
              <ActivityPanel weeks={activityWeeks} solved={report.solved} />
            </HpItem>

            <HpItem>
              <ContestHistoryPanel
                contests={report.contests}
                expandedContestId={expandedContestId}
                contestSubmissions={contestSubmissions}
                onToggle={onToggleContest}
                onOpenCode={onOpenContestSubmissionCode}
              />
            </HpItem>

            <HpItem>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <InterviewsPanel interviews={report.interviews} canReview={canReviewInterview} onReview={onReviewInterview} />
                <DrivesPanel drives={report.drive_applications} />
              </div>
            </HpItem>

            <HpItem>
              <PremiumSubmissionHistory submissions={report.submissions} onOpenCode={onOpenSubmissionCode} />
            </HpItem>
          </>
        )}
      </HpStagger>
    </div>
  );
}

/* ── Identity hero ──────────────────────────────────────────────────────── */

function IdentityHero({ report }: { report: StudentReport }) {
  const s = report.student;
  const tier = report.readiness.tier;
  const jumps: { href: string; label: string; value: number; icon: LucideIcon; tone: HpTone }[] = [
    { href: "#report-contests", label: "Contests", value: report.contests.length, icon: Swords, tone: "indigo" },
    { href: "#report-interviews", label: "Interviews", value: report.interviews.length, icon: Mic, tone: "violet" },
    { href: "#report-drives", label: "Drives", value: report.drive_applications.length, icon: Briefcase, tone: "sky" },
    { href: "#report-submissions", label: "Submissions", value: report.submissions.length, icon: Code2, tone: "teal" },
  ];

  return (
    <section
      aria-label="Student profile"
      className="hp-gborder relative overflow-hidden rounded-[24px] border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] shadow-[var(--hp-edge),var(--hp-shadow)]"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_0%,rgba(99,102,241,0.12),transparent_60%),radial-gradient(60%_110%_at_100%_0%,rgb(var(--hp-id)/0.16),transparent_60%)]" />
        <div className="hp-dots absolute inset-0 opacity-40 [mask-image:radial-gradient(60%_90%_at_85%_0%,#000,transparent)]" />
        <div className="hp-drift absolute -right-16 -top-20 h-64 w-64 rounded-full bg-gradient-to-br from-[rgb(var(--hp-id)/0.26)] to-[rgb(var(--hp-id2)/0.10)] blur-3xl" />
        <div className="hp-drift absolute -left-20 bottom-[-7rem] h-64 w-64 rounded-full bg-gradient-to-tr from-indigo-500/15 to-violet-500/10 blur-3xl [animation-delay:-4s]" />
      </div>

      <div className="relative z-10 p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <span className="relative shrink-0">
              <HpAvatar name={s.name} size="lg" className="h-16 w-16 text-lg sm:h-[72px] sm:w-[72px] sm:text-xl" />
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-0.5 right-0.5 h-4 w-4 rounded-full border-[3px] border-[rgb(var(--bg-surface-rgb))]",
                  s.is_blocked ? "bg-rose-500" : "bg-emerald-500"
                )}
              />
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-3xs font-bold uppercase tracking-[0.14em] text-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--hp-id))]" aria-hidden />
                Student profile
              </p>

              <ul aria-label="Academic details" className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <li className="min-w-0 max-w-full">
                  <IdChip icon={Hash} mono muted={!s.roll_number} label="Roll number">
                    {s.roll_number ?? "No roll number"}
                  </IdChip>
                </li>
                <li className="min-w-0 max-w-full">
                  <IdChip icon={BookOpen} tone="sky" muted={!s.branch} label="Branch">
                    {s.branch ?? "No branch on file"}
                  </IdChip>
                </li>
                <li className="min-w-0 max-w-full">
                  <IdChip icon={LayoutGrid} muted={!s.section} label="Section">
                    {s.section ? `Section ${s.section}` : "No section"}
                  </IdChip>
                </li>
                <li className="min-w-0 max-w-full">
                  <IdChip icon={GraduationCap} muted={!s.cgpa} label="CGPA">
                    {s.cgpa ? (
                      <>
                        CGPA <span className="tabular font-extrabold text-primary">{s.cgpa}</span>
                      </>
                    ) : (
                      "No CGPA on file"
                    )}
                  </IdChip>
                </li>
                {s.backlogs !== null && (
                  <li className="min-w-0 max-w-full">
                    <IdChip icon={s.backlogs > 0 ? AlertTriangle : CheckCircle2} tone={s.backlogs > 0 ? "amber" : "emerald"} label="Active backlogs">
                      {s.backlogs > 0 ? plural(s.backlogs, "active backlog") : "No backlogs"}
                    </IdChip>
                  </li>
                )}
              </ul>

              <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5">
                <ContactLink icon={Mail} href={`mailto:${s.email}`} label="Email">
                  {s.email}
                </ContactLink>
                {s.phone ? (
                  <ContactLink icon={Phone} href={`tel:${s.phone}`} label="Phone">
                    {s.phone}
                  </ContactLink>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs italic text-text-muted">
                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    No phone on file
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-end">
            <HpPill tone={s.is_blocked ? "rose" : "emerald"} icon={s.is_blocked ? ShieldAlert : ShieldCheck}>
              {s.is_blocked ? "Account blocked" : "Account active"}
            </HpPill>
            <HpPill tone={PREMIUM_TIER_TONE[tier]} dot>
              {tier}
            </HpPill>
          </div>
        </div>

        <nav aria-label="Jump to a report section" className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {jumps.map((j) => (
            <a
              key={j.href}
              href={j.href}
              className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))]/70 px-3 py-2.5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/30 hover:shadow-[0_10px_24px_-14px_rgba(79,70,229,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <HpIconTile icon={j.icon} tone={j.tone} size="sm" className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110" />
              <span className="min-w-0">
                <span className="tabular block text-lg font-extrabold leading-none tracking-tight text-primary">{j.value}</span>
                <span className="mt-1 block truncate text-3xs font-bold uppercase tracking-[0.08em] text-text-muted">{j.label}</span>
              </span>
            </a>
          ))}
        </nav>
      </div>
    </section>
  );
}

function IdChip({
  icon: Icon,
  tone,
  mono = false,
  muted = false,
  label,
  children,
}: {
  icon: LucideIcon;
  tone?: HpTone;
  mono?: boolean;
  muted?: boolean;
  /** Spoken before the value — the icon alone is decorative. */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-2xs font-semibold ring-1 ring-inset",
        muted
          ? "bg-elevated/60 italic text-text-muted ring-border-subtle"
          : tone
          ? HP_TONES[tone].soft
          : "bg-[rgb(var(--bg-surface-rgb))]/80 text-text-secondary ring-border-subtle",
        mono && !muted && "font-mono"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      <span className="sr-only">{label}: </span>
      <span className="truncate">{children}</span>
    </span>
  );
}

function ContactLink({ icon: Icon, href, label, children }: { icon: LucideIcon; href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md text-xs font-medium text-text-secondary transition-colors hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:text-indigo-300"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted transition-colors group-hover:text-current" aria-hidden />
      <span className="sr-only">{label}: </span>
      <span className="truncate">{children}</span>
    </a>
  );
}

/* ── KPI strip ──────────────────────────────────────────────────────────── */

function PremiumStats({ report }: { report: StudentReport }) {
  const { rating, solved, streak } = report;
  // Contests arrive newest-first (StudentReportService orders by
  // registered_at desc), so the first rated one is the latest rating move.
  const lastRated = report.contests.find((c) => c.rating_before !== null && c.rating_after !== null);
  const lastDelta = lastRated ? lastRated.rating_after! - lastRated.rating_before! : null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <ReadinessStatCard score={report.readiness.score} tier={report.readiness.tier} />
      <HpStatCard
        label="Rating"
        value={rating.rated_contests_count > 0 ? rating.current_rating : "—"}
        icon={Trophy}
        tone="indigo"
        delta={lastDelta !== null ? { label: `${lastDelta > 0 ? "+" : lastDelta < 0 ? "" : "±"}${lastDelta} last`, positive: lastDelta >= 0 } : undefined}
        hint={rating.rated_contests_count > 0 ? plural(rating.rated_contests_count, "rated contest") : "Unrated — no rated contest yet"}
      />
      <HpStatCard
        label="Problems solved"
        value={solved.total_solved}
        icon={Code2}
        tone="sky"
        hint={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <span key={d} className="tabular inline-flex items-center gap-1" title={`${solved[d].solved} of ${solved[d].total} ${d} problems solved`}>
                <span className={cn("h-1.5 w-1.5 rounded-full", HP_TONES[DIFFICULTY_META[d].tone].fill)} aria-hidden />
                {solved[d].solved} {DIFFICULTY_META[d].short}
              </span>
            ))}
          </span>
        }
      />
      <HpStatCard
        label="Current streak"
        value={streak.current}
        suffix="d"
        icon={Flame}
        tone={streak.current > 0 ? "violet" : "slate"}
        hint={`Personal best ${plural(streak.max, "day")}`}
      />
    </div>
  );
}

/** HpStatCard's anatomy, with the readiness ring standing in for the icon tile. */
function ReadinessStatCard({ score, tier }: { score: number; tier: ReportReadiness["tier"] }) {
  const tone = PREMIUM_TIER_TONE[tier];
  return (
    <HpCard interactive className="group p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">Readiness</span>
        <span className="transition-transform duration-300 group-hover:scale-110">
          <HpRing value={score} size={44} stroke={5} tone={tone}>
            <Gauge className={cn("h-4 w-4", HP_TONES[tone].text)} aria-hidden />
          </HpRing>
        </span>
      </div>
      <div className="mt-4">
        <div className="tabular text-[32px] font-extrabold leading-none tracking-tight text-primary">
          <AnimatedCounter target={score} />
          <span className="ml-0.5 text-base font-bold text-text-muted">/100</span>
        </div>
        <div className="mt-2">
          <HpPill tone={tone} dot size="sm">
            {tier}
          </HpPill>
        </div>
      </div>
    </HpCard>
  );
}

/* ── Readiness breakdown ────────────────────────────────────────────────── */

function ReadinessBreakdown({ readiness }: { readiness: ReportReadiness }) {
  const components = readiness.components ?? [];
  const steps = readiness.next_steps ?? [];
  const contribution = (n: number) => Math.round(n * 10) / 10;

  return (
    <HpCard spotlight={false} className="p-4 sm:p-6">
      <HpSectionHeader
        icon={Gauge}
        tone="sky"
        title="Readiness breakdown"
        subtitle="Each signal is scored 0–100, then weighted into the total"
        action={
          <HpPill tone={PREMIUM_TIER_TONE[readiness.tier]} size="sm" className="tabular">
            {readiness.score}/100
          </HpPill>
        }
      />

      <div className={cn("mt-5 grid grid-cols-1 gap-5", steps.length > 0 && "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]")}>
        <ul className="space-y-4">
          {components.map((c) => (
            <li key={c.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-xs font-semibold text-text-secondary">{c.label}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="tabular text-3xs font-semibold text-text-muted">
                    {c.weight_percent}% weight · +{contribution(c.contribution)}
                  </span>
                  <span className="tabular w-8 text-right text-sm font-extrabold text-primary">
                    {c.score}
                    <span className="sr-only"> out of 100</span>
                  </span>
                </span>
              </div>
              <Meter value={c.score} tone={scoreTone(c.score)} />
            </li>
          ))}
        </ul>

        {steps.length > 0 && (
          <div className="rounded-2xl border border-border-subtle bg-elevated/40 p-4">
            <p className="flex items-center gap-1.5 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">
              <Lightbulb className="h-3.5 w-3.5 text-sky-500" aria-hidden />
              Next steps the student sees
            </p>
            <ol className="mt-3 space-y-2.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-2xs leading-relaxed text-text-secondary">
                  <span
                    aria-hidden
                    className="tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-3xs font-bold text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-300"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 pt-px">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </HpCard>
  );
}

/* ── Activity + practice coverage ───────────────────────────────────────── */

function ActivityPanel({ weeks, solved }: { weeks: ReturnType<typeof buildActivityWeeks>; solved: StudentReport["solved"] }) {
  const days = weeks.flat();
  const activeDays = days.filter((d) => d.count > 0).length;
  const total = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <HpCard spotlight={false} className="overflow-hidden">
      <div className="p-4 sm:p-6">
        <HpSectionHeader
          icon={CalendarDays}
          tone="sky"
          title="Daily activity"
          subtitle={`${plural(activeDays, "active day")} · ${plural(total, "submission")} in the past year`}
        />
        {/* A day at count 0 is exactly an absent day; hover or focus any
            cell for the exact count (see ActivityHeatmap). */}
        <div className="mt-5">
          <ActivityHeatmap weeks={weeks} />
        </div>
      </div>

      <div className="border-t border-border-subtle bg-elevated/30 px-4 py-4 sm:px-6">
        <p className="text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">Practice coverage by difficulty</p>
        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-3">
          {(["easy", "medium", "hard"] as const).map((d) => {
            const meta = DIFFICULTY_META[d];
            const { solved: done, total: of } = solved[d];
            return (
              <div key={d} className="min-w-0">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <span className={cn("h-2 w-2 rounded-full", HP_TONES[meta.tone].fill)} aria-hidden />
                    {meta.label}
                  </span>
                  <span className="tabular text-xs font-bold text-primary">
                    {done}
                    <span className="font-semibold text-text-muted"> / {of}</span>
                    <span className="sr-only"> solved</span>
                  </span>
                </div>
                <Meter value={of > 0 ? (done / of) * 100 : 0} tone={meta.tone} />
              </div>
            );
          })}
        </div>
      </div>
    </HpCard>
  );
}

/* ── Contest history ────────────────────────────────────────────────────── */

function ContestHistoryPanel({
  contests,
  expandedContestId,
  contestSubmissions,
  onToggle,
  onOpenCode,
}: {
  contests: StudentReportContest[];
  expandedContestId: number | null;
  contestSubmissions: PremiumReportProps["contestSubmissions"];
  onToggle: PremiumReportProps["onToggleContest"];
  onOpenCode: PremiumReportProps["onOpenContestSubmissionCode"];
}) {
  const ranks = contests.map((c) => c.rank).filter((r): r is number => r !== null);
  const bestRank = ranks.length ? Math.min(...ranks) : null;

  return (
    <HpCard spotlight={false} id="report-contests" className="scroll-mt-24 overflow-hidden">
      <div className="px-4 py-4 sm:px-6">
        <HpSectionHeader
          icon={Swords}
          tone="indigo"
          title="Contest history"
          subtitle={
            contests.length
              ? `${plural(contests.length, "contest")} entered${bestRank !== null ? ` · best rank #${bestRank}` : ""}`
              : "Every contest this student registers for shows up here"
          }
          action={<CountBadge value={contests.length} />}
        />
      </div>

      {contests.length === 0 ? (
        <div className="px-4 pb-5 sm:px-6">
          <ScInlineEmpty icon={Swords} tone="indigo" title="No contests yet" description="Hasn't entered any contest yet." />
        </div>
      ) : (
        <ul className="max-h-[680px] divide-y divide-border-subtle overflow-y-auto border-t border-border-subtle">
          {contests.map((c) => (
            <ContestRow
              key={c.contest_id}
              contest={c}
              expanded={expandedContestId === c.contest_id}
              state={contestSubmissions[c.contest_id]}
              onToggle={() => onToggle(c.contest_id, c.slug)}
              onOpenCode={onOpenCode}
            />
          ))}
        </ul>
      )}
    </HpCard>
  );
}

function ContestRow({
  contest: c,
  expanded,
  state,
  onToggle,
  onOpenCode,
}: {
  contest: StudentReportContest;
  expanded: boolean;
  state: ContestParticipantSubmission[] | "loading" | "error" | undefined;
  onToggle: () => void;
  onOpenCode: PremiumReportProps["onOpenContestSubmissionCode"];
}) {
  const panelId = `contest-${c.contest_id}-submissions`;
  const ratingChanged = c.rating_before !== null && c.rating_after !== null;
  const ratingDelta = ratingChanged ? c.rating_after! - c.rating_before! : 0;
  const solvedPct = c.problem_count > 0 ? (c.problems_solved / c.problem_count) * 100 : 0;
  const allSolved = c.problem_count > 0 && c.problems_solved === c.problem_count;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={expanded ? panelId : undefined}
        className={cn(
          "group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 sm:gap-4 sm:px-6",
          expanded ? "bg-indigo-500/[0.045]" : "hover:bg-sky-500/[0.035]"
        )}
      >
        <ScDateTile date={new Date(c.start_at)} tone="sky" className="hidden sm:flex" />

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="min-w-0 max-w-full truncate text-13 font-bold text-primary transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-300">
              {c.title}
            </span>
            <HpPill tone={SOURCE_HP_TONE[c.contest_type]} size="sm">
              {SOURCE_LABEL[c.contest_type]}
            </HpPill>
            {c.is_rated && (
              <HpPill tone="violet" size="sm" icon={Trophy}>
                Rated
              </HpPill>
            )}
          </span>

          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-muted">
            <span className="tabular">{fmtDate(c.start_at)}</span>
            <span className="tabular inline-flex items-center gap-1">
              <CheckCircle2 className={cn("h-3 w-3 shrink-0", allSolved && "text-emerald-500")} aria-hidden />
              {c.problems_solved}/{c.problem_count} solved
            </span>
            {c.penalty_minutes ? (
              <span className="tabular inline-flex items-center gap-1">
                <Timer className="h-3 w-3 shrink-0" aria-hidden />+{c.penalty_minutes}m penalty
              </span>
            ) : null}
            {ratingChanged && (
              <span className="tabular inline-flex items-center gap-1.5 font-mono">
                <span>{c.rating_before}</span>
                <span aria-hidden>→</span>
                <span className="sr-only">to</span>
                <span className="font-bold text-primary">{c.rating_after}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-sans text-3xs font-bold",
                    ratingDelta > 0
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : ratingDelta < 0
                      ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      : "bg-elevated text-text-muted"
                  )}
                >
                  {ratingDelta > 0 ? <TrendingUp className="h-3 w-3" aria-hidden /> : ratingDelta < 0 ? <TrendingDown className="h-3 w-3" aria-hidden /> : null}
                  {ratingDelta > 0 ? "+" : ratingDelta === 0 ? "±" : ""}
                  {ratingDelta}
                </span>
              </span>
            )}
          </span>

          {c.problem_count > 0 && <Meter value={solvedPct} tone={allSolved ? "emerald" : "sky"} className="mt-2 max-w-[240px]" />}
        </span>

        <span className="shrink-0 text-right">
          <span className={cn("tabular block text-sm font-extrabold", c.rank ? "text-primary" : "text-text-muted")}>
            {c.rank ? `#${c.rank}` : "Unranked"}
          </span>
          <span className="tabular mt-0.5 block text-3xs font-semibold text-text-muted">
            {c.score ?? 0}
            {c.total_points_possible > 0 && ` / ${c.total_points_possible}`} pts
          </span>
        </span>

        <span
          aria-hidden
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-[rgb(var(--bg-surface-rgb))] transition-all duration-300",
            expanded
              ? "rotate-180 border-indigo-500/30 text-indigo-600 dark:text-indigo-300"
              : "border-border-subtle text-text-muted group-hover:border-indigo-500/30 group-hover:text-indigo-600 dark:group-hover:text-indigo-300"
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <ScCollapse id={panelId}>
            <ContestSubmissionsPanel state={state} contestTitle={c.title} onOpenCode={onOpenCode} />
          </ScCollapse>
        )}
      </AnimatePresence>
    </li>
  );
}

function ContestSubmissionsPanel({
  state,
  contestTitle,
  onOpenCode,
}: {
  state: ContestParticipantSubmission[] | "loading" | "error" | undefined;
  contestTitle: string;
  onOpenCode: PremiumReportProps["onOpenContestSubmissionCode"];
}) {
  return (
    <div className="border-t border-border-subtle bg-elevated/40 px-4 py-3.5 sm:py-4 sm:pl-[88px] sm:pr-6">
      {state === "loading" || state === undefined ? (
        <div role="status" aria-label="Loading submissions" className="space-y-1.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-3 py-2.5">
              <HpSkeleton className="h-7 w-7 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <HpSkeleton className="h-3 w-1/3" />
                <HpSkeleton className="h-2.5 w-1/4" />
              </div>
              <HpSkeleton className="h-7 w-16 rounded-[10px]" />
            </div>
          ))}
        </div>
      ) : state === "error" ? (
        <HpFormError>Couldn&apos;t load this contest&apos;s submissions. Collapse it and open it again to retry.</HpFormError>
      ) : state.length ? (
        <>
          <p className="mb-2 text-3xs font-bold uppercase tracking-[0.1em] text-text-muted">{plural(state.length, "attempt")}</p>
          <ul className="space-y-1.5">
            {state.map((s) => {
              const v = VERDICT_PILL[s.status];
              const VIcon = v?.icon ?? Minus;
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-xl border border-border-subtle bg-[rgb(var(--bg-surface-rgb))] px-3 py-2.5 transition-colors duration-200 hover:border-border-strong"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                      v ? HP_TONES[v.tone].soft : "bg-elevated text-text-muted ring-border-subtle"
                    )}
                  >
                    <VIcon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-primary">{s.problem_title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-3xs text-text-muted">
                      <span className={cn("font-bold capitalize", v ? HP_TONES[v.tone].text : "text-text-secondary")}>{verdictLabel(s.status)}</span>
                      <span className="font-mono">{s.language}</span>
                      {s.points_awarded !== null && <span className="tabular">{s.points_awarded} pts</span>}
                      <time dateTime={s.submitted_at} className="tabular">
                        {fmtDateTime(s.submitted_at)}
                      </time>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCode(s, contestTitle)}
                    aria-label={`View submitted code for ${s.problem_title}`}
                    className={hpBtn("secondary", "sm", "h-7 shrink-0 gap-1.5 px-2.5 text-2xs")}
                  >
                    <FileCode2 className="h-3.5 w-3.5" aria-hidden />
                    Code
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="flex items-center gap-2 py-1 text-2xs text-text-muted">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          No submissions in this contest.
        </p>
      )}
    </div>
  );
}

/* ── Mock interviews ────────────────────────────────────────────────────── */

function InterviewsPanel({
  interviews,
  canReview,
  onReview,
}: {
  interviews: StudentReportInterview[];
  canReview: PremiumReportProps["canReviewInterview"];
  onReview: PremiumReportProps["onReviewInterview"];
}) {
  const completed = interviews.filter((iv) => iv.status === "completed").length;

  return (
    <HpCard spotlight={false} id="report-interviews" className="flex min-w-0 scroll-mt-24 flex-col overflow-hidden">
      <div className="px-4 py-4 sm:px-6">
        <HpSectionHeader
          icon={Mic}
          tone="violet"
          title="Mock interviews"
          subtitle={interviews.length ? `${completed} of ${plural(interviews.length, "session")} completed` : "AI mock interview sessions"}
          action={<CountBadge value={interviews.length} />}
        />
      </div>

      {interviews.length === 0 ? (
        <div className="flex flex-1 flex-col px-4 pb-5 sm:px-6">
          <ScInlineEmpty icon={Mic} tone="violet" title="No mock interviews yet" description="Hasn't taken any mock interview yet." className="flex-1 justify-center" />
        </div>
      ) : (
        <ul className="max-h-[460px] flex-1 divide-y divide-border-subtle overflow-y-auto border-t border-border-subtle">
          {interviews.map((iv) => {
            const status = INTERVIEW_STATUS_PILL[iv.status] ?? { tone: "slate" as HpTone };
            const when = iv.completed_at ?? iv.started_at ?? iv.invited_at;
            const reviewable = canReview(iv.interview_type) && iv.status !== "invited";
            return (
              <li key={iv.session_id} className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-violet-500/[0.03] sm:px-6">
                <ScoreDial value={iv.has_score ? iv.composite_score_percent ?? 0 : null} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-13 font-bold text-primary">{iv.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-2xs text-text-muted">
                    <HpPill tone={status.tone} icon={status.icon} dot={status.live} pulse={status.live} size="sm">
                      {INTERVIEW_STATUS_LABEL[iv.status] ?? iv.status}
                    </HpPill>
                    {iv.round_name && <span className="min-w-0 truncate">{iv.round_name}</span>}
                    {iv.company_name && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">{iv.company_name}</span>
                      </span>
                    )}
                    {iv.question_count > 0 && (
                      <span className="tabular">
                        {iv.answered_count}/{iv.question_count} answered
                      </span>
                    )}
                    {!iv.has_score && <span className="italic">Awaiting score</span>}
                    {when && <span className="tabular">{fmtDate(when)}</span>}
                  </div>
                </div>
                {reviewable && (
                  <button
                    type="button"
                    onClick={() => onReview(iv)}
                    title="View full transcript"
                    aria-label={`View full transcript of ${iv.title}`}
                    className={hpBtn("soft", "sm", "h-8 shrink-0 px-2.5")}
                  >
                    <PlayCircle className="h-3.5 w-3.5" aria-hidden />
                    <span className="hidden sm:inline">Transcript</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </HpCard>
  );
}

/** Static score ring for list rows (one motion value per row isn't worth it). `null` = not scored yet. */
function ScoreDial({ value, size = 42 }: { value: number | null; size?: number }) {
  if (value === null) {
    return (
      <span
        title="Awaiting score"
        className="flex shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border-strong text-text-muted"
        style={{ width: size, height: size }}
      >
        <Clock className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={`Composite score ${value}%`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border-subtle" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={HP_TONES[scoreTone(v)].hex}
          strokeDasharray={c}
          strokeDashoffset={c - (c * v) / 100}
        />
      </svg>
      <span className="tabular absolute inset-0 flex items-center justify-center text-2xs font-extrabold text-primary">
        <span className="sr-only">Score </span>
        {Math.round(v)}
        <span className="text-[8px] font-bold text-text-muted">%</span>
      </span>
    </span>
  );
}

/* ── Placement drives ───────────────────────────────────────────────────── */

function DrivesPanel({ drives }: { drives: StudentReportDriveApplication[] }) {
  const offers = drives.filter((d) => d.stage === "offer_extended" || d.stage === "offer_accepted").length;

  return (
    <HpCard spotlight={false} id="report-drives" className="flex min-w-0 scroll-mt-24 flex-col overflow-hidden">
      <div className="px-4 py-4 sm:px-6">
        <HpSectionHeader
          icon={Briefcase}
          tone="sky"
          title="Placement drives"
          subtitle={drives.length ? `${plural(drives.length, "application")}${offers > 0 ? ` · ${plural(offers, "offer")}` : ""}` : "Drives this student has registered for"}
          action={<CountBadge value={drives.length} />}
        />
      </div>

      {drives.length === 0 ? (
        <div className="flex flex-1 flex-col px-4 pb-5 sm:px-6">
          <ScInlineEmpty icon={Briefcase} tone="sky" title="No drive applications yet" description="Not registered for any placement drive yet." className="flex-1 justify-center" />
        </div>
      ) : (
        <ul className="max-h-[460px] flex-1 divide-y divide-border-subtle overflow-y-auto border-t border-border-subtle">
          {drives.map((d) => {
            const step = DRIVE_PIPELINE.indexOf(d.stage);
            const ctc = d.ctc_offered ?? d.ctc_range;
            return (
              <li key={d.application_id} className="flex items-start gap-3 px-4 py-3.5 transition-colors duration-200 hover:bg-sky-500/[0.035] sm:items-center sm:px-6">
                <HpCompanyLogo name={d.company_name ?? d.drive_title} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-13 font-bold text-primary">{d.drive_title}</p>
                  {(d.company_name || d.role_title || ctc) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-muted">
                      {d.company_name && (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <Building2 className="h-3 w-3 shrink-0" aria-hidden />
                          <span className="truncate">{d.company_name}</span>
                        </span>
                      )}
                      {d.role_title && <span className="min-w-0 truncate">{d.role_title}</span>}
                      {ctc && (
                        <span className={cn("tabular inline-flex items-center gap-1", d.ctc_offered && "font-semibold text-emerald-700 dark:text-emerald-300")}>
                          <IndianRupee className="h-3 w-3 shrink-0" aria-hidden />
                          {d.ctc_offered ? `${d.ctc_offered} LPA offered` : d.ctc_range}
                        </span>
                      )}
                    </div>
                  )}
                  {step >= 0 && <StageMeter step={step} done={d.stage === "offer_accepted"} />}
                  <div className="mt-2 sm:hidden">
                    <StagePill stage={d.stage} />
                  </div>
                </div>
                <div className="hidden shrink-0 sm:block">
                  <StagePill stage={d.stage} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </HpCard>
  );
}

function StagePill({ stage }: { stage: DriveApplicationStage }) {
  const terminal = DRIVE_APPLICATION_TERMINAL_STAGES.includes(stage);
  const label = DRIVE_APPLICATION_STAGE_LABELS[stage];
  if (stage === "offer_accepted") {
    return (
      <HpPill tone="emerald" icon={CheckCircle2} size="sm">
        {label}
      </HpPill>
    );
  }
  if (stage === "rejected") {
    return (
      <HpPill tone="rose" icon={XCircle} size="sm">
        {label}
      </HpPill>
    );
  }
  if (terminal) {
    return (
      <HpPill tone="slate" icon={Minus} size="sm">
        {label}
      </HpPill>
    );
  }
  return (
    <HpPill tone="sky" dot size="sm">
      {label}
    </HpPill>
  );
}

/** Segmented progress along the forward drive pipeline (Registered → Offer Accepted). */
function StageMeter({ step, done }: { step: number; done: boolean }) {
  return (
    <span
      role="img"
      aria-label={`Stage ${step + 1} of ${DRIVE_PIPELINE.length}: ${DRIVE_APPLICATION_STAGE_LABELS[DRIVE_PIPELINE[step]]}`}
      className="mt-2.5 flex max-w-[260px] items-center gap-1"
    >
      {DRIVE_PIPELINE.map((st, i) => (
        <span
          key={st}
          className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? (done ? "bg-emerald-500" : "bg-sky-500") : "bg-border-strong")}
        />
      ))}
    </span>
  );
}

/* ── Submission history ─────────────────────────────────────────────────── */

/**
 * The premium twin of SubmissionHistoryList — same source filter (one tab
 * per source actually present, plus All), same rows, same onOpenCode hand-off
 * — drawn on the portal kit. The shared list itself stays untouched for the
 * student dashboard and every non-TPO viewer of this page.
 */
function PremiumSubmissionHistory({ submissions, onOpenCode }: { submissions: SubmissionHistoryRow[]; onOpenCode: (row: SubmissionHistoryRow) => void }) {
  const [filter, setFilter] = useState<"all" | SubmissionSource>("all");

  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of submissions) counts.set(s.source, (counts.get(s.source) ?? 0) + 1);
    return counts;
  }, [submissions]);

  const filtered = useMemo(() => (filter === "all" ? submissions : submissions.filter((s) => s.source === filter)), [submissions, filter]);

  const tabs: HpTabItem<"all" | SubmissionSource>[] = [
    { id: "all", label: "All", count: submissions.length },
    ...(Object.keys(SOURCE_LABEL) as SubmissionSource[])
      .filter((source) => sourceCounts.has(source))
      .map((source) => ({ id: source, label: SOURCE_LABEL[source], count: sourceCounts.get(source) ?? 0 })),
  ];

  return (
    <HpCard spotlight={false} id="report-submissions" className="scroll-mt-24 overflow-hidden">
      <div className="px-4 py-4 sm:px-6">
        <HpSectionHeader
          icon={Code2}
          tone="teal"
          title="Submission history"
          subtitle="Practice and contest attempts — open any one to read the exact code"
          action={<CountBadge value={submissions.length} />}
        />
      </div>

      {submissions.length === 0 ? (
        <div className="px-4 pb-5 sm:px-6">
          <ScInlineEmpty icon={Code2} tone="teal" title="No submissions yet" description="Nothing submitted in practice or any contest so far." />
        </div>
      ) : (
        <>
          <div className="border-y border-border-subtle bg-elevated/30 px-4 py-3 sm:px-6">
            <HpTabs tabs={tabs} value={filter} onChange={setFilter} />
            <p className="sr-only" aria-live="polite">
              Showing {filtered.length} of {plural(submissions.length, "submission")}
            </p>
          </div>

          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-2xs text-text-muted sm:px-6">No submissions match this filter.</p>
          ) : (
            <ul className="max-h-[560px] divide-y divide-border-subtle overflow-y-auto">
              {filtered.map((s) => {
                const diff = DIFFICULTY_META[s.difficulty?.toLowerCase() ?? ""];
                const v = VERDICT_PILL[s.status];
                return (
                  <li key={`${s.kind}-${s.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-sky-500/[0.035] sm:px-6">
                    <span
                      title={diff?.label ?? s.difficulty}
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-2xs font-extrabold uppercase ring-1 ring-inset",
                        diff ? HP_TONES[diff.tone].soft : "bg-elevated text-text-muted ring-border-subtle"
                      )}
                    >
                      <span aria-hidden>{diff?.letter ?? s.difficulty?.charAt(0) ?? "?"}</span>
                      <span className="sr-only">{diff?.label ?? s.difficulty} difficulty</span>
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-13 font-bold text-primary">{s.problem_title}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-3xs text-text-muted">
                        <HpPill tone={v?.tone ?? "slate"} icon={v?.icon} size="sm" className="capitalize">
                          {verdictLabel(s.status)}
                        </HpPill>
                        <HpPill tone={SOURCE_HP_TONE[s.source]} size="sm">
                          {SOURCE_LABEL[s.source]}
                        </HpPill>
                        <span className="rounded-md bg-elevated px-1.5 py-px font-mono font-semibold text-text-secondary ring-1 ring-inset ring-border-subtle">
                          {s.language}
                        </span>
                        {s.contest_title && <span className="min-w-0 max-w-[16rem] truncate">via {s.contest_title}</span>}
                        {s.points_awarded !== null && <span className="tabular font-semibold">{s.points_awarded} pts</span>}
                        <span className="tabular sm:hidden">{fmtDay(s.submitted_at)}</span>
                      </div>
                    </div>

                    <time dateTime={s.submitted_at} title={fmtDateTime(s.submitted_at)} className="tabular hidden shrink-0 text-2xs text-text-muted sm:block">
                      {fmtDay(s.submitted_at)}
                    </time>
                    <button
                      type="button"
                      onClick={() => onOpenCode(s)}
                      aria-label={`View submitted code for ${s.problem_title}`}
                      className={hpBtn("secondary", "sm", "h-8 shrink-0 gap-1.5 px-2.5")}
                    >
                      <FileCode2 className="h-3.5 w-3.5" aria-hidden />
                      Code
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </HpCard>
  );
}

/* ── Small shared pieces ────────────────────────────────────────────────── */

/** Visual count chip in a section header (the subtitle already says it in words). */
function CountBadge({ value }: { value: number }) {
  return (
    <span
      aria-hidden
      className="tabular inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-elevated px-2.5 text-2xs font-bold text-text-secondary ring-1 ring-inset ring-border-subtle"
    >
      {value}
    </span>
  );
}

/** Thin span-based meter (safe inside a <button>) that fills in on mount; instant under reduced motion. `value` is 0–100. */
function Meter({ value, tone, className }: { value: number; tone: HpTone; className?: string }) {
  const reduce = useReducedMotion();
  const width = `${Math.max(0, Math.min(100, value))}%`;
  return (
    <span aria-hidden className={cn("block h-1.5 w-full overflow-hidden rounded-full bg-elevated", className)}>
      <motion.span
        className={cn("block h-full rounded-full", HP_TONES[tone].bar)}
        initial={reduce ? false : { width: 0 }}
        animate={{ width }}
        transition={{ duration: 0.8, ease: hpEase }}
      />
    </span>
  );
}

function PremiumReportSkeleton() {
  return (
    <div role="status" aria-label="Loading student report" className="space-y-6">
      <HpCard spotlight={false} className="overflow-hidden rounded-[24px] p-5 sm:p-7">
        <div className="flex items-start gap-4 sm:gap-5">
          <HpSkeleton className="h-16 w-16 shrink-0 rounded-full sm:h-[72px] sm:w-[72px]" />
          <div className="min-w-0 flex-1 space-y-3">
            <HpSkeleton className="h-2.5 w-28" />
            <div className="flex flex-wrap gap-1.5">
              <HpSkeleton className="h-6 w-24 rounded-lg" />
              <HpSkeleton className="h-6 w-20 rounded-lg" />
              <HpSkeleton className="h-6 w-20 rounded-lg" />
              <HpSkeleton className="h-6 w-24 rounded-lg" />
            </div>
            <HpSkeleton className="h-3 w-56 max-w-full" />
          </div>
          <HpSkeleton className="hidden h-7 w-32 rounded-full lg:block" />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <HpSkeleton key={i} className="h-[58px] rounded-2xl" />
          ))}
        </div>
      </HpCard>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <HpCard key={i} spotlight={false} className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <HpSkeleton className="h-3 w-20" />
              <HpSkeleton className="h-10 w-10 rounded-xl" />
            </div>
            <HpSkeleton className="h-8 w-16" />
            <HpSkeleton className="h-3 w-24 max-w-full" />
          </HpCard>
        ))}
      </div>

      <HpCard spotlight={false} className="p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <HpSkeleton className="h-8 w-8 rounded-[10px]" />
          <div className="space-y-2">
            <HpSkeleton className="h-3.5 w-32" />
            <HpSkeleton className="h-2.5 w-48 max-w-full" />
          </div>
        </div>
        <HpSkeleton className="mt-5 h-[118px] w-full rounded-xl" />
      </HpCard>

      <HpCard spotlight={false} className="divide-y divide-border-subtle overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4 sm:px-6">
            <HpSkeleton className="hidden h-12 w-12 rounded-[14px] sm:block" />
            <div className="flex-1 space-y-2">
              <HpSkeleton className="h-3.5 w-1/3 max-w-[14rem]" />
              <HpSkeleton className="h-3 w-1/2 max-w-[18rem]" />
            </div>
            <HpSkeleton className="h-8 w-12 rounded-lg" />
          </div>
        ))}
      </HpCard>

      <span className="sr-only">Loading student report…</span>
    </div>
  );
}
