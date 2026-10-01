export type PrepQuestionCategory = "Aptitude" | "Coding" | "Technical" | "System Design" | "HR" | "Behavioral";

export type DriveStatus = "draft" | "published" | "completed" | "cancelled";

/** A drive/college mapping's resolved requirements (min CGPA, backlog cap, eligible branches). */
export interface DriveEligibility {
  minCgpa: number | null;
  maxBacklogs: number | null;
  eligibleBranches: string[] | null;
}

export type StudentEligibilityStatus = "eligible" | "not_eligible" | "unknown";

/**
 * The signed-in student's own pass/fail against a drive's requirements,
 * computed server-side from their academic record (roll import data, never
 * client-supplied). "unknown" means a required field (e.g. CGPA) isn't on
 * their record yet — not a false negative.
 */
export interface StudentEligibility {
  status: StudentEligibilityStatus;
  reasons: string[];
}

export interface PlacementCompanySummary {
  id: number;
  name: string;
  slug: string;
  logo: string | null;
}

export interface UpcomingPlacementDrive {
  id: number;
  title: string;
  company: PlacementCompanySummary;
  roleTitle: string;
  ctcRange: string | null;
  driveDate: string;
  durationMinutes: number | null;
  eligibility: DriveEligibility;
  studentEligibility: StudentEligibility;
  myApplication: MyDriveApplication | null;
}

export interface PlacementCompanyDetail extends PlacementCompanySummary {
  overview: string | null;
  hiringProcess: { name: string; description?: string }[];
}

export interface PrepQuestion {
  id: number;
  askedYear: number;
  category: PrepQuestionCategory;
  roundName: string | null;
  question: string;
  answerNotes: string | null;
}

export interface RecommendedProblemRef {
  problemSlug: string;
  topicTag: string | null;
  priority: number;
  /** Resolved server-side against the real Problem table (see StudentDriveController::recommendedProblems) — null/false when the slug has no real match. */
  title: string | null;
  difficulty: string | null;
  available: boolean;
}

/** A student's own progress on a drive's ATS pipeline — null until their TPO registers them (see DriveApplication/DrivePipelineService). */
export interface MyDriveApplication {
  stage: DriveApplicationStage;
  stage_label: string;
  ctc_offered: string | null;
  is_terminal: boolean;
}

export interface PlacementDriveDetail {
  drive: UpcomingPlacementDrive & { status: DriveStatus; termsAndConditions: string | null };
  company: PlacementCompanyDetail;
  prepQuestions: PrepQuestion[];
  recommendedProblems: RecommendedProblemRef[];
}

// --- Real placement pipeline (PlacementReportService) — replaces the
// previously 100%-fictional PLACEMENT_FUNNEL/RECENT_PLACEMENTS/etc mock
// data in data/tpoAnalytics.ts. ---

export const DRIVE_APPLICATION_STAGES = [
  "registered",
  "online_test",
  "technical_interview",
  "hr_round",
  "offer_extended",
  "offer_accepted",
  "rejected",
  "withdrawn",
] as const;

export type DriveApplicationStage = (typeof DRIVE_APPLICATION_STAGES)[number];

/** Mirrors DriveApplication::stageLabel() / TERMINAL_STAGES on the backend — one source of truth for every surface that renders a stage. */
export const DRIVE_APPLICATION_STAGE_LABELS: Record<DriveApplicationStage, string> = {
  registered: "Registered",
  online_test: "Online Test",
  technical_interview: "Technical Interview",
  hr_round: "HR Round",
  offer_extended: "Offer Extended",
  offer_accepted: "Offer Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const DRIVE_APPLICATION_TERMINAL_STAGES: DriveApplicationStage[] = ["offer_accepted", "rejected", "withdrawn"];

export interface DriveApplication {
  id: number;
  placement_drive_id: number;
  user_id: number;
  stage: DriveApplicationStage;
  stage_updated_at: string;
  ctc_offered: string | null;
  notes: string | null;
  user: {
    id: number;
    name: string;
    email: string;
    roll_number: string | null;
    branch: string | null;
    parent_phone: string | null;
    /** A candidate's own contact number (never set for a student row — see parent_phone above instead). Only ever populated by the company hiring endpoints. */
    phone?: string | null;
  };
}

export interface PlacementFunnel {
  batch_enrolled: number;
  registered: number;
  shortlisted: number;
  interviewed: number;
  offered: number;
  accepted: number;
}

export interface RecentPlacement {
  student_name: string;
  roll_number: string | null;
  branch: string | null;
  company: string;
  role_title: string;
  ctc_offered: string;
  placed_at: string;
}

export interface PackageBracket {
  bracket: string;
  count: number;
}

export interface CompanyPlacementSummary {
  company: string;
  offers_accepted: number;
  avg_ctc: number | null;
  max_ctc: number | null;
}

export interface BranchTrendRow {
  year: number;
  branch: string;
  applications: number;
  offers_accepted: number;
  placement_rate: number;
}

export interface PlacementTarget {
  target_percent: string | null;
  target_deadline: string | null;
  current_percent: number;
}

export interface PlacementActionItem {
  type: string;
  message: string;
}

export interface PlacementReportData {
  funnel: PlacementFunnel;
  recent_placements: RecentPlacement[];
  package_distribution: PackageBracket[];
  company_summary: CompanyPlacementSummary[];
  branch_trend: BranchTrendRow[];
  target: PlacementTarget;
  action_items: PlacementActionItem[];
}
