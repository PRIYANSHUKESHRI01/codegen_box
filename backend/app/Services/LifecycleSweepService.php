<?php

namespace App\Services;

use App\Enums\LifecycleEmail;
use App\Jobs\SendLifecycleEmail;
use App\Models\LifecycleEmailLog;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\VaultProfile;
use App\Services\Payments\CheckoutService;
use App\Services\Vault\VaultService;
use App\Support\SingleMail;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The e-mails that are DUE rather than ones that happened: a plan about to end, a
 * student a few points short of the Vault, someone who has not been back for two
 * weeks. Run once a day by `lifecycle:send` (the same scheduler cron that already
 * drives payments:reconcile and readiness:refresh — no queue worker involved).
 *
 * Rules that apply to every nudge here, because a nudge that annoys is worse than
 * none:
 *   • it respects the unsubscribe flag, and never goes to a blocked account;
 *   • a student gets at most one engagement e-mail every few days, whatever the
 *     kind (config: min_days_between_engagement). The sweeps run in priority order
 *     — Vault upgrade, "close to the Vault", buy-a-plan, win-back — so when a
 *     student qualifies for several, the most useful one goes first and the rest
 *     wait their turn;
 *   • one run sends at most `max_per_run` engagement mails, so the mail account's
 *     daily limit is never spent on nudges;
 *   • each message has a unique key (SendLifecycleEmail), so running the command
 *     twice, or two servers running it at once, cannot double-send.
 *
 * `$dryRun` does everything except send: the counts are what WOULD go out.
 */
class LifecycleSweepService
{
    /** @var array<string, int> */
    private array $stats = [];

    public function __construct(
        private readonly ReadinessScoreService $readiness,
        private readonly VaultService $vault,
    ) {}

    /**
     * @param  list<string>|null  $only  limit to these LifecycleEmail values
     * @return array<string, int> messages sent (or that would be sent, on a dry run) per type
     */
    public function run(bool $dryRun = false, ?array $only = null, ?int $cap = null): array
    {
        $this->stats = [];
        $budget = $cap ?? (int) config('lifecycle_mail.max_per_run', 300);
        $wants = fn (LifecycleEmail $type) => $only === null || in_array($type->value, $only, true);

        if ($wants(LifecycleEmail::PlanExpiring)) {
            $this->stats[LifecycleEmail::PlanExpiring->value] = $this->planExpiring($dryRun);
        }

        if (! config('lifecycle_mail.engagement_enabled', true)) {
            return $this->stats;
        }

        $engagement = [
            [LifecycleEmail::VaultUpgrade, fn (int $room) => $this->vaultUpgradeReminders($dryRun, $room)],
            [LifecycleEmail::ReadinessPush, fn (int $room) => $this->readinessPush($dryRun, $room)],
            [LifecycleEmail::UpgradeNudge, fn (int $room) => $this->upgradeNudges($dryRun, $room)],
            [LifecycleEmail::Inactivity, fn (int $room) => $this->inactivity($dryRun, $room)],
        ];

        foreach ($engagement as [$type, $sweep]) {
            if (! $wants($type)) {
                continue;
            }

            $sent = $budget > 0 ? $sweep($budget) : 0;
            $this->stats[$type->value] = $sent;
            $budget -= $sent;
        }

        return $this->stats;
    }

    // ───────────────────────────── plans that are about to end ─────────────────────────────

