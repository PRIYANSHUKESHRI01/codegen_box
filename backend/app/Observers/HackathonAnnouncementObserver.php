<?php

namespace App\Observers;

use App\Models\HackathonAnnouncement;
use App\Services\Notifications\HackathonNotifier;

/** An organiser's update reaches everyone who registered. */
class HackathonAnnouncementObserver
{
    public function __construct(private readonly HackathonNotifier $notifier) {}

    public function created(HackathonAnnouncement $announcement): void
    {
        $this->notifier->announced($announcement);
    }
}
