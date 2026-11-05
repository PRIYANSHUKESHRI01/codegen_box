<?php

namespace App\Services\Activity;

use App\Models\AuthEvent;
use App\Models\User;
use App\Models\UserActivityDay;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Where each account is on the road from "we gave them a login" to "they use it":
 *
 *   not_opened    the login has been issued and nobody has used it
 *   tried         the one-time password was typed (or a code asked for) but no password of their own was chosen yet
 *   password_set  they chose a password and never came in
 *   active        seen within the dormant window (config activity.dormant_after_days)
 *   dormant       came in before, not within the window
 *
 * Read for many accounts at once (two grouped queries, whatever the number), so a list of colleges never costs a query each.
 */
class AccountStates
{
    public const NOT_OPENED = 'not_opened';

    public const TRIED = 'tried';

    public const PASSWORD_SET = 'password_set';

    public const ACTIVE = 'active';

    public const DORMANT = 'dormant';

    /** Best (furthest along) first: a college's state is its best account's. */
    public const ORDER = [self::ACTIVE, self::DORMANT, self::PASSWORD_SET, self::TRIED, self::NOT_OPENED];

    public const LABELS = [
        self::NOT_OPENED => 'Login not opened yet',
        self::TRIED => 'Tried the login, no password yet',
        self::PASSWORD_SET => 'Password set, never signed in',
        self::ACTIVE => 'Active',
        self::DORMANT => 'Gone quiet',
    ];

    /**
     * @param  Collection<int, User>  $users  needs id, must_change_password, created_at, last_seen_at
     * @return array<int, array<string, mixed>> user id => facts
     */
    public function resolve(Collection $users): array
    {
        $ids = $users->pluck('id')->all();
        $events = [];
        $days = [];

        foreach (array_chunk($ids, 500) as $chunk) {
            AuthEvent::query()
                ->whereIn('user_id', $chunk)
                ->selectRaw('user_id, event, COUNT(*) as n, MIN(created_at) as first_at, MAX(created_at) as last_at')
                ->groupBy('user_id', 'event')
                ->get()
                ->each(function ($row) use (&$events) {
                    $events[$row->user_id][$row->event] = ['n' => (int) $row->n, 'first' => $row->first_at, 'last' => $row->last_at];
                });

            UserActivityDay::query()
                ->whereIn('user_id', $chunk)
                ->selectRaw('user_id, SUM(visits) as visits, SUM(page_views) as pages, SUM(active_seconds) as seconds, MIN(first_seen_at) as first_at, MAX(last_seen_at) as last_at')
                ->groupBy('user_id')
                ->get()
                ->each(function ($row) use (&$days) {
                    $days[$row->user_id] = $row;
                });
        }

        $cutoff = Carbon::now()->subDays(max(1, (int) config('activity.dormant_after_days', 7)));
        $out = [];

        foreach ($users as $user) {
            $ev = $events[$user->id] ?? [];
            $day = $days[$user->id] ?? null;

            $firstSignIn = $this->time($ev[AuthEvent::LOGIN]['first'] ?? null) ?? $this->time($day?->first_at);
            $lastSeen = collect([$user->last_seen_at, $this->time($day?->last_at), $this->time($ev[AuthEvent::LOGIN]['last'] ?? null)])->filter()->max();
            $tried = isset($ev[AuthEvent::TEMP_PASSWORD]) || isset($ev[AuthEvent::OTP_REQUESTED]);

            $state = match (true) {
                (bool) $user->must_change_password => $tried ? self::TRIED : self::NOT_OPENED,
                $lastSeen === null => self::PASSWORD_SET,
                $lastSeen->gte($cutoff) => self::ACTIVE,
                default => self::DORMANT,
            };

            $out[$user->id] = [
                'state' => $state,
                'state_label' => self::LABELS[$state],
                'created_at' => $user->created_at,
                'first_tried_at' => $this->earliest([$ev[AuthEvent::TEMP_PASSWORD]['first'] ?? null, $ev[AuthEvent::OTP_REQUESTED]['first'] ?? null]),
                'password_set_at' => $this->time($ev[AuthEvent::PASSWORD_SET]['first'] ?? null),
                'first_signin_at' => $firstSignIn,
                'last_signin_at' => $this->time($ev[AuthEvent::LOGIN]['last'] ?? null),
                'last_seen_at' => $lastSeen,
                'sign_ins' => (int) ($ev[AuthEvent::LOGIN]['n'] ?? 0),
                'failed_attempts' => (int) (($ev[AuthEvent::LOGIN_FAILED]['n'] ?? 0) + ($ev[AuthEvent::LOGIN_BLOCKED]['n'] ?? 0)),
                'visits' => (int) ($day->visits ?? 0),
                'page_views' => (int) ($day->pages ?? 0),
                'active_seconds' => (int) ($day->seconds ?? 0),
            ];
        }

        return $out;
    }

    /** The furthest-along state among a set of states (null for none). */
    public static function best(iterable $states): ?string
    {
        $present = collect($states)->unique()->all();

        foreach (self::ORDER as $state) {
            if (in_array($state, $present, true)) {
                return $state;
            }
        }

        return null;
    }

    private function time(mixed $value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        return $value instanceof Carbon ? $value : Carbon::parse($value);
    }

    /** @param  list<mixed>  $values */
    private function earliest(array $values): ?Carbon
    {
        return collect($values)->map(fn ($v) => $this->time($v))->filter()->min();
    }
}
