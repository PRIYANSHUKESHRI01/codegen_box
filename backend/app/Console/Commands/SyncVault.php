<?php

namespace App\Console\Commands;

use App\Models\VaultSyncEvent;
use App\Services\Vault\VaultSyncService;
use Illuminate\Console\Command;

/**
 * Hands whatever is waiting in the Vault outbox to Mellow Vault. The scheduler
 * runs it every minute; it needs only the cron that already runs `schedule:run`,
 * not a queue worker. With the hand-off unconfigured (VAULT_SYNC_URL / VAULT_SYNC_SECRET, or
 * for VAULT_SYNC_DRIVER=database the MELLOW_VAULT_DB_* settings) it sends nothing and loses nothing — events wait.
 *
 *   php artisan vault:sync                 deliver what is due
 *   php artisan vault:sync --retry-dead    first give parked events another full set of attempts
 */
class SyncVault extends Command
{
    protected $signature = 'vault:sync {--retry-dead : Re-queue events that gave up before delivering}';

    protected $description = 'Deliver pending Vault profile updates to Mellow Vault';

    public function handle(VaultSyncService $sync): int
    {
        if ($this->option('retry-dead')) {
            $this->info('Re-queued '.$sync->retryDead().' dead event(s).');
        }

        $result = $sync->deliverDue();

        if (! $result['configured']) {
            $waiting = VaultSyncEvent::whereIn('status', [VaultSyncEvent::STATUS_PENDING, VaultSyncEvent::STATUS_FAILED])->count();

            if ($waiting > 0) {
                $this->warn($sync->driver() === 'database'
                    ? "Mellow Vault's database is not configured (set MELLOW_VAULT_DB_DATABASE). {$waiting} update(s) are waiting."
                    : "Mellow Vault is not connected (set VAULT_SYNC_URL and VAULT_SYNC_SECRET). {$waiting} update(s) are waiting.");
            }

            return self::SUCCESS;
        }

        if ($result['attempted'] > 0) {
            $this->info("Delivered {$result['delivered']} of {$result['attempted']}; {$result['retrying']} will retry, {$result['dead']} gave up.");
        }

        return $result['dead'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
