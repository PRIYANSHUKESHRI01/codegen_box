<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\ProblemTestCase;
use App\Services\Judge\JudgeQueue;
use App\Services\Judge\JudgeRequest;
use App\Services\JudgeService;
use App\Services\ProblemCodeGenerator\StarterCodeGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Fetch/run/submit for one contest problem. Judges through the same queued
 * pipeline (JudgeQueue -> JudgeSubmissionJob -> JudgeService) practice
 * submissions use, so contest verdicts can never diverge from practice
 * verdicts for the same code. Live-contest work goes on the highest-priority
 * queue, so a participant's submit is never stuck behind practice traffic.
 *
 * The verdict and its ContestSubmission row are written by the job once a
 * real verdict exists, stamped with the time the participant CLICKED (queue
 * delay never costs a penalty minute) and keyed by the job token so a retry
 * can't double-count an attempt. An infrastructure failure records nothing.
 *
 * While a contest is live, every action here requires registration. Once a
 * contest has ended, show()/run() stay open to ANY authenticated student —
 * a free "solve it after the fact" practice mode that costs nothing extra
 * to support — but submit() is permanently closed; a separate
 * virtual-contest mode (own timer, own scoring) is explicitly out of scope.
 */
class ContestSubmissionController extends Controller
{

    public function show(Request $request, Contest $contest, ContestProblem $contestProblem, StarterCodeGenerator $starterCodeGenerator)
    {
        $this->assertVisible($request, $contest, $contestProblem);
        if (! $contest->hasEnded()) {
            $this->assertRegistered($request, $contest);
        }

        $problem = $contestProblem->problem;

        // Same curated shape as ProblemController::show() — the hidden
        // suite backing a contest problem must never reach the client
        // either, and matters more here (a contest's real judging integrity
        // depends on it, not just a practice problem's).
        return response()->json([
            'problem' => [
                'id' => $problem->id,
                'slug' => $problem->slug,
                'title' => $problem->title,
                'difficulty' => $problem->difficulty,
                'tags' => $problem->tags,
                'description' => $problem->description,
                'constraints' => $problem->constraints,
                'hints' => $problem->hints,
                'examples' => $problem->sampleTestCases()->get()->map(fn (ProblemTestCase $tc) => [
                    'input' => $tc->prettyInput($problem->params),
                    'output' => json_encode($tc->expected_output),
                    'explanation' => $tc->explanation,
                ]),
                'starter_code' => $starterCodeGenerator->generateAll($problem),
            ],
            'points' => $contestProblem->points,
        ]);
    }

    public function run(Request $request, Contest $contest, ContestProblem $contestProblem, JudgeQueue $queue): JsonResponse
    {
        $this->assertVisible($request, $contest, $contestProblem);
        if (! $contest->hasEnded()) {
            $this->assertRegistered($request, $contest);
        }

        return $this->enqueue($request, $contest, $contestProblem, JudgeRequest::KIND_RUN, $queue);
    }

    public function submit(Request $request, Contest $contest, ContestProblem $contestProblem, JudgeQueue $queue): JsonResponse
    {
        $this->assertVisible($request, $contest, $contestProblem);

        if ($contest->hasEnded()) {
            return response()->json([
                'message' => 'This contest has ended — submissions are closed, but you can still run it for practice.',
            ], 422);
        }

        $this->assertRegistered($request, $contest);

        return $this->enqueue($request, $contest, $contestProblem, JudgeRequest::KIND_SUBMIT, $queue);
    }

    private function enqueue(Request $request, Contest $contest, ContestProblem $contestProblem, string $kind, JudgeQueue $queue): JsonResponse
    {
        $validated = $this->validateInput($request);
        $problem = $contestProblem->problem;

        $result = $queue->enqueue(
            JudgeRequest::contest(
                $kind,
                ! $contest->hasEnded(),
                $request->user()->id,
                $problem->id,
                $contest->id,
                $contestProblem->id,
                $validated['language'],
                $validated['code'],
            ),
            $problem
        );

        return response()->json($result['body'], $result['status'], $result['headers']);
    }

    /**
     * Plain route-model-binding does not verify nested-param ownership —
     * must check explicitly on every method. The college-visibility check
     * matters most here: once a contest ends, show()/run() below stay open
     * to any authenticated student with no registration check at all, so
     * this is the only thing stopping a student at an unrelated college
     * from freely practicing a company/tpo_mock contest's problems.
     */
    private function assertVisible(Request $request, Contest $contest, ContestProblem $contestProblem): void
    {
        abort_unless($contestProblem->contest_id === $contest->id, 404);
        abort_unless($contest->hasStarted(), 404);
        abort_unless($contest->isVisibleToUser($request->user()), 404);
    }

    /**
     * Also the server-side proctoring lock check — every call site here
     * only invokes this while the contest hasn't ended, which is exactly
     * when a 3-strike lock (see ProctoringService) needs to keep biting.
     * This is what makes the lock real rather than cosmetic: even a
     * tampered/modified client that stops reporting violations still hits
     * this on its very next run/submit/show call.
     */
    private function assertRegistered(Request $request, Contest $contest): void
    {
        $participant = ContestParticipant::where('contest_id', $contest->id)
            ->where('user_id', $request->user()->id)
            ->first();

        abort_unless($participant, 403, 'You must register for this contest first.');

        if ($participant->proctoringSession?->isLocked()) {
            abort(403, 'You have been locked out of this contest due to repeated proctoring violations. This has been reported to your TPO and section coordinator.');
        }
    }

    private function validateInput(Request $request): array
    {
        return $request->validate([
            'language' => ['required', 'string', Rule::in(JudgeService::SUPPORTED_LANGUAGES)],
            'code' => ['required', 'string', 'max:'.(int) config('judge.limits.max_code_length', 65536)],
        ]);
    }
}
