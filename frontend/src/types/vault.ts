// Mirrors the Vault endpoints on the backend:
//   student:  GET /api/me/vault                       (StudentVaultController)
//   company:  GET /api/company/vault[/{id}]           (CompanyVaultController)
//   staff:    GET /api/admin/vault/*                  (AdminVaultController)

import type { ReadinessComponent, ReadinessDecay, ReadinessHistory, ReadinessOverride } from "./studentStats";

/** The one derived status every screen reads — see VaultProfile::resolveStatus() on the backend. */
export type VaultStatus =
  | "not_ready"
  | "upgrade_required"
  | "pending_consent"
  | "visible"
  | "hidden_by_candidate"
  | "hidden_by_mellow"
  | "hired";

export const VAULT_STATUS_LABEL: Record<VaultStatus, string> = {
  not_ready: "Not Vault-ready yet",
  upgrade_required: "Ready — upgrade to be hired",
  pending_consent: "Ready — awaiting your consent",
  visible: "Live in the Vault",
  hidden_by_candidate: "Hidden (your choice)",
  hidden_by_mellow: "Under Mellow review",
  hired: "Hired",
};

export type VaultInquiryStatus =
  | "interested"
  | "interview_scheduled"
  | "interview_completed"
  | "hired"
  | "declined_by_company"
  | "declined_by_candidate"
  | "withdrawn";

export interface VaultInquiry {
  id: number;
  status: VaultInquiryStatus | string;
  interview_scheduled_at: string | null;
  interview_mode: string | null;
  interview_location: string | null;
  interview_notes: string | null;
  responded_at: string | null;
  company: { id: number; name: string; logo: string | null; industry: string | null } | null;
}

export type SyncState = "idle" | "pending" | "delivered" | "failed";

// ── The student's own page ───────────────────────────────────────────────

export interface StudentVaultProfile {
  id: number;
  status: VaultStatus;
  status_label: string;
  is_eligible: boolean;
  consent: { given: boolean; given_at: string | null; withdrawn_at: string | null };
  qualified_at: string | null;
  peak_readiness: number;
  /** Set only on a profile carried over from the old Talent Pool contest. */
  legacy_score_percent: string | null;
  qualification_source?: string | null;
  ai_interview_score?: number | null;
  ai_interview_stack?: string | null;
  ai_interview_role?: string | null;
  ai_interview_scores?: Record<string, number> | null;
  ai_interview_attempt?: number | null;
  ai_interview_qualified_at?: string | null;
  hired: {
    at: string | null;
    via: "aptrun_partner" | "mellow_vault" | null;
    company: { id: number; name: string; logo: string | null } | null;
    employer_name: string | null;
  } | null;
  sync: { state: SyncState; on_mellow_vault: boolean; last_synced_at: string | null };
}

export interface StudentVaultResponse {
  readiness: {
    score: number;
    tier: "Placement Ready" | "In Progress" | "Needs Training";
    components: ReadinessComponent[];
    next_steps: string[];
    /** The score that makes a student eligible. */
    threshold: number;
    /** A listed student only comes off when their score drops below this. */
    exit_threshold: number;
    points_needed: number;
    base_score?: number;
    decay?: ReadinessDecay | null;
    /** Set only while a superadmin has set the score by hand. */
    override?: ReadinessOverride | null;
  };
  /** The last 30 days of the score. Absent from an older API. */
  history?: ReadinessHistory;
  /** Does the student's plan include being listed? Everything else on the page shows either way. */
  access: boolean;
  profile: StudentVaultProfile | null;
  inquiries: VaultInquiry[];
  /** Exactly what is shared, in the student's words — the consent screen shows it verbatim. */
  shared_fields: string[];
  never_shared: string[];
  mellow_vault_connected: boolean;
  ai_interview_qualifications?: Array<{
    id: number;
    stack_key: string;
    role_key: string;
    series_average: number;
    series_scores: Record<string, number> | null;
    current_attempt: number;
    qualified_at: string;
  }> | null;
}

