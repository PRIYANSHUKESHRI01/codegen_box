<?php

namespace App\Services\Activity;

use App\Models\ActivityPageView;
use App\Models\ActivityVisit;
use App\Models\User;
use App\Models\UserActivityDay;
use App\Support\ActivitySections;
use App\Support\ClientInfo;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Takes what the browser reports while someone is signed in — "I am on these screens, for this long, scrolled this far" — and keeps it:
 * the visit, its page views, the person's day, and `users.last_seen_at`.
 *
 * The browser sends the same page again every minute with its running totals, so a page's row is raised to the latest numbers rather
 * than added to, and a report that arrives twice (a retry, two tabs) changes nothing. Only the server's clock is trusted: a page's
 * start is "now minus how long ago the browser says it began", never a timestamp from the browser.
 */
class ActivityRecorder
{
    public function enabled(): bool
    {
        return (bool) config('activity.enabled', true);
    }

    /** Accounts that are never recorded: the superadmin's own browsing would drown the people being watched. */
    public function tracks(User $user): bool
    {
        return $this->enabled() && $user->role !== User::ROLE_SUPERADMIN;
    }

    /**
     * @param  array{visit: string, events: list<array{seq: int, path: string, tab?: string|null, age?: int, seconds?: int, scroll?: int}>}  $report
     * @return array{recorded: int, next_in: int}
     */
    public function record(User $user, array $report, ?string $ip, ?string $userAgent): array
    {
        $now = Carbon::now();
        $limits = ['max' => (int) config('activity.max_events_per_report', 25), 'seconds' => (int) config('activity.max_seconds_per_page', 14400)];
        $events = collect($report['events'])->take($limits['max'])->values();

        $oldestAge = (int) $events->max(fn (array $e) => (int) ($e['age'] ?? 0));
        [$visit, $createdVisit] = $this->visit($user, (string) $report['visit'], $now->copy()->subSeconds(min($oldestAge, 86400)), $events->first(), $events->last(), $ip, $userAgent);

        $existing = ActivityPageView::where('visit_id', $visit->id)->whereIn('seq', $events->pluck('seq')->all())->get()->keyBy('seq');

        $newPages = 0;
        $gainedSeconds = 0;

        foreach ($events as $event) {
            $seconds = max(0, min((int) ($event['seconds'] ?? 0), $limits['seconds']));
            $scroll = max(0, min((int) ($event['scroll'] ?? 0), 100));
            $row = $existing->get((int) $event['seq']);

            if ($row === null) {
                $path = $this->path($event);
                $age = max(0, min((int) ($event['age'] ?? 0), 86400));

                try {
                    ActivityPageView::create([
                        'visit_id' => $visit->id,
                        'user_id' => $user->id,
                        'college_id' => $user->college_id,
                        'seq' => (int) $event['seq'],
                        'path' => $path,
                        'section' => ActivitySections::label(strtok($path, '?') ?: '/', $event['tab'] ?? null),
                        'entered_at' => $now->copy()->subSeconds($age),
                        'active_seconds' => $seconds,
                        'max_scroll' => $scroll,
                    ]);
                    $newPages++;
                    $gainedSeconds += $seconds;
                } catch (QueryException) {
                    // The same page arrived twice at once: the other request has it.
                }

                continue;
            }

            if ($seconds > $row->active_seconds || $scroll > $row->max_scroll) {
                $gainedSeconds += max(0, $seconds - $row->active_seconds);
                $row->forceFill([
                    'active_seconds' => max($seconds, $row->active_seconds),
                    'max_scroll' => max($scroll, $row->max_scroll),
                ])->save();
            }
        }

        $last = $events->last();
        $currentPath = $last ? $this->path($last) : $visit->current_path;

        ActivityVisit::where('id', $visit->id)->update([
            'last_seen_at' => $now,
            'active_seconds' => DB::raw('active_seconds + '.(int) $gainedSeconds),
            'pages' => DB::raw('pages + '.(int) $newPages),
            'current_path' => $currentPath,
            'current_section' => $last ? ActivitySections::label(strtok($currentPath, '?') ?: '/', $last['tab'] ?? null) : $visit->current_section,
        ]);

        $this->rollUpDay($user, $now, $createdVisit ? 1 : 0, $newPages, $gainedSeconds);
        $this->touchLastSeen($user, $now);

        return ['recorded' => $events->count(), 'next_in' => (int) config('activity.report_every', 60)];
    }

