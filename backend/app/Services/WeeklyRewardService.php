<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\ActivityLog;
use App\Models\PlatformModule;
use App\Models\User;
use App\Models\WeeklyRewardWinner;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;

/**
 * Prizes for the weekly leaderboard: the shelf of voucher cards (config/weekly_rewards.php), which of them the superadmin has put live
 * for a given week — this one or any of the next few — and the ledger of who won what once a week has closed.
 *
 * "Live for a week" is stored in the existing `platform_modules` table, one row per week and card, keyed
 * `wr:<monday's date>:<card>` with `enabled` = live. A week therefore carries its own switches: a card chosen for next week says
 * nothing about this one and starts showing to students by itself when that Monday arrives, nothing has to be done on Monday, and last
 * week's prize list is still there to be paid out. PlatformModules only ever reads the keys it knows, so these rows never touch the
 * real platform modules.
 *
 * The live cards are handed out in order of value (ties keep the shelf's order): the biggest voucher is rank 1's, the next is rank 2's,
 * and so on — so putting three cards live means a top-3 prize list.
 *
 * When a week closes (rewards:finalize-weekly, Monday just after midnight IST) whoever held a prize rank gets a row in
 * `weekly_reward_winners` and a bell notification; the superadmin sends the voucher, records the code and marks it sent, and the
 * student is told again (and can see the code) — a permanent record, since the live board resets every Monday.
 */
class WeeklyRewardService
{
    private const KEY_PREFIX = 'wr:';

    /** Weeks of switches kept; older ones are swept whenever a card is switched. */
    private const KEEP_WEEKS = 12;

    /** How far ahead a week's prizes can be chosen. */
    public const SCHEDULE_AHEAD_WEEKS = 8;

    public function __construct(private readonly ContestLeaderboardService $board) {}

    /** @return array<string, array<string, mixed>> card key => definition */
    public function cards(): array
    {
        return (array) config('weekly_rewards.cards', []);
    }

    public function exists(string $card): bool
    {
        return isset($this->cards()[$card]);
    }

    private function rowKey(array $week, string $card): string
    {
        return self::KEY_PREFIX.$week['key'].':'.$card;
    }

    /**
     * The week a date belongs to (this week for null). Any date in a week names it, so "2026-11-11" and "2026-11-09" are the same week.
     *
     * @return array{key: string, start: Carbon, end: Carbon}
     */
    public function weekOf(?string $date): array
    {
        if ($date === null || $date === '') {
            return $this->board->week();
        }

        try {
            $at = Carbon::parse($date, $this->board->timezone());
        } catch (\Throwable) {
            abort(422, 'That is not a date.');
        }

        return $this->board->week($at->setTime(12, 0));
    }

    /** Can the superadmin still change this week's cards? This week and the next few, never a week that has closed. */
    private function assertEditable(array $week): void
    {
        $current = $this->board->week();
        $last = Carbon::parse($current['key'])->addWeeks(self::SCHEDULE_AHEAD_WEEKS)->toDateString();

        abort_if($week['key'] < $current['key'], 422, 'That week is over — its prizes can no longer be changed.');
        abort_if($week['key'] > $last, 422, 'You can set prizes up to '.self::SCHEDULE_AHEAD_WEEKS.' weeks ahead.');
    }

    /** @return list<string> card keys switched live for the week */
    public function liveKeys(array $week): array
    {
        $prefix = self::KEY_PREFIX.$week['key'].':';

        return PlatformModule::query()
            ->where('key', 'like', $prefix.'%')
            ->where('enabled', true)
            ->pluck('key')
            ->map(fn (string $key) => substr($key, strlen($prefix)))
            ->filter(fn (string $card) => $this->exists($card))
            ->values()
            ->all();
    }

    /** One card as the screens draw it. */
    private function cardPayload(string $key): array
    {
        $card = $this->cards()[$key];

        return [
            'key' => $key,
            'brand' => (string) $card['brand'],
            'amount' => (int) $card['amount'],
            'logo' => (string) $card['logo'],
            'color' => (string) $card['color'],
            'tagline' => (string) ($card['tagline'] ?? ''),
        ];
    }

