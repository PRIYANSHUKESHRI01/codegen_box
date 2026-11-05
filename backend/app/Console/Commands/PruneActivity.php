<?php

namespace App\Console\Commands;

use App\Models\ActivityPageView;
use App\Models\ActivityVisit;
use App\Models\AuthEvent;
use App\Models\UserActivityDay;
use Illuminate\Console\Command;

/**
 * Daily: drops the activity data past its retention (config activity.retention_days). Page views are the bulk of it and go first;
 * the one-row-per-person-per-day roll-up and the sign-in log are small and are kept longest. Deleted in slices so a big backlog never
 * holds a table lock for long.
 */
class PruneActivity extends Command
{
    protected $signature = 'activity:prune';

    protected $description = 'Delete page views, visits, daily roll-ups and sign-in log rows past their retention';

    public function handle(): int
    {
        $keep = (array) config('activity.retention_days', []);

        $this->line('Page views: '.$this->slice(ActivityPageView::query()->where('entered_at', '<', now()->subDays((int) ($keep['page_views'] ?? 90)))));
        $this->line('Visits: '.$this->slice(ActivityVisit::query()->where('last_seen_at', '<', now()->subDays((int) ($keep['visits'] ?? 180)))));
        $this->line('Daily roll-ups: '.$this->slice(UserActivityDay::query()->where('day', '<', now()->subDays((int) ($keep['days'] ?? 400))->toDateString())));
        $this->line('Sign-in log: '.$this->slice(AuthEvent::query()->where('created_at', '<', now()->subDays((int) ($keep['auth_events'] ?? 400)))));

        return self::SUCCESS;
    }

    private function slice($query): int
    {
        $total = 0;

        do {
            $ids = (clone $query)->limit(5000)->pluck('id');
            $deleted = $ids->isEmpty() ? 0 : $query->getModel()->newQuery()->whereIn('id', $ids)->delete();
            $total += $deleted;
        } while ($deleted > 0);

        return $total;
    }
}
