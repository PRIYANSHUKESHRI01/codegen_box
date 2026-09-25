<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Real replacement for frontend/src/data/leaderboard.ts's 8 hardcoded rows.
 * Ranked by a difficulty-weighted "Solved Score" (real, comparable, and
 * available for every student from day one) rather than contest rating —
 * rating only exists for students who've entered a rated contest, and
 * mixing a ~1200-centered rating scale with an unbounded solved-score scale
 * into one ranking would be apples-to-oranges. A per-contest leaderboard
 * ranked by that contest's score/penalty already exists separately
 * (ContestController::leaderboard) — this is the all-time, always-available
 * one. `display_rating` is still surfaced per row so a rated student's
 * real rating is visible alongside their solved-score rank.
 */
class LeaderboardController extends Controller
{
    public function index(Request $request)
    {
        $scope = $request->query('scope', 'global'); // global | college
        $user = $request->user();

        $query = $this->baseQuery();

        if ($scope === 'college') {
            abort_unless($user->college_id, 422, 'You are not linked to a college.');
            $query->where('users.college_id', $user->college_id);
        }

        $ranked = $query->orderByDesc('solved_score')->orderBy('users.name')->get()->values();

        $myIndex = $ranked->search(fn ($row) => (int) $row->id === $user->id);
        $myRank = $myIndex !== false ? $myIndex + 1 : null;

        return response()->json([
            'scope' => $scope,
            'leaderboard' => $ranked->take(50)->map(fn ($row, $i) => $this->formatRow($row, $i + 1))->all(),
            'my_rank' => $myRank,
            'my_row' => $myIndex !== false ? $this->formatRow($ranked[$myIndex], $myRank) : null,
        ]);
    }

    private function baseQuery()
    {
        $solvedScoreSql = "COALESCE(SUM(CASE p.difficulty WHEN 'easy' THEN 10 WHEN 'medium' THEN 25 WHEN 'hard' THEN 50 ELSE 0 END), 0)";

        return User::query()
            ->leftJoin(
                DB::raw("(SELECT DISTINCT user_id, problem_id FROM submissions WHERE status = 'accepted') as s"),
                's.user_id',
                '=',
                'users.id'
            )
            ->leftJoin('problems as p', 'p.id', '=', 's.problem_id')
            ->where('users.role', User::ROLE_USER)
            // Every non-aggregate column is listed explicitly (not just
            // users.id) — MySQL's ONLY_FULL_GROUP_BY mode doesn't always
            // detect that these are functionally dependent on the primary
            // key once a join is involved.
            ->groupBy('users.id', 'users.name', 'users.handle', 'users.college_id', 'users.current_rating', 'users.rated_contests_count')
            ->select('users.id', 'users.name', 'users.handle', 'users.college_id', 'users.current_rating', 'users.rated_contests_count')
            ->selectRaw("{$solvedScoreSql} as solved_score");
    }

    private function formatRow($row, int $rank): array
    {
        return [
            'rank' => $rank,
            'user' => ['id' => $row->id, 'name' => $row->name, 'handle' => $row->handle],
            'solved_score' => (int) $row->solved_score,
            'display_rating' => $row->rated_contests_count > 0 ? (string) $row->current_rating : 'Unrated',
        ];
    }
}
