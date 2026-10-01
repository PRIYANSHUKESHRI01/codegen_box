<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\PlacementDrive;
use App\Services\DriveCollegeProposalService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only scheduling of placement drives against the
 * shared company catalog, and Mellow-initiated mapping of a published drive
 * onto specific partner colleges. TPOs never create catalog drives here —
 * they either self-map an already-published one or add their own
 * campus-only drive instead (TpoDriveController) — both of those stay
 * instant, since that's the TPO's own deliberate choice. A mapping proposed
 * *by Mellow*, in contrast, needs the receiving college's consent first —
 * see mapColleges() below and TpoDriveController::respond().
 */
class AdminPlacementDriveController extends Controller
{
    public function index(Request $request)
    {
        $query = PlacementDrive::with(['company', 'collegeMappings.college:id,name,short_code'])->latest('drive_date');

        if ($companyId = $request->query('company_id')) {
            $query->where('company_id', $companyId);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        return response()->json([
            'drives' => $query->get()->map(fn (PlacementDrive $d) => [
                ...$d->toArray(),
                'interview_urgency' => $d->interviewUrgency(),
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateDrive($request);

        $drive = PlacementDrive::create($validated);

        return response()->json(['drive' => $drive->load('company')], 201);
    }

    public function update(Request $request, PlacementDrive $placementDrive)
    {
        $validated = $this->validateDrive($request);

        $placementDrive->update($validated);

        return response()->json(['drive' => $placementDrive->fresh('company')]);
    }

    private function validateDrive(Request $request): array
    {
        return $request->validate([
            'company_id' => ['required', 'exists:companies,id'],
            'title' => ['required', 'string', 'max:255'],
            'role_title' => ['required', 'string', 'max:255'],
            'ctc_range' => ['nullable', 'string', 'max:255'],
            'drive_date' => ['required', 'date'],
            'interview_date' => ['nullable', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:1'],
            'min_cgpa' => ['nullable', 'numeric', 'min:0', 'max:10'],
            'max_backlogs' => ['nullable', 'integer', 'min:0'],
            'eligible_branches' => ['nullable', 'array'],
            'eligible_branches.*' => ['string', 'max:50'],
            'terms_and_conditions' => ['nullable', 'string', 'max:20000'],
            'status' => ['nullable', Rule::in(PlacementDrive::STATUSES)],
        ]);
    }

    /**
     * The real roster to pick from when proposing a drive to specific
     * colleges — deliberately gated by permission:placements (same as every
     * other method here) rather than permission:colleges, so a Mellow
     * employee with placements access doesn't need a second, unrelated
     * permission just to see who they can map a drive to.
     */
    public function partnerColleges()
    {
        return response()->json([
            'colleges' => College::where('is_active', true)->orderBy('name')->get(['id', 'name', 'short_code', 'city', 'state']),
        ]);
    }

    /**
     * Every college-mapping row for one drive — live (approved+active),
     * awaiting the TPO's decision (pending), or resolved either way
     * (declined/unmapped). Surfaced in the Contests admin UI so Ops can see,
     * right when building a `company` contest, which colleges will actually
     * be able to see it — a company contest's visibility is entirely
     * derived from this table (see Contest::isVisibleToCollege()), so a
     * drive with zero live mappings means zero students will ever see the
     * contest, silently, unless this is surfaced somewhere.
     */
    public function mappings(PlacementDrive $placementDrive)
    {
        return response()->json([
            'mappings' => $placementDrive->collegeMappings()->with('college:id,name,short_code')->get(),
        ]);
    }

    /**
     * Mellow proposes mapping a published drive onto one or more colleges.
     * Unlike TpoDriveController::map() (a TPO's own instant, self-service
     * choice), this never goes live immediately — it creates a pending
     * mapping per college and emails that college's TPO(s) the full drive
     * detail (see SendDriveMappingProposalEmail); only their approval
     * (TpoDriveController::respond()) flips it live. A college that already
     * has an *active* mapping for this drive (however it got there) is
     * silently skipped rather than clobbered back to pending — Mellow
     * re-proposing never revokes an already-live mapping. A previously
     * *declined* college is fair game to re-propose to, which resets it
     * back to pending.
     */
    public function mapColleges(Request $request, PlacementDrive $placementDrive, DriveCollegeProposalService $service)
    {
        abort_unless($placementDrive->isPublished(), 422, 'Only published drives can be mapped to colleges.');

        $validated = $request->validate([
            'college_ids' => ['required', 'array', 'min:1'],
            'college_ids.*' => ['integer', 'distinct', 'exists:colleges,id'],
            'min_cgpa_override' => ['nullable', 'numeric', 'min:0', 'max:10'],
            'max_backlogs_override' => ['nullable', 'integer', 'min:0'],
            'eligible_branches_override' => ['nullable', 'array'],
            'eligible_branches_override.*' => ['string', 'max:50'],
        ]);

        $overrides = [
            'min_cgpa_override' => $validated['min_cgpa_override'] ?? null,
            'max_backlogs_override' => $validated['max_backlogs_override'] ?? null,
            'eligible_branches_override' => $validated['eligible_branches_override'] ?? null,
        ];

        ['proposed' => $proposed, 'skipped_count' => $skippedCount] = $service->propose(
            $placementDrive, $validated['college_ids'], $request->user(), $overrides
        );

        $service->notifyAndLog($proposed, $skippedCount, $request->user(), $placementDrive);

        return response()->json([
            'proposed_count' => count($proposed),
            'skipped_count' => $skippedCount,
            'mappings' => Collection::make($proposed)->load('college', 'placementDrive.company'),
        ], 201);
    }
}
