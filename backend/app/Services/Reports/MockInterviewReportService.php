<?php

namespace App\Services\Reports;

use App\Models\Interview;
use App\Models\InterviewProctoringViolation;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\User;
use App\Services\Interviews\InterviewAudience;
use Illuminate\Support\Facades\DB;

/**
 * What a college's mock AI interview produced — for the results screen, the cohort PDF and the single-student PDF. Everything
 * is computed from the stored sittings and the scores already on them (AI-scored or reviewer-scored); nothing is estimated.
 *
 * "Audience" is who the interview was FOR (InterviewAudience); a student who sat it but is no longer in the audience (the TPO
 * narrowed it afterwards) still appears, because their result is real.
 */
class MockInterviewReportService
{
    /** A sitting this good or better counts as a pass when the interview has no target of its own. */
    public const DEFAULT_TARGET = 60;

    public const BUCKETS = [[0, 39, '0–39'], [40, 59, '40–59'], [60, 79, '60–79'], [80, 100, '80–100']];

    public function __construct(private readonly InterviewAudience $audience) {}

    public static function tier(?float $score): string
    {
        return match (true) {
            $score === null => 'Not scored',
            $score >= 75 => 'Strong',
            $score >= 50 => 'Developing',
            default => 'Needs practice',
        };
    }