    /**
     * The visit this report belongs to. A report with a new token opens a new one; the same token carries on.
     *
     * @return array{0: ActivityVisit, 1: bool} the visit and whether it was just made
     */
    private function visit(User $user, string $token, Carbon $startedAt, ?array $first, ?array $current, ?string $ip, ?string $userAgent): array
    {
        $found = ActivityVisit::where('user_id', $user->id)->where('token', $token)->first();

        if ($found) {
            return [$found, false];
        }

        $client = ClientInfo::parse($userAgent);
        $entry = $first ? $this->path($first) : null;
        $path = $current ? $this->path($current) : null;

        try {
            return [ActivityVisit::create([
                'user_id' => $user->id,
                'college_id' => $user->college_id,
                'role' => $user->role,
                'token' => $token,
                'started_at' => $startedAt,
                'last_seen_at' => Carbon::now(),
                'entry_path' => $entry,
                'current_path' => $path,
                'current_section' => $path !== null ? ActivitySections::label(strtok($path, '?') ?: '/', $current['tab'] ?? null) : null,
                'device' => $client['device'],
                'browser' => $client['browser'],
                'os' => $client['os'],
                'ip' => $ip,
            ]), true];
        } catch (QueryException) {
            // Two reports of the same new visit raced; the other one won.
            return [ActivityVisit::where('user_id', $user->id)->where('token', $token)->firstOrFail(), false];
        }
    }

    /** The address as stored: the path, plus the page's own tab when it has one ("/superadmin?tab=students"). */
    private function path(array $event): string
    {
        $path = ActivitySections::normalize((string) ($event['path'] ?? '/'));
        $tab = $event['tab'] ?? null;

        return $tab ? $path.'?tab='.$tab : $path;
    }

    private function rollUpDay(User $user, Carbon $now, int $newVisits, int $newPages, int $gainedSeconds): void
    {
        $day = $now->copy()->setTimezone(self::timezone())->toDateString();

        $row = UserActivityDay::where('user_id', $user->id)->where('day', $day)->first();

        if ($row === null) {
            try {
                UserActivityDay::create([
                    'user_id' => $user->id,
                    'college_id' => $user->college_id,
                    'role' => $user->role,
                    'day' => $day,
                    'visits' => max(1, $newVisits),
                    'page_views' => $newPages,
                    'active_seconds' => $gainedSeconds,
                    'first_seen_at' => $now,
                    'last_seen_at' => $now,
                ]);

                return;
            } catch (QueryException) {
                $row = UserActivityDay::where('user_id', $user->id)->where('day', $day)->first();
            }
        }

        if ($row !== null) {
            UserActivityDay::where('id', $row->id)->update([
                'visits' => DB::raw('visits + '.(int) $newVisits),
                'page_views' => DB::raw('page_views + '.(int) $newPages),
                'active_seconds' => DB::raw('active_seconds + '.(int) $gainedSeconds),
                'last_seen_at' => $now,
            ]);
        }
    }

    /** What the TPO's cohort view shows as "last seen": raised at most once a minute, with a raw update (bookkeeping, not an edit). */
    private function touchLastSeen(User $user, Carbon $now): void
    {
        DB::table('users')
            ->where('id', $user->id)
            ->where(fn ($q) => $q->whereNull('last_seen_at')->orWhere('last_seen_at', '<', $now->copy()->subMinute()))
            ->update(['last_seen_at' => $now]);
    }

    public static function timezone(): string
    {
        return (string) config('activity.timezone', 'Asia/Kolkata');
    }
}