    /**
     * A reminder per configured day-count before a paid personal plan ends (7 days,
     * 1 day). Transactional — it is about the student's own paid plan — so the
     * unsubscribe flag does not stop it and the per-run cap does not count it.
     */
    private function planExpiring(bool $dryRun): int
    {
        $days = collect(config('lifecycle_mail.plan_expiring_days', [7, 1]))->map(fn ($d) => (int) $d)->sort()->values();

        if ($days->isEmpty()) {
            return 0;
        }

        $sent = 0;

        Subscription::with('plan')
            ->where('status', Subscription::STATUS_ACTIVE)
            ->where('subscriber_type', User::class)
            ->whereNotNull('current_period_end')
            ->where('current_period_end', '>', now())
            ->where('current_period_end', '<=', now()->addDays($days->max() + 1))
            ->whereHas('plan', fn ($q) => $q->where('kind', Plan::KIND_BASE)->paidTier())
            ->orderBy('id')
            ->chunkById(200, function ($subscriptions) use ($days, $dryRun, &$sent) {
                foreach ($subscriptions as $subscription) {
                    $left = (int) $subscription->daysRemaining();
                    $stage = $days->first(fn (int $d) => $left <= $d);

                    if ($stage === null) {
                        continue;
                    }

                    // The end date is part of the key: a plan that is extended (or renewed onto the same row) after a reminder earns a fresh set for its new end.
                    $key = 'sub'.$subscription->id.'-'.$subscription->current_period_end->format('Ymd').'-d'.$stage;

                    if ($this->alreadySent($subscription->subscriber_id, LifecycleEmail::PlanExpiring, $key)) {
                        continue;
                    }

                    $student = User::find($subscription->subscriber_id);

                    if ($student === null || ! $student->isStudent()) {
                        continue;
                    }

                    if (! $dryRun) {
                        SingleMail::now(new SendLifecycleEmail($student->id, LifecycleEmail::PlanExpiring->value, [
                            'plan' => $subscription->plan->name,
                            'plan_code' => $subscription->plan->code,
                            'days_left' => $left,
                            'ends_at' => $subscription->current_period_end->toIso8601String(),
                        ], $key));
                    }

                    $sent++;
                }
            });

        return $sent;
    }

    // ───────────────────────────── ready for the Vault, but the plan has no Vault ─────────────────────────────

    /**
     * The first message goes out the moment a student qualifies (VaultService). This
     * sweep catches the ones who qualified before that existed, and sends the two
     * reminders — 14 and 30 days after the first — to anyone still waiting.
     */
    private function vaultUpgradeReminders(bool $dryRun, int $room): int
    {
        $reminderDays = array_values(array_map('intval', (array) config('lifecycle_mail.vault_upgrade_reminder_days', [14, 30])));
        $sent = 0;

        VaultProfile::with('user')
            ->where('is_eligible', true)
            ->where('visibility_status', VaultProfile::STATUS_UPGRADE_REQUIRED)
            ->whereHas('user', fn ($q) => $this->reachable($q)->whereNull('invited_by_company_id'))
            ->orderBy('id')
            ->chunkById(200, function ($profiles) use ($reminderDays, $dryRun, $room, &$sent) {
                $recent = $this->engagedRecently($profiles->pluck('user_id'));

                foreach ($profiles as $profile) {
                    if ($sent >= $room) {
                        return false;
                    }

                    if (isset($recent[$profile->user_id]) || $profile->user === null) {
                        continue;
                    }

                    $logs = LifecycleEmailLog::where('user_id', $profile->user_id)->where('type', LifecycleEmail::VaultUpgrade->value)->orderBy('sent_at')->get();
                    $count = $logs->count();
                    $first = $logs->first()?->sent_at;

                    $stage = match (true) {
                        $count === 0 => 0,
                        $count <= count($reminderDays) && $first->lte(now()->subDays($reminderDays[$count - 1])) => $count,
                        default => null,
                    };

                    if ($stage === null) {
                        continue;
                    }

                    if (! $dryRun) {
                        SingleMail::now(new SendLifecycleEmail($profile->user_id, LifecycleEmail::VaultUpgrade->value, [
                            'score' => (int) $profile->readiness_score,
                            'enter' => $this->vault->thresholds()['enter'],
                            'stage' => $stage,
                        ], $stage === 0 ? 'first' : 'r'.$stage));
                    }

                    $sent++;
                }
            });

        return $sent;
    }

    // ───────────────────────────── a few points short of the Vault ─────────────────────────────

