<?php

namespace App\Services\Core;

use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\CoreTest;
use App\Models\CoreTestResponse;
use App\Models\CoreTestSession;
use App\Models\User;
use App\Services\Integrity\IntegrityService;
use App\Services\PlanGate;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Taking a Core test: starting (or resuming) an attempt, autosaving answers against a server-enforced
 * clock, and submitting. Grading is CoreTestGradingService; proctoring is CoreTestProctoringService.
 *
 * The student never receives a key: the session payload carries questions and the student's own answers only.
 * Keys and explanations appear in resultFor(), and only once the attempt has ended.
 */
class CoreTestService
{
    public function __construct(
        private readonly PlanGate $gate,
        private readonly CoreAccess $access,
        private readonly CoreTestGradingService $grader,
    ) {}

    /** Tests the student may see: their branch family's published tests (Mellow's, and their own college's). @return Collection<int, CoreTest> */
    public function visibleTo(User $user): Collection
    {
        if ($user->discipline === null) {
            return collect();
        }

        return CoreTest::query()
            ->where('status', CoreTest::STATUS_PUBLISHED)
            ->where('discipline_code', $user->discipline)
            ->where(fn ($q) => $q->where('test_type', CoreTest::TYPE_GENERAL)
                ->orWhere(fn ($own) => $own->where('test_type', CoreTest::TYPE_TPO_MOCK)->where('owning_college_id', $user->college_id)))
            ->withCount('testQuestions')
            ->orderByDesc('id')
            ->get()
            ->filter(fn (CoreTest $t) => $t->isVisibleToUser($user))
            ->values()
            ->pipe(fn (Collection $tests) => $this->withinTheirBranch($tests, $user));
    }

    /**
     * Drops a test that holds a question from a specialisation this student does not study (an older paper, or a subject whose branches were
     * edited after the test was built). One grouped query for the whole list. Authoring already prevents it; this is the guarantee.
     *
     * @param  Collection<int, CoreTest>  $tests
     * @return Collection<int, CoreTest>
     */
    private function withinTheirBranch(Collection $tests, User $user): Collection
    {
        if ($tests->isEmpty()) {
            return $tests;
        }

        $visible = array_flip(CoreSubject::idsVisibleTo((string) $user->discipline, $user->branch_code));
        $subjectsByTest = DB::table('core_test_questions as tq')
            ->join('core_questions as q', 'q.id', '=', 'tq.core_question_id')
            ->whereIn('tq.core_test_id', $tests->pluck('id'))
            ->select('tq.core_test_id', 'q.subject_id')->distinct()->get()->groupBy('core_test_id');

        return $tests->filter(fn (CoreTest $t) => ($subjectsByTest[$t->id] ?? collect())->every(fn ($row) => isset($visible[(int) $row->subject_id])))->values();
    }

    /**
     * Starts an attempt, or resumes the one in progress. A resume never spends a plan try or an attempt.
     */
    public function start(User $user, CoreTest $test): CoreTestSession
    {
        abort_unless($test->isVisibleToUser($user) && $this->access->available($user) && $this->withinTheirBranch(collect([$test]), $user)->isNotEmpty(), 404);

        $open = CoreTestSession::where('core_test_id', $test->id)->where('user_id', $user->id)->where('status', CoreTestSession::STATUS_IN_PROGRESS)->latest('id')->first();

        if ($open !== null) {
            if (! $open->isPastDeadline(withGrace: true)) {
                return $open;
            }
            // Abandoned past its clock: grade what was saved, then fall through to a fresh attempt if one is allowed.
            $this->grader->finalize($open);
        }

        if (! $test->isOpenNow()) {
            throw ValidationException::withMessages(['test' => [$test->available_from && $test->available_from->isFuture()
                ? 'This test opens on '.$test->available_from->format('j M, g:i A').'.'
                : 'This test is closed.']]);
        }

        $taken = CoreTestSession::where('core_test_id', $test->id)->where('user_id', $user->id)->count();
        if ($test->max_attempts !== null && $taken >= $test->max_attempts) {
            throw ValidationException::withMessages(['test' => ["You've used all {$test->max_attempts} attempt(s) of this test."]]);
        }

        $this->gate->requireCoreTestAccess($user);

        $questions = $test->testQuestions()->with('question')->get();
        if ($questions->isEmpty()) {
            throw ValidationException::withMessages(['test' => ['This test has no questions yet.']]);
        }

        return DB::transaction(function () use ($user, $test, $questions, $taken) {
            $session = CoreTestSession::create([
                'core_test_id' => $test->id,
                'user_id' => $user->id,
                'attempt_number' => $taken + 1,
                'status' => CoreTestSession::STATUS_IN_PROGRESS,
                'started_at' => now(),
                'deadline_at' => now()->addMinutes($test->duration_minutes),
                'max_score' => $questions->sum(fn ($tq) => (float) $tq->question->marks),
            ]);

            $ordered = $test->shuffle_questions ? $questions->shuffle() : $questions;

            foreach ($ordered->values() as $position => $testQuestion) {
                $question = $testQuestion->question;
                $order = null;

                if (! $question->isNumeric()) {
                    $order = collect($question->options ?? [])->pluck('id')->all();
                    $test->shuffle_options ? shuffle($order) : null;
                }

                CoreTestResponse::create([
                    'core_test_session_id' => $session->id,
                    'core_question_id' => $question->id,
                    'position' => $position + 1,
                    'option_order' => $order,
                ]);
            }

            return $session;
        });
    }

