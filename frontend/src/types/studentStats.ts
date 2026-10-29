// Mirrors GET /api/me/stats (StudentStatsController::mine) — every field
// here is real, derived from the student's actual submissions/problems
// rows. Replaces STUDENT_PROFILE/studentAnalytics.ts's hardcoded mock data.

export interface DifficultyBucket {
  solved: number;
  total: number;
}

export interface SolvedStats {
  total_solved: number;
  easy: DifficultyBucket;
  medium: DifficultyBucket;
  hard: DifficultyBucket;
}

export interface StreakStats {
  current: number;
  max: number;
}

export interface ReadinessComponent {
  key: string;
  label: string;
  score: number;
  weight_percent: number;
  contribution: number;
  /** One line saying what the score is made of ("3 recent interviews · average 82%"). Absent on older API responses. */
  detail?: string;
}

/** How far a readiness score is from the Vault line — see GET /api/me/vault for acting on it. */
export interface ReadinessVault {
  threshold: number;
  qualifies: boolean;
  points_needed: number;
}

/** What staying away has cost: score = base_score - points. Mirrors ReadinessScoreService::decayFor(). */
export interface ReadinessDecay {
  enabled: boolean;
  /** False until the student has been tracked for a day — nothing is charged before that. */
  tracking: boolean;
  /** Points taken off the score today. */
  points: number;
  /** Complete days with no activity, inside the window. */
  missed_days: number;
  window_days: number;
  per_day: number;
  free_days: number;
  practised_today: boolean;
  last_active: string | null;
  /** Complete days since they last did anything; null when nothing in the window. */
  idle_days: number | null;
  /** The most a student can lose to missed days. */
  max_points: number;
}

/**
 * Present only while the AptRun team has set this student's score by hand: `score` is then that number and `calculated_score`
 * is what their activity alone adds up to. The reason is never sent to the student.
 */
export interface ReadinessOverride {
  active: true;
  score: number;
  calculated_score: number;
  calculated_tier: string;
  set_at: string | null;
  /** When it stops applying and the calculated score takes over again; null = until the team removes it. */
  expires_at: string | null;
}

/** One day on the readiness chart. `score` = `base_score` - `penalty`. */
export interface ReadinessHistoryPoint {
  date: string;
  score: number;
  base_score: number;
  penalty: number;
  /** Whether the student did anything that day. */
  active: boolean;
}

/** GET /api/me/readiness/history — also embedded in GET /api/me/vault. */
export interface ReadinessHistory {
  points: ReadinessHistoryPoint[];
  summary: {
    score: number;
    threshold: number;
    tracking_since: string | null;
    best: number;
    /** The first day the score reached the Vault line (null if it never has). */
    first_crossed_on: string | null;
    /** Points gained (or lost) over the last 7 days; null with no earlier day to compare with. */
    change_7d: number | null;
    /** "At this pace" — null unless the trend is real. */
    days_to_threshold: number | null;
  };
}

export interface ReadinessStats {
  score: number;
  tier: "Placement Ready" | "In Progress" | "Needs Training";
  practice_score: number;
  components: ReadinessComponent[];
  next_steps: string[];
  vault?: ReadinessVault;
  /** Which weighting made the score. Absent from an older API, which is "software". */
  profile?: "software" | "core" | "balanced" | "general";
  /** While set and in the future, the better of the core-profile and software scores stands. */
  grace_until?: string | null;
  /** What the components add up to, before missed days are taken off. Absent from an older API. */
  base_score?: number;
  decay?: ReadinessDecay | null;
  /** Set only while a superadmin has set the score by hand. */
  override?: ReadinessOverride | null;
}

export interface RatingStats {
  current_rating: number;
  rated_contests_count: number;
  display_rating: string; // "Unrated" or the numeric rating as a string
  solved_score: number;
}

export interface VerdictStat {
  status: string;
  count: number;
}

export interface LanguageUsage {
  language: string;
  count: number;
}

export interface TopicMastery {
  topic: string;
  solved: number;
  total: number;
  accuracy: number;
}

export interface RecentSubmission {
  /** Lets a caller with permission to see this student's code (the TPO/admin
   * Student Report page) fetch it via GET .../submissions/{id} — the code
   * itself is never included in this list (see Submission::$hidden on the
   * backend), only ever in that single-submission detail response. */
  id: number;
  problem_title: string;
  problem_slug: string;
  difficulty: string;
  language: string;
  status: string;
  runtime_ms: number | null;
  memory_kb: number | null;
  submitted_at: string;
}

export interface ActivityDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface WeeklyGoalProgress {
  current: number;
  target: number;
}

export interface WeeklyGoals {
  solved_this_week: WeeklyGoalProgress;
  hard_solved_this_week: WeeklyGoalProgress;
}

// Mirrors GET /api/me/rating-history (StudentStatsController::ratingHistory)
export interface RatingHistoryPoint {
  contest_title: string;
  date: string;
  rating: number;
  change: number;
  rank: number;
}

export interface MyStats {
  solved: SolvedStats;
  streak: StreakStats;
  readiness: ReadinessStats;
  rating: RatingStats;
  verdict_stats: VerdictStat[];
  language_usage: LanguageUsage[];
  topic_mastery: TopicMastery[];
  recent_submissions: RecentSubmission[];
  activity: ActivityDay[];
  weekly_goals: WeeklyGoals;
}
