<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\User;

/**
 * A company hiring tenant's read-only browse of every partner college — the
 * entry point for proposing one of the company's own job openings to a
 * specific campus (see CompanyDriveController::proposeToColleges()).
 * Deliberately limited to honest, aggregate figures (student count, tier,
 * placement rate) — never a roster or per-student data, which only ever
 * becomes visible once a real relationship exists (an approved drive +
 * real assessment scores, see CompanyContestController::results()).
 */
class CompanyCollegeController extends Controller
{
    public function index()
    {
        $colleges = College::where('is_active', true)
            ->withCount(['users as student_count' => fn ($q) => $q->where('role', User::ROLE_USER)])
            ->orderBy('name')
            ->get(['id', 'name', 'short_code', 'city', 'state', 'tier', 'placement_rate']);

        return response()->json(['colleges' => $colleges]);
    }
}
