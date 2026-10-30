// Mirrors GET /api/mock-interviews/catalog (backend MockInterviewService::catalog).

/** How this student has done on one round. */
export interface MockRoundProgress {
  attempts: number;
  /** Best score of their finished sittings, 0-100; null until one is scored. */
  best_score: number | null;
  /** Study sets: the newest finished sitting's score and the one before it (null until there are that many). */
  last_score?: number | null;
  previous_score?: number | null;
  /** A finished sitting is still being scored. */
  scoring: boolean;
  /** An interview made for this round and not finished: starting the round resumes it. */
  open_slug: string | null;
  open_status: "ready" | "in_progress" | null;
}

export interface MockRound {
  id: string;
  round_number: number;
  title: string;
  description: string;
  duration_minutes: number;
  /** Questions in the round's bank. */
  question_count: number;
  /** Questions one sitting asks (less than the bank when the round is sampled). */
  sitting_questions: number;
  /** Has enough questions to practise. */
  ready: boolean;
  my: MockRoundProgress;
}

export interface MockStack {
  key: string;
  name: string;
  blurb: string;
  icon: string;
  aliases: string[];
  tags: string[];
  /** At least one round is ready. */
  live: boolean;
  /** A study exam: not scored by AI; after each answer the model answer and the match are shown. */
  study?: boolean;
  /** False for exam preparation (Merchant Navy): sittings never change the placement-readiness score. Absent from an older server = true. */
  counts_toward_readiness?: boolean;
  ready_rounds: number;
  total_rounds: number;
  rounds: MockRound[];
}

/** What a domain calls its parts when it is not "tech stack" / "round" (the Merchant Navy: exam, exams, set, sets). */
export interface MockTerms {
  stack: string;
  stacks: string;
  round?: string;
  rounds?: string;
}

export interface MockRole {
  key: string;
  title: string;
  blurb: string;
  icon: string;
  badge: string | null;
  color: string;
  /** What this domain calls a stack ("exam" for the Merchant Navy); null = "tech stack". */
  terms: MockTerms | null;
  stacks_count: number;
  live_stacks_count: number;
  stacks: MockStack[];
}

export interface MockCatalogResponse {
  roles: MockRole[];
  stats: { total_roles: number; total_stacks: number; live_stacks: number; total_questions: number };
  min_questions: number;
}

export interface MockStartResponse {
  interview: { id: number; slug: string; title: string; question_count: number };
}

// ── Staff side: Admin -> AI Interviews -> Mock interview questions (backend AdminMockInterviewQuestionController) ──

export type MockQuestionCategory = "technical" | "behavioral" | "hr" | "situational" | "aptitude";

export interface MockCoverageStack {
  key: string;
  name: string;
  aliases: string[];
  live: boolean;
  ready_rounds: number;
  total_rounds: number;
  questions: number;
  /** Questions in each of the three rounds. */
  grid: number[];
}

export interface MockCoverage {
  min_questions: number;
  stats: { stacks: number; live: number; coming_soon: number };
  roles: { key: string; title: string; color: string; terms?: MockTerms | null; stacks: MockCoverageStack[] }[];
}

export interface MockAdminQuestion {
  id: number;
  text: string;
  category: MockQuestionCategory;
  duration_seconds: number;
  note: string | null;
  /** The syllabus section, when the bank is organised by one. */
  topic: string | null;
  /** The reference answer holds a figure still to be checked against the current text. */
  needs_review: boolean;
  /** Where the question came from: the team's question bank ("document"), written by AptRun to fill a set ("generated"), or added here ("staff"). */
  origin?: "document" | "generated" | "staff";
  /** The picture this question is asked of (a Rule of the Road card), on this site; null for an ordinary question. Set when the cards are loaded, not editable. */
  image?: string | null;
}

export interface MockAdminRound {
  id: string;
  round_number: number;
  title: string;
  description: string;
  ready: boolean;
  questions: MockAdminQuestion[];
}

export interface MockAdminStack {
  key: string;
  name: string;
  blurb: string;
  role: { key: string; title: string; terms?: MockTerms | null };
  live: boolean;
  min_questions: number;
  rounds: MockAdminRound[];
}

export interface MockImportResult {
  added: number;
  duplicates: number;
  errors: { row: number; message: string }[];
  /** Names of the stacks this upload opened to students. */
  opened: string[];
}
