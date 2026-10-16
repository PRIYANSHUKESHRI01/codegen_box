<?php

namespace App\Console\Commands;

use App\Enums\LifecycleEmail;
use App\Services\LifecycleSweepService;
use Illuminate\Console\Command;

/**
 * Scheduled daily (see routes/console.php): the plan-ending reminders, the
 * "you are close to the Vault" push, the Vault-upgrade reminders, the buy-a-plan
 * nudges and the win-back. See LifecycleSweepService for the rules each follows.
 *
 *   php artisan lifecycle:send --dry-run          what would go out, send nothing
 *   php artisan lifecycle:send --only=plan_expiring --only=readiness_push
 *   php artisan lifecycle:send --max=50           cap this run's nudges
 *
 * Safe to run any number of times a day: every message has a unique key, so a
 * second run sends only what has become due since the first.
 */
class SendLifecycleEmails extends Command
{
    protected $signature = 'lifecycle:send
        {--dry-run : Count what would be sent, send nothing}
        {--only=* : Only these kinds (plan_expiring, vault_upgrade, readiness_push, upgrade_nudge, inactivity)}
        {--max= : Most engagement e-mails this run may send (default: LIFECYCLE_MAX_PER_RUN)}';

    protected $description = 'Send the due reminders and nudges: plans ending, close to the Vault, upgrade and win-back e-mails';

    public function handle(LifecycleSweepService $sweep): int
    {
        $only = array_values(array_filter((array) $this->option('only')));
        $known = array_map(fn (LifecycleEmail $t) => $t->value, LifecycleEmail::cases());

        if (($unknown = array_diff($only, $known)) !== []) {
            $this->error('Unknown kind: '.implode(', ', $unknown).'. Choose from: '.implode(', ', $known));

            return self::INVALID;
        }

        $dry = (bool) $this->option('dry-run');
        $stats = $sweep->run($dry, $only === [] ? null : $only, $this->option('max') !== null ? (int) $this->option('max') : null);

        if (! config('lifecycle_mail.engagement_enabled', true)) {
            $this->warn('Engagement e-mails are switched off (LIFECYCLE_ENGAGEMENT_ENABLED=false) — only plan-ending reminders ran.');
        }

        foreach ($stats as $type => $count) {
            $this->line(sprintf('  %-16s %d', $type, $count));
        }

        $this->info(($dry ? 'Dry run — would send ' : 'Sent ').array_sum($stats).' e-mail(s).');

        return self::SUCCESS;
    }
}
