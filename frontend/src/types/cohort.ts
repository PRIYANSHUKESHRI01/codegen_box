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
}
