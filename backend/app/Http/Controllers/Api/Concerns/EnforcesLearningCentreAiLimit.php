<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\SpeakingAttempt;
use App\Models\VocabularyAttempt;
use Illuminate\Http\Request;

/**
 * Shared by SpeakingPracticeController::submit() and VocabularyController::
 * generate() — the two Learning Centre endpoints that actually cost a
 * Gemini call. Listening Lab is graded deterministically (no Gemini call)
 * so it's never gated here. Mirrors InterviewController::
 * assertWithinDailyMockInterviewLimit() exactly: null entitlement =
 * unlimited, a plan opts INTO a limit by setting a number.
 */
trait EnforcesLearningCentreAiLimit
{
    private function assertWithinDailyLearningCentreAiLimit(Request $request): void
    {
        $limit = $request->user()->effectiveEntitlements()['max_learning_centre_ai_attempts_per_day'];

        if ($limit === null) {
            return;
        }

        $usedToday = SpeakingAttempt::where('user_id', $request->user()->id)->whereDate('created_at', today())->count()
            + VocabularyAttempt::where('user_id', $request->user()->id)->whereDate('created_at', today())->count();

        abort_if(
            $usedToday >= $limit,
            402,
            "You've reached today's Learning Centre AI practice limit ({$limit}) on your plan. Upgrade to practice more."
        );
    }
}
