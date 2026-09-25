<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\CompanyRecommendedProblem;
use App\Models\Contest;
use App\Models\ContestProblem;
use App\Models\ContestSubmission;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\Problem;
use App\Services\ContestFinalizeService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only (role: admin_internal, superadmin) — contests
 * are platform-run and centrally curated, mirroring how companies/drives
 * are never auto-generated in this app. A contest starts in `draft` so its
 * problem set can be assembled privately (see Contest::STATUS_*) before
 * `publish()` makes it visible to students at all.
 *
 * Only ever creates/edits `general` and `company` contests — `daily` is
 * exclusively GenerateDailyContest's domain and `tpo_mock` is exclusively
 * TpoContestController's (see guardNotTpoMock() below), even though this
 * controller's index() still lists every contest type for Mellow's own
 * platform-wide oversight.
 */
class AdminContestController extends Controller
{
    public function index()
    {
        $contests = Contest::withCount('participants')
            ->with(['company:id,name,logo', 'placementDrive:id,title', 'owningCollege:id,name,short_code'])
            ->latest('start_at')
            ->get();

        return response()->json([
            'contests' => $contests->map(fn (Contest $c) => [
                ...$c->toArray(),
                'visibility_summary' => $c->visibilityCollegeSummary(),
                'college_ids' => $c->isCompanyContest() || ($c->isTalentPool() && $c->audience_scope === Contest::AUDIENCE_SCOPE_COLLEGE)
                    ? $c->colleges()->pluck('colleges.id')
                    : null,
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after:start_at'],
            'is_rated' => ['boolean'],
            'contest_type' => ['sometimes', Rule::in([Contest::CONTEST_TYPE_GENERAL, Contest::CONTEST_TYPE_COMPANY, Contest::CONTEST_TYPE_TALENT_POOL])],
            'placement_drive_id' => ['required_if:contest_type,company', 'integer', 'exists:placement_drives,id'],
            // Which of the drive's currently-live colleges this specific
            // contest should target — a drive can be live at several
            // colleges without every contest attached to it going to all of
            // them. Optional: an empty/omitted selection just means "not
            // visible to anyone yet", fixable later via updateColleges().
            'college_ids' => ['sometimes', 'array'],
            'college_ids.*' => ['integer'],
            // talent_pool only — see Contest::AUDIENCE_SCOPES.
            'audience_scope' => ['required_if:contest_type,talent_pool', Rule::in(Contest::AUDIENCE_SCOPES)],
            'qualifying_score_percent' => ['sometimes', 'numeric', 'min:1', 'max:100'],
        ]);

        $contestType = $validated['contest_type'] ?? Contest::CONTEST_TYPE_GENERAL;
        $companyId = null;
        $placementDriveId = null;
        $collegeIds = [];
        $audienceScope = null;
        $qualifyingScorePercent = null;

        if ($contestType === Contest::CONTEST_TYPE_COMPANY) {
            $drive = PlacementDrive::findOrFail($validated['placement_drive_id']);
            $companyId = $drive->company_id;
            $placementDriveId = $drive->id;
            $collegeIds = $this->validatedLiveCollegeIds($placementDriveId, $validated['college_ids'] ?? []);
        }

        if ($contestType === Contest::CONTEST_TYPE_TALENT_POOL) {
            $audienceScope = $validated['audience_scope'];
            $qualifyingScorePercent = $validated['qualifying_score_percent'] ?? 90.00;

            // Any real, active college can be targeted directly — no drive
            // mapping to intersect against (see the talent_pool arm of
            // Contest::isVisibleToCollege()).
            if ($audienceScope === Contest::AUDIENCE_SCOPE_COLLEGE) {
                $collegeIds = College::whereIn('id', $validated['college_ids'] ?? [])->pluck('id')->all();
            }
        }

        $contest = Contest::create([
            'title' => $validated['title'],
            'slug' => Contest::uniqueSlug($validated['title']),
            'description' => $validated['description'] ?? null,
            'start_at' => $validated['start_at'],
            'end_at' => $validated['end_at'],
            'is_rated' => $contestType === Contest::CONTEST_TYPE_TALENT_POOL ? false : ($validated['is_rated'] ?? true),
            'status' => Contest::STATUS_DRAFT,
            'contest_type' => $contestType,
            'company_id' => $companyId,
            'placement_drive_id' => $placementDriveId,
            'created_by' => $request->user()->id,
            'audience_scope' => $audienceScope,
            'qualifying_score_percent' => $qualifyingScorePercent,
        ]);

        if ($contestType === Contest::CONTEST_TYPE_COMPANY || ($contestType === Contest::CONTEST_TYPE_TALENT_POOL && $audienceScope === Contest::AUDIENCE_SCOPE_COLLEGE)) {
            $contest->colleges()->sync($collegeIds);
        }

        return response()->json(['contest' => $contest], 201);
    }

    /**
     * Replace a company contest's college targeting wholesale (a full sync,
     * not an add/remove pair) — this is what lets Ops narrow "Infosys is
     * live at two colleges" down to "but this contest is only for one" from
     * the Contests screen, without touching the underlying drive mapping at
     * all. Silently drops any submitted id that isn't currently a live
     * (approved + active) mapping for this contest's drive, rather than
     * rejecting the whole request — a college that went pending/declined
     * between page-load and save shouldn't block saving the rest.
     */
    public function updateColleges(Request $request, Contest $contest)
    {
        abort_unless(
            $contest->isCompanyContest() || ($contest->isTalentPool() && $contest->audience_scope === Contest::AUDIENCE_SCOPE_COLLEGE),
            422,
            'Only company contests, and college-scoped Talent Pool assessments, have selectable college visibility.'
        );

        $validated = $request->validate([
            'college_ids' => ['present', 'array'],
            'college_ids.*' => ['integer'],
        ]);

        $collegeIds = $contest->isCompanyContest()
            ? $this->validatedLiveCollegeIds($contest->placement_drive_id, $validated['college_ids'])
            : College::whereIn('id', $validated['college_ids'])->pluck('id')->all();

        $contest->colleges()->sync($collegeIds);

        return response()->json(['college_ids' => $contest->colleges()->pluck('colleges.id')]);
    }

    /** Intersects a requested set of college ids with the drive's currently live (approved + active) mappings — the only colleges a company contest may ever target. */
    private function validatedLiveCollegeIds(int $placementDriveId, array $requestedCollegeIds): array
    {
        $liveCollegeIds = DriveCollegeMapping::where('placement_drive_id', $placementDriveId)
            ->where('status', DriveCollegeMapping::STATUS_APPROVED)
            ->where('is_active', true)
            ->pluck('college_id')
            ->all();

        return array_values(array_intersect($requestedCollegeIds, $liveCollegeIds));
    }

    public function update(Request $request, Contest $contest)
    {
        $this->guardNotTpoMock($contest);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_at' => ['sometimes', 'date'],
            'end_at' => ['sometimes', 'date', 'after:start_at'],
            'is_rated' => ['sometimes', 'boolean'],
            'status' => ['sometimes', Rule::in(Contest::STATUSES)],
        ]);

        $contest->update($validated);

        return response()->json(['contest' => $contest->fresh()]);
    }

