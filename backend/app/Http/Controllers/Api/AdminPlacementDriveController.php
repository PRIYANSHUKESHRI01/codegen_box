<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\Company;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Services\DriveCollegeProposalService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
        $query = PlacementDrive::with([
            'company',
            'owningCollege:id,name,short_code',
            'collegeMappings.college:id,name,short_code',
        ])
        ->withCount('applications')
        ->latest('drive_date');

        if ($companyId = $request->query('company_id')) {
            $query->where('company_id', $companyId);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        if ($collegeId = $request->query('college_id')) {
            $query->where(function ($q) use ($collegeId) {
                $q->where('owning_college_id', $collegeId)
                  ->orWhereHas('collegeMappings', function ($sub) use ($collegeId) {
                      $sub->where('college_id', $collegeId);
                  });
            });
        }

        if ($q = trim((string) $request->query('q', ''))) {
            $query->where(function ($sub) use ($q) {
                $sub->where('title', 'like', "%{$q}%")
                    ->orWhere('role_title', 'like', "%{$q}%")
                    ->orWhereHas('company', fn ($cq) => $cq->where('name', 'like', "%{$q}%"));
            });
        }

        return response()->json([
            'drives' => $query->get()->map(fn (PlacementDrive $d) => [
                ...$d->toArray(),
                'applications_count' => $d->applications_count,
                'owning_college' => $d->owningCollege,
                'interview_urgency' => $d->interviewUrgency(),
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validateDrive($request);

        $collegeId = $request->input('college_id');
        $collegeIds = $request->input('college_ids', []);
        if ($collegeId && empty($collegeIds)) {
            $collegeIds = [$collegeId];
        }

        // Auto-create company if company_name provided without company_id
        if (empty($validated['company_id']) && $request->filled('company_name')) {
            $companyName = trim($request->input('company_name'));
            $company = Company::firstOrCreate(
                ['name' => $companyName],
                [
                    'slug' => Str::slug($companyName),
                    'is_active' => true,
                    'account_type' => Company::ACCOUNT_TYPE_CATALOG_ONLY,
                ]
            );
            $validated['company_id'] = $company->id;
        }

        if ($collegeId) {
            $validated['owning_college_id'] = $collegeId;
            $validated['source'] = PlacementDrive::SOURCE_TPO_CREATED;
        } else {
            $validated['source'] = PlacementDrive::SOURCE_CATALOG;
        }

        $validated['created_by'] = $request->user()->id;

        $drive = DB::transaction(function () use ($validated, $collegeIds, $request) {
            $drive = PlacementDrive::create($validated);

            // Auto-map selected colleges with approved status so drive is instantly live for them
            foreach ($collegeIds as $cid) {
                DriveCollegeMapping::firstOrCreate(
                    [
                        'placement_drive_id' => $drive->id,
                        'college_id' => $cid,
                    ],
                    [
                        'status' => DriveCollegeMapping::STATUS_APPROVED,
                        'is_active' => true,
                        'mapped_by' => $request->user()->id,
                        'approved_by' => $request->user()->id,
                        'approved_at' => now(),
                    ]
                );
            }

            return $drive;
        });

        return response()->json(['drive' => $drive->load(['company', 'owningCollege', 'collegeMappings.college'])], 201);
    }

    public function update(Request $request, PlacementDrive $placementDrive)
    {
        $validated = $this->validateDrive($request, $placementDrive);

        $placementDrive->update($validated);

        return response()->json(['drive' => $placementDrive->fresh(['company', 'owningCollege', 'collegeMappings.college'])]);
    }

    public function applications(PlacementDrive $placementDrive)
    {
        $applications = $placementDrive->applications()
            ->with(['user:id,name,email,college_id,roll_number,branch,cgpa', 'college:id,name,short_code'])
            ->latest()
            ->get();

        return response()->json([
            'drive' => [
                'id' => $placementDrive->id,
                'title' => $placementDrive->title,
                'role_title' => $placementDrive->role_title,
                'company' => $placementDrive->company?->only(['id', 'name', 'logo']),
            ],
            'applications' => $applications->map(fn ($app) => [
                'id' => $app->id,
                'user' => [
                    'id' => $app->user?->id,
                    'name' => $app->user?->name,
                    'email' => $app->user?->email,
                    'roll_number' => $app->user?->roll_number,
                    'branch' => $app->user?->branch,
                    'cgpa' => $app->user?->cgpa,
                ],
                'college' => $app->college ? [
                    'id' => $app->college->id,
                    'name' => $app->college->name,
                    'short_code' => $app->college->short_code,
                ] : null,
                'stage' => $app->stage,
                'stage_label' => DriveApplication::stageLabel($app->stage),
                'ctc_offered' => $app->ctc_offered,
                'registered_at' => $app->created_at?->toIso8601String(),
                'notes' => $app->notes,
            ]),
        ]);
    }

    public function destroy(PlacementDrive $placementDrive)
    {
        DB::transaction(function () use ($placementDrive) {
            $placementDrive->collegeMappings()->delete();
            $placementDrive->applications()->delete();
            $placementDrive->delete();
        });

        return response()->json(['message' => 'Placement drive removed successfully.']);
    }

    private function validateDrive(Request $request, ?PlacementDrive $placementDrive = null): array
    {
        return $request->validate([
            'company_id' => [$request->filled('company_name') ? 'nullable' : 'required', 'exists:companies,id'],
            'company_name' => ['nullable', 'string', 'max:255'],
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
            'college_id' => ['nullable', 'integer', 'exists:colleges,id'],
            'college_ids' => ['nullable', 'array'],
            'college_ids.*' => ['integer', 'exists:colleges,id'],
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
