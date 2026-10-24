/** Core Prep (branch technical questions) — shapes returned by the /admin/core API. */

export type CoreType = "mcq_single" | "mcq_multi" | "numeric";
export type CoreStatus = "draft" | "in_review" | "published" | "retired";
export type CoreUsage = "practice" | "test" | "both";
export type CoreDifficulty = "easy" | "medium" | "hard";

/** The engineering families that had Core Prep first. The full list — every discipline of every department that has Domain Prep — comes from the catalogue (see useCoreDisciplines in lib/core.ts). */
export const CORE_DISCIPLINES = ["ece", "eee", "mech", "civil"] as const;
/** A discipline code (`ece`, `mba`, `bcom`, `psychology` …): any family with Domain Prep. */
export type CoreDiscipline = string;

export interface CoreOption {
  id: string;
  text: string;
}

export type CoreQuestionFlag = "too_easy" | "too_hard" | "low_discrimination" | "negative_discrimination" | "suspected_key";

export interface CoreQuestionStats {
  test_attempts: number;
  /** Share who got it right in a timed test (0–1). */
  facility: number | null;
  /** Point-biserial against the overall test score (−1 to 1); negative = the strong students get it wrong. */
  discrimination: number | null;
  practice_attempts: number;
  practice_facility: number | null;
  flags: CoreQuestionFlag[];
  /** For a suspected wrong key: the option the stronger students keep choosing. */
  suspect_option: string | null;
  computed_at: string | null;
}

export interface CoreQuestion {
  id: number;
  public_id: string;
  external_id: string | null;
  discipline_code: CoreDiscipline;
  subject: { id: number; code: string; name: string } | null;
  topic: { id: number; code: string; name: string } | null;
  type: CoreType;
  stem: string;
  image_url: string | null;
  options: CoreOption[] | null;
  correct: string[] | null;
  numeric_min: number | null;
  numeric_max: number | null;
  numeric_unit: string | null;
  marks: number;
  negative_marks: number;
  difficulty: CoreDifficulty;
  explanation: string | null;
  tags: string[];
  companies: string[];
  source: string | null;
  usage: CoreUsage;
  status: CoreStatus;
  version: number;
  attempts_count: number;
  /** Students have answered it, so the answer key can only change through "Fix answer key". */
  key_locked: boolean;
  /** What students' answers say about it (nightly item analysis) — null until it has been answered. */
  stats?: CoreQuestionStats | null;
  reviewed_at: string | null;
  published_at: string | null;
  created_by: { id: number; name: string } | null;
  reviewed_by: { id: number; name: string } | null;
  open_reports: number | null;
  updated_at: string;
  created_at: string;
}

export interface CoreAudit {
  id: number;
  action: string;
  changes: Record<string, { from: unknown; to: unknown }> | null;
  note: string | null;
  user: { id: number; name: string } | null;
  at: string;
}

export interface CoreTopicRow {
  id: number;
  code: string;
  name: string;
  sort: number;
  is_active: boolean;
}

export interface CoreSubjectRow {
  id: number;
  code: string;
  name: string;
  sort: number;
  is_active: boolean;
  questions: number;
  topics: CoreTopicRow[];
}

export interface CoreTaxonomyResponse {
  disciplines: { code: CoreDiscipline; subjects: CoreSubjectRow[] }[];
  /** The optional "Draft with AI" helper is switched on. Absent from an older API. */
  ai_drafts?: boolean;
}

export interface CoreQuestionList {
  data: CoreQuestion[];
  meta: { page: number; per_page: number; total: number; last_page: number };
}

export interface CoreImportError {
  row: number;
  external_id: string | null;
  field: string;
  message: string;
}

export interface CoreImport {
  id: number;
  filename: string;
  mode: "dry_run" | "commit";
  status: "pending" | "processing" | "checked" | "completed" | "completed_with_errors" | "failed";
  total_rows: number;
  valid_rows: number;
  created_rows: number;
  updated_rows: number;
  failed_rows: number;
  summary: {
    by_subject: Record<string, number>;
    by_difficulty: Record<string, number>;
    by_type: Record<string, number>;
    without_external_id: number;
    downgraded_to_review: number;
    images: number;
  } | null;
  options: { discipline?: string; status?: string } | null;
  can_commit: boolean;
  has_failures: boolean;
  errors: CoreImportError[];
  created_at: string;
}

