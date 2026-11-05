<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DailyChallengeService;
use Illuminate\Http\Request;

/**
 * The student-facing face of the AptRun Daily Challenge: the hero on the Contests page and the
 * "Daily Challenge" tab of the global leaderboard. Read-only — registering, solving and ranking all
 * go through the ordinary contest endpoints (ContestController / ContestSubmissionController), which
 * is what keeps a daily edition exactly as fair and as proctored as any other rated round.
 */
class DailyChallengeController extends Controller
{
    public function __construct(private readonly DailyChallengeService $daily) {}

    public function show(Request $request)
    {
        return response()->json($this->daily->hero($request->user()));
    }

    public function leaderboard(Request $request)
    {
        $scope = $request->query('scope', 'global'); // global | college
        $user = $request->user();

        abort_unless(in_array($scope, ['global', 'college'], true), 422, 'Unknown scope.');

        if ($scope === 'college') {
            abort_unless($user->college_id, 422, 'You are not linked to a college.');
        }

        return response()->json($this->daily->board($user, $scope === 'college' ? $user->college_id : null));
    }
}
