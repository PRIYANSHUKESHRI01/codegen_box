<?php

namespace App\Console\Commands;

use App\Services\NotificationService;
use Illuminate\Console\Command;

/** Removes old in-app notifications (read: 60 days, unread: 180 days, plus anything past its own expiry), so the table stays small and the bell's unread count stays one cheap index scan. */
class PruneNotifications extends Command
{
    protected $signature = 'notifications:prune';

    protected $description = 'Delete old in-app notifications';

    public function handle(NotificationService $notifications): int
    {
        $this->info('Removed '.$notifications->prune().' notification(s).');

        return self::SUCCESS;
    }
}
