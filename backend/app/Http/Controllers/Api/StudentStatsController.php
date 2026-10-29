<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContestParticipant;
use App\Services\ReadinessHistoryService;
use App\Services\StudentStatsService;
use Illuminate\Http\Request;

/**
 * Everything the dashboard/performance-report/practice pages need, in one
 * call — mirrors TpoReportsController's own "everything this page needs"
 * shape. Every field here is traceable to a real row; nothing here is
 * fabricated the way STUDENT_PROFILE/studentAnalytics.ts's mock data was.
 */
class StudentStatsController extends Controller
{
    public function mine(Request $request, StudentStatsService $service)
    {
        $user = $request->user();

        return response()->json([
            'solved' => $service->solvedByDifficulty($user),
            'streak' => $service->streak($user),
            'readiness' => [
                'score' => $user->readinessScore(),
                'tier' => $user->readinessTier(),
                'practice_score' => $user->practiceScore(),
                'components' => $user->readinessBreakdown()['components'],
                'next_steps' => $user->readinessBreakdown()['next_steps'],
                // How far this score is from the Vault line — see VaultService. The Vault page is where it is acted on.
                'vault' => $user->readinessBreakdown()['vault'],
                // Which weighting made the score (software · core · balanced), and until when the better of two is kept after a branch's Core Prep goes live.
                'profile' => $user->readinessBreakdown()['profile'] ?? 'software',
                'grace_until' => $user->readinessBreakdown()['grace_until'] ?? null,
                // What the components add up to, and what missed days have taken off it (score = base_score - decay.points).
                'base_score' => $user->readinessBreakdown()['base_score'] ?? $user->readinessScore(),
                'decay' => $user->readinessBreakdown()['decay'] ?? null,
                // Set only while a superadmin has set this student's score by hand (the reason is never sent here).
                'override' => $user->readinessBreakdown()['override'] ?? null,
            ],
            'rating' => [
                'current_rating' => $user->current_rating,
                'rated_contests_count' => $user->rated_contests_count,
                'display_rating' => $user->displayRating(),
                'solved_score' => $service->solvedScore($user),
            ],
            'verdict_stats' => $service->verdictBreakdown($user),
            'language_usage' => $service->languageUsage($user),
            'topic_mastery' => $service->topicMastery($user),
            'recent_submissions' => $service->recentSubmissions($user),
            'activity' => $service->activityHeatmap($user),
            'weekly_goals' => $service->weeklyGoalsProgress($user),
        ]);
    }

    /**
     * The student's readiness day by day: the points to chart (today from the live score) and a few facts — when they
     * first reached the Vault line, how far they have moved in a week, and, if the trend is real, how long to the line.
     */
    public function readinessHistory(Request $request, ReadinessHistoryService $history)
    {
        $user = $request->user();

        return response()->json($history->history($user, $user->readinessBreakdown(), (int) $request->query('days', 30)));
    }

    /**
     * Real rating history — only ever contains rounds this student actually
     * entered and that have been finalized (rating_after is null until
     * ContestFinalizeService runs). Empty for anyone with
     * rated_contests_count === 0; the frontend falls back to a cumulative
     * solved-over-time chart in that case rather than showing nothing.
     */
    public function ratingHistory(Request $request)
    {
        $history = ContestParticipant::where('user_id', $request->user()->id)
            ->whereNotNull('rating_after')
            ->with('contest:id,title,start_at')
            ->orderBy('registered_at')
            ->get()
            ->map(fn (ContestParticipant $p) => [
                'contest_title' => $p->contest->title,
                'date' => $p->contest->start_at,
                'rating' => $p->rating_after,
                'change' => $p->rating_after - $p->rating_before,
                'rank' => $p->rank,
            ]);

        return response()->json(['history' => $history]);
    }
}
