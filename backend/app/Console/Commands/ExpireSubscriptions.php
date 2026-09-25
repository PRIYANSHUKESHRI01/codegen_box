<?php

namespace App\Console\Commands;

use App\Services\SubscriptionService;
use Illuminate\Console\Command;

/**
 * Scheduled daily (see routes/console.php) — flips any subscription whose
 * current_period_end has passed from active to expired. The days-remaining
 * countdown shown in the UI is computed live from dates regardless, so this
 * doesn't affect what users see; it exists so subscription *status* is
 * accurate for future access-gating and admin reporting.
 */
class ExpireSubscriptions extends Command
{
    protected $signature = 'subscriptions:expire';

    protected $description = 'Mark past-due active subscriptions as expired';

    public function handle(SubscriptionService $service): int
    {
        $count = $service->expireDue();

        $this->info("Done — {$count} subscription(s) marked expired.");

        return self::SUCCESS;
    }
}
