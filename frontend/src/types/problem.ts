export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Problem {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  tags: string[];
  acceptanceRate: number; // percentage (e.g. 74.2)
  solved: boolean;
  totalSubmissions: number;
  description?: string;
  sampleInput?: string;
  sampleOutput?: string;
}

export type ProblemFilter = "All" | Difficulty;

// --- Real, database-backed problems (Practice Arena / solve screen) ---
// Separate from the marketing-page mock `Problem` type above: the API
// returns lowercase difficulty ('easy'|'medium'|'hard') and a richer shape
// (multiple examples, constraints, hints, per-language starter code).

export type ApiDifficulty = "easy" | "medium" | "hard";

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string | null;
}

export interface ProblemSummary {
  id: number;
  slug: string;
  title: string;
  difficulty: ApiDifficulty;
  tags: string[];
  acceptance_rate: string | number | null;
  total_submissions: number;
  /** Real — true iff this user has ever gotten `accepted` on this problem. Re-attempting is always allowed regardless. */
  solved: boolean;
}

export interface ProblemDetail extends ProblemSummary {
  description: string;
  examples: ProblemExample[];
  constraints: string[];
  hints: string[];
  starter_code: Record<string, string>;
}

// --- Code execution (POST /problems/{slug}/run) ---

export interface RunResultCase {
  case: number;
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
}

export interface RunResponse {
  results: RunResultCase[];
  all_passed: boolean;
  compile_error?: string;
  runtime_error?: string;
  status?: string;
  time?: string | null;
  memory?: number | null;
}
