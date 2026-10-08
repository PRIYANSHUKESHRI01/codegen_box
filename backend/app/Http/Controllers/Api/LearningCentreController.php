<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ListeningAttempt;
use App\Models\SpeakingAttempt;
use App\Models\VocabularyAnswer;
use App\Models\VocabularyAttempt;
use App\Models\VocabularyWord;
use App\Models\VocabularyWordProgress;
use App\Services\ListeningProgressService;
use App\Support\ActivityStreak;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * The Learning Centre hub's header stats — one aggregate call across all
 * three practice modules, same "one summary endpoint powers the header,
 * each module has its own list/detail endpoints" shape as
 * InterviewController::index() vs AdminController::overview(). Reading Hub
 * (Articles) isn't included here — it has no scoring/attempts concept, it's
 * a straight re-presentation of the existing feature.
 */
class LearningCentreController extends Controller
{
    public function overview(Request $request, ListeningProgressService $listeningProgress)
    {
        $userId = $request->user()->id;

        $speaking = SpeakingAttempt::where('user_id', $userId)->whereNotNull('scored_at');
        $listening = ListeningAttempt::where('user_id', $userId);
        $vocabulary = VocabularyAttempt::where('user_id', $userId)->whereNotNull('submitted_at');

        $totalSessions = (clone $speaking)->count() + (clone $listening)->count() + (clone $vocabulary)->count();
        $bestSpeakingScore = (clone $speaking)->max('overall_score');

        $activityDates = collect()
            ->concat((clone $speaking)->pluck('created_at'))
            ->concat((clone $listening)->pluck('created_at'))
            // Every answered question counts as activity; finished quizzes from before per-question answers existed still count too.
            ->concat((clone $vocabulary)->pluck('submitted_at'))
            ->concat(VocabularyAnswer::where('user_id', $userId)->pluck('created_at'))
            ->filter()
            ->map(fn ($d) => Carbon::parse($d)->toDateString())
            ->unique()
            ->sortDesc()
            ->values();

        // Words the student has actually learned (spaced-repetition box 4+), not just answers they got right.
        $mastered = VocabularyWordProgress::where('user_id', $userId)->whereNotNull('mastered_at');
        $wordsMasteredTotal = (clone $mastered)->count();
        $wordsMasteredThisWeek = (clone $mastered)->where('mastered_at', '>=', now()->startOfWeek())->count();
        $vocabularyDue = VocabularyWordProgress::where('user_id', $userId)->whereDate('due_on', '<=', today())->count();

        $listeningCounts = $listeningProgress->counts($userId);

        return response()->json([
            'total_sessions' => $totalSessions,
            'best_speaking_score' => $bestSpeakingScore !== null ? (int) $bestSpeakingScore : null,
            'day_streak' => $this->computeStreak($activityDates),
            'words_mastered_this_week' => $wordsMasteredThisWeek,
            // Real numbers for the hub's Vocabulary Sprint card.
            'words_mastered_total' => $wordsMasteredTotal,
            'vocabulary_words_total' => VocabularyWord::library()->count(),
            'vocabulary_due' => $vocabularyDue,
            // Real numbers for the hub's Listening Lab card (library lessons only).
            'listening_lessons_total' => $listeningCounts['total'],
            'listening_lessons_passed' => $listeningCounts['passed'],
        ]);
    }

    /** See ActivityStreak — spans three different tables here, so it takes already-collected dates. */
    private function computeStreak(Collection $sortedDescDateStrings): int
    {
        return ActivityStreak::current($sortedDescDateStrings);
    }
}
