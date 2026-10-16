<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Vault\VaultRefreshService;
use Illuminate\Console\Command;

/**
 * Re-scores students and applies the result to the Vault (lists those who have
 * reached the bar and said yes, takes down those who have fallen clearly below
 * it). The scheduler runs it every ten minutes for students who were just active,
 * and nightly for everyone seen recently plus everyone already in the Vault — a
 * score also falls with time, so people who have gone quiet must be re-checked
 * too. Safe to run by hand at any time, and as often as you like.
 *
 *   php artisan readiness:refresh                 students seen in the last 45 minutes
 *   php artisan readiness:refresh --all           everyone seen in the last 120 days + the whole Vault
 *   php artisan readiness:refresh --user=12 --user=40
 */
class RefreshReadiness extends Command
{
    protected $signature = 'readiness:refresh
        {--all : Every student seen recently, plus everyone who has a Vault profile}
        {--minutes=45 : Without --all: students seen in the last N minutes}
        {--days=120 : With --all: "seen recently" means the last N days}
        {--user=* : Only these user ids}';

    protected $description = "Re-score students' readiness and update who is in the Vault";

    public function handle(VaultRefreshService $refresh): int
    {
        $query = User::query()->where('role', User::ROLE_USER)->where('is_blocked', false);

        if ($this->option('user')) {
            $query->whereIn('id', array_map('intval', (array) $this->option('user')));
        } elseif ($this->option('all')) {
            $since = now()->subDays((int) $this->option('days'));
            $query->where(fn ($q) => $q->where('last_seen_at', '>=', $since)->orWhereHas('vaultProfile'));
        } else {
            $query->where('last_seen_at', '>=', now()->subMinutes((int) $this->option('minutes')));
        }

        $scored = 0;
        $errors = 0;

        $query->chunkById(500, function ($students) use ($refresh, &$scored, &$errors) {
            $stats = $refresh->refresh($students);
            $scored += $stats['scored'];
            $errors += $stats['errors'];
        });

        $this->info("Scored {$scored} student(s)".($errors > 0 ? ", {$errors} error(s) — see the log" : '').'.');

        return $errors > 0 ? self::FAILURE : self::SUCCESS;
    }
}
