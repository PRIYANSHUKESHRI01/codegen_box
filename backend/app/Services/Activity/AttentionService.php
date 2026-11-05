<?php

namespace App\Services\Activity;

use App\Models\Contest;
use App\Models\PaymentOrder;
use App\Models\Subscription;
use App\Models\WeeklyRewardWinner;
use App\Services\DailyChallengeService;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * "What needs the superadmin today?" — the short list on the Overview. Each item says what is wrong in one line, how many it is,
 * and which tab to open to deal with it. Nothing here is a report: an empty list is the good outcome.
 *
 *   demo logins not opened     colleges (and accounts) handed a login more than a few days ago that has never been used
 *   quiet colleges             colleges that were active and have not been seen for a week
 *   plans ending soon          college and student plans that end within a week
 *   payments stuck             orders opened over an hour ago and still unpaid, and failed ones today
 *   vouchers to send           weekly-reward winners still waiting for their voucher
 *   tonight's challenge        the daily contest of the day has not been created
 *   background jobs            failed jobs, and a scheduler that has not ticked (the cron is the heart of the platform)
 */
class AttentionService
{
    public function __construct(private readonly CollegeAdoption $adoption, private readonly DailyChallengeService $daily) {}

    /** The scheduler stamps this every minute (routes/console.php). */
    public const HEARTBEAT_KEY = 'scheduler:heartbeat';

    /** @return list<array<string, mixed>> */
    public function items(): array
    {
        $items = [];
        $add = function (string $key, string $severity, string $title, string $detail, int $count, string $tab, ?array $examples = null) use (&$items) {
            if ($count > 0) {
                $items[] = compact('key', 'severity', 'title', 'detail', 'count', 'tab') + ['examples' => $examples ?? []];
            }
        };

        // Demo logins nobody opened, and colleges gone quiet.
        $waitingDays = max(1, (int) config('activity.waiting_after_days', 3));
        $directory = $this->adoption->directory(['sort' => 'attention'], 1, 100)['rows'];
        $stalled = collect($directory)->filter(fn ($r) => in_array($r['status'], ['not_opened', 'tried', 'password_set'], true)
            && collect($r['tpos'])->contains(fn ($t) => $t['issued_at']->lte(Carbon::now()->subDays($waitingDays))));
        $add('logins_unused', 'warning', 'Colleges that have not started', "A TPO login was issued more than {$waitingDays} days ago and the college has not got going.", $stalled->count(), 'activity',
            $stalled->take(4)->map(fn ($r) => ['id' => $r['id'], 'label' => $r['name'], 'note' => $r['status_label']])->values()->all());

        $dormant = collect($directory)->where('status', 'dormant');
        $add('colleges_quiet', 'info', 'Colleges gone quiet', 'These colleges were using AptRun and have not been seen for a week.', $dormant->count(), 'activity',
            $dormant->take(4)->map(fn ($r) => ['id' => $r['id'], 'label' => $r['name'], 'note' => $r['last_activity_at'] ? 'last seen '.$r['last_activity_at']->diffForHumans() : null])->values()->all());

        // Plans ending within a week.
        $ending = Subscription::query()->where('status', Subscription::STATUS_ACTIVE)->whereNotNull('current_period_end')
            ->whereBetween('current_period_end', [Carbon::now(), Carbon::now()->addDays(7)])->count();
        $add('plans_ending', 'warning', 'Plans ending this week', 'Renew them, or they fall back to the free plan.', $ending, 'subscriptions');

        // Payments.
        if (Schema::hasTable('payment_orders')) {
            $stuck = PaymentOrder::query()->where('status', PaymentOrder::STATUS_NEEDS_REVIEW)->count();
            $add('payments_stuck', 'warning', 'Payments that need a look', 'The gateway and AptRun disagree about these orders. "Re-check" in Payments asks the gateway again.', $stuck, 'payments');
        }

        // Vouchers owed.
        if (Schema::hasTable('weekly_reward_winners')) {
            $add('vouchers_owed', 'info', 'Vouchers to send', 'Winners of the weekly leaderboard who have not been sent their voucher.', WeeklyRewardWinner::where('status', WeeklyRewardWinner::PENDING)->count(), 'weekly_rewards');
        }

        // Tonight's contest.
        $date = $this->daily->targetDate();
        if (! Contest::where('daily_key', $date)->exists()) {
            $add('daily_missing', 'critical', 'The next Daily Challenge does not exist', "No edition is scheduled for {$date}. Run contests:generate-daily; check the problem bank has Easy, Medium and Hard problems.", 1, 'weekly_rewards');
        }

        // Background work.
        $failed = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->where('failed_at', '>', Carbon::now()->subDay())->count() : 0;
        $add('failed_jobs', 'warning', 'Background jobs failed', 'In the last 24 hours (e-mails, imports, scoring). Look at failed_jobs on the server.', $failed, 'infrastructure');

        $beat = Cache::get(self::HEARTBEAT_KEY);
        if ($beat === null || Carbon::parse($beat)->lt(Carbon::now()->subMinutes(5))) {
            $add('scheduler_stopped', 'critical', 'The scheduler is not running', $beat === null ? 'It has not ticked since the last restart (or never). Contests, e-mails, scoring and reports all depend on `schedule:run` every minute.' : 'Last tick '.Carbon::parse($beat)->diffForHumans().'. Check the server cron for `php artisan schedule:run`.', 1, 'infrastructure');
        }

        $order = ['critical' => 0, 'warning' => 1, 'info' => 2];
        usort($items, fn ($a, $b) => [$order[$a['severity']], -$a['count']] <=> [$order[$b['severity']], -$b['count']]);

        return $items;
    }
}
