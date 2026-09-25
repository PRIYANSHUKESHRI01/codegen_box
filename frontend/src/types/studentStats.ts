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
}

export interface ReadinessStats {
  score: number;
  tier: "Placement Ready" | "In Progress" | "Needs Training";
  practice_score: number;
  components: ReadinessComponent[];
  next_steps: string[];
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
