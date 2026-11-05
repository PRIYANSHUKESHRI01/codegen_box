// Mirrors DailyChallengeController (GET /daily-challenge and /daily-challenge/leaderboard) —
// see backend/app/Services/DailyChallengeService.php. One "edition" is one day's daily contest.

export interface DailyEdition {
  slug: string;
  title: string;
  start_at: string;
  end_at: string;
  state: "upcoming" | "live" | "ended";
  is_finalized: boolean;
  is_rated: boolean;
  problem_count: number;
  total_points: number;
  registered_count: number;
  is_registered: boolean;
  /** When a student can sign up: opens 15 h before the start, closes 1 min before it. */
  registration: DailyRegistration | null;
}

export interface DailyRegistration {
  state: "not_open" | "open" | "closed";
  opens_at: string;
  closes_at: string;
}

export interface DailyStandingRow {
  rank: number;
  user: { id: number; name: string; handle: string };
  score: number;
  penalty_minutes: number;
  /** Null until the edition is finalised and its ratings are applied. */
  rating_delta: number | null;
  rating_after: number | null;
}

export interface DailyLadderRow {
  rank: number;
  user: { id: number; name: string; handle: string };
  rating: number;
  contests: number;
}

export interface DailyHero {
  name: string;
  schedule: { start_label: string; duration_minutes: number; timezone: string };
  /** The edition running now, else the next to open; null before the day's contest has been created. */
  featured: DailyEdition | null;
  /** When the next challenge opens, even when no edition exists yet. */
  next_start_at: string;
  latest: (DailyEdition & { participants: number; top: DailyStandingRow[]; my_result: DailyStandingRow | null }) | null;
  my_rating: { display: string; contests: number };
}

export interface DailyBoard {
  scope: "global" | "college";
  edition: (DailyEdition & { participants: number }) | null;
  top: DailyStandingRow[];
  my_result: DailyStandingRow | null;
  ladder: DailyLadderRow[];
  my_ladder: DailyLadderRow | null;
}
