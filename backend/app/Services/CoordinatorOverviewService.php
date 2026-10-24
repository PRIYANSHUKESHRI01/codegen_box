<?php

namespace App\Services;

use App\Models\CoordinatorNote;
use App\Models\ProctoringSession;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * What a Section Coordinator needs at a glance, computed once on the server from the same cohort rows the roster shows
 * (so the numbers on the cards, the rows in the table and the queue of "who needs a call" can never disagree):
 *
 *  • summary    — headcount, average readiness, how the section splits by readiness tier and by practice engagement,
 *                 who is at risk, who has never signed in, and the follow-ups that are open or overdue.
 *  • attention  — the students most worth a conversation THIS WEEK, ranked, each with the plain-language reasons.
 *
 * A student lands in the queue by adding up reasons (a lock-out, an overdue follow-up, never having signed in, weeks
 * without practice, low readiness…). A follow-up already scheduled for later takes some of the urgency off — the
 * coordinator is already on it. The weights are the one place that policy lives.
 */
class CoordinatorOverviewService
{
    public const AT_RISK_BELOW = WeeklyReadinessReportService::AT_RISK_THRESHOLD;

    /** A student who has had an account this many days and never signed in is worth a nudge. */
    public const NEVER_SIGNED_IN_AFTER_DAYS = 3;

    /** A contest lock-out stays on the radar this long. */
    public const LOCKOUT_RELEVANT_DAYS = 7;

    public const QUEUE_SIZE = 12;

    /** Smallest total that earns a place in the queue — low readiness on its own (15) is not enough: it takes a second signal. */
    private const MIN_SCORE = 20;

    private const WEIGHTS = [
        'locked_out' => 50,
        'follow_up_overdue' => 45,
        'follow_up_due' => 35,
        'never_signed_in' => 30,
        'dormant' => 25,
        'not_started' => 20,
        'needs_training' => 15,
        'slipping' => 12,
        'at_risk' => 8,
        'follow_up_scheduled' => -15,
    ];

    /**
     * Per student: open follow-ups, the next due date, and when the last note was written — one grouped query.
     *
     * @param  array<int, int>  $studentIds
     * @return array<int, array{open: int, next_due: ?string, overdue: bool, due_today: bool, last_note_at: ?string}>
     */
    public function followUpsFor(array $studentIds): array
    {
        if ($studentIds === []) {
            return [];
        }

        $today = now()->toDateString();

        return CoordinatorNote::query()
            ->whereIn('student_id', $studentIds)
            ->groupBy('student_id')
            ->selectRaw('student_id, sum(case when resolved_at is null then 1 else 0 end) as open_count')
            ->selectRaw('min(case when resolved_at is null then follow_up_on else null end) as next_due')
            ->selectRaw('max(created_at) as last_at')
            ->get()
            ->mapWithKeys(function ($row) use ($today) {
                $due = $row->next_due !== null ? substr((string) $row->next_due, 0, 10) : null;

                return [(int) $row->student_id => [
                    'open' => (int) $row->open_count,
                    'next_due' => $due,
                    'overdue' => $due !== null && $due < $today,
                    'due_today' => $due === $today,
                    'last_note_at' => $row->last_at !== null ? Carbon::parse($row->last_at)->toIso8601String() : null,
                ]];
            })
            ->all();
    }

