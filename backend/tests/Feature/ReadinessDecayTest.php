<?php

namespace Tests\Feature;

use App\Models\ReadinessSnapshot;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\VaultProfile;
use App\Services\ReadinessHistoryService;
use App\Services\ReadinessScoreService;
use App\Services\Vault\VaultRefreshService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * Staying ready is a daily habit: a day with no activity costs points, coming back stops the loss, and every day's score
 * is kept so a student (and the Vault) can see the climb. See config/readiness.php `decay` and ReadinessHistoryService.
 */
class ReadinessDecayTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
    }

    private function breakdown(User $student): array
    {
        return app(ReadinessScoreService::class)->breakdown($student->fresh());
    }

    /** The student was first tracked this many days ago (a row in the history, as the refresh would have written). */
    private function trackedSince(User $student, int $daysAgo, int $score = 10): void
    {
        ReadinessSnapshot::create([
            'user_id' => $student->id, 'snapshot_date' => now()->subDays($daysAgo)->toDateString(),
            'score' => $score, 'base_score' => $score, 'penalty' => 0, 'missed_days' => 0, 'active_today' => false,
        ]);
    }

    private function didSomething(User $student, int $daysAgo): void
    {
        $this->practiceSubmission($student, 'python', 'accepted', null, now()->subDays($daysAgo));
    }

    // ───────────────────────────── the penalty ─────────────────────────────

    public function test_a_student_who_is_not_tracked_yet_is_never_charged(): void
    {
        $student = $this->strongStudent();

        $breakdown = $this->breakdown($student);

        $this->assertFalse($breakdown['decay']['tracking']);
        $this->assertSame(0, $breakdown['decay']['points']);
        $this->assertSame($breakdown['base_score'], $breakdown['score']);
    }

    public function test_every_day_missed_since_tracking_began_costs_a_point(): void
    {
        // A strong student was active on each of the last 14 days. Tracked for 30 days, the window (21 days) looks at days
        // 1-21 ago: days 15-21 ago had nothing → 7 missed days.
        $student = $this->strongStudent();
        $this->trackedSince($student, 30);

        $breakdown = $this->breakdown($student);

        $this->assertTrue($breakdown['decay']['tracking']);
        $this->assertSame(7, $breakdown['decay']['missed_days']);
        $this->assertSame(7, $breakdown['decay']['points']);
        $this->assertSame($breakdown['base_score'] - 7, $breakdown['score']);
        $this->assertSame(0, $breakdown['decay']['idle_days'], 'they were here yesterday');
    }

    public function test_the_day_after_first_being_tracked_is_free_and_today_is_never_counted(): void
    {
        $student = $this->readinessStudent();
        $this->scoredInterview($student, 90, at: now()->subDays(6));

        $this->trackedSince($student, 1);
        $this->assertSame(0, $this->breakdown($student)['decay']['missed_days'], 'tracked yesterday: nothing to charge yet, and today is still theirs');

        DB::table('readiness_snapshots')->delete();
        $this->trackedSince($student, 3);
        $decay = $this->breakdown($student)['decay'];
        $this->assertSame(2, $decay['missed_days'], 'tracked 3 days ago: days 2 and 1 ago, not today and not the first day');
        $this->assertSame(5, $decay['idle_days'], 'last active 6 days ago; yesterday is 5 complete days on');
    }

    public function test_practising_stops_the_loss_and_the_days_missed_roll_out_of_the_window(): void
    {
        $student = $this->readinessStudent();
        $this->scoredInterview($student, 90, at: now()->subDays(10));
        $this->trackedSince($student, 8);

        $before = $this->breakdown($student)['decay'];
        $this->assertSame(7, $before['missed_days']);
        $this->assertFalse($before['practised_today']);

        $this->didSomething($student, 0);
        $after = $this->breakdown($student)['decay'];
        $this->assertTrue($after['practised_today']);
        $this->assertSame(7, $after['missed_days'], 'today is a fresh start, but the days already missed still count until they roll out');

        $this->didSomething($student, 1);
        $this->assertSame(6, $this->breakdown($student)['decay']['missed_days'], 'a day of work yesterday is a day no longer missed');
    }

    public function test_the_penalty_is_capped_by_the_window_and_never_pushes_a_score_below_zero(): void
    {
        config(['readiness.decay.window_days' => 5]);
        $student = $this->readinessStudent();
        foreach ([100, 100, 100, 100, 100] as $i => $score) {
            $this->scoredInterview($student, $score, at: now()->subDays(60 + $i));
        }
        $this->trackedSince($student, 100);

        $breakdown = $this->breakdown($student);
        $this->assertSame(5, $breakdown['decay']['points'], 'five days in the window, a point each');
        $this->assertSame(5, $breakdown['decay']['max_points']);

        config(['readiness.decay.points_per_missed_day' => 50]);
        $breakdown = $this->breakdown($student);
        $this->assertSame($breakdown['base_score'], $breakdown['decay']['points'], 'a penalty can take the score to 0, not past it');
        $this->assertSame(0, $breakdown['score']);
    }

    public function test_the_first_free_days_cost_nothing_and_the_rest_do(): void
    {
        $student = $this->strongStudent();
        $this->trackedSince($student, 30);

        config(['readiness.decay.free_days' => 3]);
        $this->assertSame(4, $this->breakdown($student)['decay']['points'], '7 missed days, 3 of them free');

        config(['readiness.decay.free_days' => 30]);
        $this->assertSame(0, $this->breakdown($student)['decay']['points']);
    }

    public function test_the_penalty_can_be_turned_off_and_the_score_goes_back_to_what_it_always_was(): void
    {
        $student = $this->strongStudent();
        $this->trackedSince($student, 30);
        $penalised = $this->breakdown($student);

        config(['readiness.decay.enabled' => false]);
        $plain = $this->breakdown($student);

        $this->assertSame(0, $plain['decay']['points']);
        $this->assertSame($penalised['base_score'], $plain['score']);
    }

    public function test_the_penalty_decides_the_tier_and_the_vault_line(): void
    {
        config(['readiness.decay.points_per_missed_day' => 30]);
        $student = $this->strongStudent();
        $this->trackedSince($student, 30);

        $breakdown = $this->breakdown($student);

        $this->assertLessThan(60, $breakdown['score']);
        $this->assertFalse($breakdown['vault']['qualifies']);
        $this->assertSame(60 - $breakdown['score'], $breakdown['vault']['points_needed']);
        $this->assertStringContainsString('missed 7 of the last 21 days', $breakdown['next_steps'][0]);
    }

    public function test_a_student_with_a_score_of_zero_has_nothing_to_lose(): void
    {
        $student = $this->readinessStudent();
        $this->trackedSince($student, 30, 0);

        $decay = $this->breakdown($student)['decay'];

        $this->assertSame(0, $decay['points']);
        $this->assertSame(0, $decay['missed_days']);
    }

    // ───────────────────────────── the record ─────────────────────────────

    public function test_the_refresh_writes_one_row_a_day_and_only_rewrites_it_when_something_changed(): void
    {
        $student = $this->strongStudent();

        app(VaultRefreshService::class)->refresh([$student]);
        $row = ReadinessSnapshot::where('user_id', $student->id)->sole();
        $this->assertSame($row->score, app(ReadinessScoreService::class)->breakdown($student->fresh())['score']);
        $this->assertSame(now()->toDateString(), $row->snapshot_date->toDateString());
        $this->assertSame(0, $row->penalty);
        $this->assertArrayHasKey('interview_performance', $row->components);

        DB::table('readiness_snapshots')->update(['updated_at' => '2020-01-01 00:00:00']);
        app(VaultRefreshService::class)->refresh([$student]);
        $this->assertSame('2020-01-01 00:00:00', DB::table('readiness_snapshots')->value('updated_at'), 'an unchanged day is not rewritten');

        $this->scoredInterview($student, 10, at: now()->subHour());
        app(VaultRefreshService::class)->refresh([$student->fresh()]);
        $this->assertSame(1, ReadinessSnapshot::where('user_id', $student->id)->count(), 'still one row for today');
        $this->assertNotSame('2020-01-01 00:00:00', DB::table('readiness_snapshots')->value('updated_at'), 'a changed day is');
    }

    public function test_a_student_with_nothing_to_track_gets_no_row(): void
    {
        $student = $this->readinessStudent();

        app(VaultRefreshService::class)->refresh([$student]);

        $this->assertSame(0, ReadinessSnapshot::count());
    }

    public function test_a_tracked_student_keeps_getting_rows_all_the_way_down_to_zero(): void
    {
        config(['readiness.decay.points_per_missed_day' => 100]);
        $student = $this->readinessStudent();
        $this->scoredInterview($student, 90, at: now()->subDays(6));
        $this->trackedSince($student, 4);

        app(VaultRefreshService::class)->refresh([$student]);

        $row = ReadinessSnapshot::where('user_id', $student->id)->whereDate('snapshot_date', now()->toDateString())->sole();
        $this->assertSame(0, $row->score);
        $this->assertGreaterThan(0, $row->base_score);
        $this->assertSame($row->base_score, $row->penalty);
        $this->assertSame(3, $row->missed_days);
    }

    public function test_old_rows_are_pruned(): void
    {
        $student = $this->readinessStudent();
        $this->trackedSince($student, 500);
        $this->trackedSince($student, 3);

        $this->assertSame(1, app(ReadinessHistoryService::class)->prune());
        $this->assertSame(1, ReadinessSnapshot::count());
    }

    // ───────────────────────────── the whole journey ─────────────────────────────

    public function test_a_student_climbs_into_the_vault_and_is_taken_out_again_if_they_stop(): void
    {
        $start = now()->startOfDay()->addHours(12);
        $this->travelTo($start);
        $student = $this->readinessStudent();
        $refresh = fn () => app(VaultRefreshService::class)->refresh([$student->fresh()]);

        // Day 0: a beginner. Tracked, but nowhere near the Vault — and no Vault profile is created for them.
        $this->scoredInterview($student, 60, at: now()->subDay());
        $this->didSomething($student, 1);
        $refresh();
        $this->assertSame(0, VaultProfile::count());
        $beginner = ReadinessSnapshot::where('user_id', $student->id)->sole();
        $this->assertLessThan(60, $beginner->score);

        // Day 1: they work hard across the platform and cross the line the same day.
        $this->travelTo($start->copy()->addDay());
        foreach ([95, 90, 92] as $i => $score) {
            $this->scoredInterview($student, $score, at: now()->subHours($i + 1));
        }
        foreach ([88, 92] as $i => $score) {
            $this->softSkillResult($student, $score, at: now()->subHours($i + 1));
        }
        foreach ([90, 85, 95] as $i => $score) {
            $this->speakingScore($student, $score, now()->subHours($i + 1));
            $this->listeningScore($student, $score, now()->subHours($i + 1));
            $this->vocabularyScore($student, $score, now()->subHours($i + 1));
        }
        foreach ([0, 1, 2] as $i) {
            $this->finishedContest([$student->id => 270], \App\Models\Contest::CONTEST_TYPE_DAILY, 300, now()->subDays($i + 2));
        }
        for ($i = 0; $i < 12; $i++) {
            $this->didSomething($student, $i);
        }
        $refresh();

        $profile = VaultProfile::where('user_id', $student->id)->sole();
        $this->assertTrue($profile->is_eligible, 'crossing 60 puts them in the Vault the same day');
        $this->assertSame(now()->toDateString(), $profile->qualified_at->toDateString());
        $crossed = ReadinessSnapshot::where('user_id', $student->id)->where('score', '>=', 60)->orderBy('snapshot_date')->first();
        $this->assertSame(now()->toDateString(), $crossed->snapshot_date->toDateString());
        $peak = $profile->readiness_score;

        // From here they do nothing. Each missed day costs more than a point (steeper than the default so a few days show it).
        config(['readiness.decay.points_per_missed_day' => 8]);
        $scores = [$peak];
        $leftOn = null;

        for ($day = 2; $day <= 12; $day++) {
            $this->travelTo($start->copy()->addDays($day));
            $refresh();
            $scores[] = ReadinessSnapshot::where('user_id', $student->id)->whereDate('snapshot_date', now()->toDateString())->value('score');

            if ($leftOn === null && ! $profile->fresh()->is_eligible) {
                $leftOn = $day;
            }
        }

        $this->assertNotNull($leftOn, 'a student who stops practising leaves the Vault');
        $this->assertSame($scores, collect($scores)->sortDesc()->values()->all(), 'the score only falls while they are away');
        $this->assertLessThan(55, ReadinessSnapshot::where('user_id', $student->id)->orderByDesc('snapshot_date')->first()->score);
        $this->assertNotNull($profile->fresh()->left_at);
        $this->assertSame($peak, $profile->fresh()->peak_readiness, 'the best they reached is remembered');
        $this->assertTrue(
            UserNotification::where('user_id', $student->id)->where('type', 'readiness.slip')->exists(),
            'they were told it was slipping'
        );

        // They come back: today's work stops the loss at once.
        $before = $this->breakdown($student)['decay'];
        $this->didSomething($student, 0);
        $after = $this->breakdown($student)['decay'];
        $this->assertTrue($after['practised_today']);
        $this->assertSame($before['points'], $after['points']);
        $this->assertSame(0, $after['idle_days']);
    }

    // ───────────────────────────── the nudge ─────────────────────────────

    public function test_a_slipping_student_is_nudged_once_on_each_milestone_however_often_it_runs(): void
    {
        $student = $this->readinessStudent();
        $this->scoredInterview($student, 90, at: now()->subDays(4));
        $this->trackedSince($student, 6);

        // Last active 4 days ago → idle 3 days (yesterday is 3 complete days on). A milestone.
        $breakdown = $this->breakdown($student);
        $this->assertSame(3, $breakdown['decay']['idle_days']);

        $history = app(ReadinessHistoryService::class);
        $this->assertTrue($history->nudge($student, $breakdown));
        $this->assertFalse($history->nudge($student, $breakdown), 'a second run the same day says nothing');

        $note = UserNotification::where('user_id', $student->id)->where('type', 'readiness.slip')->sole();
        $this->assertStringContainsString('slipped to '.$breakdown['score'], $note->title);
        $this->assertSame('/dashboard/vault', $note->url);
    }

    public function test_nobody_is_nudged_off_a_milestone_or_after_practising_or_when_nothing_was_lost(): void
    {
        $history = app(ReadinessHistoryService::class);
        $student = $this->readinessStudent();
        $this->scoredInterview($student, 90, at: now()->subDays(5));
        $this->trackedSince($student, 8);

        $this->assertSame(4, $this->breakdown($student)['decay']['idle_days']);
        $this->assertFalse($history->nudge($student, $this->breakdown($student)), 'day 4 is not a milestone');

        $fresh = $this->readinessStudent();
        $this->scoredInterview($fresh, 90, at: now()->subDays(2));
        $this->assertSame(1, $this->breakdown($fresh)['decay']['idle_days']);
        $this->assertFalse($history->nudge($fresh, $this->breakdown($fresh)), 'untracked: nothing has been lost');

        $this->trackedSince($fresh, 4);
        $this->didSomething($fresh, 0);
        $this->assertFalse($history->nudge($fresh, $this->breakdown($fresh)), 'they are back today');
    }

    // ───────────────────────────── what the student sees ─────────────────────────────

    public function test_the_history_endpoint_returns_the_climb_and_the_facts(): void
    {
        $student = $this->strongStudent();
        foreach ([6 => 30, 5 => 34, 4 => 41, 3 => 47, 2 => 55, 1 => 61] as $ago => $score) {
            ReadinessSnapshot::create([
                'user_id' => $student->id, 'snapshot_date' => now()->subDays($ago)->toDateString(),
                'score' => $score, 'base_score' => $score, 'penalty' => 0, 'missed_days' => 0, 'active_today' => true,
            ]);
        }
        Sanctum::actingAs($student);

        $body = $this->getJson('/api/me/readiness/history?days=30')->assertOk()->json();

        $this->assertSame([30, 34, 41, 47, 55, 61], array_slice(array_column($body['points'], 'score'), 0, 6));
        $today = end($body['points']);
        $this->assertSame(now()->toDateString(), $today['date']);
        $this->assertSame($this->breakdown($student)['score'], $today['score']);
        $this->assertSame(60, $body['summary']['threshold']);
        $this->assertSame(now()->subDays(1)->toDateString(), $body['summary']['first_crossed_on']);
        $this->assertSame(now()->subDays(6)->toDateString(), $body['summary']['tracking_since']);
        $this->assertSame($today['score'] - 30, $body['summary']['change_7d']);
        $this->assertNull($body['summary']['days_to_threshold'], 'already past the line');
    }

    public function test_it_estimates_the_days_to_the_line_only_when_the_trend_is_real(): void
    {
        $student = $this->readinessStudent();
        foreach ([8 => 10, 7 => 12, 6 => 14, 5 => 16, 4 => 18, 3 => 20, 2 => 22, 1 => 24] as $ago => $score) {
            ReadinessSnapshot::create([
                'user_id' => $student->id, 'snapshot_date' => now()->subDays($ago)->toDateString(),
                'score' => $score, 'base_score' => $score, 'penalty' => 0, 'missed_days' => 0, 'active_today' => true,
            ]);
        }
        $live = ['score' => 26, 'base_score' => 26, 'decay' => []];
        $history = app(ReadinessHistoryService::class);

        // Two points a day, 34 to go → 17 days.
        $this->assertSame(17, $history->history($student, $live)['summary']['days_to_threshold']);

        // Flat or falling → no promise.
        DB::table('readiness_snapshots')->update(['score' => 26]);
        $this->assertNull($history->history($student, $live)['summary']['days_to_threshold']);

        // Too little history → no promise either.
        DB::table('readiness_snapshots')->where('snapshot_date', '<', now()->subDays(3)->toDateString())->delete();
        DB::table('readiness_snapshots')->update(['score' => 10]);
        $this->assertNull($history->history($student, $live)['summary']['days_to_threshold']);
    }

    public function test_the_stats_and_vault_payloads_carry_the_penalty_and_the_history(): void
    {
        $student = $this->strongStudent();
        $this->trackedSince($student, 30);
        Sanctum::actingAs($student);

        $stats = $this->getJson('/api/me/stats')->assertOk()->json('readiness');
        $this->assertSame(7, $stats['decay']['points']);
        $this->assertSame($stats['base_score'] - 7, $stats['score']);

        $vault = $this->getJson('/api/me/vault')->assertOk()->json();
        $this->assertSame(7, $vault['readiness']['decay']['points']);
        $this->assertSame($vault['readiness']['base_score'] - 7, $vault['readiness']['score']);
        $this->assertNotEmpty($vault['history']['points']);
        $this->assertSame(60, $vault['history']['summary']['threshold']);
    }

    public function test_a_missing_history_table_never_takes_the_score_or_the_vault_page_down(): void
    {
        $student = $this->strongStudent();
        Sanctum::actingAs($student);
        \Illuminate\Support\Facades\Schema::drop('readiness_snapshots');

        $this->assertSame(0, $this->breakdown($student)['decay']['points']);
        $this->getJson('/api/me/vault')->assertOk()->assertJsonCount(1, 'history.points');
        $this->getJson('/api/me/readiness/history')->assertOk();
    }
}