    /**
     * The week's prize list: the live cards, biggest voucher first, each with the rank it is for.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function prizes(array $week): Collection
    {
        $order = array_flip(array_keys($this->cards()));

        return collect($this->liveKeys($week))
            ->sort(fn (string $a, string $b) => [(int) $this->cards()[$b]['amount'], $order[$a]] <=> [(int) $this->cards()[$a]['amount'], $order[$b]])
            ->values()
            ->map(fn (string $key, int $i) => ['rank' => $i + 1] + $this->cardPayload($key));
    }

    /**
     * Puts a card live for a week (this one unless `$week` says otherwise), or takes it off. Explicit (live: true|false), never a flip,
     * so two admins or two tabs cannot undo each other. Returns whether anything changed.
     */
    public function setLive(string $card, bool $live, User $actor, ?array $week = null): bool
    {
        abort_unless($this->exists($card), 404, 'There is no such reward card.');

        $week ??= $this->board->week();
        $this->assertEditable($week);

        $row = PlatformModule::firstOrNew(['key' => $this->rowKey($week, $card)]);
        $was = $row->exists && $row->enabled;

        if ($was === $live) {
            return false;
        }

        $row->enabled = $live;
        $row->updated_by = $actor->id;
        $row->save();

        $this->prune($this->board->week());

        $definition = $this->cards()[$card];
        $when = $week['key'] === $this->board->week()['key'] ? "this week's" : "the week of {$week['key']}'s";
        ActivityLog::record(
            $actor,
            $live ? "Put the {$definition['brand']} ₹{$definition['amount']} voucher live for {$when} leaderboard" : "Took the {$definition['brand']} voucher off {$when} leaderboard",
            'Weekly reward',
            (string) $definition['brand'],
            ['card' => $card, 'live' => $live, 'week' => $week['key']]
        );

        return true;
    }

    /**
     * Makes `$to` carry the same cards as `$from` (replacing whatever `$to` had) — "do the same as last week" in one press.
     *
     * @return int how many cards `$to` has afterwards
     */
    public function copyWeek(array $from, array $to, User $actor): int
    {
        $this->assertEditable($to);
        abort_if($from['key'] === $to['key'], 422, 'Pick a different week to copy from.');

        $want = $this->liveKeys($from);

        foreach ($this->cards() as $key => $_) {
            $this->setLive($key, in_array($key, $want, true), $actor, $to);
        }

        return count($want);
    }

    /** Forget the switches of weeks long gone. */
    private function prune(array $week): void
    {
        $oldest = Carbon::parse($week['key'])->subWeeks(self::KEEP_WEEKS)->toDateString();

        PlatformModule::query()
            ->where('key', 'like', self::KEY_PREFIX.'%')
            ->pluck('key')
            ->filter(fn (string $key) => (explode(':', $key)[1] ?? '9999') < $oldest)
            ->whenNotEmpty(fn ($keys) => PlatformModule::whereIn('key', $keys->all())->delete());
    }

    // ---------------------------------------------------------------- screens

    /**
     * What a student's dashboard banner needs: this week's prize list, when the week resets, where they stand in it, and a peek at what
     * the next week offers when the superadmin has already chosen it. `live` is false (and the banner is not drawn) while no card is live
     * this week.
     */
    public function bannerFor(User $user): array
    {
        $week = $this->board->week();
        $prizes = $this->prizes($week);

        $next = $this->board->week($week['end']->copy()->addHour());
        $nextPrizes = $this->prizes($next);

        $payload = [
            'live' => $prizes->isNotEmpty(),
            'week' => $this->board->weekPayload($week),
            'prizes' => $prizes->values(),
            'my' => null,
            'next' => $nextPrizes->isEmpty() ? null : ['week' => $this->board->weekPayload($next), 'prizes' => $nextPrizes->values()],
        ];

        if ($prizes->isEmpty()) {
            return $payload;
        }

        $mine = $this->board->standings(ContestLeaderboardService::PERIOD_WEEKLY, null, $week)->first(fn (array $row) => $row['user']['id'] === $user->id);

        $payload['my'] = [
            'rank' => $mine['rank'] ?? null,
            'contest_score' => $mine['contest_score'] ?? 0,
            'prize' => $mine ? $this->prizeForRank($prizes, $mine['rank']) : null,
        ];

        return $payload;
    }

