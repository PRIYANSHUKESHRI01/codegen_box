<?php

namespace App\Observers;

use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Services\Notifications\DriveNotifier;

/**
 * What happens to a drive that is already live: it is cancelled (every college that had it open closes it for its students)
 * or its date moves (those students are told the new date). A drive going LIVE is the mapping's event, not this one's.
 */
class PlacementDriveObserver
{
    public function __construct(private readonly DriveNotifier $notifier) {}

    public function updated(PlacementDrive $drive): void
    {
        $cancelled = $drive->wasChanged('status') && $drive->status === PlacementDrive::STATUS_CANCELLED;
        $moved = $drive->isPublished() && $drive->wasChanged('drive_date');

        if (! $cancelled && ! $moved) {
            return;
        }

        $live = DriveCollegeMapping::query()
            ->where('placement_drive_id', $drive->id)
            ->where('is_active', true)
            ->where('status', DriveCollegeMapping::STATUS_APPROVED)
            ->get();

        foreach ($live as $mapping) {
            $cancelled
                ? $this->notifier->closed($mapping, 'The drive was cancelled.')
                : $this->notifier->rescheduled($mapping, $drive);
        }
    }
}
