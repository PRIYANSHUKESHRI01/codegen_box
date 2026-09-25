<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Company;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * College-TPO-only actions on the shared drive catalog. Every method scopes
 * strictly to $request->user()->college_id — a TPO can only ever map,
 * remap, or unmap drives for their own college, never another one. That
 * college id is always derived server-side, never trusted from the request.
 */
class TpoDriveController extends Controller
{
    public function mapped(Request $request)
    {
        $mappings = DriveCollegeMapping::with('placementDrive.company')
            ->where('college_id', $request->user()->college_id)
            ->where('is_active', true)
            ->get();

        return response()->json(['mappings' => $mappings]);
    }

    public function available(Request $request)
    {
        $collegeId = $request->user()->college_id;

        // Excludes anything already pending or approved — a drive Mellow
        // has proposed (awaiting this TPO's approval in pending()/respond()
        // below) must not also be instantly self-mappable here, which would
        // let a TPO route around the approval step entirely. A previously
        // *declined* drive correctly reappears here, giving the TPO their
        // own way back in without waiting on Mellow to re-propose it.
        $excludedDriveIds = DriveCollegeMapping::where('college_id', $collegeId)
            ->whereIn('status', [DriveCollegeMapping::STATUS_PENDING, DriveCollegeMapping::STATUS_APPROVED])
            ->pluck('placement_drive_id');

        // Only the shared Mellow-curated catalog is ever "available to map"
        // for someone else — a TPO-created drive is scoped exclusively to
        // the college that made it (see store() below) and is auto-mapped
        // to them immediately, so it should never surface here for anyone,
        // including its own owning college (it's already mapped by then).
        $drives = PlacementDrive::with('company')
            ->where('status', PlacementDrive::STATUS_PUBLISHED)
            ->where('source', PlacementDrive::SOURCE_CATALOG)
            ->whereNotIn('id', $excludedDriveIds)
            ->orderBy('drive_date')
            ->get();

        return response()->json(['drives' => $drives]);
    }

    /**
     * Drives Mellow has proposed mapping to this TPO's college that are
     * still awaiting a decision — see AdminPlacementDriveController::
     * mapColleges() (what creates these) and respond() below (what resolves
     * them).
     */
    public function pending(Request $request)
    {
        $mappings = DriveCollegeMapping::with('placementDrive.company', 'mappedBy')
            ->where('college_id', $request->user()->college_id)
            ->where('status', DriveCollegeMapping::STATUS_PENDING)
            ->latest('mapped_at')
            ->get();

        return response()->json(['mappings' => $mappings]);
    }