    /** The prize a rank wins (null when it is below the prize list). Tied ranks share the prize of the position they hold. */
    public function prizeForRank(Collection $prizes, int $rank): ?array
    {
        return $prizes->firstWhere('rank', $rank);
    }

    /**
     * The superadmin's view of one week (this one by default): every card with whether it is live for that week, the board with the
     * prizes, the schedule of the weeks ahead, and the winners waiting for their voucher.
     */
    public function adminPayload(?string $weekKey = null): array
    {
        $current = $this->board->week();
        $week = $weekKey ? $this->weekOf($weekKey) : $current;
        $prizes = $this->prizes($week);
        $live = $prizes->keyBy('key');

        $cards = collect($this->cards())->keys()->map(fn (string $key) => $this->cardPayload($key) + [
            'live' => $live->has($key),
            'prize_rank' => $live->get($key)['rank'] ?? null,
        ])->values();

        $shown = (int) config('weekly_rewards.winners_shown', 10);
        $standings = $week['start']->gt(Carbon::now())
            ? collect()
            : $this->board->standings(ContestLeaderboardService::PERIOD_WEEKLY, null, $week)->take(max($shown, $prizes->count()));

        $previous = $this->board->previousWeek();
        $lastPrizes = $this->prizes($previous);

        return [
            'week' => $this->weekFlags($week, $current),
            'current_week' => $this->board->weekPayload($current),
            'schedule' => $this->schedule($current),
            'cards' => $cards,
            'standings' => $standings->map(fn (array $row) => $row + ['prize' => $this->prizeForRank($prizes, $row['rank'])])->values(),
            'last_week' => [
                'week' => $this->board->weekPayload($previous),
                'prizes' => $lastPrizes->values(),
                'winners' => $this->winnersFor($previous, $lastPrizes),
            ],
            'pending_vouchers' => $this->ledgerAvailable() ? WeeklyRewardWinner::where('status', WeeklyRewardWinner::PENDING)->count() : 0,
            'daily' => app(DailyChallengeService::class)->adminSummary(),
        ];
    }

    private function weekFlags(array $week, array $current): array
    {
        return $this->board->weekPayload($week) + [
            'is_current' => $week['key'] === $current['key'],
            'is_past' => $week['key'] < $current['key'],
            'is_future' => $week['key'] > $current['key'],
        ];
    }

    /**
     * This week and the next few, each with the prizes chosen for it — the "what is scheduled" strip of the screen.
     *
     * @return list<array<string, mixed>>
     */
    private function schedule(array $current): array
    {
        $out = [];

        for ($i = 0; $i <= 4; $i++) {
            $week = $this->board->week($current['start']->copy()->addWeeks($i)->addHours(12));
            $out[] = $this->weekFlags($week, $current) + ['prizes' => $this->prizes($week)->values()->all()];
        }

        return $out;
    }

    // ------------------------------------------------------------ winners ledger

    private function ledgerAvailable(): bool
    {
        return Schema::hasTable('weekly_reward_winners');
    }

