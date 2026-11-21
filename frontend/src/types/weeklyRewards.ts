// Mirrors WeeklyRewardController / LeaderboardController / SuperAdminWeeklyRewardController —
// see backend/app/Services/WeeklyRewardService.php and ContestLeaderboardService.php.

export interface RewardCard {
  key: string;
  brand: string;
  /** Voucher value in rupees. */
  amount: number;
  /** A file in /public/rewards. */
  logo: string;
  /** Brand colour as a hex string. */
  color: string;
  tagline: string;
}

/** A live card with the leaderboard rank it is for (the biggest voucher is rank 1's). */
export interface Prize extends RewardCard {
  rank: number;
}

export interface WeekInfo {
  /** The Monday's date, e.g. 2026-11-02. */
  key: string;
  starts_at: string;
  /** When the board starts again from zero (Monday 00:00 IST). */
  resets_at: string;
}

export interface RewardBanner {
  live: boolean;
  week: WeekInfo;
  prizes: Prize[];
  my: { rank: number | null; contest_score: number; prize: Prize | null } | null;
  /** What next week offers, once the superadmin has chosen it (null before). */
  next?: { week: WeekInfo; prizes: Prize[] } | null;
}

/** One of the student's own wins. The code is only present once the voucher has been marked sent. */
export interface MyWin {
  id: number;
  week_key: string;
  rank: number;
  brand: string;
  amount: number;
  logo: string;
  color: string;
  status: "pending" | "sent";
  voucher_code: string | null;
  sent_at: string | null;
}

export type LeaderboardPeriod = "weekly" | "all_time";

export interface ContestBoardRow {
  rank: number;
  user: { id: number; name: string; handle: string };
  contest_score: number;
  penalty_minutes: number;
  contests_played: number;
  display_rating: string;
  prize: Prize | null;
}

export interface ContestBoardResponse {
  period: LeaderboardPeriod;
  scope: "global" | "college";
  week: WeekInfo | null;
  prizes: Prize[];
  leaderboard: ContestBoardRow[];
  total: number;
  my_rank: number | null;
  my_row: ContestBoardRow | null;
}

// ── Superadmin ──────────────────────────────────────────────────────────────

export interface AdminRewardCard extends RewardCard {
  live: boolean;
  prize_rank: number | null;
}

export interface AdminStanding extends Omit<ContestBoardRow, "prize"> {
  prize: Prize | null;
  email?: string | null;
  college?: string | null;
  winner?: LedgerWinner | null;
}

export interface WeekFlags extends WeekInfo {
  is_current: boolean;
  is_past: boolean;
  is_future: boolean;
}

export interface ScheduleWeek extends WeekFlags {
  prizes: Prize[];
}

export type WinnerStatus = "pending" | "sent" | "cancelled" | "not_recorded";

/** A winners-ledger row (or, before the week is closed out, who would win: id null, status not_recorded). */
export interface LedgerWinner {
  id: number | null;
  week_key?: string;
  rank: number;
  user: { id: number | null; name: string; handle: string | null };
  contest_score: number;
  email: string | null;
  college: string | null;
  prize: Prize | null;
  status: WinnerStatus;
  has_code: boolean;
  voucher_code?: string | null;
  note: string | null;
  sent_at: string | null;
}

export interface DailyProblem {
  title: string | null;
  difficulty: string | null;
  points: number;
}

export interface DailyEdition {
  title: string;
  slug: string;
  start_at: string;
  end_at: string;
  state: "upcoming" | "live" | "ended";
  finalized: boolean;
  registered: number;
  scored: number;
  problems: DailyProblem[];
  registration: { state: "not_open" | "open" | "closed"; opens_at: string; closes_at: string } | null;
}

export interface DailySummary {
  name: string;
  start_label: string;
  duration_minutes: number;
  timezone: string;
  next_start_at: string;
  scheduled: boolean;
  next: DailyEdition | null;
  last: DailyEdition | null;
}

export interface AdminRewards {
  week: WeekFlags;
  current_week?: WeekInfo;
  schedule?: ScheduleWeek[];
  cards: AdminRewardCard[];
  standings: AdminStanding[];
  last_week: { week: WeekInfo; prizes: Prize[]; winners: LedgerWinner[] };
  pending_vouchers?: number;
  daily?: DailySummary;
}