    /**
     * The attempt as the student's browser sees it: the questions (options in THIS attempt's shuffled order),
     * the student's own answers and the clock — never a key.
     *
     * @return array<string, mixed>
     */
    public function payload(CoreTestSession $session): array
    {
        $session->loadMissing('test');
        $responses = $session->responses()->with('question.subject:id,name')->get();

        return [
            'id' => $session->public_id,
            'status' => $session->status,
            'attempt_number' => $session->attempt_number,
            'started_at' => $session->started_at,
            'deadline_at' => $session->deadline_at,
            'server_time' => now(),
            'test' => [
                'title' => $session->test->title,
                'slug' => $session->test->slug,
                'duration_minutes' => $session->test->duration_minutes,
                'pass_percentage' => $session->test->pass_percentage,
                'total_marks' => $session->max_score,
            ],
            'questions' => $responses->map(function (CoreTestResponse $r) {
                $q = $r->question;
                $byId = collect($q->options ?? [])->keyBy('id');

                return [
                    'position' => $r->position,
                    'id' => $q->id,
                    'type' => $q->type,
                    'stem' => $q->stem,
                    'image_url' => $q->imageUrl(),
                    'options' => collect($r->option_order ?? [])->map(fn ($id) => $byId->has($id) ? ['id' => $id, 'text' => $byId[$id]['text']] : null)->filter()->values(),
                    'numeric_unit' => $q->numeric_unit,
                    'marks' => $q->marks,
                    'negative_marks' => $q->negative_marks,
                    'section' => $q->subject?->name,
                    'selected' => $r->selected ?? [],
                    'numeric_value' => $r->numeric_value,
                    'marked_for_review' => $r->marked_for_review,
                ];
            })->values(),
        ];
    }

    /**
     * Autosaves one answer. Refused (and the attempt graded) once the clock has run out; refused while
     * proctoring has locked the attempt. Re-answering is fine; clearing an answer is an empty selection.
     *
     * @param  array{selected?: mixed, numeric_value?: mixed, marked_for_review?: bool, time_spent?: int|null}  $input
     */
    public function saveAnswer(CoreTestSession $session, CoreQuestion $question, array $input): CoreTestResponse
    {
        $this->assertOpen($session);

        $response = CoreTestResponse::where('core_test_session_id', $session->id)->where('core_question_id', $question->id)->first();
        abort_unless($response !== null, 404, 'That question is not part of this test.');

        [$chosen, $value] = CoreGrader::sanitise($question, $input['selected'] ?? null, $input['numeric_value'] ?? null);
        $answered = $chosen !== null || $value !== null;
        $firstAnswer = $answered && $response->answered_at === null;

        $response->forceFill([
            'selected' => $chosen,
            'numeric_value' => $value,
            'answered_at' => $answered ? ($response->answered_at ?? now()) : null,
            'marked_for_review' => (bool) ($input['marked_for_review'] ?? $response->marked_for_review),
            'time_spent_seconds' => isset($input['time_spent']) ? min(max((int) $input['time_spent'], $response->time_spent_seconds), 86400) : $response->time_spent_seconds,
        ])->save();

        // The key locks as soon as anyone answers (see CoreQuestion::isKeyLocked) — counted once per student.
        if ($firstAnswer) {
            CoreQuestion::whereKey($question->id)->increment('attempts_count');
        }

        return $response;
    }

