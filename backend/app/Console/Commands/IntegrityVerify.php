<?php

namespace App\Console\Commands;

use App\Models\IntegritySession;
use App\Services\Integrity\EventLog;
use Illuminate\Console\Command;

/**
 * Re-walks the hash chain of integrity logs and reports the first row where it breaks. Every event stores the hash of the
 * row before it, so editing a row, deleting one from the middle, or trimming the end is detectable.
 *
 *   php artisan integrity:verify 3f2a…          one attempt (its uuid)
 *   php artisan integrity:verify --since=30     every attempt started in the last 30 days (default 7)
 *
 * Exits non-zero when anything is broken, so it can be run from a monitor. This is the answer to a dispute that says
 * "the log was edited": it either verifies or it points at the exact row.
 */
class IntegrityVerify extends Command
{
    protected $signature = 'integrity:verify {uuid? : One attempt} {--since=7 : Days back when no uuid is given}';

    protected $description = 'Verify the tamper-evident hash chain of integrity logs';

    public function handle(): int
    {
        $uuid = $this->argument('uuid');

        $query = $uuid
            ? IntegritySession::where('uuid', $uuid)
            : IntegritySession::where('started_at', '>=', now()->subDays(max(1, (int) $this->option('since'))));

        $checked = 0;
        $broken = 0;

        $query->orderBy('id')->chunkById(100, function ($sessions) use (&$checked, &$broken) {
            foreach ($sessions as $s) {
                $checked++;
                $problem = EventLog::verify($s);

                if ($problem !== null) {
                    $broken++;
                    $this->error("BROKEN {$s->uuid} (user {$s->user_id}, {$s->surface}) at event #{$problem['seq']}: {$problem['reason']}");
                }
            }
        });

        if ($checked === 0) {
            $this->warn('No matching attempts.');

            return self::SUCCESS;
        }

        $broken === 0
            ? $this->info("{$checked} attempt log(s) verified — every hash chain is intact.")
            : $this->error("{$broken} of {$checked} attempt log(s) failed verification.");

        return $broken === 0 ? self::SUCCESS : self::FAILURE;
    }
}
