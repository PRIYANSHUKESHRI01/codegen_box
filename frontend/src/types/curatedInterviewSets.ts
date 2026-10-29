export type InterviewDifficulty = "easy" | "medium" | "hard" | "standard";

export interface CuratedInterviewSetSummary {
  id: string;
  series_number?: number;
  set_number?: number;
  title: string;
  difficulty?: InterviewDifficulty;
  duration_minutes: number;
  description: string;
  tags: string[];
  question_count: number;
  /** Whether this set has enough questions to be sat. Absent on older servers: treat as ready. */
  ready?: boolean;
  preview_questions: string[];
}

export interface CuratedSeries {
  id: string;
  series_number: number;
  title: string;
  description: string;
  sets_count: number;
  sets: CuratedInterviewSetSummary[];
}

export interface CuratedStack {
  key: string;
  name: string;
  blurb: string;
  icon: string;
  /** The Mellow Vault domain names this stack covers ("AI/ML", "SQL Developer"), searchable. */
  aliases?: string[];
  tags?: string[];
  /**
   * Open to students: all 9 of its sets have questions. A stack that is not live is listed as "Coming soon" and cannot be started.
   * Absent on older servers: treat as live.
   */
  live?: boolean;
  ready_sets?: number;
  total_sets?: number;
  /** The student asked to be told when it opens. Only ever true for a stack that is not live. */
  interested?: boolean;
  series_count?: number;
  series?: CuratedSeries[];
  sets_count: number;
  sets: CuratedInterviewSetSummary[];
}

export interface CuratedRole {
  key: string;
  title: string;
  blurb: string;
  icon: string;
  badge?: string | null;
  color: string;
  stacks_count: number;
  /** How many of its stacks are open. Absent on older servers: all of them. */
  live_stacks_count?: number;
  sets_count: number;
  stacks: CuratedStack[];
}

export interface CuratedCatalogResponse {
  roles: CuratedRole[];
  stats: {
    total_roles: number;
    total_stacks: number;
    live_stacks?: number;
    total_sets: number;
    total_questions: number;
  };
}

export interface CuratedStartResponse {
  interview: {
    id: number;
    slug: string;
    title: string;
    question_count: number;
    practice_config?: Record<string, unknown>;
  };
}

export interface QualificationSetDetail {
  set_number: number;
  set_id: string;
  title: string;
  description: string;
  duration_minutes: number;
  question_count: number;
  preview_questions: string[];
  /** "scoring": the set was sat but its score has not landed yet. */
  status: "not_started" | "in_progress" | "scoring" | "completed";
  score_percent: number | null;
  interview_slug: string | null;
}

/** GET /vault-qualification/status for a stack that has no questions yet: nothing to sit, but they can ask to be told. */
export interface VaultQualificationComingSoonResponse {
  stack_live: false;
  status: "coming_soon";
  stack_key: string;
  role_key: string;
  ready_sets: number;
  total_sets: number;
  interested: boolean;
}

export interface VaultQualificationStatusResponse {
  stack_live?: true;
  qualification_id: number;
  user_id: number;
  stack_key: string;
  role_key: string;
  status: "in_progress" | "qualified" | "cooling_down";
  is_qualified: boolean;
  is_cooling_down: boolean;
  current_attempt: number; // 1, 2, 3
  max_attempts: number; // 3
  attempts_remaining: number;
  cooldown_until: string | null;
  cooldown_formatted_date: string | null;
  cooldown_days_remaining: number;
  cooldown_hours_remaining: number;
  active_series: {
    series_number: number;
    title: string;
    sets: QualificationSetDetail[];
    completed_sets_count: number;
    all_sets_completed: boolean;
    series_average: number | null;
  };
  past_attempts: Array<{
    attempt: number;
    series_number: number;
    scores: Record<string, number>;
    average: number;
    evaluated_at: string;
    passed: boolean;
  }>;
}
