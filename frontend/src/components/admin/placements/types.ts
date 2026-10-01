export interface AdminCompanyAdmin {
  id: number;
  name: string;
  email: string;
  is_blocked: boolean;
}

export interface AdminCompanyRow {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
  website_url: string | null;
  industry: string | null;
  overview: string | null;
  hiring_process: { name: string; description?: string }[] | null;
  is_active: boolean;
  /** "hiring_tenant" once a dashboard login has been provisioned (see admins below) — "catalog_only" for a company Mellow curates but that has never logged in. */
  account_type: "catalog_only" | "hiring_tenant";
  admins?: AdminCompanyAdmin[];
  placement_drives_count?: number;
  prep_questions_count?: number;
  recommended_problems_count?: number;
}

export interface AdminDriveCollegeMapping {
  id: number;
  college_id: number;
  status: "pending" | "approved" | "declined";
  is_active: boolean;
  college: { id: number; name: string; short_code: string };
}

/**
 * "Interview coming up — publish a mock or the final AI interview" nudge
 * data — see PlacementDrive::interviewUrgency(). Absent/null means the
 * drive has no interview_date set yet; should_prompt=false with a value
 * present means it applies but nothing's actionable right now.
 */
export interface InterviewUrgency {
  days_until: number;
  candidates_in_pipeline: number;
  has_mock_interview: boolean;
  has_final_interview: boolean;
  should_prompt: boolean;
}

export interface AdminDriveRow {
  id: number;
  company_id: number;
  title: string;
  role_title: string;
  ctc_range: string | null;
  drive_date: string;
  interview_date: string | null;
  interview_urgency: InterviewUrgency | null;
  duration_minutes: number | null;
  min_cgpa: string | null;
  max_backlogs: number | null;
  eligible_branches: string[] | null;
  terms_and_conditions: string | null;
  status: "draft" | "published" | "completed" | "cancelled";
  company?: { id: number; name: string; slug: string; logo: string | null };
  /** Every college this drive has ever been proposed/mapped to, whatever the outcome — see AdminPlacementDriveController::index()'s eager load. */
  college_mappings?: AdminDriveCollegeMapping[];
}

export interface AdminPartnerCollege {
  id: number;
  name: string;
  short_code: string;
  city: string | null;
  state: string | null;
}

export interface AdminPrepQuestionRow {
  id: number;
  company_id: number;
  asked_year: number;
  category: string;
  round_name: string | null;
  question: string;
  answer_notes: string | null;
  display_order: number;
}

export interface AdminRecommendedProblemRow {
  id: number;
  company_id: number;
  problem_slug: string;
  topic_tag: string | null;
  priority: number;
}

export const PREP_CATEGORIES = ["Aptitude", "Coding", "Technical", "System Design", "HR", "Behavioral"] as const;
export const DRIVE_STATUSES = ["draft", "published", "completed", "cancelled"] as const;
export const BRANCH_OPTIONS = ["CSE", "IT", "ECE", "EE", "MECH"] as const;

export const inputClass =
  "w-full px-3 py-2 rounded-control bg-elevated border border-border-subtle text-primary outline-none focus:border-accent-primary text-xs";
