<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\College;
use App\Models\TalentPoolCandidate;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only (role: admin_internal + PERM_TALENT_POOL,
 * superadmin) — oversight of the shared Talent Pool marketplace itself.
 * Authoring the sourcing assessments (the coding test / interview that
 * qualify a candidate) is NOT here — that reuses AdminContestController /
 * AdminInterviewController with contest_type/interview_type = talent_pool
 * (see those classes), same "one source of truth per concept" pattern as
 * every other contest/interview type in this app. This controller is only
 * the marketplace roster: who's qualified, who's visible, and a policy
 * override to hide a candidate outright.
 */
class AdminTalentPoolController extends Controller
{
    /**
     * A minimal, self-contained college picker for the college-scoped
     * audience targeting on a talent_pool contest/interview (see
     * AdminContestController::store()) — deliberately not reusing
     * AdminController::colleges() (that's a heavier payload gated by
     * permission:colleges, a different permission a talent_pool-only staff
     * account may not hold).
     */
    public function colleges()
    {
        return response()->json([
            'colleges' => College::where('is_active', true)->orderBy('name')->get(['id', 'name', 'short_code']),
        ]);
    }

    public function index(Request $request)
    {
        $query = TalentPoolCandidate::query()
            ->with([
                'user:id,name,email,college_id,branch,cgpa',
                'user.college:id,name,short_code',
                'sourceContest:id,title,slug',
                'hiredByCompany:id,name,logo',
            ])
            ->withCount('inquiries');

        if ($request->filled('visibility_status')) {
            $query->where('visibility_status', $request->string('visibility_status'));
        }

        if ($request->filled('min_score')) {
            $query->where('score_percent', '>=', (float) $request->input('min_score'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->whereHas('user', fn ($q) => $q->where('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%"));
        }

        return response()->json([
            'candidates' => $query->latest('qualified_at')->paginate(30),
        ]);
    }

    /**
     * Mellow's own policy override — `hide` can be applied over any
     * currently-visible-or-pending candidate; `unhide` only ever reverses a
     * PRIOR `hide` from this same endpoint (visibility_status ===
     * hidden_by_mellow). A candidate who opted themselves out
     * (hidden_by_candidate) must opt back in from their own dashboard — this
     * endpoint deliberately cannot override that choice.
     */
    public function updateVisibility(Request $request, TalentPoolCandidate $candidate)
    {
        $validated = $request->validate([
            'action' => ['required', Rule::in(['hide', 'unhide'])],
        ]);

        if ($validated['action'] === 'hide') {
            abort_if($candidate->isHired(), 422, 'Cannot hide a candidate who has already been hired.');
            $candidate->update(['visibility_status' => TalentPoolCandidate::STATUS_HIDDEN_BY_MELLOW]);
        } else {
            abort_unless(
                $candidate->visibility_status === TalentPoolCandidate::STATUS_HIDDEN_BY_MELLOW,
                422,
                'Only a candidate hidden by Mellow can be unhidden here.'
            );
            $candidate->update(['visibility_status' => TalentPoolCandidate::STATUS_VISIBLE]);
        }

        ActivityLog::record(
            $request->user(),
            $validated['action'] === 'hide' ? 'Hid a Talent Pool candidate' : 'Unhid a Talent Pool candidate',
            'TalentPoolCandidate',
            $candidate->user?->name ?? "#{$candidate->id}"
        );

        return response()->json(['candidate' => $candidate->fresh(['user:id,name,email'])]);
    }
}