    /** @return array<string, mixed> */
    public function cohort(Interview $interview): array
    {
        $interview->loadMissing('owningCollege:id,name,city,state');

        $target = $interview->qualifying_score_percent !== null ? (float) $interview->qualifying_score_percent : (float) self::DEFAULT_TARGET;

        $audience = $this->audience->students($interview);
        $sessions = InterviewSession::query()
            ->where('interview_id', $interview->id)
            ->with(['user:id,name,roll_number,section,branch,is_blocked', 'proctoringSession:id,interview_session_id,violation_count,status'])
            ->withCount('responses')
            ->get();

        $questionCount = $interview->interviewQuestions()->count();

        $rows = [];
        $seen = [];

        foreach ($sessions as $s) {
            $u = $s->user;
            if ($u === null) {
                continue;
            }
            $seen[$u->id] = true;
            $score = $s->hasScoreAvailable() ? (float) $s->composite_score_percent : null;
            $rows[] = [
                'session_id' => $s->id,
                'student_id' => $u->id,
                'name' => $u->name,
                'roll_number' => $u->roll_number,
                'section' => $u->section,
                'branch' => $u->branch,
                'status' => $s->status,
                'score' => $score,
                'tier' => self::tier($score),
                'answered' => (int) $s->responses_count,
                'questions' => $questionCount,
                'strikes' => (int) ($s->proctoringSession?->violation_count ?? 0),
                'locked' => $s->proctoringSession?->status === 'locked',
                'started_at' => $s->started_at?->toIso8601String(),
                'completed_at' => $s->completed_at?->toIso8601String(),
                'scoring_failed' => $s->scoringFailed(),
            ];
        }

        $notAttempted = $audience->reject(fn (User $u) => isset($seen[$u->id]))
            ->map(fn (User $u) => ['student_id' => $u->id, 'name' => $u->name, 'roll_number' => $u->roll_number, 'section' => $u->section, 'branch' => $u->branch, 'blocked' => (bool) $u->is_blocked])
            ->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();

        // Ranked by score (unscored last), then name; rank only for scored sittings.
        usort($rows, fn (array $a, array $b) => [$b['score'] ?? -1, $a['name']] <=> [$a['score'] ?? -1, $b['name']]);
        $rank = 0;
        foreach ($rows as &$row) {
            $row['rank'] = $row['score'] !== null ? ++$rank : null;
        }
        unset($row);

        $scored = array_values(array_filter($rows, fn (array $r) => $r['score'] !== null));
        $scores = array_column($scored, 'score');
        sort($scores);

        $completed = count(array_filter($rows, fn (array $r) => $r['status'] === InterviewSession::STATUS_COMPLETED));
        $inProgress = count(array_filter($rows, fn (array $r) => $r['status'] === InterviewSession::STATUS_IN_PROGRESS));
        $audienceSize = count($seen) + count($notAttempted);

        $distribution = array_map(fn (array $b) => [
            'label' => $b[2],
            'count' => count(array_filter($scores, fn ($s) => $s >= $b[0] && $s < ($b[1] === 100 ? 101 : $b[1] + 1))),
        ], self::BUCKETS);

        $data = [
            'interview' => [
                'id' => $interview->id,
                'slug' => $interview->slug,
                'title' => $interview->title,
                'description' => $interview->description,
                'status' => $interview->status,
                'schedule_state' => $interview->scheduleState(),
                'opens_at' => $interview->opens_at?->toIso8601String(),
                'closes_at' => $interview->closes_at?->toIso8601String(),
                'audience' => $this->audience->describe($interview),
                'target_score' => (int) $target,
                'question_count' => $questionCount,
                'created_at' => $interview->created_at?->toIso8601String(),
            ],
            'college' => ['name' => $interview->owningCollege?->name, 'city' => $interview->owningCollege?->city, 'state' => $interview->owningCollege?->state],
            'generated_at' => now()->toIso8601String(),
            'participation' => [
                'audience' => $audienceSize,
                'started' => count($rows),
                'completed' => $completed,
                'in_progress' => $inProgress,
                'not_started' => count($notAttempted),
                'scored' => count($scored),
                'completion_rate' => $audienceSize > 0 ? (int) round($completed / $audienceSize * 100) : 0,
            ],
            'scores' => [
                'average' => $scores === [] ? null : round(array_sum($scores) / count($scores), 1),
                'median' => $scores === [] ? null : $this->median($scores),
                'highest' => $scores === [] ? null : max($scores),
                'lowest' => $scores === [] ? null : min($scores),
                'target' => (int) $target,
                'pass_count' => count(array_filter($scores, fn ($s) => $s >= $target)),
                'pass_rate' => $scores === [] ? null : (int) round(count(array_filter($scores, fn ($s) => $s >= $target)) / count($scores) * 100),
                'distribution' => $distribution,
            ],
            'questions' => $this->questions($interview),
            'categories' => $this->categories($interview),
            'integrity' => [
                'students_flagged' => count(array_filter($rows, fn (array $r) => $r['strikes'] > 0)),
                'locked' => count(array_filter($rows, fn (array $r) => $r['locked'])),
                'total_strikes' => array_sum(array_column($rows, 'strikes')),
            ],
            'students' => $rows,
            'not_attempted' => $notAttempted,
            'top' => array_slice($scored, 0, 5),
            'needs_support' => array_slice(array_reverse($scored), 0, 5),
        ];

        $data['insights'] = $this->insights($data);

        return $data;
    }

