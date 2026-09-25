"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  GraduationCap,
  ListChecks,
  BookOpen,
  Code2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SessionLoader } from "@/components/ui/SessionLoader";
import { CountdownTimer } from "@/components/dashboard/student/CountdownTimer";
import { DifficultyBadge } from "@/components/problems/DifficultyBadge";
import { useAuthGuard } from "@/lib/useAuthGuard";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { DriveStatus, MyDriveApplication, PlacementDriveDetail, PrepQuestionCategory } from "@/types/placement";

interface ApiDriveDetailResponse {
  drive: {
    id: number;
    title: string;
    company: { id: number; name: string; slug: string; logo: string | null };
    role_title: string;
    ctc_range: string | null;
    drive_date: string;
    duration_minutes: number | null;
    eligibility: { min_cgpa: string | null; max_backlogs: number | null; eligible_branches: string[] | null };
    student_eligibility: { status: "eligible" | "not_eligible" | "unknown"; reasons: string[] };
    my_application: MyDriveApplication | null;
    status: DriveStatus;
  };
  company: {
    id: number;
    name: string;
    slug: string;
    logo: string | null;
    overview: string | null;
    hiring_process: { name: string; description?: string }[] | null;
  };
  prep_questions: {
    id: number;
    asked_year: number;
    category: PrepQuestionCategory;
    round_name: string | null;
    question: string;
    answer_notes: string | null;
  }[];
  recommended_problems: {
    problem_slug: string;
    topic_tag: string | null;
    priority: number;
    title: string | null;
    difficulty: string | null;
    available: boolean;
  }[];
}

function mapDriveDetailFromApi(res: ApiDriveDetailResponse): PlacementDriveDetail {
  return {
    drive: {
      id: res.drive.id,
      title: res.drive.title,
      company: res.drive.company,
      roleTitle: res.drive.role_title,
      ctcRange: res.drive.ctc_range,
      driveDate: res.drive.drive_date,
      durationMinutes: res.drive.duration_minutes,
      eligibility: {
        minCgpa: res.drive.eligibility.min_cgpa !== null ? Number(res.drive.eligibility.min_cgpa) : null,
        maxBacklogs: res.drive.eligibility.max_backlogs,
        eligibleBranches: res.drive.eligibility.eligible_branches,
      },
      studentEligibility: res.drive.student_eligibility,
      myApplication: res.drive.my_application,
      status: res.drive.status,
    },
    company: {
      id: res.company.id,
      name: res.company.name,
      slug: res.company.slug,
      logo: res.company.logo,
      overview: res.company.overview,
      hiringProcess: res.company.hiring_process ?? [],
    },
    prepQuestions: res.prep_questions.map((q) => ({
      id: q.id,
      askedYear: q.asked_year,
      category: q.category,
      roundName: q.round_name,
      question: q.question,
      answerNotes: q.answer_notes,
    })),
    recommendedProblems: res.recommended_problems.map((p) => ({
      problemSlug: p.problem_slug,
      topicTag: p.topic_tag,
      priority: p.priority,
      title: p.title,
      difficulty: p.difficulty,
      available: p.available,
    })),
  };
}

type LoadState = "loading" | "ready" | "not_found" | "error";

const YEAR_FILTER_ALL = "All";
const CATEGORY_FILTER_ALL = "All";