    private function readinessPush(bool $dryRun, int $room): int
    {
        $cfg = (array) config('lifecycle_mail.readiness_push', []);
        $enter = $this->vault->thresholds()['enter'];
        $from = min((int) ($cfg['from'] ?? 45), $enter - 1);
        $max = (int) ($cfg['max'] ?? 4);
        $sent = 0;

        $this->students()
            ->whereNull('invited_by_company_id')
            ->where('last_seen_at', '>=', now()->subDays((int) ($cfg['active_within_days'] ?? 30)))
            ->whereDoesntHave('vaultProfile', fn ($q) => $q->where('is_eligible', true))
            ->whereDoesntHave('lifecycleEmails', fn ($q) => $q->where('type', LifecycleEmail::ReadinessPush->value)
                ->where('sent_at', '>=', now()->subDays((int) ($cfg['cooldown_days'] ?? 10))))
            ->withCount(['lifecycleEmails as pushes_sent' => fn ($q) => $q->where('type', LifecycleEmail::ReadinessPush->value)])
            ->chunkById(250, function ($students) use ($from, $enter, $max, $dryRun, $room, &$sent) {
                $students = $students->filter(fn (User $s) => (int) $s->pushes_sent < $max)->values();

                if ($students->isEmpty()) {
                    return;
                }

                foreach ($this->readiness->compute($students) as $userId => $result) {
                    if ($sent >= $room) {
                        return false;
                    }

                    $breakdown = $result['breakdown'];
                    $score = (int) $breakdown['score'];

                    if ($score < $from || $score >= $enter) {
                        continue;
                    }

                    $student = $students->firstWhere('id', $userId);

                    if (! $dryRun) {
                        SingleMail::now(new SendLifecycleEmail($userId, LifecycleEmail::ReadinessPush->value, [
                            'score' => $score,
                            'enter' => $enter,
                            'needed' => $enter - $score,
                            'steps' => array_slice((array) ($breakdown['next_steps'] ?? []), 0, 3),
                            'needs_plan' => ! $student->effectiveEntitlements()['vault_access'],
                        ], 'on'.now()->format('Ymd')));
                    }

                    $sent++;
                }
            });

        return $sent;
    }

    // ───────────────────────────── free-plan students who have not bought ─────────────────────────────

    private function upgradeNudges(bool $dryRun, int $room): int
    {
        // Never tell people to buy something they cannot buy.
        if (! app(CheckoutService::class)->isAvailable()) {
            return 0;
        }

        $cfg = (array) config('lifecycle_mail.upgrade_nudge', []);
        $days = array_values(array_map('intval', (array) ($cfg['days'] ?? [3, 10, 24])));
        $gap = (int) ($cfg['gap_days'] ?? 5);
        $sent = 0;

        $this->students()
            ->mellowDirectLeads()
            ->where('created_at', '<=', now()->subDays($days[0] ?? 3))
            // Anyone who has ever held a paid plan is past this stage — they get the plan-ending and renewal mail instead.
            ->whereDoesntHave('subscriptions', fn ($q) => $q->whereHas('plan', fn ($p) => $p->paidTier()))
            ->withCount(['lifecycleEmails as nudges_sent' => fn ($q) => $q->where('type', LifecycleEmail::UpgradeNudge->value)])
            ->withMax(['lifecycleEmails as last_nudge_at' => fn ($q) => $q->where('type', LifecycleEmail::UpgradeNudge->value)], 'sent_at')
            ->chunkById(250, function ($students) use ($days, $gap, $dryRun, $room, &$sent) {
                foreach ($students as $student) {
                    if ($sent >= $room) {
                        return false;
                    }

                    $done = (int) $student->nudges_sent;

                    if ($done >= count($days) || $student->created_at->gt(now()->subDays($days[$done]))) {
                        continue;
                    }

                    if ($student->last_nudge_at !== null && Carbon::parse($student->last_nudge_at)->gt(now()->subDays($gap))) {
                        continue;
                    }

                    if (! $dryRun) {
                        SingleMail::now(new SendLifecycleEmail($student->id, LifecycleEmail::UpgradeNudge->value, ['stage' => $done + 1], 'stage'.($done + 1)));
                    }

                    $sent++;
                }
            });

        return $sent;
    }

