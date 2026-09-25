<?php

namespace App\Services;

use App\Jobs\SendDriveMappingProposalEmail;
use App\Models\ActivityLog;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * The one write path for "propose a drive to specific colleges, pending
 * their approval" — shared by AdminPlacementDriveController (Mellow staff
 * proposing a catalog drive) and CompanyDriveController (a company
 * proposing one of its own drives), so the skip-already-active rule, the
 * proposal email, and the audit trail can never drift between the two
 * callers. Never creates a live mapping itself — only TpoDriveController::
 * respond() (via the receiving college's own TPO) does that.
 */
class DriveCollegeProposalService
{
    /**
     * A college already carrying an *active* mapping for this drive
     * (however it got there) is silently skipped rather than clobbered back
     * to pending — re-proposing never revokes an already-live mapping. A
     * previously *declined* college is fair game to re-propose to, which
     * resets it back to pending.
     *
     * @return array{proposed: array<int, DriveCollegeMapping>, skipped_count: int}
     */
    public function propose(PlacementDrive $drive, array $collegeIds, User $actor, array $overrides = []): array
    {
        return DB::transaction(function () use ($drive, $collegeIds, $actor, $overrides) {
            $existingActive = DriveCollegeMapping::where('placement_drive_id', $drive->id)
                ->where('is_active', true)
                ->pluck('college_id')
                ->all();

            $proposed = [];
            $skipped = 0;

            foreach ($collegeIds as $collegeId) {
                if (in_array($collegeId, $existingActive, true)) {
                    $skipped++;

                    continue;
                }

                $proposed[] = DriveCollegeMapping::updateOrCreate(
                    ['placement_drive_id' => $drive->id, 'college_id' => $collegeId],
                    [
                        'min_cgpa_override' => $overrides['min_cgpa_override'] ?? null,
                        'max_backlogs_override' => $overrides['max_backlogs_override'] ?? null,
                        'eligible_branches_override' => $overrides['eligible_branches_override'] ?? null,
                        'mapped_by' => $actor->id,
                        'mapped_at' => now(),
                        'unmapped_at' => null,
                        'is_active' => false,
                        'status' => DriveCollegeMapping::STATUS_PENDING,
                        'approved_by' => null,
                        'approved_at' => null,
                        'declined_at' => null,
                    ]
                );
            }

            return ['proposed' => $proposed, 'skipped_count' => $skipped];
        });
    }

    /** @param array<int, DriveCollegeMapping> $proposed */
    public function notifyAndLog(array $proposed, int $skippedCount, User $actor, PlacementDrive $drive): void
    {
        foreach ($proposed as $mapping) {
            SendDriveMappingProposalEmail::dispatch($mapping->id);
        }

        if ($proposed !== []) {
            ActivityLog::record(
                $actor,
                'Proposed a placement drive mapping to '.count($proposed).' college(s)',
                'PlacementDrive',
                $drive->title,
                ['skipped_already_mapped' => $skippedCount]
            );
        }
    }
}
