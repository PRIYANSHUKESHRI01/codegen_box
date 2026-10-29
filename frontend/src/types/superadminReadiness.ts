/** Superadmin → Readiness. Mirrors SuperAdminReadinessController. */

export interface ReadinessRow {
  id: number;
  name: string;
  email: string;
  college: string | null;
  study_year: number | null;
  is_blocked: boolean;
  /** What every screen shows. */
  score: number;
  tier: string;
  /** What the student's activity alone adds up to (equal to `score` unless set by hand). */
  calculated_score: number;
  set_by_hand: boolean;
  /** A hand-set score that has run out - the student is back on their calculated one. */
  override_expired: boolean;
  vault_ready: boolean;
}

export interface ReadinessListResponse {
  summary: { students: number; set_by_hand: number; vault_line: number };
  students: ReadinessRow[];
  pagination: { current_page: number; last_page: number; total: number };
}

export interface ReadinessDetailResponse {
  student: { id: number; name: string; email: string; college: string | null; study_year: number | null };
  score: number;
  tier: string;
  calculated_score: number;
  calculated_tier: string;
  vault: { threshold: number; qualifies: boolean; points_needed: number };
  components: { key: string; label: string; score: number | null; weight: number | null; contribution: number | null }[];
  missed_day_penalty: number;
  override: {
    score: number;
    reason: string;
    set_by: string | null;
    set_at: string | null;
    expires_at: string | null;
    in_force: boolean;
  } | null;
  history: { at: string; by: string; action: string; score: number | null; score_before: number | null; score_after: number | null; reason: string | null }[];
}