    // ───────────────────────────── students who stopped coming ─────────────────────────────

    private function inactivity(bool $dryRun, int $room): int
    {
        $cfg = (array) config('lifecycle_mail.inactivity', []);
        $days = array_values(array_map('intval', (array) ($cfg['days'] ?? [14, 45])));
        $giveUp = (int) ($cfg['give_up_after_days'] ?? 90);
        $sent = 0;

        $this->students()
            ->whereNull('invited_by_company_id')
            ->whereNotNull('last_seen_at')
            ->where('last_seen_at', '<=', now()->subDays($days[0] ?? 14))
            ->where('last_seen_at', '>=', now()->subDays($giveUp))
            // How many win-backs this absence has already had: those sent since the student was last seen.
            ->withCount(['lifecycleEmails as winbacks_sent' => fn ($q) => $q->where('type', LifecycleEmail::Inactivity->value)
                ->whereColumn('lifecycle_emails.sent_at', '>', 'users.last_seen_at')])
            ->chunkById(250, function ($students) use ($days, $dryRun, $room, &$sent) {
                $due = $students->filter(function (User $s) use ($days) {
                    $done = (int) $s->winbacks_sent;

                    return $done < count($days) && $s->last_seen_at->lte(now()->subDays($days[$done]));
                })->take($room - $sent)->values();

                if ($due->isEmpty()) {
                    return $sent >= $room ? false : null;
                }

                $scores = $this->readiness->compute($due);

                foreach ($due as $student) {
                    $done = (int) $student->winbacks_sent;

                    if (! $dryRun) {
                        SingleMail::now(new SendLifecycleEmail($student->id, LifecycleEmail::Inactivity->value, [
                            'days' => (int) $student->last_seen_at->diffInDays(now()),
                            'score' => (int) ($scores[$student->id]['breakdown']['score'] ?? 0),
                            'stage' => $done + 1,
                        ], 'ls'.$student->last_seen_at->format('Ymd').'-s'.($done + 1)));
                    }

                    $sent++;
                }

                return $sent >= $room ? false : null;
            });

        return $sent;
    }

    // ───────────────────────────── shared ─────────────────────────────

    /**
     * Students we may send a nudge to right now: reachable, and not mailed an
     * engagement e-mail of any kind within the minimum gap.
     *
     * @return Builder<User>
     */
    private function students(): Builder
    {
        return $this->reachable(User::query())
            ->whereDoesntHave('lifecycleEmails', fn ($q) => $q->whereIn('type', LifecycleEmail::engagementValues())
                ->where('sent_at', '>=', now()->subDays((int) config('lifecycle_mail.min_days_between_engagement', 3))));
    }

    /** @param  Builder<User>|\Illuminate\Database\Eloquent\Relations\Relation  $query */
    private function reachable($query)
    {
        return $query->where('role', User::ROLE_USER)
            ->where('is_blocked', false)
            ->whereNull('email_nudges_opt_out_at')
            ->where('email', '!=', '');
    }

    /**
     * Of these users, who has had an engagement e-mail inside the minimum gap?
     *
     * @param  Collection<int, int>  $userIds
     * @return array<int, true>
     */
    private function engagedRecently(Collection $userIds): array
    {
        return LifecycleEmailLog::whereIn('user_id', $userIds->all())
            ->whereIn('type', LifecycleEmail::engagementValues())
            ->where('sent_at', '>=', now()->subDays((int) config('lifecycle_mail.min_days_between_engagement', 3)))
            ->pluck('user_id')
            ->mapWithKeys(fn ($id) => [(int) $id => true])
            ->all();
    }

    private function alreadySent(int $userId, LifecycleEmail $type, string $key): bool
    {
        return LifecycleEmailLog::where('user_id', $userId)->where('type', $type->value)->where('dedupe_key', $key)->exists();
    }
}
