<?php

namespace App\Console\Commands;

use App\Services\Vault\VaultSyncService;
use Illuminate\Console\Command;

/** Removes delivered Vault outbox events past their retention (config vault.sync_retention_days). Parked (`dead`) and waiting events are never touched. */
class PruneVaultSyncEvents extends Command
{
    protected $signature = 'vault:prune';

    protected $description = 'Delete delivered Vault sync events past their retention period';

    public function handle(VaultSyncService $sync): int
    {
        $this->info('Removed '.$sync->prune().' delivered event(s).');

        return self::SUCCESS;
    }
}
