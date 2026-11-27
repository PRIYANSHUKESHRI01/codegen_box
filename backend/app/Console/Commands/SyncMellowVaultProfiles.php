<?php

namespace App\Console\Commands;

use App\Services\Vault\MellowVaultProfileSyncService;
use Illuminate\Console\Command;

/**
 * Polls `mellow_vault.developer_details_tb` (`profile_complete` & `pro_id` -> `higher_professional_tb`)
 * for all synced developers, updates AptRun `users`, and dispatches the 1-click Vault AI Interview
 * email invitation to users crossing 90% profile completion.
 */
class SyncMellowVaultProfiles extends Command
{
    protected $signature = 'mellow-vault:sync-profile-completion
        {--threshold=90 : Minimum profile_complete percent to trigger the Vault AI Interview invite}
        {--max-emails=50 : Maximum invitation emails to queue per run (0 = sync only)}
        {--user-id= : Only sync one specific AptRun user id}
        {--email= : Only sync one specific email address}
        {--sync : Deliver queued invite emails synchronously inside this command instead of queueing}
        {--dry-run : Preview counts without writing to DB or queuing emails}';

    protected $description = 'Sync Mellow Vault developer profile completion % & tech stack and invite >=90% users to Vault AI Interview';

    public function handle(MellowVaultProfileSyncService $service): int
    {
        $threshold = max(1, min(100, (int) $this->option('threshold')));
        $maxEmails = max(0, (int) $this->option('max-emails'));
        $onlyUserId = $this->option('user-id') ? (int) $this->option('user-id') : null;
        $onlyEmail = $this->option('email') ? (string) $this->option('email') : null;
        $syncDispatch = (bool) $this->option('sync');
        $dryRun = (bool) $this->option('dry-run');

        $result = $service->syncAll($threshold, $maxEmails, $dryRun, $onlyUserId, $onlyEmail, $syncDispatch);

        if (! $result['configured']) {
            $this->warn('Mellow Vault database is not configured (MELLOW_VAULT_DB_DATABASE is blank).');

            return self::SUCCESS;
        }

        $this->info(sprintf(
            '%sScanned %d Mellow Vault row(s); matched %d user(s) (%d updated), %d at >=%d%%, %d invite(s) %s, %d already invited, %d skipped.',
            $dryRun ? '[DRY RUN] ' : '',
            $result['scanned'],
            $result['matched_users'],
            $result['updated_users'],
            $result['eligible_90'],
            $threshold,
            $result['invites_queued'],
            $syncDispatch ? 'sent' : 'queued',
            $result['skipped_already_invited'],
            $result['skipped_locked_or_opted_out']
        ));

        return self::SUCCESS;
    }
}
