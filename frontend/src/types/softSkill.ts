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
  duration_minutes: number;
  pass_percentage: number;
  max_attempts: number | null;
  question_count: number;
  category_composition: Partial<Record<SoftSkillCategory, number>>;
  company: { id: number; name: string; logo: string | null } | null;
  attempts_taken: number;
  best_score_percent: number | null;
  can_attempt: boolean;
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
