<?php

namespace App\Console\Commands;

use App\Models\GuardianLink;
use App\Models\IntegrityEvidence;
use App\Models\IntegritySession;
use App\Services\Integrity\EvidenceVault;
use Illuminate\Console\Command;

/**
 * Retention for the integrity layer (config/integrity.php → evidence.*):
 *
 *   - still images (webcam / screen) are deleted after `retention_days`, EXCEPT those of an attempt that raised a flag
 *     (a flagged still, a high/critical risk level, or a lock), which are kept for `flagged_retention_days` so a dispute
 *     can still be settled;
 *   - whole attempts (their hash-chained log and any remaining evidence) are deleted after `events_retention_days`;
 *   - revoked or expired Guardian links are dropped after 30 days.
 *
 * Pictures of students are personal data: keeping them only as long as there is a reason is part of the design, not a
 * nicety. Runs daily; safe to run by hand (`--dry-run` counts without deleting).
 */
class IntegrityPrune extends Command
{
    protected $signature = 'integrity:prune {--dry-run : Count what would be removed, remove nothing}';

    protected $description = 'Delete integrity evidence and logs past their retention';

    public function handle(EvidenceVault $vault): int
    {
        $dry = (bool) $this->option('dry-run');
        $cleanBefore = now()->subDays((int) config('integrity.evidence.retention_days', 45));
        $flaggedBefore = now()->subDays((int) config('integrity.evidence.flagged_retention_days', 365));
        $sessionsBefore = now()->subDays((int) config('integrity.evidence.events_retention_days', 730));

        $images = 0;
        IntegrityEvidence::with('session:id,risk_level,status')
            ->where('created_at', '<', $cleanBefore)
            ->orderBy('id')
            ->chunkById(300, function ($rows) use ($vault, $dry, $flaggedBefore, &$images) {
                foreach ($rows as $evidence) {
                    $serious = $evidence->flagged
                        || in_array($evidence->session?->risk_level, ['high', 'critical'], true)
                        || $evidence->session?->status === IntegritySession::STATUS_LOCKED;

                    if ($serious && $evidence->created_at->gt($flaggedBefore)) {
                        continue;
                    }

                    $images++;
                    if (! $dry) {
                        $vault->delete($evidence);
                    }
                }
            });

        $attempts = 0;
        IntegritySession::where('started_at', '<', $sessionsBefore)
            ->orderBy('id')
            ->chunkById(100, function ($sessions) use ($vault, $dry, &$attempts) {
                foreach ($sessions as $s) {
                    $attempts++;
                    if ($dry) {
                        continue;
                    }
                    foreach ($s->evidence as $evidence) {
                        $vault->delete($evidence);
                    }
                    $s->delete(); // the log rows go with it (cascade)
                }
            });

        $links = GuardianLink::where(function ($q) {
            $q->where('revoked_at', '<', now()->subDays(30))->orWhere('expires_at', '<', now()->subDays(30));
        });
        $linkCount = (clone $links)->count();
        if (! $dry) {
            $links->delete();
        }

        $verb = $dry ? 'Would remove' : 'Removed';
        $this->info("{$verb} {$images} image(s), {$attempts} old attempt log(s), {$linkCount} stale Guardian link(s).");

        return self::SUCCESS;
    }
}
