<?php

namespace App\Services\Vault;

use App\Enums\NotificationType;
use App\Models\VaultStackInterest;
use App\Services\NotificationService;

/**
 * Tells the students who tapped "Notify me" that a Vault AI Interview stack has just opened. Each student is told once per
 * stack (`notified_at`); their interest row stays, so staff still see how much demand there was.
 */
class StackLaunchNotifier
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly CuratedCatalog $catalog,
    ) {}

    /**
     * @param  list<string>  $stackKeys  stacks that have just become live
     * @return int how many students were told
     */
    public function opened(array $stackKeys): int
    {
        $told = 0;

        foreach ($stackKeys as $stackKey) {
            $name = $this->catalog->stack($stackKey)['stack']['name'] ?? null;

            if ($name === null) {
                continue;
            }

            $waiting = VaultStackInterest::where('stack_key', $stackKey)->whereNull('notified_at');
            $ids = (clone $waiting)->pluck('user_id')->all();

            if ($ids === []) {
                continue;
            }

            $told += $this->notifications->notifyMany($ids, NotificationType::VaultActivity, "{$name} Vault AI Interview is now open", 'The track you asked about is ready. Sit its 3 sets and qualify for Mellow Vault.', [
                'url' => '/dashboard/vault-interviews',
                'severity' => 'success',
                'group_key' => 'vault.stack_open:'.$stackKey,
            ]);

            $waiting->update(['notified_at' => now()]);
        }

        return $told;
    }
}
