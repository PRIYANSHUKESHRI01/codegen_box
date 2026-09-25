// Mirrors the JSON shapes returned by ContestController/ContestSubmissionController/AdminContestController
// — the REAL, backend-backed rated-contest engine (see backend/app/Models/Contest.php).
// Named distinctly from types/contest.ts, which already holds unrelated
// illustrative types for the logged-out landing page's marketing preview
// (components/contests/ContestPreview.tsx) — not the same feature.

import type { ProblemDetail } from "./problem";

export interface ContestSummary {
  id: number;
  title: string;
  slug: string;
  description: string | null;
  start_at: string;
  end_at: string;
  is_rated: boolean;
  has_started: boolean;
  has_ended: boolean;
  is_finalized: boolean;
  is_registered: boolean;
  problem_count: number;
  total_points: number;
  contest_type: "general" | "daily" | "company" | "tpo_mock";
  company: { id: number; name: string; logo: string | null } | null;
}

export interface LiveContestProblemRef {
  id: number;
  points: number;
  problem: {
    id: number;
    slug: string;
    title: string;
    difficulty: string;
  };
}

export interface ContestDetail extends ContestSummary {
  problems?: LiveContestProblemRef[];
}

export interface ContestLeaderboardRow {
  rank: number;
  user: { id: number; name: string; handle: string };
  score: number;
  penalty_minutes: number;
  rating_before: number | null;
  rating_after: number | null;
}

export interface ContestLeaderboard {
  is_finalized: boolean;
  leaderboard: ContestLeaderboardRow[];
}

export interface ContestProblemDetail {
  problem: ProblemDetail;
  points: number;
}
