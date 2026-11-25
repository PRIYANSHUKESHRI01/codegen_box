<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CollegeCompanyContact;
use App\Models\Company;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Services\ActivityLog;
use App\Services\EligibilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * TPO Recruiter CRM — college-scoped directory of hiring partners, HR/TA POCs,
 * historical drives hosted on campus, offers & average CTC, plus outreach notes.
 */
class TpoRecruiterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $collegeId = (int) $request->user()->college_id;

        $mappings = DriveCollegeMapping::where('college_id', $collegeId)
            ->with(['placementDrive' => fn ($q) => $q->with('company')])
            ->get();

        $tpoDrives = PlacementDrive::where('source', PlacementDrive::SOURCE_TPO_CREATED)
            ->where('owning_college_id', $collegeId)
            ->with('company')
            ->get();

        $apps = DriveApplication::where('college_id', $collegeId)
            ->select(['placement_drive_id', 'stage', 'ctc_offered', 'joining_status'])
            ->get()
            ->groupBy('placement_drive_id');

        $contacts = CollegeCompanyContact::where('college_id', $collegeId)
            ->with('company:id,name,slug,website_url,industry,logo')
            ->orderByDesc('last_contacted_at')
            ->orderByDesc('updated_at')
            ->get();

        $companyBuckets = [];

        $registerCompany = function (?Company $company) use (&$companyBuckets): ?int {
            if (! $company) {
                return null;
            }
            if (! isset($companyBuckets[$company->id])) {
                $companyBuckets[$company->id] = [
                    'company' => [
                        'id' => $company->id,
                        'name' => $company->name,
                        'slug' => $company->slug,
                        'website_url' => $company->website_url,
                        'industry' => $company->industry,
                        'logo' => $company->logo,
                    ],
                    'drives_count' => 0,
                    'last_drive_date' => null,
                    'offers_accepted' => 0,
                    'joined_count' => 0,
                    'ctcs' => [],
                    'drive_ids' => [],
                ];
            }

            return $company->id;
        };

        $accumulateDrive = function (PlacementDrive $drive) use (&$companyBuckets, $registerCompany, $apps): void {
            $cid = $registerCompany($drive->company);
            if ($cid === null || isset($companyBuckets[$cid]['drive_ids'][$drive->id])) {
                return;
            }
            $companyBuckets[$cid]['drive_ids'][$drive->id] = true;
            $companyBuckets[$cid]['drives_count']++;

            $driveDate = $drive->drive_date?->toDateString();
            if ($driveDate && ($companyBuckets[$cid]['last_drive_date'] === null || $driveDate > $companyBuckets[$cid]['last_drive_date'])) {
                $companyBuckets[$cid]['last_drive_date'] = $driveDate;
            }

            foreach ($apps->get($drive->id, collect()) as $app) {
                if ($app->stage === DriveApplication::STAGE_OFFER_ACCEPTED) {
                    $companyBuckets[$cid]['offers_accepted']++;
                    if ($app->joining_status === DriveApplication::JOINING_JOINED) {
                        $companyBuckets[$cid]['joined_count']++;
                    }
                    $ctc = $app->ctc_offered !== null ? (float) $app->ctc_offered : EligibilityService::parseMaxCtc($drive->ctc_range);
                    if ($ctc > 0) {
                        $companyBuckets[$cid]['ctcs'][] = $ctc;
                    }
                }
            }
        };

        foreach ($mappings as $m) {
            if ($m->placementDrive) {
                $accumulateDrive($m->placementDrive);
            }
        }
        foreach ($tpoDrives as $d) {
            $accumulateDrive($d);
        }
        foreach ($contacts as $contact) {
            $registerCompany($contact->company);
        }

        $contactsByCompany = $contacts->groupBy('company_id');

        $recruiters = collect($companyBuckets)->map(function (array $bucket, int $companyId) use ($contactsByCompany) {
            $ctcs = $bucket['ctcs'];
            $companyContacts = ($contactsByCompany->get($companyId) ?? collect())->map(fn (CollegeCompanyContact $c) => [
                'id' => $c->id,
                'company_id' => $c->company_id,
                'contact_name' => $c->contact_name,
                'designation' => $c->designation,
                'email' => $c->email,
                'phone' => $c->phone,
                'relationship_status' => $c->relationship_status,
                'notes' => $c->notes,
                'last_contacted_at' => $c->last_contacted_at?->toIso8601String(),
                'updated_at' => $c->updated_at?->toIso8601String(),
            ])->values()->all();

            return [
                'company' => $bucket['company'],
                'drives_count' => $bucket['drives_count'],
                'last_drive_date' => $bucket['last_drive_date'],
                'offers_accepted' => $bucket['offers_accepted'],
                'joined_count' => $bucket['joined_count'],
                'avg_ctc' => $ctcs === [] ? null : round(array_sum($ctcs) / count($ctcs), 2),
                'highest_ctc' => $ctcs === [] ? null : round(max($ctcs), 2),
                'contacts' => $companyContacts,
            ];
        })->sortByDesc(fn ($r) => [$r['offers_accepted'], $r['drives_count'], count($r['contacts'])])->values()->all();

        return response()->json(['recruiters' => $recruiters]);
    }

    public function storeContact(Request $request): JsonResponse
    {
        $collegeId = (int) $request->user()->college_id;

        $validated = $request->validate([
            'company_id' => ['required', 'integer', 'exists:companies,id'],
            'contact_name' => ['required', 'string', 'max:120'],
            'designation' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'relationship_status' => ['required', Rule::in(CollegeCompanyContact::STATUSES)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'last_contacted_at' => ['nullable', 'date'],
        ]);

        $contact = CollegeCompanyContact::create([
            ...$validated,
            'college_id' => $collegeId,
            'created_by' => $request->user()->id,
        ]);

        $contact->load('company:id,name');
        ActivityLog::record($request->user(), 'Added recruiter contact', 'Company', $contact->company?->name ?? 'Company', ['contact' => $contact->contact_name]);

        return response()->json(['contact' => $contact], 201);
    }

    public function updateContact(Request $request, CollegeCompanyContact $contact): JsonResponse
    {
        abort_unless((int) $contact->college_id === (int) $request->user()->college_id, 404);

        $validated = $request->validate([
            'contact_name' => ['sometimes', 'string', 'max:120'],
            'designation' => ['nullable', 'string', 'max:120'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'relationship_status' => ['sometimes', Rule::in(CollegeCompanyContact::STATUSES)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'last_contacted_at' => ['nullable', 'date'],
        ]);

        $contact->update($validated);
        ActivityLog::record($request->user(), 'Updated recruiter contact', 'CollegeCompanyContact', $contact->contact_name);

        return response()->json(['contact' => $contact->fresh()]);
    }

    public function destroyContact(Request $request, CollegeCompanyContact $contact): JsonResponse
    {
        abort_unless((int) $contact->college_id === (int) $request->user()->college_id, 404);

        $name = $contact->contact_name;
        $contact->delete();
        ActivityLog::record($request->user(), 'Deleted recruiter contact', 'CollegeCompanyContact', $name);

        return response()->json(['message' => 'Contact removed.']);
    }
}