    /**
     * Who won what in a week: the ledger's rows once the week has been closed out, otherwise who WOULD win (so last week is never blank
     * between Sunday night and the ledger run).
     *
     * @return list<array<string, mixed>>
     */
    public function winnersFor(array $week, ?Collection $prizes = null): array
    {
        $prizes ??= $this->prizes($week);

        if ($this->ledgerAvailable()) {
            $rows = WeeklyRewardWinner::where('week_key', $week['key'])->orderBy('rank')->orderBy('id')->get();

            if ($rows->isNotEmpty()) {
                return $rows->map(fn (WeeklyRewardWinner $w) => $this->winnerPayload($w))->all();
            }
        }

        if ($prizes->isEmpty()) {
            return [];
        }

        $rows = $this->board->standings(ContestLeaderboardService::PERIOD_WEEKLY, null, $week)->filter(fn (array $row) => $this->prizeForRank($prizes, $row['rank']) !== null)->values();
        $users = User::with('college:id,name')->whereIn('id', $rows->pluck('user.id'))->get()->keyBy('id');

        return $rows->map(fn (array $row) => $row + [
            'id' => null,
            'prize' => $this->prizeForRank($prizes, $row['rank']),
            'email' => $users->get($row['user']['id'])?->email,
            'college' => $users->get($row['user']['id'])?->college?->name,
            'status' => 'not_recorded',
            'has_code' => false,
            'note' => null,
            'sent_at' => null,
        ])->all();
    }

    /** One ledger row for the superadmin's screen (the voucher code is shown to them in full: they are the one who sends it). */
    public function winnerPayload(WeeklyRewardWinner $w): array
    {
        return [
            'id' => $w->id,
            'week_key' => $w->week_key->toDateString(),
            'rank' => $w->rank,
            'user' => ['id' => $w->user_id, 'name' => $w->user_name, 'handle' => $w->user_handle],
            'contest_score' => $w->contest_score,
            'email' => $w->email,
            'college' => $w->college,
            'prize' => [
                'key' => $w->card,
                'brand' => $w->brand,
                'amount' => $w->amount,
                'logo' => (string) ($this->cards()[$w->card]['logo'] ?? ''),
                'color' => (string) ($this->cards()[$w->card]['color'] ?? '#4F46E5'),
                'rank' => $w->rank,
            ],
            'status' => $w->status,
            'has_code' => $w->voucher_code !== null && $w->voucher_code !== '',
            'voucher_code' => $w->makeVisible('voucher_code')->voucher_code,
            'note' => $w->note,
            'sent_at' => $w->sent_at,
        ];
    }

    /**
     * Closes out a finished week: a ledger row and a bell notification for everyone who held a prize rank. Idempotent — a second run (or
     * the superadmin's button after the schedule) adds nothing and tells nobody twice.
     *
     * @return int rows created
     */
    public function finalize(array $week): int
    {
        if (! $this->ledgerAvailable() || $week['end']->gt(Carbon::now())) {
            return 0;
        }

        $prizes = $this->prizes($week);

        if ($prizes->isEmpty()) {
            return 0;
        }

        $rows = $this->board->standings(ContestLeaderboardService::PERIOD_WEEKLY, null, $week)->filter(fn (array $row) => $this->prizeForRank($prizes, $row['rank']) !== null)->values();
        $users = User::with('college:id,name')->whereIn('id', $rows->pluck('user.id'))->get()->keyBy('id');
        $created = 0;

        foreach ($rows as $row) {
            $prize = $this->prizeForRank($prizes, $row['rank']);
            $user = $users->get($row['user']['id']);

            $winner = WeeklyRewardWinner::firstOrCreate(
                ['week_key' => $week['key'], 'user_id' => $row['user']['id']],
                [
                    'rank' => $row['rank'],
                    'user_name' => $row['user']['name'],
                    'user_handle' => $row['user']['handle'],
                    'email' => $user?->email,
                    'college' => $user?->college?->name,
                    'contest_score' => $row['contest_score'],
                    'card' => $prize['key'],
                    'brand' => $prize['brand'],
                    'amount' => $prize['amount'],
                    'status' => WeeklyRewardWinner::PENDING,
                ]
            );

            if ($winner->wasRecentlyCreated) {
                $created++;
            }

            if ($winner->notified_at === null) {
                $this->tellWinner($winner);
            }
        }

        return $created;
    }

