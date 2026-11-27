<?php

namespace App\Console\Commands;

use App\Services\LaunchpadProgramService;
use Illuminate\Console\Command;

class SendLaunchpadReminders extends Command
{
    protected $signature = 'launchpad:remind';

    protected $description = 'Send deadline and readiness reminder notifications for active Launchpad 2026 programs';

    public function handle(LaunchpadProgramService $service): int
    {
        $sent = $service->sendDeadlineReminders();
        $this->info("Sent {$sent} Launchpad deadline reminder(s).");

        return self::SUCCESS;
    }
}
