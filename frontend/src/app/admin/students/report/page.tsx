"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { ActivityHeatmap } from "@/components/dashboard/student/ActivityHeatmap";
import { CodeViewModal, type CodeViewData } from "@/components/dashboard/CodeViewModal";
import { ReviewSessionsModal } from "@/components/dashboard/interviews/ReviewSessionsModal";
import { SubmissionHistoryList, SOURCE_LABEL, SOURCE_TONE } from "@/components/dashboard/student/SubmissionHistoryList";
import { buildActivityWeeks } from "@/lib/activityGrid";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn, withMinDelay } from "@/lib/utils";
import { DRIVE_APPLICATION_STAGE_LABELS, DRIVE_APPLICATION_TERMINAL_STAGES } from "@/types/placement";
import type { StudentReport, ContestParticipantSubmission, SubmissionHistoryRow } from "@/types/studentReport";

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

  return (
    <DashboardShell
      role={shellRole}
      currentTpoView={user?.role === "admin_tpo" ? "tpo" : undefined}
      title={report?.student.name ?? "Student Report"}
      subtitle={
        report
          ? [report.student.roll_number ?? "No roll number", report.student.branch, report.student.section && `Sec ${report.student.section}`]
              .filter(Boolean)
              .join(" · ")
          : undefined
      }
    >
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
                                    "shrink-0 rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide",
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
                              onClick={() =>
                                setViewingInterview({
                                  // The one interview type a TPO can open
                                  // (tpo_mock) is exactly the one type Admin
                                  // is guarded OUT of, and vice versa for
                                  // every other type — so the reviewer base
                                  // path is the INTERVIEW's own type, never
                                  // just "whatever apiBase this viewer uses
                                  // for their own student-report calls".
                                  basePath: iv.interview_type === "tpo_mock" ? "/tpo/interviews" : "/admin/interviews",
                                  slug: iv.slug,
                                  title: iv.title,
                                  sessionId: iv.session_id,
                                })
                              }
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

      <CodeViewModal data={viewingCode} onClose={() => setViewingCode(null)} />

      {viewingInterview && (
        <ReviewSessionsModal
          basePath={viewingInterview.basePath}
          listEndpoint="sessions"
          interviewSlug={viewingInterview.slug}
          interviewTitle={viewingInterview.title}
          initialSessionId={viewingInterview.sessionId}
          onClose={() => setViewingInterview(null)}
        />
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