    /**
     * One student's sitting in full: score, every question with their answer and the feedback, and what the proctoring recorded.
     *
     * @return array<string, mixed>
     */
    public function sitting(InterviewSession $session): array
    {
        $session->loadMissing(['interview:id,title,slug,description,owning_college_id,qualifying_score_percent', 'interview.owningCollege:id,name,city,state', 'user:id,name,email,roll_number,section,branch,college_id', 'proctoringSession.violations']);

        $interview = $session->interview;
        $responses = $session->responses()
            ->with('interviewQuestion.questionBank:id,question_text,category,difficulty,expected_duration_seconds')
            ->get()
            ->sortBy(fn (InterviewResponse $r) => $r->interviewQuestion?->display_order ?? 0)
            ->values();

        $questions = $responses->map(function (InterviewResponse $r) {
            $bank = $r->interviewQuestion?->questionBank;

            return [
                'order' => ($r->interviewQuestion?->display_order ?? 0) + 1,
                'question' => $bank?->question_text ?? '—',
                'category' => $bank?->category,
                'difficulty' => $bank?->difficulty,
                'answer' => trim((string) $r->transcript_text),
                'score' => $r->score,
                'feedback' => $r->review_notes,
                'seconds' => $r->audio_duration_seconds,
                'reviewed_by_human' => $r->score !== null && ! $r->ai_scored,
            ];
        })->all();

        $scored = array_values(array_filter($questions, fn (array $q) => $q['score'] !== null));
        $score = $session->hasScoreAvailable() ? (float) $session->composite_score_percent : null;
        $target = $interview->qualifying_score_percent !== null ? (float) $interview->qualifying_score_percent : (float) self::DEFAULT_TARGET;

        $byCategory = collect($scored)->groupBy(fn (array $q) => $q['category'] ?? 'general')
            ->map(fn ($qs, $cat) => ['category' => (string) $cat, 'average' => (int) round($qs->avg('score')), 'answers' => $qs->count()])
            ->sortByDesc('answers')->values()->all();

        $ps = $session->proctoringSession;
        $violations = $ps ? $ps->violations->sortBy('occurred_at')->map(fn (InterviewProctoringViolation $v) => [
            'type' => $v->type,
            'label' => $this->violationLabel($v->type),
            'counted' => (bool) $v->counted_toward_lock,
            'at' => $v->occurred_at?->toIso8601String(),
        ])->values()->all() : [];

        $sorted = $scored;
        usort($sorted, fn (array $a, array $b) => $b['score'] <=> $a['score']);

        return [
            'generated_at' => now()->toIso8601String(),
            'interview' => ['title' => $interview->title, 'slug' => $interview->slug, 'description' => $interview->description, 'target_score' => (int) $target],
            'college' => ['name' => $interview->owningCollege?->name, 'city' => $interview->owningCollege?->city, 'state' => $interview->owningCollege?->state],
            'student' => ['id' => $session->user->id, 'name' => $session->user->name, 'email' => $session->user->email, 'roll_number' => $session->user->roll_number, 'section' => $session->user->section, 'branch' => $session->user->branch],
            'result' => [
                'status' => $session->status,
                'score' => $score,
                'tier' => self::tier($score),
                'passed' => $score !== null ? $score >= $target : null,
                'answered' => count($questions),
                'started_at' => $session->started_at?->toIso8601String(),
                'completed_at' => $session->completed_at?->toIso8601String(),
                'minutes' => $session->started_at && $session->completed_at ? max(1, (int) round($session->started_at->diffInSeconds($session->completed_at) / 60)) : null,
                'scored_by' => $session->reviewed_at !== null ? 'reviewer' : ($session->ai_scored_at !== null ? 'ai' : null),
                'scoring_failed' => $session->scoringFailed(),
            ],
            'questions' => $questions,
            'categories' => $byCategory,
            'strongest' => array_slice($sorted, 0, 2),
            'weakest' => count($sorted) > 2 ? array_slice(array_reverse($sorted), 0, 2) : [],
            'integrity' => [
                'strikes' => (int) ($ps?->violation_count ?? 0),
                'locked' => $ps?->status === 'locked',
                'events' => $violations,
            ],
        ];
    }

    /** @return list<array<string, mixed>> */
    private function questions(Interview $interview): array
    {
        $stats = DB::table('interview_responses as r')
            ->join('interview_questions as q', 'q.id', '=', 'r.interview_question_id')
            ->where('q.interview_id', $interview->id)
            ->groupBy('r.interview_question_id')
            ->selectRaw('r.interview_question_id as qid, count(*) as answered, avg(r.score) as average')
            ->get()->keyBy('qid');

        return $interview->interviewQuestions()->with('questionBank:id,question_text,category,difficulty')->orderBy('display_order')->get()
            ->map(function ($q, $i) use ($stats) {
                $st = $stats[$q->id] ?? null;

                return [
                    'order' => $i + 1,
                    'question' => $q->questionBank?->question_text ?? '—',
                    'category' => $q->questionBank?->category,
                    'difficulty' => $q->questionBank?->difficulty,
                    'answered' => (int) ($st->answered ?? 0),
                    'average' => $st && $st->average !== null ? (int) round((float) $st->average) : null,
                ];
            })->all();
    }

