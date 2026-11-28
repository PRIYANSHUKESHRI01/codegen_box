export type CollegeAssessmentStatus = "draft" | "published" | "closed";
export type CollegeAssessmentAssignmentStatus = "assigned" | "in_progress" | "completed";

export interface SoftSkillSetOption {
  id: number;
  title: string;
  slug: string;
  set_number: number | null;
  description: string | null;
  questions_count: number;
}

export interface SoftSkillQuestionOption {
  id: number;
  category: string;
  difficulty: string;
  question_text: string;
}

export interface CodingProblemOption {
  id: number;
  slug: string;
  title: string;
  difficulty: string;
  tags: string[];
}

export interface CuratedInterviewSetOption {
  id: string;
  title: string;
  role_title: string;
  stack_key: string;
  stack_name: string;
  series_number: number;
  set_number: number;
  question_count: number;
  preview_questions: string[];
}

export interface MockInterviewRoundOption {
  id: string;
  title: string;
  role_title: string;
  stack_name: string;
  question_count: number;
}

export interface InterviewBankQuestionOption {
  id: number;
  question_text: string;
  category: string;
  difficulty: string;
  discipline: string | null;
  expected_duration_seconds: number;
}

export interface TargetCollegeOption {
  id: number;
  name: string;
  short_code: string | null;
  city: string | null;
  students_count: number;
  departments: string[];
}

export interface TargetDepartmentOption {
  code: string;
  name: string;
  short: string;
}

export interface TargetBranchOption {
  code: string;
  name: string;
  short: string;
  discipline_code: string;
  department_code: string;
}

export interface CollegeAssessmentBuilderOptions {
  colleges: TargetCollegeOption[];
  departments: TargetDepartmentOption[];
  branches: TargetBranchOption[];
  soft_skill_sets: SoftSkillSetOption[];
  soft_skill_questions: SoftSkillQuestionOption[];
  problems: CodingProblemOption[];
  curated_interview_sets: CuratedInterviewSetOption[];
  mock_interview_rounds: MockInterviewRoundOption[];
  interview_question_bank: InterviewBankQuestionOption[];
}

export interface TargetStudentOption {
  id: number;
  name: string;
  email: string;
  roll_number: string | null;
  college_id: number | null;
  college_name: string | null;
  college_code: string | null;
  department: string | null;
  branch: string | null;
  branch_code: string | null;
  graduation_year: number | null;
}

export interface TargetScopeConfig {
  college_ids?: number[];
  department_codes?: string[];
  branch_codes?: string[];
  student_mode?: "all_matching" | "selected";
  user_ids?: number[];
}

export interface CollegeAssessmentSummaryItem {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  status: CollegeAssessmentStatus;
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  enforce_sequence: boolean;
  blocked_by_proctoring?: boolean;
  campaign_locked?: boolean;
  campaign_lock_reason?: string | null;
  passing_score_percent: number;
  target_scope: TargetScopeConfig | null;
  include_soft_skills: boolean;
  soft_skill_weight: number;
  soft_skill_assessment?: { id: number; slug: string; title: string; status: string; duration_minutes: number; pass_percentage: number } | null;
  include_coding: boolean;
  coding_weight: number;
  contest?: { id: number; slug: string; title: string; status: string; start_at: string | null; end_at: string | null } | null;
  include_interview: boolean;
  interview_weight: number;
  interview?: { id: number; slug: string; title: string; status: string } | null;
  assigned_count: number;
  in_progress_count: number;
  completed_count: number;
  avg_overall_score: number | null;
  created_at: string | null;
}

export interface CollegeAssessmentAssignmentRow {
  id: number;
  user_id: number;
  status: CollegeAssessmentAssignmentStatus;
  soft_skill_score_percent: number | null;
  coding_points: number | null;
  coding_max_points: number | null;
  coding_score_percent: number | null;
  interview_score_percent: number | null;
  overall_score_percent: number | null;
  passed: boolean | null;
  started_at: string | null;
  completed_at: string | null;
  student: {
    id: number | null;
    name: string | null;
    email: string | null;
    roll_number: string | null;
    department: string | null;
    branch: string | null;
    branch_code: string | null;
    graduation_year: number | null;
    college: { id: number; name: string; short_code: string | null } | null;
  };
}

