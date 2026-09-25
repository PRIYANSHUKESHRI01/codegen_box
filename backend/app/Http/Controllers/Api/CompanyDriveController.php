<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DriveApplication;
use App\Models\PlacementDrive;
use App\Services\DriveCollegeProposalService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * A company hiring tenant's own job openings — always source=company_direct,
 * scoped to the caller's own company_id. Not exclusively direct-hire: a
 * company can EITHER invite/import candidates directly (CompanyCandidateController)
 * OR propose the same opening to specific colleges (proposeToColleges()
 * below, reusing the exact pending-mapping-and-approval mechanism Mellow
 * Ops already uses for catalog drives — see DriveCollegeProposalService),
 * OR both at once. `source=company_direct` only ever means "this opening
 * belongs to the company, not the shared catalog" — it says nothing about
 * whether a DriveCollegeMapping exists for it.
 */
class CompanyDriveController extends Controller
{
    public function index(Request $request)
    {
        $drives = PlacementDrive::where('company_id', $request->user()->company_id)
            ->where('source', PlacementDrive::SOURCE_COMPANY_DIRECT)
            ->withCount('applications')
            ->with(['collegeMappings.college:id,name,short_code'])
            ->latest()
            ->get();

        return response()->json([
            'drives' => $drives->map(fn (PlacementDrive $d) => [
                ...$d->toArray(),
                'interview_urgency' => $d->interviewUrgency(),
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'role_title' => ['required', 'string', 'max:255'],
            'ctc_range' => ['nullable', 'string', 'max:255'],
            'drive_date' => ['required', 'date'],
            'interview_date' => ['nullable', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:1'],
            'is_open_to_all' => ['sometimes', 'boolean'],
        ]);

        $companyId = $request->user()->company_id;
        abort_unless($companyId, 422, 'Your account is not linked to a company.');

        $drive = PlacementDrive::create([
            'company_id' => $companyId,
            'title' => $validated['title'],
            'role_title' => $validated['role_title'],
            'ctc_range' => $validated['ctc_range'] ?? null,
            'drive_date' => $validated['drive_date'],
            'interview_date' => $validated['interview_date'] ?? null,
            'duration_minutes' => $validated['duration_minutes'] ?? null,
            'status' => PlacementDrive::STATUS_DRAFT,
            'source' => PlacementDrive::SOURCE_COMPANY_DIRECT,
            'is_open_to_all' => $validated['is_open_to_all'] ?? false,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['drive' => $drive], 201);
    }

    public function show(Request $request, PlacementDrive $placementDrive)
    {
        $this->authorizeOwnership($request, $placementDrive);

        $funnel = DriveApplication::where('placement_drive_id', $placementDrive->id)
            ->selectRaw('stage, count(*) as count')
            ->groupBy('stage')
            ->pluck('count', 'stage');

        return response()->json([
            'drive' => $placementDrive,
            'funnel' => $funnel,
            'interview_urgency' => $placementDrive->interviewUrgency(),
        ]);
    }

    public function update(Request $request, PlacementDrive $placementDrive)
    {
        $this->authorizeOwnership($request, $placementDrive);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'role_title' => ['sometimes', 'string', 'max:255'],
            'ctc_range' => ['nullable', 'string', 'max:255'],
            'drive_date' => ['sometimes', 'date'],
            'interview_date' => ['nullable', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:1'],
            'status' => ['sometimes', Rule::in(PlacementDrive::STATUSES)],
            'is_open_to_all' => ['sometimes', 'boolean'],
        ]);

        $placementDrive->update($validated);

        return response()->json(['drive' => $placementDrive->fresh()]);
    }

    /**
     * Propose this opening to one or more colleges — mirrors
     * AdminPlacementDriveController::mapColleges() exactly (same validation,
     * same DriveCollegeProposalService call), just ownership-scoped to the
     * caller's own company instead of gated by a Mellow-staff permission.
     * Never goes live on its own: each college gets a pending mapping and an
     * email to its TPO(s); only their approval (TpoDriveController::
     * respond(), completely unmodified) makes it visible to that college's
     * students.
     */
    public function proposeToColleges(Request $request, PlacementDrive $placementDrive, DriveCollegeProposalService $service)
    {
        $this->authorizeOwnership($request, $placementDrive);

        abort_unless($placementDrive->isPublished(), 422, 'Only published job openings can be proposed to colleges.');

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
            'mappings' => Collection::make($proposed)->load('college'),
        ], 201);
    }

    /** Every college-mapping row for this opening, whatever its outcome — mirrors AdminPlacementDriveController::mappings(). */
    public function mappings(Request $request, PlacementDrive $placementDrive)
    {
        $this->authorizeOwnership($request, $placementDrive);

        return response()->json([
            'mappings' => $placementDrive->collegeMappings()->with('college:id,name,short_code')->get(),
        ]);
    }

    private function authorizeOwnership(Request $request, PlacementDrive $placementDrive): void
    {
        abort_unless(
            $placementDrive->company_id === $request->user()->company_id
                && $placementDrive->source === PlacementDrive::SOURCE_COMPANY_DIRECT,
            404
        );
    }
}
