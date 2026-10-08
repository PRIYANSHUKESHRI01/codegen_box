<?php

namespace Tests\Unit;

use App\Support\ActivityStreak;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\TestCase;

class ActivityStreakTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-10 12:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function streak(array $days): int
    {
        return ActivityStreak::current(collect($days)->sortDesc()->values());
    }

    public function test_no_activity_is_no_streak(): void
    {
        $this->assertSame(0, $this->streak([]));
    }

    public function test_activity_today_or_yesterday_keeps_a_streak_alive(): void
    {
        $this->assertSame(1, $this->streak(['2026-10-10']));
        $this->assertSame(1, $this->streak(['2026-10-09']), 'yesterday still counts — the day is not over yet');
    }

    public function test_the_streak_counts_consecutive_days_back_from_the_latest(): void
    {
        $this->assertSame(3, $this->streak(['2026-10-10', '2026-10-09', '2026-10-08']));
        $this->assertSame(2, $this->streak(['2026-10-09', '2026-10-08', '2026-10-06']), 'a gap ends it');
    }

    public function test_a_streak_whose_latest_day_is_older_than_yesterday_is_broken_not_paused(): void
    {
        $this->assertSame(0, $this->streak(['2026-10-08', '2026-10-07', '2026-10-06']));
    }
}
