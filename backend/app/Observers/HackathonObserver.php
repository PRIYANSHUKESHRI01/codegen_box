<?php

namespace App\Observers;

use App\Models\Hackathon;
use App\Services\Notifications\HackathonNotifier;

/** Published, cancelled and results-out — raised once, from whichever console (platform admin or hiring partner) did it. */
class HackathonObserver
{
    public function __construct(private readonly HackathonNotifier $notifier) {}

    public function saved(Hackathon $hackathon): void
    {
        if ($hackathon->isPublished() && ($hackathon->wasRecentlyCreated || $hackathon->wasChanged('status'))) {
            $this->notifier->published($hackathon);
        }

        if ($hackathon->wasChanged('status') && $hackathon->isCancelled()) {
            $this->notifier->cancelled($hackathon);
        }

        if ($hackathon->wasChanged('results_published_at') && $hackathon->resultsArePublished()) {
            $this->notifier->resultsOut($hackathon);
        }
    }
}
