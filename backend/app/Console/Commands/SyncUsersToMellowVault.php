<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Vault\MellowVaultUserSyncService;
use Illuminate\Console\Command;

/**
 * Provisions/updates AptRun users (college + direct) into `mellow_vault.developer_details_tb`
 * and stamps `mellow_vault_dev_id` back onto AptRun `users`.
 */
class SyncUsersToMellowVault extends Command
{
    protected $signature = 'mellow-vault:sync-users
        {--limit=500 : Maximum number of AptRun users to sync in one run}
        {--only-unsynced : Only process users where users.mellow_vault_dev_id is currently null}';

    protected $description = 'Sync AptRun student/direct users into mellow_vault.developer_details_tb';

    public function handle(MellowVaultUserSyncService $sync): int
    {
        if (! $sync->isConfigured()) {
            $this->warn('Mellow Vault database is not configured (MELLOW_VAULT_DB_DATABASE is blank).');

            return self::SUCCESS;
        }

        $limit = max(1, (int) $this->option('limit'));
        $onlyUnsynced = (bool) $this->option('only-unsynced');

        $query = User::query()
            ->where('role', User::ROLE_USER)
            ->where('is_blocked', false)
            ->when($onlyUnsynced, fn ($q) => $q->whereNull('mellow_vault_dev_id'))
            ->orderByDesc('id')
            ->limit($limit);

        $result = $sync->syncBatch($query->get());

        $this->info("Processed {$result['total']} user(s): {$result['inserted']} inserted, {$result['updated']} updated, {$result['failed']} failed.");

        return $result['failed'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
