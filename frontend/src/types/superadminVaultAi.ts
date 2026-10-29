/** Superadmin → Vault AI. Mirrors SuperAdminVaultAiController. */

export type QualificationStatus = "in_progress" | "qualified" | "cooling_down";

export interface VaultAiAttempt {
  /** Position in the attempt history - what "correct this attempt" is addressed by. */
  index: number;
  attempt: number;
  series_number: number;
  scores: Record<string, number>;
  average: number;
  evaluated_at: string;
  passed: boolean;
  edited_by_admin?: boolean;
  /** False for the attempts of a cycle that was reset or has run its course. */
  this_cycle: boolean;
}

export interface VaultAiAdminLogEntry {
  at: string;
  by: string;
  by_id: number;
  action: "reset" | "scores" | "qualified";
  reason: string;
  result?: string;
  average?: number;
  scores?: Record<string, number>;
  past_attempt?: number | null;
}

export interface VaultAiQualificationRow {
  id: number;
  user: { id: number; name: string | null; email: string | null; college: string | null };
  stack_key: string;
  stack_name: string;
  role_name: string;
  status: QualificationStatus;
  /** Cooling down with days still to go - the student cannot sit. */
  is_blocked: boolean;
  /** Marked cooling down, but the 45 days are over: the student can sit again without anyone doing anything. */
  cooldown_over: boolean;
  current_attempt: number;
  max_attempts: number;
  failed_attempts: number;
  /** Marks of the series being sat (or of the qualifying series). */
  series_scores: Record<string, number>;
  series_average: number | null;
  cooldown_until: string | null;
  cooldown_days_remaining: number;
  qualified_at: string | null;
  /** Qualified by a person rather than by sitting the series. */
  qualified_by_admin: boolean;
  updated_at: string | null;
  /** Only in the per-student payload. */
  attempt_history?: VaultAiAttempt[];
  admin_log?: VaultAiAdminLogEntry[];
}

export interface VaultAiStackOption {
  key: string;
  name: string;
  role: string;
  live: boolean;
}

export interface VaultAiListResponse {
  summary: { blocked: number; cooldown_over: number; in_progress: number; qualified: number; qualified_by_admin: number; total: number };
  stacks: VaultAiStackOption[];
  qualifications: VaultAiQualificationRow[];
  pagination: { current_page: number; last_page: number; total: number };
}

export interface VaultAiGate {
  state: "open" | "locked" | "unavailable";
  audience: "direct" | "college";
  year_label: string | null;
  reasons: string[];
  required_days: number | null;
  days_remaining: number | null;
  readiness: { score: number | null; required: number; met: boolean; points_needed: number } | null;
}

export interface VaultAiStudentResponse {
  student: { id: number; name: string; email: string; college: string | null; study_year: number | null; is_blocked: boolean; vault_ai_score: number | null };
  gate: VaultAiGate;
  readiness: { score: number; tier: string; overridden: boolean };
  vault: { status: string; is_eligible: boolean; source: string | null; ai_interview_stack: string | null } | null;
  qualifications: VaultAiQualificationRow[];
  stacks: VaultAiStackOption[];
}

export interface StudentSearchHit {
  id: number;
  name: string;
  email: string;
  college: string | null;
}
