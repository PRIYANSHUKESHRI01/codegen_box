<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Problem;
use App\Models\Submission;
use App\Services\Judge\JudgeQueue;
use App\Services\Judge\JudgeRequest;
use App\Services\JudgeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Practice Run/Submit. Neither executes code in the request: they validate,
 * hand a JudgeRequest to JudgeQueue and return at once — 202 + a token to
 * poll at GET /api/judge/{token}, or 200 with the verdict inline when it was
 * a cache hit / the queue driver is synchronous. See docs/scaling-the-judge.md
 * for why (short version: at 1,000 concurrent students, executing inside the
 * request would pin every PHP worker on Piston and take the whole site down).
 *
 * run() and submit() still differ in two ways:
 *  - run() judges only the public sample test cases (fast feedback on what's
 *    visible), submit() judges the full set including hidden cases — the real
 *    pass/fail.
 *  - only submit() persists (a Submission row, written by the job once a real
 *    verdict exists), so a student iterating with "Run" dozens of times never
 *    writes rows, and only a deliberate Submit counts toward practice
 *    tracking (the daily-readiness-score streak, see User::practiceScore()).
 *    The one-row-per-(user, problem, day) upsert rule lives in
 *    JudgeOutcomePersister.
 */
class SubmissionController extends Controller
{
    public function run(Request $request, Problem $problem, JudgeQueue $queue): JsonResponse
    {
        return $this->enqueue($request, $problem, JudgeRequest::KIND_RUN, $queue);
    }

    public function submit(Request $request, Problem $problem, JudgeQueue $queue): JsonResponse
    {
        $this->assertWithinDailyPracticeLimit($request, $problem);

        return $this->enqueue($request, $problem, JudgeRequest::KIND_SUBMIT, $queue);
    }

    /**
     * The plan-tier practice gate — deliberately only on submit(), not
     * run(): run() never persists a row by design (see this class's own
     * docblock), and submit() is already the one action this app treats as
     * "real practice" everywhere else (User::practiceScore()'s daily-streak
     * readiness component only ever counts Submissions too). Re-submitting
     * a problem already attempted today never counts a second time — the
     * cap is about how many DISTINCT problems a day, not how many attempts
     * on one.
     */
    private function assertWithinDailyPracticeLimit(Request $request, Problem $problem): void
    {
        $limit = $request->user()->effectiveEntitlements()['max_practice_problems_per_day'];

        if ($limit === null) {
            return;
        }

        $alreadyAttemptedToday = Submission::where('user_id', $request->user()->id)
            ->where('submitted_on', today())
            ->where('problem_id', $problem->id)
            ->exists();

        if ($alreadyAttemptedToday) {
            return;
        }

        $distinctProblemsToday = Submission::where('user_id', $request->user()->id)
            ->where('submitted_on', today())
            ->distinct('problem_id')
            ->count('problem_id');

        abort_if(
            $distinctProblemsToday >= $limit,
            402,
            "You've reached today's practice limit ({$limit} problem".($limit === 1 ? '' : 's').") on your plan. Upgrade to practice more."
        );
    }

    private function enqueue(Request $request, Problem $problem, string $kind, JudgeQueue $queue): JsonResponse
    {
        $validated = $this->validateInput($request);

        $result = $queue->enqueue(
            JudgeRequest::practice($kind, $request->user()->id, $problem->id, $validated['language'], $validated['code']),
            $problem
        );

        return response()->json($result['body'], $result['status'], $result['headers']);
    }

    private function validateInput(Request $request): array
    {
        return $request->validate([
            'language' => ['required', 'string', Rule::in(JudgeService::SUPPORTED_LANGUAGES)],
            'code' => ['required', 'string', 'max:'.(int) config('judge.limits.max_code_length', 65536)],
        ]);
    }
}
