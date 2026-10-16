<?php

namespace Tests\Concerns;

use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\ContestSubmission;
use App\Models\Problem;
use App\Models\Submission;
use App\Models\User;
use Carbon\Carbon;

/**
 * Just enough problem / practice-submission / contest-submission scaffolding to
 * give a student a coding history — shared by the onboarding, language-insight
 * and cohort tests so each states only the history it cares about.
 */
trait CreatesCodingActivityFixtures
{
    private int $problemSequence = 0;

    protected function makeProblem(string $difficulty = 'easy', array $tags = ['arrays']): Problem
    {
        $n = ++$this->problemSequence;

        return Problem::create([
            'slug' => "fixture-problem-{$n}", 'title' => "Fixture Problem {$n}", 'difficulty' => $difficulty, 'tags' => $tags,
            'description' => 'Solve it.', 'function_name' => 'solve', 'params' => [['name' => 'nums', 'type' => 'integer[]']],
            'return_type' => 'integer', 'comparison_mode' => Problem::COMPARISON_EXACT, 'display_order' => $n,
        ]);
    }

    /** One practice Submit: a row per (student, problem, day), so each call uses its own problem unless a day is given. */
    protected function practiceSubmission(User $student, string $language, string $status, ?Problem $problem = null, ?Carbon $on = null): Submission
    {
        $problem ??= $this->makeProblem();
        $on ??= now();

        $submission = Submission::create([
            'user_id' => $student->id, 'problem_id' => $problem->id, 'language' => $language, 'code' => '// code',
            'status' => $status, 'submitted_on' => $on->copy()->startOfDay(),
        ]);

        // updated_at is "when they last submitted" — pin it to the day asked for.
        $submission->forceFill(['updated_at' => $on])->saveQuietly();

        return $submission;
    }

    /** One contest attempt — every attempt is its own row, unlike practice. */
    protected function contestAttempt(User $student, string $language, string $status, ?Problem $problem = null, ?Carbon $at = null): ContestSubmission
    {
        $problem ??= $this->makeProblem();
        $at ??= now();

        $contest = Contest::create([
            'title' => 'Fixture Contest', 'slug' => 'fixture-contest-'.uniqid(), 'start_at' => $at->copy()->subHour(), 'end_at' => $at->copy()->addHour(),
            'is_rated' => false, 'status' => Contest::STATUS_PUBLISHED,
        ]);
        $cp = ContestProblem::create(['contest_id' => $contest->id, 'problem_id' => $problem->id, 'points' => 100, 'display_order' => 1]);
        ContestParticipant::create(['contest_id' => $contest->id, 'user_id' => $student->id, 'registered_at' => $at]);

        return ContestSubmission::create([
            'contest_id' => $contest->id, 'contest_problem_id' => $cp->id, 'user_id' => $student->id, 'language' => $language, 'code' => '// code',
            'status' => $status, 'submitted_at' => $at, 'points_awarded' => $status === 'accepted' ? 100 : 0,
        ]);
    }

    /**
     * A language history in one line: `$accepted` accepted submits then
     * `$wrong` wrong-answer ones, each on its own problem.
     */
    protected function practiceHistory(User $student, string $language, int $accepted, int $wrong = 0, int $compileErrors = 0, int $runtimeErrors = 0, ?Carbon $on = null): void
    {
        for ($i = 0; $i < $accepted; $i++) {
            $this->practiceSubmission($student, $language, 'accepted', null, $on);
        }
        for ($i = 0; $i < $wrong; $i++) {
            $this->practiceSubmission($student, $language, 'wrong_answer', null, $on);
        }
        for ($i = 0; $i < $compileErrors; $i++) {
            $this->practiceSubmission($student, $language, 'compile_error', null, $on);
        }
        for ($i = 0; $i < $runtimeErrors; $i++) {
            $this->practiceSubmission($student, $language, 'runtime_error', null, $on);
        }
    }
}