    /** @return list<array{category: string, average: int, answers: int}> */
    private function categories(Interview $interview): array
    {
        return DB::table('interview_responses as r')
            ->join('interview_questions as q', 'q.id', '=', 'r.interview_question_id')
            ->join('interview_question_banks as b', 'b.id', '=', 'q.interview_question_bank_id')
            ->where('q.interview_id', $interview->id)
            ->whereNotNull('r.score')
            ->groupBy('b.category')
            ->selectRaw('b.category as category, avg(r.score) as average, count(*) as answers')
            ->orderByDesc('answers')
            ->get()
            ->map(fn ($c) => ['category' => (string) $c->category, 'average' => (int) round((float) $c->average), 'answers' => (int) $c->answers])
            ->all();
    }

    /** @return list<string> plain sentences a TPO can act on, each backed by a number in the report */
    private function insights(array $d): array
    {
        $p = $d['participation'];
        $s = $d['scores'];
        $out = [];

        if ($p['audience'] === 0) {
            return ['Nobody is in this interview\'s audience yet.'];
        }

        $out[] = "{$p['completed']} of {$p['audience']} students ({$p['completion_rate']}%) completed it".($p['in_progress'] > 0 ? ", {$p['in_progress']} more are part-way through" : '').'.';

        if ($p['not_started'] > 0) {
            $out[] = "{$p['not_started']} student(s) have not started: they are listed in the report so you can follow up.";
        }
        if ($s['average'] !== null) {
            $out[] = "Average score {$s['average']}% (median {$s['median']}%); {$s['pass_count']} of {$p['scored']} scored sittings reached the {$s['target']}% target.";
        }

        $cats = $d['categories'];
        if (count($cats) >= 2) {
            $sorted = $cats;
            usort($sorted, fn (array $a, array $b) => $a['average'] <=> $b['average']);
            $weak = $sorted[0];
            $strong = end($sorted);
            if ($strong['average'] - $weak['average'] >= 10) {
                $out[] = 'Weakest area: '.$weak['category']." ({$weak['average']}%); strongest: ".$strong['category']." ({$strong['average']}%).";
            }
        }

        $hardest = collect($d['questions'])->filter(fn (array $q) => $q['average'] !== null && $q['answered'] >= 3)->sortBy('average')->first();
        if ($hardest && $hardest['average'] < 50) {
            $out[] = "Question {$hardest['order']} was the hardest for the group (average {$hardest['average']}%): worth revisiting in class.";
        }

        if ($d['integrity']['students_flagged'] > 0) {
            $out[] = "{$d['integrity']['students_flagged']} sitting(s) recorded proctoring strikes".($d['integrity']['locked'] > 0 ? " and {$d['integrity']['locked']} were locked out" : '').'.';
        }

        return $out;
    }

    /** @param  list<float>  $sortedScores */
    private function median(array $sortedScores): float
    {
        $n = count($sortedScores);
        $mid = intdiv($n, 2);

        return round($n % 2 ? $sortedScores[$mid] : ($sortedScores[$mid - 1] + $sortedScores[$mid]) / 2, 1);
    }

    private function violationLabel(string $type): string
    {
        return match ($type) {
            InterviewProctoringViolation::TYPE_FULLSCREEN_EXIT => 'Left full screen',
            InterviewProctoringViolation::TYPE_TAB_SWITCH => 'Switched tab',
            InterviewProctoringViolation::TYPE_DEVTOOLS_DETECTED => 'Opened developer tools',
            InterviewProctoringViolation::TYPE_PASTE_ATTEMPT => 'Tried to paste',
            InterviewProctoringViolation::TYPE_WINDOW_BLUR => 'Window lost focus',
            InterviewProctoringViolation::TYPE_CONTEXT_MENU_BLOCKED => 'Right-click blocked',
            InterviewProctoringViolation::TYPE_TAB_CLOSE_ATTEMPT => 'Tried to close the tab',
            default => ucfirst(str_replace('_', ' ', $type)),
        };
    }
}
