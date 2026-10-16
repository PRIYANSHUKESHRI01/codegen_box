export type SoftSkillCategory = "aptitude" | "reasoning" | "english" | "situational";
export type SoftSkillDifficulty = "easy" | "medium" | "hard";
export type SoftSkillAssessmentType = "general" | "tpo_mock" | "company";
export type SoftSkillAssessmentStatus = "draft" | "published" | "cancelled";

export const CATEGORY_LABELS: Record<SoftSkillCategory, string> = {
  aptitude: "Quantitative Aptitude",
  reasoning: "Logical Reasoning",
  english: "Verbal / English",
  situational: "Situational Judgment",
};

/** Same 5-color palette used everywhere else in this app (see types/article.ts / types/learningCentre.ts). */
export const CATEGORY_COLORS: Record<SoftSkillCategory, string> = {
  aptitude: "bg-accent-primary/10 text-accent-primary border-accent-primary/25",
  reasoning: "bg-amber-500/10 text-amber-500 border-amber-500/25",
  english: "bg-sky-500/10 text-sky-400 border-sky-500/25",
  situational: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
};

export const CATEGORY_ORDER: SoftSkillCategory[] = ["aptitude", "reasoning", "english", "situational"];

export const ASSESSMENT_TYPE_LABELS: Record<SoftSkillAssessmentType, string> = {
  general: "Mellow",
  tpo_mock: "Campus Mock",
  company: "Hiring Partner",
};

export interface SoftSkillAssessmentSummary {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  assessment_type: SoftSkillAssessmentType;
  /** true for a numbered AptRun library set ("Set 12"); false for a test somebody scheduled. */
  is_question_set: boolean;
  set_number: number | null;
  duration_minutes: number;
  pass_percentage: number;
  max_attempts: number | null;
  question_count: number;
  category_composition: Partial<Record<SoftSkillCategory, number>>;
  company: { id: number; name: string; logo: string | null } | null;
  attempts_taken: number;
  best_score_percent: number | null;
  /** The student has an unfinished attempt they can resume. */
  in_progress: boolean;
  can_attempt: boolean;
}

/** Which of the student's attempts a list is narrowed to. */
export type SoftSkillListStatus = "all" | "not_attempted" | "in_progress" | "completed";

export interface ListMeta {
  total: number;
  page: number;
  per_page: number;
  last_page: number;
  from: number;
  to: number;
  /** true when the user asked for "Show all". */
  all: boolean;
}

/** GET /soft-skills?scope=… — one page of the student's library, plus the header counts for both lists. */
export interface SoftSkillLibraryResponse {
  assessments: SoftSkillAssessmentSummary[];
  meta: ListMeta;
  counts: { sets: number; sets_completed: number; sets_in_progress: number; assigned: number };
}

export interface SoftSkillSessionQuestion {
  response_id: number;
  category: SoftSkillCategory;
  question_text: string;
  options: string[];
  selected_index: number | null;
}

export interface SoftSkillActiveSession {
  session: {
    id: number;
    status: "in_progress" | "completed";
    attempt_number: number;
    started_at: string;
    deadline_at: string;
  };
  assessment: { title: string; pass_percentage: number };
  questions: SoftSkillSessionQuestion[];
}

export interface SoftSkillResultItem {
  category: SoftSkillCategory;
  question_text: string;
  options: string[];
  selected_index: number | null;
  correct_index: number;
  is_correct: boolean | null;
  explanation: string | null;
}

export interface SoftSkillResult {
  id: number;
  assessment_title: string;
  assessment_slug: string;
  attempt_number: number;
  score_percent: number;
  pass_percentage: number;
  passed: boolean;
  category_breakdown: Partial<Record<SoftSkillCategory, { correct: number; total: number }>>;
  completed_at: string;
  /** null when the attempt was taken without proctoring (older attempts, or proctoring switched off). `terminated` = the strike limit ended it. */
  proctoring?: { violation_count: number; terminated: boolean } | null;
  results: SoftSkillResultItem[];
}

export interface SoftSkillHistoryEntry {
  session_id: number;
  title: string;
  slug: string;
  assessment_type: SoftSkillAssessmentType;
  score_percent: number;
  passed: boolean;
  completed_at: string;
}

// ---- Admin/TPO/Company authoring ----

export interface AdminSoftSkillAssessment {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  status: SoftSkillAssessmentStatus;
  assessment_type: SoftSkillAssessmentType;
  duration_minutes: number;
  pass_percentage: number;
  max_attempts: number | null;
  sessions_count: number;
  assessment_questions_count: number;
  /** Library sets this test was built from (see QuestionSetPicker). */
  applied_sets?: AppliedQuestionSet[];
  is_question_set?: boolean;
  question_set_number?: number | null;
  /** Only on library sets: how many tests have been built from it. */
  usages_count?: number;
}

/** "This test was built from that set" — snapshot, so it stays readable after a set is retired. */
export interface AppliedQuestionSet {
  id: number;
  question_set_id: number | null;
  set_title: string;
  set_number: number | null;
  questions_added: number;
  created_at: string;
}

export type SoftSkillSetUsageState = "unused" | "published" | "draft" | "cancelled";

export interface QuestionSetUsage {
  state: SoftSkillSetUsageState;
  /** How many of THIS caller's tests were built from the set. */
  count: number;
  /** The five most recent. */
  tests: { id: number; title: string; slug: string | null; status: SoftSkillAssessmentStatus | null; added_at: string | null }[];
}

/** One row of the scheduler's library picker. */
export interface QuestionSetItem {
  id: number;
  slug: string;
  title: string;
  label: string;
  set_number: number | null;
  description: string | null;
  duration_minutes: number;
  pass_percentage: number;
  question_count: number;
  category_composition: Partial<Record<SoftSkillCategory, number>>;
  usage: QuestionSetUsage;
}

export type QuestionSetUsageFilter = "all" | "unused" | "used";

export interface QuestionSetCatalogue {
  sets: QuestionSetItem[];
  meta: ListMeta;
  counts: { all: number; used: number; unused: number };
}

export interface AdminSoftSkillQuestion {
  id: number;
  category: SoftSkillCategory;
  difficulty: SoftSkillDifficulty;
  question_text: string;
  options: string[];
  correct_index: number;
}

export interface AttachedAssessmentQuestion {
  id: number;
  soft_skill_assessment_id: number;
  soft_skill_question_id: number;
  display_order: number;
  question: AdminSoftSkillQuestion;
}

export const RECOMMENDED_COMPOSITION: Partial<Record<SoftSkillCategory, number>> = {
  aptitude: 20,
  reasoning: 15,
  english: 15,
};
