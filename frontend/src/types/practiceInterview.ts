/** What the "Practice interview" studio offers (GET /me/practice-interviews/options). */

export type PracticeDifficulty = "mixed" | "easy" | "medium" | "hard";

export interface PracticeRole {
  key: string;
  title: string;
  blurb: string;
  /** Matches an interest the student picked at onboarding. */
  recommended: boolean;
  /** How many bank questions fit this role's technical round; below a full round, the AI tops it up. */
  questions_available: number;
}

export interface PracticeRoleGroup {
  key: string;
  label: string;
  is_your_branch: boolean;
  roles: PracticeRole[];
}

export interface PracticeKind {
  key: string;
  label: string;
  blurb: string;
}

export interface PracticeOptions {
  groups: PracticeRoleGroup[];
  kinds: PracticeKind[];
  counts: number[];
  difficulties: PracticeDifficulty[];
  limits: { created_today: number; per_day: number };
  defaults: { role: string | null; kind: string; count: number; difficulty: PracticeDifficulty };
}

export interface PracticeInterviewCreated {
  interview: { slug: string; title: string; question_count: number };
}
