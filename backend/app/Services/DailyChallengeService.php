<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Everything that makes the daily contest "the AptRun Daily Challenge": its name, its fixed
 * evening slot, which edition is on right now, who topped an edition, and the rating ladder
 * those editions feed. No tables or columns of its own — an edition is an ordinary `contests`
 * row of type `daily`, and results/ratings are the ones ContestFinalizeService already writes.
 *
 * Used by GenerateDailyContest (creates/aligns the day's edition), DailyChallengeController
 * (the Contests-page hero and the leaderboard tab) and ContestController (brand name on legacy rows).
 */
class DailyChallengeService
{
    /** Most rows any board returns — the same cut the all-time leaderboard uses. */
    public const BOARD_SIZE = 50;

    public function name(): string
    {
        return (string) config('contests.daily.name', 'AptRun Daily Challenge');
    }

    public function timezone(): string
    {
        return (string) config('contests.daily.timezone', 'Asia/Kolkata');
    }

    public function durationMinutes(): int
    {
        return max(1, (int) config('contests.daily.duration_minutes', 60));
    }

    /**
     * The slot of a calendar day (YYYY-MM-DD, in the contest timezone) as two instants in the app's
     * own timezone. Eloquent writes a datetime cast's wall clock with no conversion and reads it back
     * as config('app.timezone'), so "8 PM IST" must be converted before it is saved — saved as-is it
     * would be read back as 8 PM UTC, i.e. 1:30 AM IST the next morning.
     *
     * @return array{0: Carbon, 1: Carbon} [start, end]
     */
    public function slotFor(string $date): array
    {
        $start = Carbon::parse("{$date} ".config('contests.daily.start_time', '20:00'), $this->timezone())
            ->setTimezone(config('app.timezone'));

        return [$start, (clone $start)->addMinutes($this->durationMinutes())];
    }

    /** The next moment a challenge opens — today's slot if it is still ahead, otherwise tomorrow's. */
    public function nextStartAt(): Carbon
    {
        $now = Carbon::now($this->timezone());
        $today = $this->slotFor($now->toDateString())[0];

        return $today->isFuture() ? $today : $this->slotFor($now->copy()->addDay()->toDateString())[0];
    }

    /**
     * The day (YYYY-MM-DD, contest timezone) whose edition is the next one to put on the calendar: today's while today's slot has
     * not closed, tomorrow's once it has. This is what makes the next challenge appear the moment the last one ends (9 PM),
     * instead of at midnight.
     */
    public function targetDate(): string
    {
        $now = Carbon::now($this->timezone());
        $today = $now->toDateString();

        return $this->slotFor($today)[1]->lessThanOrEqualTo(now()) ? $now->copy()->addDay()->toDateString() : $today;
    }

    /** "21:00" — when a day's slot closes, in the contest timezone (the scheduler's hook for creating the next edition). */
    public function closeTime(): string
    {
        return $this->slotFor(Carbon::now($this->timezone())->toDateString())[1]->setTimezone($this->timezone())->format('H:i');
    }

    /** "8:00 PM IST" — the opening time as students read it. */
    public function startLabel(): string
    {
        $today = Carbon::now($this->timezone())->toDateString();

        return $this->slotFor($today)[0]->setTimezone($this->timezone())->format('g:i A T');
    }

    public function titleFor(Carbon $startAt): string
    {
        return $this->name().' — '.$startAt->copy()->setTimezone($this->timezone())->format('d M Y');
    }

    public function slugFor(string $date): string
    {
        return Contest::uniqueSlug($this->name().' '.$date);
    }

    public function descriptionFor(Carbon $startAt, Carbon $endAt): string
    {
        $zone = $this->timezone();

        return sprintf(
            'One Easy, one Medium, one Hard problem — live every day %s to %s. Rated: your AptRun rating moves on how you place.',
            $startAt->copy()->setTimezone($zone)->format('g:i A'),
            $endAt->copy()->setTimezone($zone)->format('g:i A T')
        );
    }

    /**
     * Rows made before the rename are called "Daily Challenge — 12 Oct 2026". Students should see one
     * name everywhere, so the brand is put on at read time instead of rewriting history.
     */
    public function displayTitle(Contest $contest): string
    {
        if (! $contest->isDaily() || str_starts_with($contest->title, $this->name())) {
            return $contest->title;
        }

        return preg_replace('/^Daily Challenge/i', $this->name(), $contest->title) ?? $contest->title;
    }

    /**
     * Brings an edition that has not opened yet in line with the current name and slot (the day's
     * contest is created just after midnight, so a change of time or name needs to reach it before it
     * opens). An edition that has opened is never touched — students may already be in it.
     */
    public function realign(Contest $contest): bool
    {
        if (! $contest->isDaily() || ! $contest->is_auto_generated || $contest->hasStarted() || $contest->daily_key === null) {
            return false;
        }

        [$start, $end] = $this->slotFor($contest->daily_key);

        $wanted = [
            'title' => $this->titleFor($start),
            'description' => $this->descriptionFor($start, $end),
            'start_at' => $start,
            'end_at' => $end,
        ];

        $contest->fill($wanted);

        if (! $contest->isDirty()) {
            return false;
        }

        $contest->save();

        return true;
    }

    // ------------------------------------------------------------ registration

    /**
     * When a daily edition can be signed up for: from `registration_opens_hours_before` until `registration_closes_minutes_before`
     * before it starts. Null for any other kind of contest (their own rules apply).
     *
     * @return array{opens_at: Carbon, closes_at: Carbon}|null
     */
    public function registrationWindow(Contest $contest): ?array
    {
        if (! $contest->isDaily()) {
            return null;
        }

        return [
            'opens_at' => $contest->start_at->copy()->subHours(max(0, (int) config('contests.daily.registration_opens_hours_before', 15))),
            'closes_at' => $contest->start_at->copy()->subMinutes(max(0, (int) config('contests.daily.registration_closes_minutes_before', 1))),
        ];
    }

    /** 'not_open' | 'open' | 'closed' for a daily edition; null for any other contest. */
    public function registrationState(Contest $contest): ?string
    {
        $window = $this->registrationWindow($contest);

        if ($window === null) {
            return null;
        }

        return match (true) {
            now()->lt($window['opens_at']) => 'not_open',
            now()->lt($window['closes_at']) => 'open',
            default => 'closed',
        };
    }

    /** The message a student gets for trying to register outside the window (null when they may). */
    public function registrationRefusal(Contest $contest): ?string
    {
        $window = $this->registrationWindow($contest);

        return match ($this->registrationState($contest)) {
            'not_open' => 'Registration for this challenge opens '.$this->when($window['opens_at']).'.',
            'closed' => $contest->hasEnded()
                ? 'This contest has already ended.'
                : 'Registration for this challenge has closed. It closes '.(int) config('contests.daily.registration_closes_minutes_before', 1).' minute(s) before the start — join the next one.',
            default => null,
        };
    }

    public function registrationPayload(Contest $contest): ?array
    {
        $window = $this->registrationWindow($contest);

        return $window === null ? null : [
            'state' => $this->registrationState($contest),
            'opens_at' => $window['opens_at'],
            'closes_at' => $window['closes_at'],
        ];
    }

    /** "today 5:00 AM IST", "tomorrow 8:00 PM IST", "2 Nov, 8:00 PM IST" — a moment, the way a student reads it. */
    public function when(Carbon $at): string
    {
        $local = $at->copy()->setTimezone($this->timezone());

        return match (true) {
            $local->isToday() => 'today '.$local->format('g:i A T'),
            $local->isTomorrow() => 'tomorrow '.$local->format('g:i A T'),
            default => $local->format('j M, g:i A T'),
        };
    }

    /**
     * Tells every student a new edition is on the calendar and when to register — a bell notification (see NotificationService:
     * muted categories are respected, and the group key means a repeated run tells nobody twice). Called once, when the
     * edition is created. Returns how many students were told.
     */
    public function announce(Contest $contest): int
    {
        $window = $this->registrationWindow($contest);

        if ($window === null) {
            return 0;
        }

        return app(NotificationService::class)->notifyMany(
            User::query()->where('role', User::ROLE_USER),
            NotificationType::DailyChallengeScheduled,
            $this->name().' is on '.$this->when($contest->start_at),
            'Registration opens '.$this->when($window['opens_at']).' and closes '.$this->when($window['closes_at']).'. Three problems, '.$this->durationMinutes().' minutes, rated — register to take your seat.',
            [
                'url' => '/dashboard/contests',
                'data' => ['kind' => 'daily_challenge', 'id' => $contest->id],
                'group_key' => 'daily.scheduled:'.($contest->daily_key ?? $contest->id),
                'expires_at' => $contest->end_at,
            ]
        );
    }

    // ------------------------------------------------------------ superadmin view

    /**
     * The superadmin's proof that the daily contest is in order: the edition on the calendar (live, or the next to open) with its
     * problems and how many have registered, and the last one that finished. `scheduled` is false when the next edition does not
     * exist yet — which the Overview's attention list also raises.
     *
     * @return array<string, mixed>
     */
    public function adminSummary(): array
    {
        $next = Contest::query()
            ->where('contest_type', Contest::CONTEST_TYPE_DAILY)->where('status', Contest::STATUS_PUBLISHED)->where('end_at', '>', now())
            ->orderBy('start_at')->first();

        $last = Contest::query()
            ->where('contest_type', Contest::CONTEST_TYPE_DAILY)->where('status', Contest::STATUS_PUBLISHED)->where('end_at', '<=', now())
            ->orderByDesc('start_at')->first();

        $describe = function (?Contest $c) {
            if ($c === null) {
                return null;
            }

            $problems = $c->contestProblems()->with('problem:id,title,difficulty')->orderBy('display_order')->get();

            return [
                'title' => $this->displayTitle($c),
                'slug' => $c->slug,
                'start_at' => $c->start_at,
                'end_at' => $c->end_at,
                'state' => $c->isLive() ? 'live' : ($c->hasEnded() ? 'ended' : 'upcoming'),
                'finalized' => $c->finalized_at !== null,
                'registered' => $c->participants()->count(),
                'scored' => $c->participants()->where('score', '>', 0)->count(),
                'problems' => $problems->map(fn ($cp) => ['title' => $cp->problem?->title, 'difficulty' => $cp->problem?->difficulty, 'points' => (int) $cp->points])->all(),
                'registration' => $this->registrationPayload($c),
            ];
        };

        return [
            'name' => $this->name(),
            'start_label' => $this->startLabel(),
            'duration_minutes' => $this->durationMinutes(),
            'timezone' => $this->timezone(),
            'next_start_at' => $this->nextStartAt(),
            'scheduled' => $next !== null,
            'next' => $describe($next),
            'last' => $describe($last),
        ];
    }

    // ---------------------------------------------------------------- editions

    /** Daily editions this student may see, newest first. */
    private function visibleEditions(User $user): Collection
    {
        return Contest::query()
            ->where('contest_type', Contest::CONTEST_TYPE_DAILY)
            ->where('status', Contest::STATUS_PUBLISHED)
            ->orderByDesc('start_at')
            ->get()
            ->filter(fn (Contest $c) => $c->isVisibleToUser($user))
            ->values();
    }

    /** The edition running right now, or else the next one to open (null before it has been created). */
    public function featured(User $user): ?Contest
    {
        $editions = $this->visibleEditions($user)->filter(fn (Contest $c) => ! $c->hasEnded());

        return $editions->first(fn (Contest $c) => $c->isLive()) ?? $editions->sortBy('start_at')->first();
    }

    /** The most recent edition that has closed. */
    public function latestEnded(User $user): ?Contest
    {
        return $this->visibleEditions($user)->first(fn (Contest $c) => $c->hasEnded());
    }

    /** What the board shows: the live edition's standings while one is running, else the last finished one. */
    public function boardEdition(User $user): ?Contest
    {
        return $this->visibleEditions($user)->first(fn (Contest $c) => $c->isLive()) ?? $this->latestEnded($user);
    }

    // ------------------------------------------------------------------ boards

    /**
     * Everyone who scored in an edition, best first. Competition ranking (1, 1, 3) on score then
     * penalty — the same tie rule the finalised ranks use — and ranked on read, like the contest's
     * own live leaderboard, so it moves as submissions land. Someone who registered and scored
     * nothing is not on a "top students" board.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function standings(Contest $contest, ?int $collegeId = null): Collection
    {
        $participants = $contest->participants()
            ->with('user:id,name,handle,college_id,role,current_rating,rated_contests_count')
            ->where('score', '>', 0)
            ->orderByDesc('score')
            ->orderBy('penalty_minutes')
            ->orderBy('id')
            ->get()
            ->filter(fn (ContestParticipant $p) => $p->user !== null
                && $p->user->role === User::ROLE_USER
                && ($collegeId === null || $p->user->college_id === $collegeId))
            ->values();

        $rows = collect();
        $previous = null;
        $rank = 0;

        foreach ($participants as $i => $p) {
            if ($previous === null || $previous->score !== $p->score || $previous->penalty_minutes !== $p->penalty_minutes) {
                $rank = $i + 1;
            }
            $previous = $p;

            $rows->push([
                'rank' => $rank,
                'user' => ['id' => $p->user->id, 'name' => $p->user->name, 'handle' => $p->user->handle],
                'score' => $p->score,
                'penalty_minutes' => $p->penalty_minutes,
                'rating_delta' => $p->rating_before !== null && $p->rating_after !== null ? $p->rating_after - $p->rating_before : null,
                'rating_after' => $p->rating_after,
            ]);
        }

        return $rows;
    }

    /**
     * The AptRun rating ladder: everyone with a rating, highest first. The rating is the one every
     * rated contest moves (ContestFinalizeService); the Daily Challenge is simply the one that comes
     * round every day, so this is where "building rating" shows up.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function ratingLadder(?int $collegeId = null, int $limit = self::BOARD_SIZE): Collection
    {
        $users = $this->ratedUsers($collegeId)
            ->orderByDesc('current_rating')
            ->orderByDesc('rated_contests_count')
            ->orderBy('name')
            ->limit($limit)
            ->get(['id', 'name', 'handle', 'current_rating', 'rated_contests_count']);

        $rows = collect();
        $previous = null;
        $rank = 0;

        foreach ($users as $i => $u) {
            if ($previous === null || $previous->current_rating !== $u->current_rating) {
                $rank = $i + 1;
            }
            $previous = $u;

            $rows->push($this->ladderRow($u, $rank));
        }

        return $rows;
    }

    /** This student's place on the ladder (null while unrated), wherever it falls — not only inside the top rows. */
    public function myLadderRow(User $user, ?int $collegeId = null): ?array
    {
        if ($user->rated_contests_count < 1) {
            return null;
        }

        $above = $this->ratedUsers($collegeId)->where('current_rating', '>', $user->current_rating)->count();

        return $this->ladderRow($user, $above + 1);
    }

    private function ratedUsers(?int $collegeId)
    {
        return User::query()
            ->where('role', User::ROLE_USER)
            ->where('rated_contests_count', '>', 0)
            ->when($collegeId !== null, fn ($q) => $q->where('college_id', $collegeId));
    }

    private function ladderRow(User $u, int $rank): array
    {
        return [
            'rank' => $rank,
            'user' => ['id' => $u->id, 'name' => $u->name, 'handle' => $u->handle],
            'rating' => (int) $u->current_rating,
            'contests' => (int) $u->rated_contests_count,
        ];
    }

    // --------------------------------------------------------------- payloads

    /** One edition as the Contests-page hero and leaderboard tab describe it. */
    public function editionPayload(Contest $contest, ?User $viewer = null): array
    {
        return [
            'slug' => $contest->slug,
            'title' => $this->displayTitle($contest),
            'start_at' => $contest->start_at,
            'end_at' => $contest->end_at,
            'state' => $contest->isLive() ? 'live' : ($contest->hasEnded() ? 'ended' : 'upcoming'),
            'is_finalized' => $contest->finalized_at !== null,
            'is_rated' => $contest->is_rated,
            'problem_count' => $contest->contestProblems()->count(),
            'total_points' => (int) $contest->contestProblems()->sum('points'),
            'registered_count' => $contest->participants()->count(),
            'is_registered' => $viewer !== null && $contest->participants()->where('user_id', $viewer->id)->exists(),
            'registration' => $this->registrationPayload($contest),
        ];
    }

    /** The Contests-page hero: what is on now/next, the last result's podium, and the student's own rating. */
    public function hero(User $user): array
    {
        $featured = $this->featured($user);
        $latest = $this->latestEnded($user);
        $podium = $latest ? $this->standings($latest) : collect();
        $mine = $podium->first(fn (array $row) => $row['user']['id'] === $user->id);

        return [
            'name' => $this->name(),
            'schedule' => [
                'start_label' => $this->startLabel(),
                'duration_minutes' => $this->durationMinutes(),
                'timezone' => $this->timezone(),
            ],
            'featured' => $featured ? $this->editionPayload($featured, $user) : null,
            'next_start_at' => $this->nextStartAt(),
            'latest' => $latest ? $this->editionPayload($latest, $user) + [
                'participants' => $podium->count(),
                'top' => $podium->take(3)->values(),
                'my_result' => $mine,
            ] : null,
            'my_rating' => [
                'display' => $user->displayRating(),
                'contests' => (int) $user->rated_contests_count,
            ],
        ];
    }

    /** The leaderboard tab: the edition's top students, plus the rating ladder, for global or the student's own college. */
    public function board(User $user, ?int $collegeId): array
    {
        $edition = $this->boardEdition($user);
        $standings = $edition ? $this->standings($edition, $collegeId) : collect();
        $mine = $standings->first(fn (array $row) => $row['user']['id'] === $user->id);

        return [
            'scope' => $collegeId === null ? 'global' : 'college',
            'edition' => $edition ? $this->editionPayload($edition, $user) + ['participants' => $standings->count()] : null,
            'top' => $standings->take(self::BOARD_SIZE)->values(),
            'my_result' => $mine,
            'ladder' => $this->ratingLadder($collegeId),
            'my_ladder' => $this->myLadderRow($user, $collegeId),
        ];
    }
}