    public function submit(CoreTestSession $session): CoreTestSession
    {
        if ($session->isCompleted()) {
            return $session;
        }

        // Submitting a hair past the deadline is allowed (that is what the grace is for); anything saved is graded.
        return $this->grader->finalize($session);
    }

    /**
     * Grades every attempt whose clock ran out without the student submitting — what the scheduled
     * `core:finalize-expired` runs. Without it an abandoned attempt would sit open forever and never count.
     */
    public function finalizeExpired(): int
    {
        $count = 0;

        CoreTestSession::where('status', CoreTestSession::STATUS_IN_PROGRESS)
            ->where('deadline_at', '<', now()->subSeconds(CoreTestSession::GRACE_SECONDS))
            ->orderBy('id')
            ->chunkById(100, function ($sessions) use (&$count) {
                foreach ($sessions as $session) {
                    $this->grader->finalize($session);
                    $count++;
                }
            });

        return $count;
    }

    /**
     * The finished attempt with the review: each question with the student's answer, the key, the marks and the
     * explanation. Only for a completed attempt — never while it is still running.
     *
     * @return array<string, mixed>
     */
    public function resultFor(CoreTestSession $session): array
    {
        abort_unless($session->isCompleted(), 409, 'Finish the test to see the review.');
        $session->loadMissing('test');

        return [
            'id' => $session->public_id,
            'test' => ['title' => $session->test->title, 'slug' => $session->test->slug, 'pass_percentage' => $session->test->pass_percentage],
            'attempt_number' => $session->attempt_number,
            'completed_at' => $session->completed_at,
            'score' => $session->score,
            'max_score' => $session->max_score,
            'score_percent' => $session->score_percent,
            'passed' => $session->passed,
            'correct_count' => $session->correct_count,
            'wrong_count' => $session->wrong_count,
            'skipped_count' => $session->skipped_count,
            'terminated_by_proctoring' => $session->terminated_by_proctoring,
            'subject_breakdown' => $session->subject_breakdown ?? [],
            'review' => $session->responses()->with('question.subject:id,name', 'question.topic:id,name')->get()->map(function (CoreTestResponse $r) {
                $q = $r->question;

                return [
                    'position' => $r->position,
                    'question_id' => $q->id,
                    'type' => $q->type,
                    'stem' => $q->stem,
                    'image_url' => $q->imageUrl(),
                    'options' => $q->options ?? [],
                    'subject' => $q->subject?->name,
                    'topic' => $q->topic?->name,
                    'marks' => $q->marks,
                    'selected' => $r->selected ?? [],
                    'numeric_value' => $r->numeric_value,
                    'correct' => $q->correct,
                    'numeric_min' => $q->numeric_min,
                    'numeric_max' => $q->numeric_max,
                    'numeric_unit' => $q->numeric_unit,
                    'is_correct' => $r->is_correct,
                    'marks_awarded' => $r->marks_awarded,
                    'explanation' => $q->explanation,
                    'time_spent_seconds' => $r->time_spent_seconds,
                ];
            })->values(),
        ];
    }

    /** The clock and the lock are enforced here, on every answer — whatever the client believes. */
    private function assertOpen(CoreTestSession $session): void
    {
        if ($session->isCompleted()) {
            abort(409, 'This test has already been submitted.');
        }

        if ($session->isPastDeadline(withGrace: true)) {
            $this->grader->finalize($session);
            abort(409, "Time's up — your saved answers have been submitted.");
        }

        if ($session->proctoringSession?->isLocked()) {
            abort(423, 'This attempt was ended by proctoring.');
        }

        // A proctored test is answered only after the student has consented (camera + fullscreen) — a client that skips the
        // consent screen gets nothing saved, whatever it claims.
        if (config('proctoring.core_tests_enabled', true) && $session->proctoringSession?->consented_at === null) {
            throw new HttpResponseException(response()->json(['message' => 'Allow the camera and fullscreen to begin this proctored test.', 'code' => 'proctoring_required'], 428));
        }

        // ...and only while the proctoring signal is alive (heartbeat, evidence, device binding). See IntegrityService::gate().
        app(IntegrityService::class)->gate('core_test', $session->proctoringSession, $session->user);
    }
}