    private function tellWinner(WeeklyRewardWinner $winner): void
    {
        if ($winner->user_id === null) {
            return;
        }

        $sent = app(NotificationService::class)->notify(
            $winner->user_id,
            NotificationType::RewardWon,
            "You won a {$winner->brand} voucher",
            "You finished #{$winner->rank} on last week's contest leaderboard — ₹{$winner->amount} {$winner->brand}. We will send it to {$winner->email} and tell you here when it is on its way.",
            ['url' => '/dashboard/contests', 'data' => ['kind' => 'reward_won', 'id' => $winner->id], 'group_key' => 'reward.won:'.$winner->id]
        );

        if ($sent) {
            $winner->forceFill(['notified_at' => now()])->save();
        }
    }

    /**
     * The superadmin's hand on the ledger: record the voucher (code and a note) and mark it sent, or cancel it. The first time a row
     * becomes `sent` the student is told, and from then on they can see the code on their Contests page.
     */
    public function updateWinner(WeeklyRewardWinner $winner, array $data, User $actor): WeeklyRewardWinner
    {
        $was = $winner->status;

        if (array_key_exists('voucher_code', $data)) {
            $winner->voucher_code = ($data['voucher_code'] === null || trim((string) $data['voucher_code']) === '') ? null : trim((string) $data['voucher_code']);
        }

        if (array_key_exists('note', $data)) {
            $winner->note = $data['note'] === null || trim((string) $data['note']) === '' ? null : trim((string) $data['note']);
        }

        if (isset($data['status'])) {
            $winner->status = $data['status'];
            $winner->sent_at = $data['status'] === WeeklyRewardWinner::SENT ? ($winner->sent_at ?? now()) : null;
        }

        $winner->handled_by = $actor->id;
        $winner->save();

        if ($was !== WeeklyRewardWinner::SENT && $winner->status === WeeklyRewardWinner::SENT && $winner->user_id !== null) {
            app(NotificationService::class)->notify(
                $winner->user_id,
                NotificationType::RewardSent,
                "Your {$winner->brand} voucher is on its way",
                $winner->voucher_code ? "Your ₹{$winner->amount} {$winner->brand} voucher is ready — open Contests to see your code." : "We have sent your ₹{$winner->amount} {$winner->brand} voucher to {$winner->email}.",
                ['url' => '/dashboard/contests', 'data' => ['kind' => 'reward_sent', 'id' => $winner->id], 'group_key' => 'reward.sent:'.$winner->id]
            );
        }

        ActivityLog::record($actor, "Marked the {$winner->brand} voucher for {$winner->user_name} as {$winner->status}", 'Weekly reward', $winner->user_name, [
            'winner' => $winner->id, 'week' => $winner->week_key->toDateString(), 'status' => $winner->status,
        ]);

        return $winner;
    }

    /**
     * A student's own wins. The voucher code is shown only once the superadmin has marked it sent.
     *
     * @return list<array<string, mixed>>
     */
    public function winsOf(User $user): array
    {
        if (! $this->ledgerAvailable()) {
            return [];
        }

        return WeeklyRewardWinner::where('user_id', $user->id)->where('status', '!=', WeeklyRewardWinner::CANCELLED)->orderByDesc('week_key')->limit(20)->get()
            ->map(fn (WeeklyRewardWinner $w) => [
                'id' => $w->id,
                'week_key' => $w->week_key->toDateString(),
                'rank' => $w->rank,
                'brand' => $w->brand,
                'amount' => $w->amount,
                'logo' => (string) ($this->cards()[$w->card]['logo'] ?? ''),
                'color' => (string) ($this->cards()[$w->card]['color'] ?? '#4F46E5'),
                'status' => $w->status,
                'voucher_code' => $w->status === WeeklyRewardWinner::SENT ? $w->makeVisible('voucher_code')->voucher_code : null,
                'sent_at' => $w->sent_at,
            ])->all();
    }
}