    /**
     * Students (among these) locked out of a proctored contest recently and not yet reinstated.
     *
     * @param  array<int, int>  $studentIds
     * @return array<int, true>
     */
    public function recentlyLockedOut(array $studentIds): array
    {
        if ($studentIds === []) {
            return [];
        }

        return ProctoringSession::query()
            ->where('status', ProctoringSession::STATUS_LOCKED)
            ->where('locked_at', '>=', now()->subDays(self::LOCKOUT_RELEVANT_DAYS))
            ->join('contest_participants', 'contest_participants.id', '=', 'proctoring_sessions.contest_participant_id')
            ->whereIn('contest_participants.user_id', $studentIds)
            ->pluck('contest_participants.user_id')
            ->mapWithKeys(fn ($id) => [(int) $id => true])
            ->all();
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows  StudentCohortService rows, already carrying `follow_up`
     * @param  array<int, true>  $lockedOut  student id => true
     * @return array{summary: array<string, mixed>, attention: list<array<string, mixed>>}
     */
    public function build(array $rows, array $lockedOut = []): array
    {
        return ['summary' => $this->summary($rows, $lockedOut), 'attention' => $this->attention($rows, $lockedOut)];
    }

    /** @return array<string, mixed> */
    public function summary(array $rows, array $lockedOut = []): array
    {
        $size = count($rows);
        $tiers = ['placement_ready' => 0, 'in_progress' => 0, 'needs_training' => 0];
        $engagement = ['active' => 0, 'slipping' => 0, 'dormant' => 0, 'not_started' => 0, 'pending_activation' => 0];

        foreach ($rows as $row) {
            $tiers[match ($row['readiness_tier']) {
                'Placement Ready' => 'placement_ready',
                'In Progress' => 'in_progress',
                default => 'needs_training',
            }]++;

            $key = $row['activity']['engagement'] ?? 'not_started';
            $engagement[$key] = ($engagement[$key] ?? 0) + 1;
        }

        $scores = array_column($rows, 'readiness_score');

        return [
            'size' => $size,
            'avg_readiness' => $size > 0 ? (int) round(array_sum($scores) / $size) : 0,
            'tiers' => $tiers,
            'engagement' => $engagement,
            'at_risk' => count(array_filter($scores, fn ($s) => $s < self::AT_RISK_BELOW)),
            'blocked' => count(array_filter($rows, fn ($r) => $r['is_blocked'])),
            'never_signed_in' => $engagement['pending_activation'],
            'locked_out' => count($lockedOut),
            'open_follow_ups' => array_sum(array_map(fn ($r) => $r['follow_up']['open'] ?? 0, $rows)),
            'overdue_follow_ups' => count(array_filter($rows, fn ($r) => $r['follow_up']['overdue'] ?? false)),
        ];
    }

    /** @return list<array<string, mixed>> */
    public function attention(array $rows, array $lockedOut = []): array
    {
        $queue = [];

        foreach ($rows as $row) {
            // Someone whose account is blocked has already been dealt with.
            if ($row['is_blocked']) {
                continue;
            }

            [$score, $reasons] = $this->score($row, isset($lockedOut[$row['id']]));

            if ($score >= self::MIN_SCORE && $reasons !== []) {
                $queue[] = [
                    'student_id' => $row['id'],
                    'name' => $row['name'],
                    'roll_number' => $row['roll_number'],
                    'readiness_score' => $row['readiness_score'],
                    'score' => $score,
                    'reasons' => $reasons,
                ];
            }
        }

        usort($queue, fn (array $a, array $b) => [$b['score'], $a['name']] <=> [$a['score'], $b['name']]);

        return array_slice($queue, 0, self::QUEUE_SIZE);
    }

    /** @return array{0: int, 1: list<array{code: string, label: string}>} */
    private function score(array $row, bool $lockedOut): array
    {
        $reasons = [];
        $add = function (string $code, string $label) use (&$reasons) {
            $reasons[] = ['code' => $code, 'label' => $label, 'weight' => self::WEIGHTS[$code]];
        };

        $followUp = $row['follow_up'] ?? [];
        $engagement = $row['activity']['engagement'] ?? 'not_started';
        $days = $row['activity']['days_since_practice'] ?? null;

        if ($lockedOut) {
            $add('locked_out', 'Locked out of a contest this week');
        }

        if ($followUp['overdue'] ?? false) {
            $add('follow_up_overdue', 'Follow-up overdue since '.Carbon::parse($followUp['next_due'])->format('j M'));
        } elseif ($followUp['due_today'] ?? false) {
            $add('follow_up_due', 'Follow-up due today');
        } elseif (($followUp['open'] ?? 0) > 0) {
            $add('follow_up_scheduled', 'Follow-up already scheduled');
        }

        if ($engagement === 'pending_activation') {
            $age = $row['created_at'] ? (int) Carbon::parse($row['created_at'])->startOfDay()->diffInDays(now()->startOfDay()) : 0;
            if ($age >= self::NEVER_SIGNED_IN_AFTER_DAYS) {
                $add('never_signed_in', "Hasn't signed in — account is {$age} days old");
            }
        } elseif ($engagement === 'dormant') {
            $add('dormant', $days !== null ? "No practice for {$days} days" : 'No recent practice');
        } elseif ($engagement === 'not_started') {
            $add('not_started', 'Signed in but has not practised yet');
        } elseif ($engagement === 'slipping') {
            $add('slipping', $days !== null ? "Slowing down — last practised {$days} days ago" : 'Practice is slowing down');
        }

        if ($row['readiness_tier'] === 'Needs Training') {
            $add('needs_training', "Readiness {$row['readiness_score']} — needs training");
        } elseif ($row['readiness_score'] < self::AT_RISK_BELOW) {
            $add('at_risk', "Readiness {$row['readiness_score']} — below the ".self::AT_RISK_BELOW.' line');
        }

        $score = array_sum(array_column($reasons, 'weight'));

        // The weights are policy, not something the page needs.
        return [$score, array_map(fn ($r) => ['code' => $r['code'], 'label' => $r['label']], $reasons)];
    }

    /** The reason weights — exposed so the tests (and the weekly digest) speak the same policy. */
    public static function weights(): array
    {
        return self::WEIGHTS;
    }
}
