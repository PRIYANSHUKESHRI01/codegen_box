<?php

namespace App\Services;

use App\Models\CoordinatorNote;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\User;
use App\Services\Interviews\InterviewAudience;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * The numbers behind a Section Coordinator's dashboard that the roster itself cannot give: how the section has MOVED (a readiness
 * trend, who is practising each day, who improved most), what the college has scheduled for it (mock AI interviews and how many of
 * the section have taken them), every open follow-up in one list, and how the section compares with the rest of the college.
 *
 * Everything is computed for the students the coordinator looks after and nobody else: the caller passes that set, which comes from
 * the one scope rule (User::scopeCoordinatedBy). Trend and movers read the daily readiness history (readiness_snapshots); a section
 * whose students have no history yet gets empty series rather than invented ones.
 */
class CoordinatorInsightsService
{
    /** Days of history the trend covers. */
    public const TREND_DAYS = 56;

    public function __construct(private readonly InterviewAudience $audience) {}

    /**
     * @param  Collection<int, User>  $students  the coordinator's students
     * @return array<string, mixed>
     */
    public function build(User $coordinator, Collection $students): array
    {
        $ids = $students->pluck('id')->map(fn ($id) => (int) $id)->all();

        return [
            'generated_at' => now()->toIso8601String(),
            'trend' => $this->trend($ids),
            'movers' => $this->movers($students),
            'follow_ups' => $this->followUps($ids),
            'events' => $this->events($coordinator, $students),
            'college' => $this->collegeAverage((int) $coordinator->college_id),
        ];
    }

    /**
     * The section's average readiness per day, and how many of its students practised that day.
     *
     * @param  list<int>  $ids
     * @return array{points: list<array{date: string, average: int, active: int, tracked: int}>, change_7d: ?int, change_28d: ?int}
     */
    public function trend(array $ids): array
    {
        if ($ids === []) {
            return ['points' => [], 'change_7d' => null, 'change_28d' => null];
        }

        try {
            $rows = DB::table('readiness_snapshots')
                ->whereIn('user_id', $ids)
                ->where('snapshot_date', '>=', now()->subDays(self::TREND_DAYS - 1)->toDateString())
                ->groupBy('snapshot_date')
                ->orderBy('snapshot_date')
                ->selectRaw('snapshot_date, avg(score) as average, count(*) as tracked, sum(case when active_today then 1 else 0 end) as active')
                ->get();
        } catch (\Throwable $e) {
            // Code deployed a moment before `migrate`: no history yet is the honest answer.
            report($e);

            return ['points' => [], 'change_7d' => null, 'change_28d' => null];
        }

        $points = $rows->map(fn ($r) => [
            'date' => substr((string) $r->snapshot_date, 0, 10),
            'average' => (int) round((float) $r->average),
            'active' => (int) $r->active,
            'tracked' => (int) $r->tracked,
        ])->values()->all();

        return ['points' => $points, 'change_7d' => $this->change($points, 7), 'change_28d' => $this->change($points, 28)];
    }

    /** @param  list<array{date: string, average: int}>  $points */
    private function change(array $points, int $days): ?int
    {
        if (count($points) < 2) {
            return null;
        }

        $target = now()->subDays($days)->toDateString();
        $reference = $points[0];

        foreach ($points as $p) {
            if ($p['date'] <= $target) {
                $reference = $p;
            }
        }

        return $points[count($points) - 1]['average'] - $reference['average'];
    }

    /**
     * Who gained and who slipped over the last two weeks: each student's latest score against the one nearest to 14 days ago. A student
     * with fewer than two days of history has no movement to report.
     *
     * @param  Collection<int, User>  $students
     * @return array{improved: list<array<string, mixed>>, slipped: list<array<string, mixed>>}
     */
    public function movers(Collection $students): array
    {
        $byId = $students->keyBy('id');

        if ($byId->isEmpty()) {
            return ['improved' => [], 'slipped' => []];
        }

        try {
            $rows = DB::table('readiness_snapshots')
                ->whereIn('user_id', $byId->keys()->all())
                ->where('snapshot_date', '>=', now()->subDays(15)->toDateString())
                ->orderBy('snapshot_date')
                ->get(['user_id', 'snapshot_date', 'score'])
                ->groupBy('user_id');
        } catch (\Throwable $e) {
            report($e);

            return ['improved' => [], 'slipped' => []];
        }

        $moves = [];

        foreach ($rows as $userId => $series) {
            if ($series->count() < 2 || ! $byId->has($userId)) {
                continue;
            }

            $first = (int) $series->first()->score;
            $last = (int) $series->last()->score;
            $student = $byId[$userId];

            $moves[] = ['student_id' => (int) $userId, 'name' => $student->name, 'roll_number' => $student->roll_number, 'from' => $first, 'to' => $last, 'change' => $last - $first];
        }

        $improved = array_values(array_filter($moves, fn (array $m) => $m['change'] > 0));
        $slipped = array_values(array_filter($moves, fn (array $m) => $m['change'] < 0));
        usort($improved, fn (array $a, array $b) => $b['change'] <=> $a['change']);
        usort($slipped, fn (array $a, array $b) => $a['change'] <=> $b['change']);

        return ['improved' => array_slice($improved, 0, 5), 'slipped' => array_slice($slipped, 0, 5)];
    }

