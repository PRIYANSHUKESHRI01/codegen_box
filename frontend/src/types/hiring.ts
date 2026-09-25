// Mirrors CompanyReportsController::data() / HiringReportService::forCompany()
// on the backend — the company-tenant equivalent of types/placement.ts's
// PlacementReportData, with section logic entirely omitted and hiring-only
// metrics (time_to_hire_days/offer_accept_rate/source_breakdown) added.

export interface HiringFunnel {
  total_candidates: number;
  registered: number;
  shortlisted: number;
  interviewed: number;
  offered: number;
  accepted: number;
}

export interface RecentHire {
  candidate_name: string;
  opening: string;
  role_title: string;
  ctc_offered: string;
  hired_at: string;
}

export interface HiringPackageBracket {
  bracket: string;
  count: number;
}

export interface DriveHiringSummary {
  opening: string;
  role_title: string;
  candidates: number;
  offers_accepted: number;
  avg_ctc: number | null;
}

export interface HiringSourceBreakdown {
  company_invited: number;
  existing_platform_student: number;
  other: number;
}

export interface HiringActionItem {
  type: string;
  message: string;
}

export interface HiringReportData {
  funnel: HiringFunnel;
  recent_hires: RecentHire[];
  package_distribution: HiringPackageBracket[];
  drive_summary: DriveHiringSummary[];
  time_to_hire_days: number | null;
  offer_accept_rate: number | null;
  source_breakdown: HiringSourceBreakdown;
  action_items: HiringActionItem[];
}

export interface CompanyReportsData {
  company: { name: string; industry: string | null; logo: string | null };
  hiring: HiringReportData;
}

/** A partner college as seen from a company's dashboard — honest aggregate figures only, never a roster. See CompanyCollegeController. */
export interface CompanyPartnerCollege {
  id: number;
  name: string;
  short_code: string;
  city: string | null;
  state: string | null;
  tier: "Academic Enterprise" | "Pro Campus" | "Standard";
  placement_rate: string;
  student_count: number;
}
