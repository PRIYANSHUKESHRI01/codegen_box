<?php

namespace App\Services\Judge;

use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\ContestSubmission;
use App\Models\Submission;
use App\Services\ContestScoringService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Records a *real* verdict once a job has actually judged the code — the
 * persistence that used to run inline in the controllers, unchanged in
 * meaning, moved behind the queue. Two properties matter now that judging
 * is asynchronous and workers can retry:
 *
 *  - Idempotent. A retried job (worker died after saving, before it could
 *    mark the job complete) must not double-record. Practice rows are
 *    upserts by (user, problem, day); contest rows are keyed by the job's
 *    unique token.
 *  - Uses the time the student CLICKED, not when a worker got to it —
 *    contest penalties are minutes-from-start, and a queue delay must never
 *    cost a participant a penalty minute (or a day rollover).
 */
class JudgeOutcomePersister
{
    public function __construct(private readonly ContestScoringService $scoring) {}

    /** @param  array{status: int, submissionStatus: string, runtimeMs: ?int, memoryKb: ?int}  $outcome */
    public function persist(JudgeRequest $request, array $outcome, string $token): void
    {
        if ($request->kind !== JudgeRequest::KIND_SUBMIT) {
            return; // "Run" never writes rows — only a deliberate Submit counts.
        }

        $request->isContest()
            ? $this->persistContest($request, $outcome, $token)
            : $this->persistPractice($request, $outcome);
    }

    /** @param  array{submissionStatus: string, runtimeMs: ?int, memoryKb: ?int}  $outcome */
    private function persistPractice(JudgeRequest $request, array $outcome): void
    {
        // One row per (user, problem, calendar day) — a student resubmitting an
        // already-accepted problem must not inflate "distinct problems solved
        // today"; only the latest status for the day survives (see SubmissionController).
        Submission::updateOrCreate(
            [
                'user_id' => $request->userId,
                'problem_id' => $request->problemId,
                // A Carbon (not a 'Y-m-d' string): the `date` cast writes 'Y-m-d 00:00:00',
                // and a bare string lookup only matches that on MySQL, which truncates to a
                // date. Same value in the lookup and the write makes the upsert driver-proof.
                'submitted_on' => Carbon::parse($request->requestedAt)->startOfDay(),
            ],
            [
                'language' => $request->language,
                // The one-row-per-(user, problem, day) upsert means a later
                // resubmit on the same day overwrites this with whatever
                // that resubmit wrote — correct: it's also the row whose
                // status/runtime this same statement is overwriting, so the
                // stored code always matches the stored verdict.
                'code' => $request->code,
                'status' => $outcome['submissionStatus'],
                'runtime_ms' => $outcome['runtimeMs'],
                'memory_kb' => $outcome['memoryKb'],
            ]
        );
    }

    /** @param  array{submissionStatus: string}  $outcome */
    private function persistContest(JudgeRequest $request, array $outcome, string $token): void
    {
        $contestProblem = ContestProblem::find($request->contestProblemId);

        if ($contestProblem === null) {
            return; // removed from the contest while queued — nothing to score
        }

        DB::transaction(function () use ($request, $outcome, $token, $contestProblem) {
            // Lock this participant's row first — serialises only this user's own
            // concurrent submits against themselves, never against other participants.
            $participant = ContestParticipant::where('contest_id', $request->contestId)
                ->where('user_id', $request->userId)
                ->lockForUpdate()
                ->first();

            ContestSubmission::firstOrCreate(
                ['judge_token' => $token],
                [
                    'contest_id' => $request->contestId,
                    'contest_problem_id' => $request->contestProblemId,
                    'user_id' => $request->userId,
                    'language' => $request->language,
                    'code' => $request->code,
                    'status' => $outcome['submissionStatus'],
                    'submitted_at' => Carbon::parse($request->requestedAt),
                    'points_awarded' => $outcome['submissionStatus'] === Submission::STATUS_ACCEPTED ? $contestProblem->points : 0,
                ]
            );

            if ($participant !== null) {
                $this->scoring->recompute($participant);
            }
        });
    }
}
