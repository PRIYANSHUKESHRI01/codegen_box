import type { ActivityDay } from "./studentStats";
import type { DriveApplicationStage } from "./placement";

/** Mirrors Contest::CONTEST_TYPES on the backend — also doubles as a submission-history filter value alongside "practice" (see SubmissionHistoryRow). */
export type ContestType = "general" | "daily" | "company" | "tpo_mock" | "company_hiring" | "talent_pool";

/**
 * The payload behind GET /tpo/students/{id}/report and its admin mirror
 * (StudentReportService on the backend) — everything the "View Report"
 * drill-down from Student Cohort needs in one call, mirroring how
 * TpoReportsController's `data` endpoint already shapes a whole page's worth
 * of real numbers into one response.
 */
export interface StudentReportProfile {
  id: number;
  name: string;
  email: string;
  roll_number: string | null;
  branch: string | null;
  section: string | null;
  cgpa: string | null;
  backlogs: number | null;
  phone: string | null;
  is_blocked: boolean;
}

export interface StudentReportContest {
  contest_id: number;
  title: string;
  slug: string;
  contest_type: ContestType;
  is_rated: boolean;
  start_at: string;
  end_at: string;
  registered_at: string;
  score: number | null;
  penalty_minutes: number | null;
  rank: number | null;
  rating_before: number | null;
  rating_after: number | null;
  problem_count: number;
  total_points_possible: number;
  problems_solved: number;
}

export interface StudentReportInterview {
  session_id: number;
  interview_id: number;
  title: string;
  slug: string;
  interview_type: string;
  round_name: string | null;
  company_name: string | null;
  question_count: number;
  answered_count: number;
  status: "invited" | "in_progress" | "completed";
  invited_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  composite_score_percent: number | null;
  has_score: boolean;
  advanced: boolean | null;
}

export interface StudentReportDriveApplication {
  application_id: number;
  drive_id: number;
  drive_title: string;
  company_name: string | null;
  role_title: string | null;
  ctc_range: string | null;
  stage: DriveApplicationStage;
  stage_updated_at: string | null;
  ctc_offered: string | null;
}

/**
 * One row in the unified submission history — a practice attempt
 * (`kind: "practice"`, `source: "practice"`) or a contest attempt
 * (`kind: "contest"`, `source` = that contest's own type). `kind` is what a
 * caller needs to know which code-view endpoint this row's `id` belongs to:
 * `/submissions/{id}` for practice, `/contest-submissions/{id}` for contest
 * — the two live in separate tables with independent id sequences.
 */
export interface SubmissionHistoryRow {
  id: number;
  kind: "practice" | "contest";
  source: "practice" | ContestType;
  contest_title: string | null;
  problem_title: string;
  problem_slug: string;
  difficulty: string;
  language: string;
  status: string;
  points_awarded: number | null;
  runtime_ms: number | null;
  memory_kb: number | null;
  submitted_at: string;
}

export interface StudentReport {
  student: StudentReportProfile;
  readiness: {
    score: number;
    tier: "Placement Ready" | "In Progress" | "Needs Training";
    practice_score: number;
    components: { key: string; label: string; score: number; weight_percent: number; contribution: number }[];
    next_steps: string[];
  };
  rating: {
    current_rating: number;
    rated_contests_count: number;
    display_rating: string;
  };
  solved: { total_solved: number; easy: { solved: number; total: number }; medium: { solved: number; total: number }; hard: { solved: number; total: number } };
  streak: { current: number; max: number };
  activity: ActivityDay[];
  submissions: SubmissionHistoryRow[];
  contests: StudentReportContest[];
  interviews: StudentReportInterview[];
  drive_applications: StudentReportDriveApplication[];
}

/** GET .../submissions/{id} — a practice submission's full detail, code included. */
export interface SubmissionDetail {
  id: number;
  language: string;
  status: string;
  /** Null for any submission made before code persistence shipped — genuinely never captured, not a loading state. */
  code: string | null;
  runtime_ms: number | null;
  memory_kb: number | null;
  submitted_on: string;
  problem: { id: number; slug: string; title: string; difficulty: string };
}

/** GET .../contest-submissions/{id} — same shape, for a contest attempt. */
export interface ContestSubmissionDetail {
  id: number;
  language: string;
  status: string;
  code: string | null;
  points_awarded: number | null;
  submitted_at: string;
  contest: { id: number; title: string; slug: string };
  contest_problem: { problem: { id: number; slug: string; title: string; difficulty: string } };
}

/** GET /tpo/contests/{id}/participants and its admin mirror. */
export interface ContestParticipantRow {
  participant_id: number;
  user_id: number;
  name: string;
  email: string;
  roll_number: string | null;
  branch: string | null;
  section: string | null;
  registered_at: string;
  score: number | null;
  penalty_minutes: number | null;
  rank: number | null;
  rating_before: number | null;
  rating_after: number | null;
}

/**
 * GET .../participants/{studentId}/submissions — one participant's
 * per-problem attempts for a contest. No `code` here on purpose: this is a
 * list of every attempt at once, and the same reasoning that keeps `code`
 * out of Submission::$hidden's default JSON applies here too — a reviewer
 * fetches one attempt's code by id (GET .../contest-submissions/{id}) only
 * when they actually click to view it.
 */
export interface ContestParticipantSubmission {
  id: number;
  problem_title: string;
  problem_slug: string;
  language: string;
  status: string;
  points_awarded: number | null;
  submitted_at: string;
}
