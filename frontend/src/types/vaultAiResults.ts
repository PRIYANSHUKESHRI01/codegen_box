// Mirrors VaultAiResultService::present() / ::listing() — see backend/app/Services/Vault/VaultAiResultService.php.

export interface VaultAiHistoryEntry {
  series: number;
  /** set number ("1" | "2" | "3") -> percent; empty for a result an admin granted outright. */
  scores: Record<string, number>;
  average: number;
  passed: boolean;
  at: string;
  source: "interview" | "admin";
  /** An admin's fresh start wiped the qualification this entry qualified; the best result still stands. */
  reset: boolean;
  is_best: boolean;
}

export interface VaultAiResult {
  id: number;
  stack_key: string;
  stack_name: string | null;
  role_key: string | null;
  status: "in_progress" | "qualified" | "cooling_down";
  qualified: boolean;
  ever_qualified: boolean;
  pass_mark: number;
  /** The final average of the three sets of the best series. */
  best_average: number | null;
  best_scores: Record<string, number>;
  best_series: number | null;
  best_at: string | null;
  last_average: number | null;
  last_at: string | null;
  attempts: number;
  history: VaultAiHistoryEntry[];
  /** The stored PDF (generated_reports.public_id), or null until it has been generated. */
  report_id: string | null;
  report_generated_at: string | null;
}

export interface MyVaultAiResults {
  pass_mark: number;
  results: VaultAiResult[];
}

export interface VaultAiResultRow extends VaultAiResult {
  student: { id: number; name: string; email: string; roll_number: string | null; branch: string | null; section: string | null };
  college: string | null;
  college_id: number | null;
}

export interface VaultAiResultList {
  total: number;
  page: number;
  per_page: number;
  pass_mark: number;
  totals: { results: number; students: number; qualified: number; average: number | null };
  stacks: { key: string; name: string; count: number }[];
  rows: VaultAiResultRow[];
}

export interface VaultAiReportRecord {
  id: string;
  filename: string;
  size_bytes: number;
  pages: number | null;
}