    /**
     * Approve or decline a Mellow-proposed mapping. Approving is the only
     * way a Mellow-initiated mapping ever goes live — mirroring map()
     * below, which stays instant only because that path is the TPO's own
     * choice to begin with.
     */
    public function respond(Request $request, PlacementDrive $placementDrive)
    {
        $validated = $request->validate([
            'decision' => ['required', Rule::in(['approve', 'decline'])],
        ]);

        $mapping = DriveCollegeMapping::where('placement_drive_id', $placementDrive->id)
            ->where('college_id', $request->user()->college_id)
            ->where('status', DriveCollegeMapping::STATUS_PENDING)
            ->first();

        abort_unless($mapping, 404, 'No pending proposal found for this drive.');

        if ($validated['decision'] === 'approve') {
            $mapping->update([
                'status' => DriveCollegeMapping::STATUS_APPROVED,
                'is_active' => true,
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);

            ActivityLog::record($request->user(), 'Approved a Mellow-proposed placement drive mapping', 'PlacementDrive', $placementDrive->title);
        } else {
            $mapping->update([
                'status' => DriveCollegeMapping::STATUS_DECLINED,
                'is_active' => false,
                'declined_at' => now(),
            ]);

            ActivityLog::record($request->user(), 'Declined a Mellow-proposed placement drive mapping', 'PlacementDrive', $placementDrive->title);
        }

        return response()->json(['mapping' => $mapping->fresh(['placementDrive.company', 'mappedBy'])]);
    }

    /**
     * Live search over the shared company catalog, for the "create a drive"
     * flow's company picker — lets a TPO reuse an existing company (and
     * whatever prep content already exists for it) instead of blindly
     * creating a duplicate.
     */
    public function searchCompanies(Request $request)
    {
        $query = trim((string) $request->query('q', ''));

        if ($query === '') {
            return response()->json(['companies' => []]);
        }

        $companies = Company::where('name', 'like', "%{$query}%")
            ->orderBy('name')
            ->limit(10)
            ->get(['id', 'name', 'slug', 'logo', 'industry', 'overview']);

        return response()->json(['companies' => $companies]);
    }

    /**
     * A TPO adding a company/drive that only their own campus is hosting —
     * this is the self-service counterpart to map(), for when the company
     * isn't already in Mellow's shared catalog. Reuses an existing company
     * by id (from searchCompanies) or by an exact case-insensitive name
     * match if the TPO typed a new one anyway; only creates a genuinely new
     * Company row when neither matches. The resulting drive is published
     * and mapped to the caller's own college in the same transaction — no
     * separate publish/map step, since this is already scoped to just them.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
            'company_name' => ['required_without:company_id', 'nullable', 'string', 'max:255'],
            'company_logo' => ['nullable', 'string', 'max:8'],
            'company_industry' => ['nullable', 'string', 'max:255'],
            'company_website_url' => ['nullable', 'string', 'max:255', 'url'],
            'company_overview' => ['nullable', 'string'],
            'title' => ['required', 'string', 'max:255'],
            'role_title' => ['required', 'string', 'max:255'],
            'ctc_range' => ['nullable', 'string', 'max:255'],
            'drive_date' => ['required', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:1'],
            'min_cgpa' => ['nullable', 'numeric', 'min:0', 'max:10'],
            'max_backlogs' => ['nullable', 'integer', 'min:0'],
            'eligible_branches' => ['nullable', 'array'],
            'eligible_branches.*' => ['string', 'max:50'],
        ]);

        $collegeId = $request->user()->college_id;

        if (! $collegeId) {
            return response()->json(['message' => 'Your account is not linked to a college.'], 422);
        }

        $drive = DB::transaction(function () use ($validated, $request, $collegeId) {
            if (! empty($validated['company_id'])) {
                $company = Company::findOrFail($validated['company_id']);
            } else {
                // Exact-name safety net: two TPOs typing "Infosys" a week
                // apart should land on the same company record, not two.
                $company = Company::whereRaw('LOWER(name) = ?', [Str::lower($validated['company_name'])])->first();

                if (! $company) {
                    $company = Company::create([
                        'name' => $validated['company_name'],
                        'slug' => Str::slug($validated['company_name']).'-'.Str::lower(Str::random(4)),
                        'logo' => $validated['company_logo'] ?? null,
                        'industry' => $validated['company_industry'] ?? null,
                        'website_url' => $validated['company_website_url'] ?? null,
                        'overview' => $validated['company_overview'] ?? null,
                        'is_active' => true,
                        'created_by' => $request->user()->id,
                    ]);
                }
            }

            $drive = PlacementDrive::create([
                'company_id' => $company->id,
                'title' => $validated['title'],
                'role_title' => $validated['role_title'],
                'ctc_range' => $validated['ctc_range'] ?? null,
                'drive_date' => $validated['drive_date'],
                'duration_minutes' => $validated['duration_minutes'] ?? null,
                'min_cgpa' => $validated['min_cgpa'] ?? null,
                'max_backlogs' => $validated['max_backlogs'] ?? null,
                'eligible_branches' => $validated['eligible_branches'] ?? null,
                'status' => PlacementDrive::STATUS_PUBLISHED,
                'source' => PlacementDrive::SOURCE_TPO_CREATED,
                'owning_college_id' => $collegeId,
                'created_by' => $request->user()->id,
            ]);

            DriveCollegeMapping::create([
                'placement_drive_id' => $drive->id,
                'college_id' => $collegeId,
                'mapped_by' => $request->user()->id,
                'mapped_at' => now(),
                'is_active' => true,
                // The TPO's own drive, mapped to their own college — implicit consent, never pending.
                'status' => DriveCollegeMapping::STATUS_APPROVED,
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
            ]);

            return $drive;
        });

        return response()->json(['drive' => $drive->load('company')], 201);
    }

    /**
     * Map (opt the caller's college into) an already-published drive.
     * updateOrCreate on the unique (drive, college) pair means re-mapping a
     * previously-unmapped drive reactivates the same row instead of hitting
     * a duplicate-key error.
     */
    public function map(Request $request, PlacementDrive $placementDrive)
    {
        if (! $placementDrive->isPublished()) {
            return response()->json(['message' => 'This drive is not open for mapping.'], 422);
        }

        $validated = $this->validateOverrides($request);

        $mapping = DriveCollegeMapping::updateOrCreate(
            [
                'placement_drive_id' => $placementDrive->id,
                'college_id' => $request->user()->college_id,
            ],
            [
                ...$validated,
                'mapped_by' => $request->user()->id,
                'mapped_at' => now(),
                'unmapped_at' => null,
                'is_active' => true,
                // The TPO's own choice to opt into a catalog drive — implicit consent, never pending.
                'status' => DriveCollegeMapping::STATUS_APPROVED,
                'approved_by' => $request->user()->id,
                'approved_at' => now(),
                'declined_at' => null,
            ]
        );

        return response()->json(['mapping' => $mapping->load('placementDrive.company')], 201);
    }

    public function updateMapping(Request $request, PlacementDrive $placementDrive)
    {
        $mapping = $this->findActiveMapping($request, $placementDrive);

        if (! $mapping) {
            return response()->json(['message' => 'This drive is not currently mapped to your college.'], 404);
        }

        $mapping->update($this->validateOverrides($request));

        return response()->json(['mapping' => $mapping->fresh('placementDrive.company')]);
    }

    public function unmap(Request $request, PlacementDrive $placementDrive)
    {
        $mapping = $this->findActiveMapping($request, $placementDrive);

        if (! $mapping) {
            return response()->json(['message' => 'This drive is not currently mapped to your college.'], 404);
        }

        $mapping->update(['is_active' => false, 'unmapped_at' => now()]);

        return response()->json(['message' => 'Drive unmapped from your college.']);
    }

    private function findActiveMapping(Request $request, PlacementDrive $placementDrive): ?DriveCollegeMapping
    {
        return DriveCollegeMapping::where('placement_drive_id', $placementDrive->id)
            ->where('college_id', $request->user()->college_id)
            ->where('is_active', true)
            ->first();
    }

    private function validateOverrides(Request $request): array
    {
        return $request->validate([
            'min_cgpa_override' => ['nullable', 'numeric', 'min:0', 'max:10'],
            'max_backlogs_override' => ['nullable', 'integer', 'min:0'],
            'eligible_branches_override' => ['nullable', 'array'],
            'eligible_branches_override.*' => ['string', 'max:50'],
        ]);
    }
}
