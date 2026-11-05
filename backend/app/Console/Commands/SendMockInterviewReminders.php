<?php

namespace App\Console\Commands;

use App\Services\Interviews\MockInterviewScheduler;
use Illuminate\Console\Command;

/**
 * Every ten minutes: "starting soon" and "closing soon" reminders for college mock AI interviews that have a window.
 * Safe to run as often as you like — each reminder is sent once per schedule (see MockInterviewScheduler).
 */
class SendMockInterviewReminders extends Command
{
    protected $signature = 'interviews:remind';

    protected $description = 'Send the starting-soon / closing-soon reminders for scheduled college mock AI interviews';

    public function handle(MockInterviewScheduler $scheduler): int
    {
        $sent = $scheduler->sendDueReminders();

        $this->info("Reminders sent: {$sent['opening']} opening-soon, {$sent['closing']} closing-soon.");

        return self::SUCCESS;
    }
}
