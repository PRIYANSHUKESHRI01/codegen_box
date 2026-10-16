import type { CohortLanguage } from "./languageInsights";

/**
 * Where a student stands on coding practice, in one word — decided on the
 * backend (StudentCohortService::engagement) so every surface agrees:
 *  - pending_activation: still on the one-time password, never signed in
 *  - not_started:        signed in, has never submitted anything
 *  - active:             practised in the last 7 days
 *  - slipping:           last practised 8–21 days ago
 *  - dormant:            last practised more than 21 days ago
 */
export type Engagement = "pending_activation" | "not_started" | "active" | "slipping" | "dormant";

/**
 * A student row shaped by StudentCohortService on the backend — shared by
 * every surface that renders a cohort table (the TPO's full Student Cohort
 * page and the Section Coordinator's section-scoped roster) so the row
 * shape can never drift between them.
 */
export interface CohortStudent {
  id: number;
  name: string;
  email: string;
  roll_number: string | null;
  branch: string | null;
  section: string | null;
  phone: string | null;
  parent_phone: string | null;
  cgpa: string | null;
  backlogs: number | null;
  is_blocked: boolean;
  readiness_score: number;
  readiness_tier: "Placement Ready" | "In Progress" | "Needs Training";
  practice_score: number;
  eligible_for_active_drive: boolean | null;
  /** How many of the college's currently active mapped drives this student
   * actually clears — what makes the Eligibility badge self-explanatory
   * instead of a flat yes/no that can't say why (see StudentCohortService). */
  eligible_drive_count: number;
  active_drive_count: number;
  created_at: string;
  /** False while the account is still on its one-time emailed password. */
  activated: boolean;
  /** Whether they answered the first-login onboarding (language, level, goal…). */
  onboarded: boolean;
  /** Distinct practice problems solved, by difficulty. */
  solved: { total: number; easy: number; medium: number; hard: number };
  activity: {
    engagement: Engagement;
    last_practice_at: string | null;
    /** Whole days since they last submitted anything; null if never. */
    days_since_practice: number | null;
    last_seen_at: string | null;
    /** Distinct days they practised in the last 30. */
    active_days_30: number;
  };
  coding: {
    /** The language they've actually solved the most in. */
    primary_language: string | null;
    /** The language they said they code in during onboarding. */
    stated_language: string | null;
    /** They named one language but mostly solve in another. */
    mismatch: boolean;
    /** Every language they've submitted in, best first. */
    languages: CohortLanguage[];
    /** Languages with enough submissions to say it's going badly (low acceptance, many compile/runtime errors). */
    needs_work: string[];
  };
}