export interface CoverageSubject {
  id: number;
  code: string;
  name: string;
  easy: number;
  medium: number;
  hard: number;
  practice: number;
  test: number;
  total: number;
  topics_total: number;
  topics_covered: number;
}

/** A college that sees a branch's Core Prep before it is live for everyone, and how many of its students of that branch that reaches. */
export interface CorePilotCollege {
  college_id: number;
  name: string;
  students: number;
}

/** Superadmin's pilot picker options: every college and its student count per core branch family. */
export interface CoverageCollege {
  id: number;
  name: string;
  students: Partial<Record<CoreDiscipline, number>>;
}

export interface CoverageDiscipline {
  discipline: CoreDiscipline;
  name: string;
  is_live: boolean;
  live_at: string | null;
  /** live = every college · pilot = only the colleges in `pilots` · off = nobody. */
  stage: "off" | "pilot" | "live";
  pilots: CorePilotCollege[];
  subjects: CoverageSubject[];
  totals: { published: number; test: number; practice: number; draft: number; in_review: number };
  go_live: {
    ready: boolean;
    reasons: string[];
    rules: { min_published: number; min_subjects: number; min_per_subject: number };
    strong_subjects: number;
  };
}

export interface CoreReport {
  id: number;
  reason: string;
  note: string | null;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  reporter: { id: number; name: string; email: string } | null;
  question: { id: number; external_id: string | null; status: CoreStatus; discipline_code: string; subject: string | null; stem: string } | null;
}

/* ───────────────────────────── student side ───────────────────────────── */

export interface CoreSubjectProgress {
  id: number;
  code: string;
  name: string;
  /** Published practice questions in the subject. */
  questions: number;
  attempts: number;
  /** Null until they have answered something in it. */
  accuracy: number | null;
  topics_total: number;
  topics_mastered: number;
}

export interface CoreWeakTopic {
  topic_id: number;
  topic: string;
  subject_id: number;
  subject: string;
  attempts: number;
  accuracy: number;
}

export interface CoreHomeUnavailable {
  available: false;
  family: boolean;
  live: boolean;
  discipline: { code: string; name: string; short: string } | null;
}

export interface CoreHomeAvailable {
  available: true;
  live?: boolean;
  /** Early access: the student's college is a pilot, so Core Prep is open to them before it is live for everyone. */
  pilot?: boolean;
  discipline: { code: string; name: string; short: string } | null;
  track_focus: "core_first" | "balanced" | "it_first" | null;
  plan: {
    practice_limit: number | null;
    practice_used_today: number;
    tests_access: boolean;
    free_test_tries: number | null;
    free_test_tries_used: number | null;
  };
  summary: { answered: number; accuracy: number | null; topics_mastered: number; topics_total: number; tests_taken: number; avg_test_percent: number | null };
  /** This week's goals against the pace the student chose (optional: an older API does not send it). */
  week?: { questions: { current: number; target: number }; tests: { current: number; target: number } };
  subjects: CoreSubjectProgress[];
  weakest_topics: CoreWeakTopic[];
  tests_available: number;
  in_progress: { session: string; test: string | null; deadline_at: string } | null;
  recent_results: { session: string; test: string | null; score_percent: number | null; passed: boolean | null; completed_at: string | null }[];
}

export type CoreHome = CoreHomeUnavailable | CoreHomeAvailable;

/** A question as a student first sees it: nothing that gives the answer away. */
export interface CorePracticeQuestion {
  id: number;
  type: CoreType;
  stem: string;
  image_url: string | null;
  options: CoreOption[];
  numeric_unit: string | null;
  marks: number;
  difficulty: CoreDifficulty;
  subject: string | null;
  topic: string | null;
}

export interface CorePracticeResult {
  correct: boolean;
  key: { correct?: string[]; min?: number | null; max?: number | null; unit?: string | null };
  explanation: string | null;
  selected: string[] | null;
  numeric_value: number | null;
  practice_used_today: number;
  practice_limit: number | null;
}

export interface CoreTestSummary {
  slug: string;
  title: string;
  description: string | null;
  type: "general" | "tpo_mock";
  duration_minutes: number;
  pass_percentage: number;
  question_count: number;
  total_marks: number;
  available_from: string | null;
  available_until: string | null;
  open_now: boolean;
  max_attempts: number | null;
  attempts_taken: number;
  best_score_percent: number | null;
  in_progress_session: string | null;
  can_attempt: boolean;
  last_session: string | null;
}

