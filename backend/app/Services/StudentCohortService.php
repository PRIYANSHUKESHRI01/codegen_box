<?php

namespace App\Services;

use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * The one place a student's cohort-table row (readiness score/tier, 7-day
 * practice consistency, and real cross-drive eligibility) gets built —
 * extracted out of TpoStudentController so the Section Coordinator's
 * narrower, section-scoped roster view can reuse the exact same computation
 * instead of a second, driftable copy. Same "one rule, reused everywhere"
 * convention as EligibilityService itself.
 */
class StudentCohortService
{
    /** Every currently published drive actively mapped to a college — the pool a student's eligibility is measured against. */
    public function activeMappingsFor(int $collegeId): Collection
    {
        return DriveCollegeMapping::with('placementDrive')
            ->where('college_id', $collegeId)
            ->where('is_active', true)
            ->whereHas('placementDrive', function ($query) {
                $query->where('status', PlacementDrive::STATUS_PUBLISHED);
            })
            ->get();
    }

    /** Shared by every caller so a cohort table's row shape can never drift between callers or between a full load and a just-added/just-edited student. */
    public function payload(User $student, Collection $activeMappings): array
    {
        // A plain "eligible for at least one active drive" boolean goes
        // silently misleading the moment any one mapped drive has no real
        // requirements (open to all branches, no CGPA floor, no backlog cap)
        // — that single drive alone then marks every student "Eligible",
        // making an Eligible Only filter look broken even though it's doing
        // exactly what it's told. Surfacing the actual count (and the total
        // active drives it's out of) lets the cohort table show real
        // signal — "Eligible for 2 of 3 drives" — instead of a badge that
        // can't explain itself.
        $eligibleDriveCount = $activeMappings->filter(function (DriveCollegeMapping $mapping) use ($student) {
            return EligibilityService::evaluate($student, $mapping->effectiveEligibility())['status'] === 'eligible';
        })->count();

        return [
            'id' => $student->id,
            'name' => $student->name,
            'email' => $student->email,
            'roll_number' => $student->roll_number,
            'branch' => $student->branch,
            'section' => $student->section,
            'phone' => $student->phone,
            'parent_phone' => $student->parent_phone,
            'cgpa' => $student->cgpa,
            'backlogs' => $student->backlogs,
            'is_blocked' => $student->is_blocked,
            'readiness_score' => $student->readinessScore(),
            'readiness_tier' => $student->readinessTier(),
            'practice_score' => $student->practiceScore(),
            'eligible_for_active_drive' => $activeMappings->isEmpty() ? null : $eligibleDriveCount > 0,
            'eligible_drive_count' => $eligibleDriveCount,
            'active_drive_count' => $activeMappings->count(),
            'created_at' => $student->created_at,
        ];
    }
}
