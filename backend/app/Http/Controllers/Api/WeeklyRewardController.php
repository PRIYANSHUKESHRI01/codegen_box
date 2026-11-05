<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\WeeklyRewardService;
use Illuminate\Http\Request;

/**
 * The student-facing side of the weekly leaderboard rewards: what the top of this week's board wins, and where the student
 * stands. `live: false` means no voucher is on this week and the dashboard draws nothing.
 */
class WeeklyRewardController extends Controller
{
    public function show(Request $request, WeeklyRewardService $rewards)
    {
        return response()->json($rewards->bannerFor($request->user()));
    }

    /** The student's own wins: which voucher, which week, and — once the superadmin has sent it — the code. */
    public function mine(Request $request, WeeklyRewardService $rewards)
    {
        return response()->json(['wins' => $rewards->winsOf($request->user())]);
    }
}
