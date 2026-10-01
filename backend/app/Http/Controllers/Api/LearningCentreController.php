<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ListeningAttempt;
use App\Models\SpeakingAttempt;
use App\Models\VocabularyAttempt;
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
    public function overview(Request $request)
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
            ->concat((clone $vocabulary)->pluck('submitted_at'))
            ->filter()
            ->map(fn ($d) => Carbon::parse($d)->toDateString())
            ->unique()
            ->sortDesc()
            ->values();

        $wordsMasteredThisWeek = (clone $vocabulary)
            ->where('submitted_at', '>=', now()->startOfWeek())
            ->get()
            ->sum(function (VocabularyAttempt $attempt) {
                $questions = $attempt->questions ?? [];
                $answers = $attempt->answers ?? [];

                return collect($answers)->filter(
                    fn ($selected, $i) => (int) $selected === (int) ($questions[$i]['correct_index'] ?? -1)
                )->count();
            });

        return response()->json([
            'total_sessions' => $totalSessions,
            'best_speaking_score' => $bestSpeakingScore !== null ? (int) $bestSpeakingScore : null,
            'day_streak' => $this->computeStreak($activityDates),
            'words_mastered_this_week' => $wordsMasteredThisWeek,
        ]);
    }

    /**
     * Current streak only counts if the most recent activity day is today
     * or yesterday — otherwise it's broken, not "paused". Same convention
     * as StudentStatsService::streak() for DSA practice, computed
     * independently here since it spans three different tables.
     */
    private function computeStreak(Collection $sortedDescDateStrings): int
    {
        if ($sortedDescDateStrings->isEmpty()) {
            return 0;
        }

        $mostRecent = $sortedDescDateStrings->first();
        if ($mostRecent !== now()->toDateString() && $mostRecent !== now()->subDay()->toDateString()) {
            return 0;
        }

        $streak = 1;
        $cursor = Carbon::parse($mostRecent);

        foreach ($sortedDescDateStrings->slice(1) as $dateString) {
            $expected = $cursor->copy()->subDay()->toDateString();
            if ($dateString !== $expected) {
                break;
            }
            $streak++;
            $cursor = Carbon::parse($dateString);
        }

        return $streak;
    }
}
