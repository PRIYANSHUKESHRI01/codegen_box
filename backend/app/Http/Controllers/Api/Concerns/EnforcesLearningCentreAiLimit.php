<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\ListeningLesson;
use App\Models\SpeakingAttempt;
use App\Models\SpeakingPrompt;
use App\Models\VocabularyAttempt;
use Illuminate\Http\Request;

/**
 * Shared by SpeakingPracticeController (submit + generate),
 * VocabularyController::generate() and ListeningLabController::generate() —
 * the Learning Centre endpoints that actually cost a Gemini call. Taking a
 * listening lesson is graded deterministically (no Gemini call), so only
 * writing a new AI lesson counts here. Likewise only the AI vocabulary quiz
 * (kind 'custom') counts — daily and deck sprints come from the word bank. Mirrors InterviewController::
 * assertWithinDailyMockInterviewLimit() exactly: null entitlement =
 * unlimited, a plan opts INTO a limit by setting a number.
 *
 * A speaking take that FAILED to score (Gemini down, rate-limited) is not
 * counted — the student got nothing for it, so it must not eat their quota.
 */
trait EnforcesLearningCentreAiLimit
{
    private function assertWithinDailyLearningCentreAiLimit(Request $request): void
    {
        $limit = $request->user()->effectiveEntitlements()['max_learning_centre_ai_attempts_per_day'];

        if ($limit === null) {
            return;
        }

        $userId = $request->user()->id;

        $usedToday = SpeakingAttempt::where('user_id', $userId)->whereNull('scoring_failed_at')->whereDate('created_at', today())->count()
            + VocabularyAttempt::where('user_id', $userId)->where('kind', VocabularyAttempt::KIND_CUSTOM)->whereDate('created_at', today())->count()
            + SpeakingPrompt::where('user_id', $userId)->where('source', SpeakingPrompt::SOURCE_AI)->whereDate('created_at', today())->count()
            + ListeningLesson::where('user_id', $userId)->where('source', ListeningLesson::SOURCE_AI)->whereDate('created_at', today())->count();

        abort_if(
            $usedToday >= $limit,
            402,
            "You've reached today's Learning Centre AI practice limit ({$limit}) on your plan. Upgrade to practice more."
        );
    }
}
