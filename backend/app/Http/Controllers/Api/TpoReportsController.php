<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\DriveCollegeMapping;
use App\Models\User;
use App\Services\EligibilityService;
use App\Services\PlacementReportService;
use App\Services\StudentCohortService;
use App\Support\AcademicYear;
use Illuminate\Http\Request;

class TpoReportsController extends Controller
{
    public function data(Request $request, PlacementReportService $placementReportService, StudentCohortService $cohort)
    {
        $collegeId = $request->user()->college_id;
        $college = College::findOrFail($collegeId);

        $department = $request->query('department');
        $departmentStr = is_string($department) && $department !== '' ? $department : null;

        $yearParam = $request->query('year');
        $studyYear = is_numeric($yearParam) && (int) $yearParam >= 0 && (int) $yearParam <= AcademicYear::programmeYears() + 1
            ? (int) $yearParam
            : null;

        $students = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_USER)
            ->inDepartment($departmentStr)
            ->when($studyYear !== null, fn ($q) => $q->inStudyYear($studyYear))
            ->orderBy('name')
            ->get();

        $studentPayload = collect($cohort->payloads($students, collect()))->map(fn (array $row) => [
            'id' => $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'roll_number' => $row['roll_number'],
            'branch' => $row['branch'],
            'branch_code' => $row['branch_code'],
            'discipline' => $row['discipline'],
            'department' => $row['department'],
            'branch_source' => $row['branch_source'],
            'track_focus' => $row['track_focus'],
            'core' => $row['core'],
            'section' => $row['section'],
            'study_year' => $row['study_year'],
            'year_label' => $row['year_label'],
            'cgpa' => $row['cgpa'],
            'tenth_percentage' => $row['tenth_percentage'],
            'twelfth_percentage' => $row['twelfth_percentage'],
            'backlogs' => $row['backlogs'],
            'placement_status' => $row['placement_status'],
            'has_resume' => $row['has_resume'],
            'readiness_score' => $row['readiness_score'],
            'readiness_tier' => $row['readiness_tier'],
            'practice_score' => $row['practice_score'],
            'activated' => $row['activated'],
            'onboarded' => $row['onboarded'],
            'solved' => $row['solved'],
            'activity' => $row['activity'],
            'coding' => $row['coding'],
        ])->all();

        $mappings = DriveCollegeMapping::with('placementDrive.company')
            ->where('college_id', $collegeId)
            ->where('is_active', true)
            ->get()
            ->sortByDesc(fn (DriveCollegeMapping $m) => $m->placementDrive->drive_date)
            ->values();

        $offerStats = EligibilityService::acceptedOfferStatsForCollege($college->id);

        $drivePayload = $mappings->map(function (DriveCollegeMapping $mapping) use ($students, $college, $offerStats) {
            $drive = $mapping->placementDrive;
            $company = $drive->company;
            $eligibility = $mapping->effectiveEligibility();

            $verdicts = $students->map(function (User $s) use ($eligibility, $college, $offerStats) {
                $stats = $offerStats[$s->id] ?? ['accepted_offers' => 0, 'best_ctc' => 0.0];

                return [
                    'student' => $s,
                    'verdict' => EligibilityService::evaluate($s, $eligibility, [
                        'college' => $college,
                        'accepted_offers' => $stats['accepted_offers'],
                        'best_ctc' => $stats['best_ctc'],
                    ]),
                ];
            });

            $meetsCriterion = fn (string $key) => $verdicts->filter(fn ($v) => ($v['verdict']['criteria'][$key] ?? 'not_required') !== 'fail');
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
                    'branch_code' => $v['student']->branch_code,
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
                'policy' => [
                    'max_offers_per_student' => $college->max_offers_per_student,
                    'dream_offer_multiplier' => $college->dream_offer_multiplier !== null ? (float) $college->dream_offer_multiplier : null,
                    'dream_offer_min_ctc' => $college->dream_offer_min_ctc !== null ? (float) $college->dream_offer_min_ctc : null,
                    'block_placed_from_lower_ctc' => (bool) $college->block_placed_from_lower_ctc,
                ],
            ],
            'students' => $studentPayload,
            'drives' => $drivePayload,
            'placements' => $placementReportService->forCollege($college, $departmentStr, $studyYear),
        ]);
    }

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