    /**
     * Every open follow-up on the section's students, the ones due first.
     *
     * @param  list<int>  $ids
     * @return list<array<string, mixed>>
     */
    public function followUps(array $ids): array
    {
        if ($ids === []) {
            return [];
        }

        $today = now()->toDateString();

        return CoordinatorNote::query()
            ->whereIn('student_id', $ids)
            ->whereNull('resolved_at')
            ->with(['author:id,name', 'student:id,name,roll_number'])
            ->orderByRaw('follow_up_on is null')
            ->orderBy('follow_up_on')
            ->orderBy('id')
            ->limit(80)
            ->get()
            ->map(function (CoordinatorNote $n) use ($today) {
                $due = $n->follow_up_on?->toDateString();

                return [
                    'id' => $n->id,
                    'student' => ['id' => $n->student_id, 'name' => $n->student?->name, 'roll_number' => $n->student?->roll_number],
                    'kind' => $n->kind,
                    'body' => mb_substr((string) $n->body, 0, 240),
                    'follow_up_on' => $due,
                    'status' => $due === null ? 'no_date' : ($due < $today ? 'overdue' : ($due === $today ? 'today' : 'upcoming')),
                    'author' => $n->author?->name,
                    'created_at' => $n->created_at?->toIso8601String(),
                ];
            })
            ->all();
    }

    /**
     * The college's mock AI interviews that concern this section, with how much of the section has done each. "In the section" is
     * the interview's own audience rule applied to these students, so a Year-3-only interview does not count a Year-2 section as
     * having skipped it.
     *
     * @param  Collection<int, User>  $students
     * @return list<array<string, mixed>>
     */
    public function events(User $coordinator, Collection $students): array
    {
        if ($students->isEmpty() || $coordinator->college_id === null) {
            return [];
        }

        $interviews = Interview::query()
            ->where('interview_type', Interview::INTERVIEW_TYPE_TPO_MOCK)
            ->where('owning_college_id', $coordinator->college_id)
            ->whereNull('interview_track_id')
            ->where('status', Interview::STATUS_PUBLISHED)
            ->where(fn ($q) => $q->whereNull('closes_at')->orWhere('closes_at', '>=', now()->subDays(14)))
            ->orderByDesc('created_at')
            ->limit(8)
            ->get();

        if ($interviews->isEmpty()) {
            return [];
        }

        $sessions = InterviewSession::query()
            ->whereIn('interview_id', $interviews->pluck('id'))
            ->whereIn('user_id', $students->pluck('id'))
            ->get(['interview_id', 'user_id', 'status', 'composite_score_percent', 'ai_scored_at', 'reviewed_at'])
            ->groupBy('interview_id');

        return $interviews->map(function (Interview $i) use ($students, $sessions) {
            $mine = $students->filter(fn (User $s) => $this->audience->includes($i, $s));
            $bySession = ($sessions[$i->id] ?? collect())->keyBy('user_id');

            $completed = $mine->filter(fn (User $s) => ($bySession[$s->id]->status ?? null) === InterviewSession::STATUS_COMPLETED);
            $inProgress = $mine->filter(fn (User $s) => ($bySession[$s->id]->status ?? null) === InterviewSession::STATUS_IN_PROGRESS);
            $notStarted = $mine->reject(fn (User $s) => $bySession->has($s->id))->reject(fn (User $s) => $s->is_blocked);

            $scores = $completed->map(fn (User $s) => $bySession[$s->id])->filter(fn ($x) => $x->ai_scored_at !== null || $x->reviewed_at !== null)->pluck('composite_score_percent')->map(fn ($v) => (float) $v);

            return [
                'id' => $i->id,
                'title' => $i->title,
                'slug' => $i->slug,
                'schedule_state' => $i->scheduleState(),
                'opens_at' => $i->opens_at?->toIso8601String(),
                'closes_at' => $i->closes_at?->toIso8601String(),
                'in_section' => $mine->count(),
                'completed' => $completed->count(),
                'in_progress' => $inProgress->count(),
                'not_started' => $notStarted->count(),
                'average_score' => $scores->isEmpty() ? null : (int) round($scores->avg()),
                'not_started_students' => $notStarted->sortBy('name')->take(30)->map(fn (User $s) => ['id' => $s->id, 'name' => $s->name, 'roll_number' => $s->roll_number])->values()->all(),
            ];
        })->filter(fn (array $e) => $e['in_section'] > 0)->values()->all();
    }

    /** The whole college's recent average readiness, so a section can see where it stands. Cached briefly: it spans every student. */
    public function collegeAverage(int $collegeId): array
    {
        if ($collegeId <= 0) {
            return ['average' => null, 'students' => 0];
        }

        return Cache::remember("coordinator:college-average:{$collegeId}", 600, function () use ($collegeId) {
            try {
                $row = DB::table('readiness_snapshots as s')
                    ->join('users as u', 'u.id', '=', 's.user_id')
                    ->where('u.college_id', $collegeId)
                    ->where('u.role', User::ROLE_USER)
                    ->where('s.snapshot_date', '>=', Carbon::now()->subDays(2)->toDateString())
                    ->selectRaw('avg(s.score) as average, count(distinct s.user_id) as students')
                    ->first();

                return ['average' => $row && $row->average !== null ? (int) round((float) $row->average) : null, 'students' => (int) ($row->students ?? 0)];
            } catch (\Throwable $e) {
                report($e);

                return ['average' => null, 'students' => 0];
            }
        });
    }
}
