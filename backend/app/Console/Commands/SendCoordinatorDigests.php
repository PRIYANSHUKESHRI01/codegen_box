<?php

namespace App\Console\Commands;

use App\Services\CoordinatorDigestService;
use Illuminate\Console\Command;

/**
 * Scheduled every Monday morning (see routes/console.php): each active Section Coordinator gets a short e-mail with how
 * their section is doing and the students most worth a conversation this week. Safe to run by hand any time — it always
 * reflects live data, there is no "pending digest" state to get out of step.
 */
class SendCoordinatorDigests extends Command
{
    protected $signature = 'report:coordinator-digest';

    protected $description = 'E-mail each Section Coordinator their weekly digest: section summary and who needs a follow-up';

    public function handle(CoordinatorDigestService $digests): int
    {
        $result = $digests->sendAll();

        $this->info("Coordinator digests — {$result['sent']} sent, {$result['skipped']} skipped (empty section), {$result['failed']} failed.");

        return $result['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
