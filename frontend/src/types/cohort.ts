import type { CohortLanguage } from "./languageInsights";
import type { CohortVaultAi } from "./vaultAi";

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

/** What a row says about Core Prep — present only for a student of a branch whose Core Prep is live (null for everyone else, CSE included). */
export interface CohortCore {
  /** The weighting their readiness score used: software · core · balanced. */
  profile: "software" | "core" | "balanced" | "general";
  /** The core component of their readiness (0–100); null if their profile has none. */
  readiness: number | null;
  /** Core questions answered in the last 180 days (practice + tests). */
  answered_30d: number;
  weakest_subject: string | null;
  weakest_accuracy: number | null;
}

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
  /** What the college's branch text was recognised as ("mech", "ece"…) — null until recognised. Filters and reports run on these; `branch` stays the college's own wording. */
  branch_code?: string | null;
  /** The branch family: cse / ece / eee / mech / civil / other. */
  discipline?: string | null;
  /** 'college' = imported or edited by staff (authoritative); 'self' = the student said so. */
  branch_source?: "college" | "self" | null;
  /** The department the student belongs to (engineering · management · commerce · arts …); null = not classified yet, read as engineering. */
  department?: string | null;
  /** The year they pass out, as the college filed it; null until it files one. */
  graduation_year?: number | null;
  /** The year of study they are in right now (1-4; above 4 = passed out), derived from `graduation_year` so it moves on by itself every July. Null = not filed. */
  study_year?: number | null;
  /** "3rd year" / "Passed out"; null when not filed. */
  year_label?: string | null;
  /** Where they stand on unlocking the Vault AI Interview (the same answer the student sees). */
  vault_ai?: CohortVaultAi | null;
  /** Non-CS students' chosen weighting: core_first / balanced / it_first. */
  track_focus?: "core_first" | "balanced" | "it_first" | null;
  /** Core Prep standing — null unless their branch's Core Prep is live. */
  core?: CohortCore | null;
  section: string | null;
  phone: string | null;
  parent_phone: string | null;
  cgpa: string | null;
  backlogs: number | null;
  is_blocked: boolean;
  /** Why and by whom the account was blocked; null while it is active. `by_coordinator`: a Section Coordinator did it (not Mellow staff). */
  blocked?: { reason: string | null; at: string | null; by_coordinator: boolean } | null;
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