// ── Hiring partners ──────────────────────────────────────────────────────

export interface VaultCandidateUser {
  id: number;
  name: string;
  college_id: number | null;
  branch: string | null;
  cgpa: string | null;
  backlogs?: number | null;
  current_rating: number;
  rated_contests_count: number;
  bio: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  skills: string[] | null;
  has_resume: boolean;
  profile_completion_percent: number;
  college?: { id: number; name: string; short_code: string; city?: string; state?: string } | null;
}

export interface VaultCandidate {
  id: number;
  visibility_status: VaultStatus;
  readiness_score: number;
  readiness_tier: string | null;
  readiness_components: ReadinessComponent[] | null;
  qualified_at: string | null;
  user: VaultCandidateUser;
  my_inquiry_status?: VaultInquiryStatus | string | null;
}

export interface VaultCandidateDetailResponse {
  profile: VaultCandidate;
  readiness: { score: number; tier: string; components: ReadinessComponent[] };
  display_rating: string | null;
  inquiry: (VaultInquiry & { messages?: { id: number; message: string; created_at: string }[] }) | null;
}

// ── Mellow staff ─────────────────────────────────────────────────────────

export interface AdminVaultSummary {
  by_status: Record<VaultStatus, number>;
  eligible: number;
  consented: number;
  listed_on_mellow_vault: number;
  ai_qualifiers?: number;
  thresholds: { enter: number; exit: number };
  sync: {
    configured: boolean;
    url_set: boolean;
    secret_set: boolean;
    api_key_set: boolean;
    pending: number;
    retrying: number;
    dead: number;
    delivered_24h: number;
    oldest_waiting_minutes: number | null;
  };
}

export interface AdminVaultProfile {
  id: number;
  visibility_status: VaultStatus;
  is_eligible: boolean;
  readiness_score: number;
  peak_readiness: number;
  readiness_tier: string | null;
  qualified_at: string | null;
  consent_given_at: string | null;
  consent_withdrawn_at: string | null;
  hidden_by_staff_at: string | null;
  hidden_reason?: string | null;
  hired_at: string | null;
  hired_via: string | null;
  hired_employer_name: string | null;
  sync_state: SyncState;
  vault_listed_at: string | null;
  last_synced_at: string | null;
  qualification_source: "readiness" | "legacy_contest";
  inquiries_count: number;
  user: { id: number; name: string; email: string; branch: string | null; cgpa: string | null; is_blocked?: boolean; college?: { id: number; name: string; short_code: string } | null } | null;
  hired_by_company?: { id: number; name: string; logo: string | null } | null;
  hidden_by_staff?: { id: number; name: string } | null;
}

export interface AdminVaultSyncEvent {
  id: number;
  profile: string;
  type: "profile.upsert" | "profile.withdraw";
  reason: string | null;
  status: "pending" | "processing" | "delivered" | "failed" | "dead";
  attempts: number;
  available_at: string;
  delivered_at: string | null;
  last_status_code: number | null;
  last_error: string | null;
  created_at: string;
}

export interface Paginated<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface AdminVaultAiQualifier {
  id: number;
  user_id: number;
  stack_key: string;
  role_key: string;
  current_attempt: number;
  max_attempts: number;
  status: string;
  series_scores: Record<string, number> | null;
  series_average: number;
  qualified_at: string;
  user: {
    id: number;
    name: string;
    email: string;
    college_id: number | null;
    branch: string | null;
    branch_code: string | null;
    discipline: string | null;
    department: string | null;
    cgpa: string | null;
    is_blocked: boolean;
    college?: { id: number; name: string; short_code: string } | null;
    vault_profile?: {
      id: number;
      visibility_status: VaultStatus;
      readiness_score: number;
      readiness_tier: string | null;
      qualified_at: string | null;
      ai_interview_score: number | null;
      ai_interview_stack: string | null;
    } | null;
  };
}
