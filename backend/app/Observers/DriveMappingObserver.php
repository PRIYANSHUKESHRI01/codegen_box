<?php

namespace App\Observers;

use App\Models\DriveCollegeMapping;
use App\Services\Notifications\DriveNotifier;

/**
 * A drive's mapping to a college is the one row that decides whether students see it, so its transitions are where the
 * notifications come from — whichever controller or job made the change:
 *
 *   → approved + active          the drive is live for the college's students            (DriveNotifier::live)
 *   active → inactive            the college closed it                                    (DriveNotifier::closed)
 *   → pending                    a drive was proposed to the college's TPOs               (DriveNotifier::proposed)
 *   pending → approved/declined  the college answered the proposer                        (DriveNotifier::proposalAnswered)
 *
 * Notifications are best-effort and never throw (NotificationService), so they cannot fail the save they follow.
 */
class DriveMappingObserver
{
    public function __construct(private readonly DriveNotifier $notifier) {}

    public function saved(DriveCollegeMapping $mapping): void
    {
        $created = $mapping->wasRecentlyCreated;
        $statusChanged = $mapping->wasChanged('status');
        $activeChanged = $mapping->wasChanged('is_active');

        if (! $created && ! $statusChanged && ! $activeChanged) {
            return;
        }

        if ($mapping->isPending() && ($created || $statusChanged)) {
            $this->notifier->proposed($mapping);

            return;
        }

        if ($mapping->isApproved() && $mapping->is_active && ($created || $statusChanged || $activeChanged)) {
            $this->notifier->live($mapping);
        }

        if ($statusChanged && $mapping->getOriginal('status') === DriveCollegeMapping::STATUS_PENDING
            && in_array($mapping->status, [DriveCollegeMapping::STATUS_APPROVED, DriveCollegeMapping::STATUS_DECLINED], true)) {
            $this->notifier->proposalAnswered($mapping, $mapping->isApproved());
        }

        if ($activeChanged && ! $mapping->is_active && $mapping->isApproved() && ! $created) {
            $this->notifier->closed($mapping, 'Your placement cell closed it for your college.');
        }
    }
}