    public function problems(Contest $contest)
    {
        return response()->json([
            'problems' => $contest->contestProblems()
                ->with('problem:id,slug,title,difficulty')
                ->orderBy('display_order')
                ->get(),
        ]);
    }

    public function storeProblem(Request $request, Contest $contest)
    {
        $this->guardNotTpoMock($contest);

        $validated = $request->validate([
            'problem_id' => ['required', 'integer', 'exists:problems,id'],
            'points' => ['required', 'integer', 'min:1'],
            'display_order' => ['nullable', 'integer', 'min:0'],
        ]);

        // A company contest's whole point is relevance — every attached
        // problem must already be tagged to that company (see
        // AdminCompanyController::storeRecommendedProblem), never picked
        // from the full 600+ bank ad hoc.
        if ($contest->isCompanyContest()) {
            $problem = Problem::findOrFail($validated['problem_id']);
            $isRecommended = CompanyRecommendedProblem::where('company_id', $contest->company_id)
                ->where('problem_slug', $problem->slug)
                ->exists();

            if (! $isRecommended) {
                return response()->json([
                    'message' => "This problem isn't tagged to {$contest->company->name}. Tag it under that company's Recommended Problems first.",
                ], 422);
            }
        }

        $contestProblem = ContestProblem::create([
            'contest_id' => $contest->id,
            'problem_id' => $validated['problem_id'],
            'points' => $validated['points'],
            'display_order' => $validated['display_order'] ?? $contest->contestProblems()->count(),
        ]);

        return response()->json([
            'contest_problem' => $contestProblem->load('problem:id,slug,title,difficulty'),
        ], 201);
    }

    /**
     * 422 once the contest has started or any submission exists against
     * this problem — removing it after either point would silently corrupt
     * graded history for anyone who already attempted it.
     */
    public function destroyProblem(Contest $contest, ContestProblem $contestProblem)
    {
        $this->guardNotTpoMock($contest);

        abort_unless($contestProblem->contest_id === $contest->id, 404);

        if ($contest->hasStarted()) {
            return response()->json(['message' => 'Cannot remove a problem after the contest has started.'], 422);
        }

        if (ContestSubmission::where('contest_problem_id', $contestProblem->id)->exists()) {
            return response()->json(['message' => 'Cannot remove a problem that already has submissions.'], 422);
        }

        $contestProblem->delete();

        return response()->json(['message' => 'Problem removed from contest.']);
    }

    /**
     * Manual trigger — calls the exact same service the scheduled
     * `contests:finalize` command calls, so there is one source of truth
     * for scoring/rating regardless of which path invoked it. Safe to hit
     * more than once (idempotent via Contest::finalized_at).
     */
    public function finalize(Contest $contest, ContestFinalizeService $service)
    {
        $this->guardNotTpoMock($contest);

        if (! $contest->hasEnded()) {
            return response()->json(['message' => 'This contest has not ended yet.'], 422);
        }

        return response()->json($service->finalize($contest));
    }

    /**
     * A tpo_mock contest belongs entirely to the owning college's TPO (see
     * TpoContestController) — Mellow Ops can still see it in index() for
     * oversight, but must never edit/publish/finalize someone else's
     * private practice contest through this controller.
     */
    private function guardNotTpoMock(Contest $contest): void
    {
        abort_if($contest->isTpoMock(), 403, 'This is a TPO mock contest — only its owning college can manage it.');
    }
}
