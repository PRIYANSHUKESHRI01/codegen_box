<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ContestLeaderboardService;
use App\Services\WeeklyRewardService;
use Illuminate\Http\Request;

/**
 * The global leaderboard — contest scores only (see ContestLeaderboardService for exactly what counts). Two boards:
 *
 *   weekly    this week's contest points, starting again from zero every Monday 00:00 (India time). When the superadmin has put
 *             voucher cards live for the week, the global board also says which rank wins which voucher.
 *   all_time  every platform-wide contest a student has ever scored in.
 *
 * `scope=global|college` narrows either board to the student's own college. A per-contest leaderboard exists separately
 * (ContestController::leaderboard), and the Daily Challenge's own board and rating ladder in DailyChallengeController.
 */
class LeaderboardController extends Controller
{
    public function __construct(
        private readonly ContestLeaderboardService $boards,
        private readonly WeeklyRewardService $rewards,
    ) {}

    public function index(Request $request)
    {
        $period = $request->query('period', ContestLeaderboardService::PERIOD_WEEKLY);
        $scope = $request->query('scope', 'global'); // global | college
        $user = $request->user();

        abort_unless(in_array($period, ContestLeaderboardService::PERIODS, true), 422, 'Unknown leaderboard period.');
        abort_unless(in_array($scope, ['global', 'college'], true), 422, 'Unknown scope.');

        if ($scope === 'college') {
            abort_unless($user->college_id, 422, 'You are not linked to a college.');
        }

        $weekly = $period === ContestLeaderboardService::PERIOD_WEEKLY;
        $week = $weekly ? $this->boards->week() : null;

        $ranked = $this->boards->standings($period, $scope === 'college' ? $user->college_id : null, $week);

        // Prizes belong to the global weekly board: a rank inside one college is not a rank on the whole platform.
        $prizes = $weekly && $scope === 'global' ? $this->rewards->prizes($week) : collect();
        $withPrize = fn (array $row) => $row + ['prize' => $prizes->isEmpty() ? null : $this->rewards->prizeForRank($prizes, $row['rank'])];

        $mine = $ranked->first(fn (array $row) => $row['user']['id'] === $user->id);

        return response()->json([
            'period' => $period,
            'scope' => $scope,
            'week' => $week ? $this->boards->weekPayload($week) : null,
            'prizes' => $prizes->values(),
            'leaderboard' => $ranked->take(ContestLeaderboardService::BOARD_SIZE)->map($withPrize)->values(),
            'total' => $ranked->count(),
            'my_rank' => $mine['rank'] ?? null,
            'my_row' => $mine ? $withPrize($mine) : null,
        ]);
    }
}
