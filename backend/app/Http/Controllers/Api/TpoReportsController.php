<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\User;
use App\Services\EligibilityService;
use App\Services\PlacementReportService;
use Illuminate\Http\Request;

/**
 * Everything the six report cards on /admin/reports need, in one call — no
 * per-student-per-drive application/interview/offer tracking exists in this
 * schema (no ATS pipeline), so "placed/shortlisted/interviewed" style
 * reports were never buildable as real data. What IS real and reportable:
 * the cohort's academic/readiness profile, the college's mapped drive
 * catalog, and — reusing EligibilityService, the exact same rule the
 * student-facing eligibility banner and the TPO cohort table already use —
 * a genuine per-drive eligibility funnel and compliance audit. Every number
 * in every report this feeds is traceable to a real column.
 */
class TpoReportsController extends Controller
{
    public function data(Request $request, PlacementReportService $placementReportService)
    {
        $collegeId = $request->user()->college_id;
        $college = College::findOrFail($collegeId);

        $students = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_USER)
            ->orderBy('name')
            ->get();

        $studentPayload = $students->map(fn (User $s) => [
            'id' => $s->id,
            'name' => $s->name,
            'email' => $s->email,
            'roll_number' => $s->roll_number,
            'branch' => $s->branch,
            'section' => $s->section,
            'cgpa' => $s->cgpa,
            'backlogs' => $s->backlogs,
            'readiness_score' => $s->readinessScore(),
            'readiness_tier' => $s->readinessTier(),
            'practice_score' => $s->practiceScore(),
        ])->all();

        $mappings = DriveCollegeMapping::with('placementDrive.company')
            ->where('college_id', $collegeId)
            ->where('is_active', true)
            ->get()
            ->sortByDesc(fn (DriveCollegeMapping $m) => $m->placementDrive->drive_date)
            ->values();

        $drivePayload = $mappings->map(function (DriveCollegeMapping $mapping) use ($students) {
            $drive = $mapping->placementDrive;
            $company = $drive->company;
            $eligibility = $mapping->effectiveEligibility();

            $verdicts = $students->map(fn (User $s) => [
                'student' => $s,
                'verdict' => EligibilityService::evaluate($s, $eligibility),
            ]);

            $meetsCriterion = fn (string $key) => $verdicts->filter(fn ($v) => $v['verdict']['criteria'][$key] !== 'fail');
            $meetsCgpa = $meetsCriterion('cgpa');
            $meetsBacklogs = $meetsCriterion('backlogs');
            $meetsBranch = $meetsCriterion('branch');
            $fullyEligible = $verdicts->filter(fn ($v) => $v['verdict']['status'] === 'eligible');
            $notEligible = $verdicts->filter(fn ($v) => $v['verdict']['status'] === 'not_eligible');

            return [
                'id' => $drive->id,
                'title' => $drive->title,
                'role_title' => $drive->role_title,
                'ctc_range' => $drive->ctc_range,
                'drive_date' => $drive->drive_date,
                'status' => $drive->status,
                'company' => ['id' => $company->id, 'name' => $company->name, 'logo' => $company->logo],
                'eligibility' => $eligibility,
                'funnel' => [
                    'total' => $students->count(),
                    'meets_cgpa' => $meetsCgpa->count(),
                    'meets_backlogs' => $meetsBacklogs->count(),
                    'meets_branch' => $meetsBranch->count(),
                    'fully_eligible' => $fullyEligible->count(),
                ],
                'non_compliant' => $notEligible->map(fn ($v) => [
                    'id' => $v['student']->id,
                    'name' => $v['student']->name,
                    'roll_number' => $v['student']->roll_number,
                    'branch' => $v['student']->branch,
                    'reasons' => $v['verdict']['reasons'],
                ])->values()->all(),
            ];
        })->all();

        return response()->json([
            'college' => [
                'name' => $college->name,
                'city' => $college->city,
                'state' => $college->state,
                'tier' => $college->tier,
            ],
            'students' => $studentPayload,
            'drives' => $drivePayload,
            // Real placement pipeline — replaces the entirely-fictional
            // PLACEMENT_FUNNEL/RECENT_PLACEMENTS/etc mock data.
            'placements' => $placementReportService->forCollege($college),
        ]);
    }

    /**
     * A placement target is a TPO-chosen goal, not an observed fact — real
     * to store as a plain configurable value, unlike colleges.placement_rate
     * (pre-existing fake seed data this controller never reads from).
     */
    public function updateTarget(Request $request, PlacementReportService $placementReportService)
    {
        $college = College::findOrFail($request->user()->college_id);

        $validated = $request->validate([
            'target_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'target_deadline' => ['nullable', 'date'],
        ]);

        $college = $placementReportService->updateTarget(
            $college,
            $validated['target_percent'] ?? null,
            $validated['target_deadline'] ?? null
        );

        return response()->json(['college' => $college]);
    }
}
