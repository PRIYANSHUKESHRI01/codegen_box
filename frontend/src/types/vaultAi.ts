/**
 * Whether a student may take the Vault AI Interview yet - the server's answer (VaultAiAccessService), never re-derived here.
 *
 *  - open:        take it now (a direct AptRun user always; a college student once their wait and readiness are met)
 *  - locked:      a college student who has something still to do - see `reasons`
 *  - unavailable: their year (1st / 2nd) is not offered it
 */
export type VaultAiState = "open" | "locked" | "unavailable";

export type VaultAiReason = "year_not_set" | "year_not_offered" | "waiting_period" | "readiness";

export interface VaultAiAccess {
  state: VaultAiState;
  /** direct = no college, so no wait and no readiness gate. */
  audience: "direct" | "college";
  /** Year of study 1-4 (above 4 = passed out); null until the college files it. */
  study_year: number | null;
  year_label: string | null;
  reasons: VaultAiReason[];
  /** Days since first sign-in this year must wait (45 / 90); null when the year is not offered it. */
  required_days: number | null;
  first_login_at: string | null;
  /** When the wait ends; null until the first sign-in is on file. */
  unlocks_at: string | null;
  /** Days of the wait still to go (45, 44, 43 ...), 0 once it is over; null for a direct user. */
  days_remaining: number | null;
  waiting_period_met: boolean | null;
  readiness: { score: number | null; required: number; met: boolean; points_needed: number } | null;
  /** The student's best Vault AI Interview series average (0-100), kept on the student; null until they complete a series. */
  vault_ai_score?: number | null;
}

/** The TPO's view of the same thing, one student at a time (a cohort row's `vault_ai`). */
export interface CohortVaultAi {
  state: VaultAiState;
  reasons: VaultAiReason[];
  days_remaining: number | null;
  required_days: number | null;
  unlocks_at: string | null;
  /** The readiness score the interview asks for (60). */
  readiness_required?: number | null;
}