export default function PlacementDrivePreparePage() {
  const params = useParams<{ driveId: string }>();
  const router = useRouter();
  const { status: authStatus } = useAuthGuard(["user"]);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [detail, setDetail] = useState<PlacementDriveDetail | null>(null);
  const [yearFilter, setYearFilter] = useState<string>(YEAR_FILTER_ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(CATEGORY_FILTER_ALL);
  // Computed once when the drive loads so CountdownTimer is never handed a
  // freshly-recomputed value on an unrelated re-render (which would reset its tick).
  const [minutesFromNow, setMinutesFromNow] = useState(0);

  useEffect(() => {
    if (authStatus !== "ready" || !params?.driveId) return;
    let cancelled = false;
    setLoadState("loading");

    api
      .get<ApiDriveDetailResponse>(`/drives/${params.driveId}`)
      .then((res) => {
        if (cancelled) return;
        const mapped = mapDriveDetailFromApi(res);
        setDetail(mapped);
        setMinutesFromNow(Math.round((new Date(mapped.drive.driveDate).getTime() - Date.now()) / 60000));
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadState(err instanceof ApiError && err.status === 404 ? "not_found" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [authStatus, params?.driveId]);

  const years = useMemo(() => {
    if (!detail) return [];
    return Array.from(new Set(detail.prepQuestions.map((q) => q.askedYear))).sort((a, b) => b - a);
  }, [detail]);

  const categories = useMemo(() => {
    if (!detail) return [];
    return Array.from(new Set(detail.prepQuestions.map((q) => q.category)));
  }, [detail]);

  const filteredQuestions = useMemo(() => {
    if (!detail) return [];
    return detail.prepQuestions.filter(
      (q) =>
        (yearFilter === YEAR_FILTER_ALL || q.askedYear === Number(yearFilter)) &&
        (categoryFilter === CATEGORY_FILTER_ALL || q.category === categoryFilter)
    );
  }, [detail, yearFilter, categoryFilter]);

  const recommendedProblems = detail?.recommendedProblems ?? [];
  const availableRecommendedProblems = recommendedProblems.filter((p) => p.available);

  const practiceHref = detail
    ? `/dashboard/practice?slugs=${availableRecommendedProblems.map((p) => p.problemSlug).join(",")}&company=${encodeURIComponent(detail.company.name)}`
    : "/dashboard/practice";

  if (authStatus !== "ready" || loadState === "loading") {
    return <SessionLoader label={authStatus !== "ready" ? undefined : "Loading your prep pack..."} />;
  }

  if (loadState !== "ready" || !detail) {
    return (
      <DashboardShell role="user" title="Drive Unavailable">
        <div className="p-10 text-center rounded-panel bg-surface border border-border-subtle space-y-3">
          <AlertCircle className="w-8 h-8 text-text-muted mx-auto" />
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            {loadState === "not_found"
              ? "This drive is no longer available for your college — it may have been unmapped or hasn't been published yet."
              : "Something went wrong loading this drive. Please try again."}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-accent-primary hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const { drive, company } = detail;
  const isPast = minutesFromNow <= 0;
  const isOpen = drive.status === "published" && !isPast;

  return (
    <DashboardShell
      role="user"
      title={`Prepare — ${company.name}`}
      subtitle={`${drive.roleTitle} · ${drive.ctcRange ?? "CTC not disclosed"}`}
    >
      <Link
        href="/dashboard#placement-drives"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Placement Drives</span>
      </Link>

      {/* Header */}
      <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <span className="text-4xl shrink-0">{company.logo ?? "🏢"}</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="text-lg font-bold text-primary">{company.name}</h2>
                <span
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border inline-flex items-center gap-1",
                    isOpen
                      ? "bg-status-success/10 text-status-success border-status-success/25"
                      : "bg-elevated text-text-muted border-border-subtle"
                  )}
                >
                  {isOpen ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {isOpen ? "Open for Applications" : isPast ? "Drive Concluded" : "Not Yet Open"}
                </span>
                {drive.myApplication && (
                  <span
                    className={cn(
                      "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border inline-flex items-center gap-1",
                      drive.myApplication.stage === "offer_accepted"
                        ? "bg-status-success/10 text-status-success border-status-success/25"
                        : drive.myApplication.stage === "rejected" || drive.myApplication.stage === "withdrawn"
                        ? "bg-elevated text-text-muted border-border-subtle"
                        : "bg-accent-secondary/10 text-accent-secondary border-accent-secondary/25"
                    )}
                  >
                    Your Status: {drive.myApplication.stage_label}
                  </span>
                )}
              </div>
              <p className="text-sm text-text-secondary">{drive.roleTitle}</p>
              <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5 flex-wrap">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(drive.driveDate).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {drive.durationMinutes && (
                  <>
                    <Clock className="w-3.5 h-3.5 ml-2" />
                    {drive.durationMinutes} minutes
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-center lg:text-right">
            {isPast ? (
              <p className="text-sm font-bold text-text-muted">This drive has concluded</p>
            ) : (
              <>
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-semibold block mb-1.5">
                  Starts in
                </span>
                <CountdownTimer minutesFromNow={minutesFromNow} />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Overview + Eligibility */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle space-y-5">
          <div>
            <h3 className="font-bold text-sm text-primary mb-2">About {company.name}</h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {company.overview ?? "No overview has been added for this company yet."}
            </p>
          </div>

          {company.hiringProcess.length > 0 && (
            <div>
              <h3 className="font-bold text-sm text-primary flex items-center gap-2 mb-3">
                <ListChecks className="w-4 h-4 text-accent-primary" />
                <span>Hiring Process</span>
              </h3>
              <div className="space-y-2.5">
                {company.hiringProcess.map((round, i) => (
                  <div key={round.name} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-accent-primary/10 border border-accent-primary/25 text-accent-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-primary">{round.name}</p>
                      {round.description && <p className="text-[11px] text-text-muted mt-0.5">{round.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
          <h3 className="font-bold text-sm text-primary flex items-center gap-2 mb-4">
            <GraduationCap className="w-4 h-4 text-accent-secondary" />
            <span>Eligibility Requirements</span>
          </h3>

          {drive.studentEligibility.status === "eligible" && (
            <div className="mb-4 p-3 rounded-control bg-status-success/10 border border-status-success/25 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-status-success">You meet every requirement for this drive.</p>
            </div>
          )}
          {drive.studentEligibility.status === "not_eligible" && (
            <div className="mb-4 p-3 rounded-control bg-status-danger/10 border border-status-danger/25 space-y-1.5">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-status-danger shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-status-danger">You don&apos;t currently meet every requirement.</p>
              </div>
              <ul className="pl-6 space-y-1 list-disc text-[11px] text-text-secondary">
                {drive.studentEligibility.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          )}
          {drive.studentEligibility.status === "unknown" && (
            <div className="mb-4 p-3 rounded-control bg-status-warning/10 border border-status-warning/25 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-status-warning shrink-0 mt-0.5" />
              <p className="text-[11px] text-text-secondary">
                Part of your academic profile (CGPA/branch/backlogs) isn&apos;t on file yet, so we can&apos;t confirm your
                eligibility — check with your TPO.
              </p>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Minimum CGPA</span>
              <span className="font-mono font-bold text-primary">
                {drive.eligibility.minCgpa !== null ? drive.eligibility.minCgpa.toFixed(2) : "No cutoff"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Max Active Backlogs</span>
              <span className="font-mono font-bold text-primary">
                {drive.eligibility.maxBacklogs !== null ? drive.eligibility.maxBacklogs : "No limit"}
              </span>
            </div>
            <div>
              <span className="text-text-muted block mb-1.5">Eligible Branches</span>
              {drive.eligibility.eligibleBranches?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {drive.eligibility.eligibleBranches.map((b) => (
                    <span
                      key={b}
                      className="px-2 py-0.5 rounded-full bg-elevated border border-border-subtle text-[10px] font-bold text-text-secondary"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="font-mono font-bold text-primary">All branches</span>
              )}
            </div>
          </div>
          <p className="mt-4 pt-4 border-t border-border-subtle text-[10px] text-text-muted leading-relaxed">
            Checked against the academic record your placement cell has on file for you. Spotted an error in your
            CGPA, branch or backlog count? Contact your TPO to get it corrected.
          </p>
        </div>
      </div>

      {/* Previous Year Questions */}
      <section className="p-5 sm:p-6 rounded-panel bg-surface border border-border-subtle shadow-subtle">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-bold text-sm sm:text-base text-primary flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-accent-primary" />
            <span>Previous Year Questions</span>
          </h3>
          <span className="text-[10px] text-text-muted font-mono">{detail.prepQuestions.length} questions archived</span>
        </div>

        {detail.prepQuestions.length === 0 ? (
          <p className="text-xs text-text-muted">No previous-year questions have been added for {company.name} yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setYearFilter(YEAR_FILTER_ALL)}
                  className={cn(
                    "px-2.5 py-1 rounded-control text-[11px] font-bold border transition-colors",
                    yearFilter === YEAR_FILTER_ALL
                      ? "bg-accent-primary text-white border-accent-primary"
                      : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                  )}
                >
                  All Years
                </button>
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={() => setYearFilter(String(y))}
                    className={cn(
                      "px-2.5 py-1 rounded-control text-[11px] font-bold border transition-colors",
                      yearFilter === String(y)
                        ? "bg-accent-primary text-white border-accent-primary"
                        : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                    )}
                  >
                    {y}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setCategoryFilter(CATEGORY_FILTER_ALL)}
                  className={cn(
                    "px-2.5 py-1 rounded-control text-[11px] font-bold border transition-colors",
                    categoryFilter === CATEGORY_FILTER_ALL
                      ? "bg-accent-secondary text-white border-accent-secondary"
                      : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                  )}
                >
                  All Categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={cn(
                      "px-2.5 py-1 rounded-control text-[11px] font-bold border transition-colors",
                      categoryFilter === c
                        ? "bg-accent-secondary text-white border-accent-secondary"
                        : "bg-elevated text-text-secondary border-border-subtle hover:text-primary"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredQuestions.map((q) => (
                <div key={q.id} className="p-4 rounded-control bg-elevated/60 border border-border-subtle">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/25 text-[9px] font-bold">
                      {q.category}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-elevated text-text-muted border border-border-subtle text-[9px] font-bold">
                      {q.askedYear}
                    </span>
                    {q.roundName && <span className="text-[10px] text-text-muted">{q.roundName}</span>}
                  </div>
                  <p className="text-xs font-semibold text-primary leading-relaxed">{q.question}</p>
                  {q.answerNotes && <p className="text-[11px] text-text-secondary mt-1.5 leading-relaxed">{q.answerNotes}</p>}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Recommended Practice */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-base font-bold text-primary flex items-center gap-2">
            <Code2 className="w-4 h-4 text-accent-primary" />
            <span>Recommended Practice</span>
          </h3>
          {availableRecommendedProblems.length > 0 && (
            <button
              onClick={() => router.push(practiceHref)}
              className="text-[11px] font-semibold text-accent-primary hover:underline flex items-center gap-1"
            >
              <span>Practice all {availableRecommendedProblems.length} recommended problems</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recommendedProblems.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted rounded-panel bg-surface border border-border-subtle">
            No practice problems have been mapped to {company.name} yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendedProblems.map((problem) => (
              <button
                key={problem.problemSlug}
                disabled={!problem.available}
                onClick={() =>
                  problem.available &&
                  router.push(`/dashboard/practice?slugs=${problem.problemSlug}&company=${encodeURIComponent(detail.company.name)}`)
                }
                className={cn(
                  "text-left p-5 rounded-panel bg-surface border border-border-subtle shadow-subtle transition-all space-y-3",
                  problem.available ? "hover:border-accent-primary/40 hover:shadow-card cursor-pointer" : "opacity-60 cursor-not-allowed"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  {problem.difficulty ? (
                    <DifficultyBadge difficulty={problem.difficulty} size="sm" />
                  ) : (
                    <span className="text-[11px] text-text-muted">Difficulty TBD</span>
                  )}
                  {!problem.available && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-elevated text-text-muted border border-border-subtle whitespace-nowrap">
                      Coming Soon
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-bold text-primary line-clamp-2">
                  {problem.title ?? problem.problemSlug}
                </h4>
                {problem.topicTag && (
                  <span className="inline-block text-[11px] font-mono px-2 py-0.5 rounded-[5px] bg-elevated/80 border border-border-subtle text-text-muted">
                    {problem.topicTag}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
