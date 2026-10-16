import type { CareerGoal, FocusArea, SkillLevel, WeeklyPace } from "@/lib/studentPreferences";

/**
 * Mirrors LanguageInsightsService on the backend — which language a student
 * actually solves problems in, how it goes in each, and where to improve. The
 * same shape feeds the student's own Language Focus card (GET /me/language-insights)
 * and the `languages` section of a TPO / coordinator / admin student report.
 *
 * "Attempts" are submissions with a final verdict (a practice Submit is one per
 * problem per day, a contest attempt is each try) and `acceptance_rate` is the
 * share that were Accepted — best read as a comparison between a student's own
 * languages, not an absolute pass-rate.
 */

export type Proficiency = "getting_started" | "steady" | "strong" | "needs_work";

export interface LanguageStat {
  language: string;
  attempts: number;
  accepted: number;
  /** Distinct problems Accepted in this language (practice and contests together). */
  solved: number;
  wrong_answers: number;
  runtime_errors: number;
  compile_errors: number;
  acceptance_rate: number;
  share_percent: number;
  last_used_at: string | null;
  proficiency: Proficiency;
}

export type FindingKind = "low_acceptance" | "compile_errors" | "runtime_errors" | "preferred_not_practiced";

export interface LanguageFinding {
  kind: FindingKind;
  severity: "high" | "medium";
  language: string;
  attempts: number;
  acceptance_rate: number;
  compile_error_share: number;
  runtime_error_share: number;
  dominant_failure: "wrong_answer" | "runtime_error" | "compile_error" | null;
  stronger_language: { language: string; acceptance_rate: number } | null;
}

export interface StatedPreferences {
  primary_language: string | null;
  preferred_languages: string[];
  skill_level: SkillLevel | null;
  career_goal: CareerGoal | null;
  focus_areas: FocusArea[];
  weekly_pace: WeeklyPace | null;
  /** Whether they finished the first-login onboarding. */
  onboarded: boolean;
}

export interface LanguageInsights {
  stated: StatedPreferences;
  /** The language they have solved the most in; null until they have submitted anything. */
  actual_primary_language: string | null;
  totals: { attempts: number; accepted: number; languages_used: number };
  /** Best first: most solved, then most accepted, then most attempts, then most recent. */
  languages: LanguageStat[];
  improve: LanguageFinding[];
  /** They named one primary language but mostly solve in another (only once there is enough activity to say). */
  mismatch: boolean;
}

/** The compact per-language entry on a cohort roster row (see StudentCohortService::row()). */
export interface CohortLanguage {
  language: string;
  attempts: number;
  accepted: number;
  solved: number;
  acceptance_rate: number;
  proficiency: Proficiency;
}
