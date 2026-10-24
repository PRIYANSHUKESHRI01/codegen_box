<?php

namespace App\Services\Core;

use App\Events\CoreQuestionKeyFixed;
use App\Models\CorePracticeAnswer;
use App\Models\CoreTestResponse;
use App\Models\CoreTestSession;

/**
 * Listens for CoreQuestionKeyFixed and rescoring everything that was graded against the old key:
 * practice verdicts, and every COMPLETED test attempt that contained the question (its totals, subject
 * breakdown and pass/fail are recomputed). Attempts still in progress need nothing — they are graded against
 * the current key when they finish.
 */
class RegradeCoreQuestion
{
    public function __construct(private readonly CoreTestGradingService $grader) {}

    public function handle(CoreQuestionKeyFixed $event): void
    {
        $question = $event->question;

        CorePracticeAnswer::where('core_question_id', $question->id)->chunkById(500, function ($answers) use ($question) {
            foreach ($answers as $answer) {
                $verdict = CoreGrader::evaluate($question, $answer->selected, $answer->numeric_value);

                if ($verdict['correct'] !== $answer->is_correct) {
                    $answer->forceFill(['is_correct' => $verdict['correct']])->save();
                }
            }
        });

        $sessionIds = CoreTestResponse::query()
            ->join('core_test_sessions', 'core_test_sessions.id', '=', 'core_test_responses.core_test_session_id')
            ->where('core_test_responses.core_question_id', $question->id)
            ->where('core_test_sessions.status', CoreTestSession::STATUS_COMPLETED)
            ->pluck('core_test_sessions.id');

        foreach ($sessionIds->chunk(200) as $chunk) {
            foreach (CoreTestSession::whereIn('id', $chunk)->get() as $session) {
                $this->grader->regrade($session);
            }
        }
    }
}