export interface StudentCollegeAssessment {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  status: CollegeAssessmentStatus;
  is_open: boolean;
  starts_at: string | null;
  ends_at: string | null;
  enforce_sequence: boolean;
  blocked_by_proctoring?: boolean;
  campaign_locked?: boolean;
  campaign_lock_reason?: string | null;
  passing_score_percent: number;
  assignment_status: CollegeAssessmentAssignmentStatus;
  overall_score_percent: number | null;
  modules_total: number;
  modules_completed: number;
  started_at: string | null;
  completed_at: string | null;
  modules: {
    soft_skills:
      | {
          enabled: true;
          weight: number;
          slug: string;
          title: string;
          duration_minutes: number;
          pass_percentage: number;
          locked: boolean;
          score_percent: number | null;
          completed: boolean;
          in_progress: boolean;
        }
      | { enabled: false };
    coding:
      | {
          enabled: true;
          weight: number;
          slug: string;
          title: string;
          locked: boolean;
          points: number | null;
          max_points: number | null;
          score_percent: number | null;
          completed: boolean;
          in_progress: boolean;
        }
      | { enabled: false };
    interview:
      | {
          enabled: true;
          weight: number;
          slug: string;
          title: string;
          locked: boolean;
          score_percent: number | null;
          completed: boolean;
          scoring_pending: boolean;
          in_progress: boolean;
        }
      | { enabled: false };
  };
}

export type LaunchpadTrack = "tech" | "non_tech";
export type LaunchpadStatus = "draft" | "published" | "closed";

export interface LaunchpadProgramSummary {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  track: LaunchpadTrack;
  status: LaunchpadStatus;
  duration_days: number;
  min_readiness_percent: number;
  passing_score_percent: number;
  enforce_proctoring: boolean;
  target_scope: TargetScopeConfig | null;
  starts_at: string | null;
  ends_at: string | null;
  published_at: string | null;
  enrolled_count: number;
  in_progress_count: number;
  completed_count: number;
}

export interface LaunchpadAssessmentSlotSummary {
  set: number;
  status: CollegeAssessmentAssignmentStatus;
  blocked_by_proctoring?: boolean;
  overall_score_percent: number | null;
  soft_skill_score_percent: number | null;
  coding_score_percent: number | null;
  interview_score_percent: number | null;
}

export interface LaunchpadResultRow {
  enrollment_id: number;
  status: "enrolled" | "in_progress" | "completed";
  rotation_offset: number;
  assessments_completed: number;
  program_avg_score: number | null;
  readiness_score: number;
  readiness_qualified: boolean;
  fully_qualified: boolean;
  student: CollegeAssessmentAssignmentRow["student"];
  assessment_1: LaunchpadAssessmentSlotSummary;
  assessment_2: LaunchpadAssessmentSlotSummary;
  assessment_3: LaunchpadAssessmentSlotSummary;
}

export interface StudentLaunchpadCampaign {
  id: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  track: LaunchpadTrack;
  status: LaunchpadStatus;
  is_open: boolean;
  duration_days: number;
  starts_at: string | null;
  ends_at: string | null;
  enforce_proctoring: boolean;
  min_readiness_percent: number;
  passing_score_percent: number;
  readiness_score_percent: number;
  readiness_met: boolean;
  assessments_completed: number;
  assessments_total: number;
  program_avg_score: number | null;
  qualified: boolean;
  enrollment_status: "enrolled" | "in_progress" | "completed";
  assessments: {
    number: number;
    set_number: number;
    slug: string;
    title: string;
    status: CollegeAssessmentAssignmentStatus;
    locked?: boolean;
    blocked_by_proctoring?: boolean;
    lock_reason?: string | null;
    overall_score_percent: number | null;
    soft_skill_score_percent: number | null;
    coding_score_percent: number | null;
    interview_score_percent: number | null;
    include_soft_skills: boolean;
    include_coding: boolean;
    include_interview: boolean;
  }[];
}
