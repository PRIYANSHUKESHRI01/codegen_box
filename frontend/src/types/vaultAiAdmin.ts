// Mirrors the JSON of the Vault AI Interview question tools (backend AdminVaultQuestionController / CuratedQuestionAdmin).

export interface VaultAiCoverageStack {
  key: string;
  name: string;
  /** The Mellow Vault domain names this stack covers. */
  aliases: string[];
  /** Open to students: all 9 sets have enough questions. */
  live: boolean;
  ready_sets: number;
  total_sets: number;
  questions: number;
  /** Of those, how many staff added (the rest are hand-written in the catalog). */
  custom_questions: number;
  /** Students who asked to be told and have not been yet. */
  waiting: number;
  /** Students who ever asked. */
  interested: number;
  /** Questions per set: 3 series x 3 sets. */
  grid: number[][];
}

export interface VaultAiCoverageRole {
  key: string;
  title: string;
  color: string;
  stacks: VaultAiCoverageStack[];
}

export interface VaultAiCoverage {
  /** How many questions a set needs before it counts as ready. */
  min_questions: number;
  stats: { stacks: number; live: number; coming_soon: number };
  roles: VaultAiCoverageRole[];
}

export type VaultAiCategory = "technical" | "behavioral" | "hr" | "situational" | "aptitude";

export interface VaultAiQuestion {
  /** null for a hand-written question (read-only). */
  id: number | null;
  text: string;
  category: VaultAiCategory;
  duration_seconds: number;
  /** What a strong answer covers — the rubric the AI scorer is given. */
  note: string | null;
  source: "builtin" | "custom";
}

export interface VaultAiSet {
  id: string;
  set_number: number;
  title: string;
  description: string;
  ready: boolean;
  questions: VaultAiQuestion[];
}

export interface VaultAiSeries {
  series_number: number;
  title: string;
  sets: VaultAiSet[];
}

export interface VaultAiStackDetail {
  key: string;
  name: string;
  blurb: string;
  role: { key: string; title: string };
  aliases: string[];
  live: boolean;
  ready_sets: number;
  total_sets: number;
  min_questions: number;
  waiting: number;
  series: VaultAiSeries[];
}

export interface VaultAiImportResult {
  added: number;
  duplicates: number;
  errors: Array<{ row: number; message: string }>;
  /** Names of the stacks this upload opened to students. */
  opened: string[];
}
