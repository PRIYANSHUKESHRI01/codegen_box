<?php

namespace App\Console\Commands;

use App\Models\VaultProfile;
use App\Services\Vault\MellowVaultDeveloperWriter;
use App\Services\Vault\VaultService;
use App\Services\Vault\VaultSyncService;
use Illuminate\Console\Command;
use Throwable;

/**
 * The way back for the database hand-off: Mellow Vault marks a developer BOOKED (developer_status 4) when an employer hires them, and with no
 * HTTP callback in this arrangement AptRun reads that from the table - the same "this student was hired" that
 * POST /vault/v1/profiles/{id}/status carries in production. Only profiles AptRun delivered itself count (their dev_id is the profile's
 * external id), so a developer who merely shares an email is never mistaken for one.
 *
 *   php artisan vault:pull-outcomes
 */
class PullVaultOutcomes extends Command
{
    protected $signature = 'vault:pull-outcomes';

    protected $description = 'Mark AptRun students hired when Mellow Vault has booked them (database hand-off only)';

    public function handle(VaultSyncService $sync, MellowVaultDeveloperWriter $writer, VaultService $vault): int
    {
        if ($sync->driver() !== 'database' || ! $sync->isConfigured()) {
            return self::SUCCESS;
        }

        try {
            $booked = $writer->bookedDeveloperIds();
        } catch (Throwable $e) {
            $this->warn("Could not read Mellow Vault's database: {$e->getMessage()}");

            return self::FAILURE;
        }

        if ($booked === []) {
            return self::SUCCESS;
        }

        $marked = 0;

        VaultProfile::whereIn('external_id', array_map('strval', $booked))->get()->each(function (VaultProfile $profile) use ($vault, &$marked) {
            if (! $profile->isHired()) {
                $vault->markHired($profile, VaultProfile::HIRED_VIA_VAULT);
                $marked++;
            }
        });

        if ($marked > 0) {
            $this->info("Marked {$marked} student(s) hired.");
        }

        return self::SUCCESS;
    }
}