export interface CoreSessionQuestion {
  position: number;
  id: number;
  type: CoreType;
  stem: string;
  image_url: string | null;
  options: CoreOption[];
  numeric_unit: string | null;
  marks: number;
  negative_marks: number;
  section: string | null;
  selected: string[];
  numeric_value: number | null;
  marked_for_review: boolean;
}

export interface CoreSession {
  id: string;
  status: "in_progress" | "completed";
  attempt_number: number;
  started_at: string;
  deadline_at: string;
  server_time: string;
  test: { title: string; slug: string; duration_minutes: number; pass_percentage: number; total_marks: number };
  questions: CoreSessionQuestion[];
  proctoring?: { status: string; violation_count: number; max_violations: number } | null;
}

export interface CoreResultReview {
  position: number;
  question_id: number;
  type: CoreType;
  stem: string;
  image_url: string | null;
  options: CoreOption[];
  subject: string | null;
  topic: string | null;
  marks: number;
  selected: string[];
  numeric_value: number | null;
  correct: string[] | null;
  numeric_min: number | null;
  numeric_max: number | null;
  numeric_unit: string | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
  explanation: string | null;
  time_spent_seconds: number;
}

export interface CoreResult {
  id: string;
  test: { title: string; slug: string; pass_percentage: number };
  attempt_number: number;
  completed_at: string | null;
  score: number;
  max_score: number;
  score_percent: number;
  passed: boolean;
  correct_count: number;
  wrong_count: number;
  skipped_count: number;
  terminated_by_proctoring: boolean;
  subject_breakdown: { subject_id: number; subject: string; correct: number; wrong: number; skipped: number; score: number; max: number; percent: number }[];
  review: CoreResultReview[];
}

/* ───────────────────────────── tests (authoring) ───────────────────────────── */

export interface CoreTestRow {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  discipline_code: CoreDiscipline;
  status: "draft" | "published" | "cancelled";
  test_type: "general" | "tpo_mock";
  duration_minutes: number;
  pass_percentage: number;
  shuffle_options: boolean;
  shuffle_questions: boolean;
  max_attempts: number | null;
  available_from: string | null;
  available_until: string | null;
  branch_audience: { disciplines?: string[]; branches?: string[] } | null;
  question_count: number;
  sessions_count: number;
  total_marks: number;
  created_at: string;
  sections?: { section: string | null; questions: number; marks: number }[];
  already_copied?: boolean;
}

export interface CorePoolSubject {
  id: number;
  name: string;
  easy: number;
  medium: number;
  hard: number;
  total: number;
}

export interface CoreCandidate {
  id: number;
  external_id: string | null;
  stem: string;
  type: CoreType;
  difficulty: CoreDifficulty;
  marks: number;
  subject: string | null;
}

/* ───────────────────────────── TPO insights ───────────────────────────── */

export interface CoreHeatmapCell {
  accuracy: number | null;
  attempts: number;
  students: number;
}

export interface CoreHeatmapResponse {
  disciplines: {
    code: CoreDiscipline;
    name: string;
    short: string;
    students: number;
    subjects: { id: number; name: string; accuracy: number | null; attempts: number; students: number }[];
    branches: { code: string | null; name: string; students: number; cells: Record<string, CoreHeatmapCell> }[];
  }[];
  insights: { discipline: CoreDiscipline; discipline_name: string; subject: string; accuracy: number; students: number; message: string }[];
}

export interface CoreProficiencyStudent {
  id: number;
  name: string;
  roll_number: string | null;
  branch: string | null;
  section: string | null;
  track_focus: "core_first" | "balanced" | "it_first" | null;
  readiness_score: number;
  profile: "software" | "core" | "balanced" | "general";
  core_readiness: number | null;
  answered: number;
  topics_mastered: number;
  tests_taken: number;
  avg_test_percent: number | null;
  subjects: Record<string, { accuracy: number | null; attempts: number }>;
}

export interface CoreProficiencyResponse {
  disciplines: { code: CoreDiscipline; name: string; subjects: { id: number; name: string }[]; students: CoreProficiencyStudent[] }[];
}
