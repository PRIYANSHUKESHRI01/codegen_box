<?php

namespace App\Support;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Consecutive-days streak from a list of activity dates.
 *
 * The streak only counts while the most recent activity day is today or
 * yesterday — otherwise it's broken, not "paused". Same convention as
 * StudentStatsService::streak() for DSA practice. Shared by the Learning
 * Centre hub (which spans several modules) and Vocabulary Sprint's own streak.
 */
final class ActivityStreak
{
    /**
     * @param  Collection<int, string>  $sortedDescDateStrings  unique Y-m-d dates, newest first
     */
    public static function current(Collection $sortedDescDateStrings): int
    {
        if ($sortedDescDateStrings->isEmpty()) {
            return 0;
        }

        $mostRecent = $sortedDescDateStrings->first();
        if ($mostRecent !== Carbon::now()->toDateString() && $mostRecent !== Carbon::now()->subDay()->toDateString()) {
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
