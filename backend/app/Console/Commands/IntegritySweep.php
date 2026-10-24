<?php

namespace App\Console\Commands;

use App\Models\IntegritySession;
use App\Services\Integrity\IntegrityService;
use App\Services\Integrity\Surface;
use Illuminate\Console\Command;

/**
 * Housekeeping for the integrity layer, every few minutes from the scheduler:
 *   - an attempt the surface has finished (submitted, graded, the sitting closed, the contest over) has its integrity
 *     session ended, so a stale "active" row never lingers and the log gets a closing entry;
 *   - an attempt nobody has touched for `--abandon-hours` is ended as abandoned.
 *
 * It deliberately does NOT strike anybody for silence. A student who closes the lid has not been caught cheating; the
 * silence is measured (and costs a strike if long enough) the moment they come back and the first beat arrives — see
 * IntegrityService::ingestWeb(). While the signal is stale the gate refuses answers anyway.
 */
class IntegritySweep extends Command
{
    protected $signature = 'integrity:sweep {--abandon-hours=8 : End an attempt that has been silent this long}';

    protected $description = 'End integrity sessions whose attempt is finished or abandoned';

    public function handle(IntegrityService $integrity): int
    {
        $ended = 0;
        $cutoff = now()->subHours(max(1, (int) $this->option('abandon-hours')));

        IntegritySession::whereIn('status', [IntegritySession::STATUS_ACTIVE, IntegritySession::STATUS_LOCKED])
            ->orderBy('id')
            ->chunkById(200, function ($sessions) use ($integrity, &$ended, $cutoff) {
                foreach ($sessions as $s) {
                    $surface = Surface::for($s->surface);
                    $record = $surface->find($s->surface_id);

                    if ($record === null) {
                        $integrity->end($s, 'record_removed');
                        $ended++;

                        continue;
                    }

                    if ($surface->isFinished($record)) {
                        $integrity->end($s, 'finished');
                        $ended++;
                    } elseif (($s->last_beat_at ?? $s->started_at)->lt($cutoff)) {
                        $integrity->end($s, 'abandoned');
                        $ended++;
                    }
                }
            });

        $this->info("Ended {$ended} integrity session(s).");

        return self::SUCCESS;
    }
}
