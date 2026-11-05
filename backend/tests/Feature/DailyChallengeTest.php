<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\DailyChallengeService;
use Carbon\Carbon;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * The AptRun Daily Challenge: opens at 8:00 PM IST, carries the AptRun name, and its results feed a
 * leaderboard tab and a rating ladder. Everything is checked through the same entry points the product
 * uses — the scheduled command and the student API — against real rows.
 */
class DailyChallengeTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function seedProblemBank(): void
    {
        foreach (['easy', 'medium', 'hard'] as $difficulty) {
            $this->makeProblem($difficulty);
        }
    }

    /** A moment of the day in IST, e.g. "2026-10-31 10:00". */
    private function nowIst(string $dateTime): void
    {
        Carbon::setTestNow(Carbon::parse($dateTime, 'Asia/Kolkata'));
    }

    public function test_the_day_s_challenge_is_named_aptrun_and_opens_at_8_pm_ist(): void
    {
        $this->seedProblemBank();
        $this->nowIst('2026-10-31 10:00');

        $this->artisan('contests:generate-daily')->assertExitCode(0);

        $contest = Contest::where('daily_key', '2026-10-31')->firstOrFail();

        $this->assertSame('AptRun Daily Challenge — 31 Oct 2026', $contest->title);
        $this->assertSame('aptrun-daily-challenge-2026-10-31', $contest->slug);
        $this->assertTrue($contest->is_rated);
        $this->assertSame(Contest::STATUS_PUBLISHED, $contest->status);
        $this->assertSame(3, $contest->contestProblems()->count());

        // 8:00 PM IST is 14:30 UTC, and the hour-long window closes at 9:00 PM IST.
        $this->assertSame('2026-10-31 14:30:00', $contest->start_at->utc()->format('Y-m-d H:i:s'));
        $this->assertSame('2026-10-31 15:30:00', $contest->end_at->utc()->format('Y-m-d H:i:s'));
        $this->assertStringContainsString('8:00 PM to 9:00 PM IST', $contest->description);
    }

    public function test_running_the_generator_twice_still_makes_one_challenge(): void
    {
        $this->seedProblemBank();
        $this->nowIst('2026-10-31 00:05');

        $this->artisan('contests:generate-daily')->assertExitCode(0);
        $this->artisan('contests:generate-daily')->assertExitCode(0);

        $this->assertSame(1, Contest::where('contest_type', Contest::CONTEST_TYPE_DAILY)->count());
    }

    public function test_a_challenge_made_for_the_old_7_pm_slot_is_moved_to_8_pm_before_it_opens(): void
    {
        $this->seedProblemBank();
        $this->nowIst('2026-10-31 09:00');

        $old = Contest::create([
            'title' => 'Daily Challenge — 31 Oct 2026', 'slug' => 'daily-challenge-2026-10-31', 'description' => 'old',
            'start_at' => Carbon::parse('2026-10-31 19:00', 'Asia/Kolkata')->utc(), 'end_at' => Carbon::parse('2026-10-31 20:00', 'Asia/Kolkata')->utc(),
            'is_rated' => true, 'status' => Contest::STATUS_PUBLISHED, 'contest_type' => Contest::CONTEST_TYPE_DAILY,
            'is_auto_generated' => true, 'daily_key' => '2026-10-31',
        ]);

        $this->artisan('contests:generate-daily')->assertExitCode(0);

        $old->refresh();
        $this->assertSame('AptRun Daily Challenge — 31 Oct 2026', $old->title);
        $this->assertSame('daily-challenge-2026-10-31', $old->slug, 'links students already hold must keep working');
        $this->assertSame('2026-10-31 14:30:00', $old->start_at->utc()->format('Y-m-d H:i:s'));
        $this->assertSame(1, Contest::where('contest_type', Contest::CONTEST_TYPE_DAILY)->count());
    }

    public function test_a_challenge_that_has_already_opened_is_never_touched(): void
    {
        $this->seedProblemBank();
        $this->nowIst('2026-10-31 19:30'); // the old 7 PM slot is live right now

        $live = Contest::create([
            'title' => 'Daily Challenge — 31 Oct 2026', 'slug' => 'daily-challenge-2026-10-31',
            'start_at' => Carbon::parse('2026-10-31 19:00', 'Asia/Kolkata')->utc(), 'end_at' => Carbon::parse('2026-10-31 20:00', 'Asia/Kolkata')->utc(),
            'is_rated' => true, 'status' => Contest::STATUS_PUBLISHED, 'contest_type' => Contest::CONTEST_TYPE_DAILY,
            'is_auto_generated' => true, 'daily_key' => '2026-10-31',
        ]);

        $this->artisan('contests:generate-daily')->assertExitCode(0);

        $live->refresh();
        $this->assertSame('Daily Challenge — 31 Oct 2026', $live->title);
        $this->assertSame('2026-10-31 13:30:00', $live->start_at->utc()->format('Y-m-d H:i:s'));
    }

    public function test_once_the_day_s_slot_closes_the_next_days_challenge_is_scheduled(): void
    {
        $this->seedProblemBank();
        $this->nowIst('2026-10-31 21:00:20'); // a few seconds after tonight's contest closed

        $this->artisan('contests:generate-daily')->assertExitCode(0);

        $tomorrow = Contest::where('contest_type', Contest::CONTEST_TYPE_DAILY)->firstOrFail();
        $this->assertSame('2026-11-01', $tomorrow->daily_key);
        $this->assertSame('AptRun Daily Challenge — 01 Nov 2026', $tomorrow->title);
        $this->assertSame('2026-11-01 14:30:00', $tomorrow->start_at->utc()->format('Y-m-d H:i:s'));
    }

    public function test_the_schedule_fires_at_the_minute_the_slot_closes(): void
    {
        $this->assertSame('21:00', app(DailyChallengeService::class)->closeTime());

        $this->artisan('schedule:list')->assertSuccessful();
        $closing = collect(app(Schedule::class)->events())->filter(fn ($e) => str_contains($e->command, 'contests:generate-daily'));
        $this->assertTrue($closing->contains(fn ($e) => $e->expression === '0 21 * * *'), 'a run at 21:00 IST');
    }

    public function test_every_student_is_told_when_the_next_challenge_is_scheduled_and_only_once(): void
    {
        $this->seedProblemBank();
        $a = $this->readinessStudent();
        $b = $this->readinessStudent(['college_id' => null]);
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO]);
        $this->nowIst('2026-10-31 21:00:20');

        $this->artisan('contests:generate-daily')->assertExitCode(0);
        $this->artisan('contests:generate-daily')->assertExitCode(0);

        foreach ([$a, $b] as $student) {
            $notes = UserNotification::where('user_id', $student->id)->where('type', 'daily.scheduled')->get();
            $this->assertCount(1, $notes);
            $this->assertSame('AptRun Daily Challenge is on tomorrow 8:00 PM IST', $notes[0]->title);
            $this->assertStringContainsString('Registration opens tomorrow 5:00 AM IST', $notes[0]->body);
            $this->assertStringContainsString('closes tomorrow 7:59 PM IST', $notes[0]->body);
            $this->assertSame('/dashboard/contests', $notes[0]->url);
        }
        $this->assertSame(0, UserNotification::where('user_id', $tpo->id)->count(), 'staff are not told');
    }

    public function test_registration_opens_15_hours_before_the_start_and_closes_a_minute_before(): void
    {
        $student = $this->readinessStudent();
        Sanctum::actingAs($student);
        $this->nowIst('2026-11-01 08:00');
        $start = Carbon::parse('2026-11-01 20:00', 'Asia/Kolkata');

        $edition = Contest::create([
            'title' => 'AptRun Daily Challenge — 01 Nov 2026', 'slug' => 'aptrun-daily-challenge-2026-11-01', 'start_at' => $start->copy()->utc(), 'end_at' => $start->copy()->addHour()->utc(),
            'is_rated' => true, 'status' => Contest::STATUS_PUBLISHED, 'contest_type' => Contest::CONTEST_TYPE_DAILY, 'daily_key' => '2026-11-01',
        ]);
        $url = "/api/contests/{$edition->slug}/register";

        // 08:00 is 12 hours before the start: inside the 15-hour window.
        $this->nowIst('2026-11-01 04:59');
        $this->postJson($url)->assertStatus(422)->assertJsonPath('message', 'Registration for this challenge opens today 5:00 AM IST.');
        $this->getJson("/api/contests/{$edition->slug}")->assertJsonPath('registration.state', 'not_open');

        $this->nowIst('2026-11-01 05:00:30');
        $this->getJson("/api/contests/{$edition->slug}")->assertJsonPath('registration.state', 'open');

        $this->nowIst('2026-11-01 19:58:59');
        $this->postJson($url)->assertCreated();

        // A student who did not register in time cannot walk in at 19:59:30 …
        $late = $this->readinessStudent();
        Sanctum::actingAs($late);
        $this->nowIst('2026-11-01 19:59:30');
        $this->postJson($url)->assertStatus(422)->assertJsonPath('message', 'Registration for this challenge has closed. It closes 1 minute(s) before the start — join the next one.');
        $this->assertSame(1, $edition->participants()->count());
    }

    public function test_registration_stays_shut_while_the_challenge_is_live(): void
    {
        $this->nowIst('2026-11-01 20:10');
        $edition = Contest::create([
            'title' => 'AptRun Daily Challenge — 01 Nov 2026', 'slug' => 'aptrun-daily-challenge-2026-11-01',
            'start_at' => Carbon::parse('2026-11-01 20:00', 'Asia/Kolkata')->utc(), 'end_at' => Carbon::parse('2026-11-01 21:00', 'Asia/Kolkata')->utc(),
            'is_rated' => true, 'status' => Contest::STATUS_PUBLISHED, 'contest_type' => Contest::CONTEST_TYPE_DAILY, 'daily_key' => '2026-11-01',
        ]);
        Sanctum::actingAs($this->readinessStudent());

        $this->postJson("/api/contests/{$edition->slug}/register")->assertStatus(422);
        $this->assertSame(0, $edition->participants()->count());
    }

    public function test_other_contests_keep_their_own_registration_rules(): void
    {
        $this->nowIst('2026-11-01 10:00');
        $general = Contest::create([
            'title' => 'Rated Round', 'slug' => 'rated-round', 'start_at' => now()->subMinutes(10), 'end_at' => now()->addHour(),
            'is_rated' => true, 'status' => Contest::STATUS_PUBLISHED, 'contest_type' => Contest::CONTEST_TYPE_GENERAL,
        ]);
        Sanctum::actingAs($this->readinessStudent());

        $this->postJson("/api/contests/{$general->slug}/register")->assertCreated();
        $this->getJson("/api/contests/{$general->slug}")->assertJsonPath('registration', null);
    }

    public function test_the_contests_list_shows_an_older_edition_under_the_aptrun_name(): void
    {
        $student = $this->readinessStudent();
        $this->finishedContest([$student->id => 100]);
        Contest::query()->update(['title' => 'Daily Challenge — 12 Oct 2026']);
        Sanctum::actingAs($student);

        $titles = collect($this->getJson('/api/contests')->assertOk()->json('contests'))->pluck('title');

        $this->assertSame(['AptRun Daily Challenge — 12 Oct 2026'], $titles->all());
    }

    public function test_the_hero_says_what_is_on_next_and_who_won_last_time(): void
    {
        $this->nowIst('2026-10-31 12:00');
        $me = $this->readinessStudent(['name' => 'Me']);
        $ace = $this->readinessStudent(['name' => 'Ace']);
        $this->finishedContest([$ace->id => 300, $me->id => 100]);

        $upcoming = Contest::create([
            'title' => 'AptRun Daily Challenge — 31 Oct 2026', 'slug' => 'aptrun-daily-challenge-2026-10-31',
            'start_at' => Carbon::parse('2026-10-31 20:00', 'Asia/Kolkata')->utc(), 'end_at' => Carbon::parse('2026-10-31 21:00', 'Asia/Kolkata')->utc(),
            'is_rated' => true, 'status' => Contest::STATUS_PUBLISHED, 'contest_type' => Contest::CONTEST_TYPE_DAILY, 'daily_key' => '2026-10-31',
        ]);
        ContestParticipant::create(['contest_id' => $upcoming->id, 'user_id' => $me->id, 'registered_at' => now()]);
        Sanctum::actingAs($me);

        $hero = $this->getJson('/api/daily-challenge')->assertOk()->json();

        $this->assertSame('AptRun Daily Challenge', $hero['name']);
        $this->assertSame('8:00 PM IST', $hero['schedule']['start_label']);
        $this->assertSame('upcoming', $hero['featured']['state']);
        $this->assertTrue($hero['featured']['is_registered']);
        $this->assertSame(1, $hero['featured']['registered_count']);
        $this->assertSame('aptrun-daily-challenge-2026-10-31', $hero['featured']['slug']);
        $this->assertSame(['Ace', 'Me'], collect($hero['latest']['top'])->pluck('user.name')->all());
        $this->assertSame(2, $hero['latest']['my_result']['rank']);
        $this->assertSame('Unrated', $hero['my_rating']['display']);
    }

    public function test_with_no_edition_made_yet_the_hero_still_knows_when_the_next_one_opens(): void
    {
        $this->nowIst('2026-10-31 21:30'); // tonight's slot is over, tomorrow's is not made until 00:05
        Sanctum::actingAs($this->readinessStudent());

        $hero = $this->getJson('/api/daily-challenge')->assertOk()->json();

        $this->assertNull($hero['featured']);
        $this->assertNull($hero['latest']);
        $this->assertSame('2026-11-01 14:30:00', Carbon::parse($hero['next_start_at'])->utc()->format('Y-m-d H:i:s'));
    }

    public function test_the_board_ranks_the_last_edition_with_ties_and_leaves_out_zero_scores(): void
    {
        $a = $this->readinessStudent(['name' => 'Aarav']);
        $b = $this->readinessStudent(['name' => 'Bina']);
        $c = $this->readinessStudent(['name' => 'Chirag']);
        $d = $this->readinessStudent(['name' => 'Dev']);
        $contest = $this->finishedContest([$a->id => 300, $b->id => 300, $c->id => 100, $d->id => 0]);
        ContestParticipant::where('contest_id', $contest->id)->where('user_id', $a->id)->update(['rating_before' => 1200, 'rating_after' => 1230]);
        Sanctum::actingAs($c);

        $board = $this->getJson('/api/daily-challenge/leaderboard')->assertOk()->json();

        $this->assertSame('ended', $board['edition']['state']);
        $this->assertSame(3, $board['edition']['participants']);
        $this->assertSame([['Aarav', 1], ['Bina', 1], ['Chirag', 3]], collect($board['top'])->map(fn ($r) => [$r['user']['name'], $r['rank']])->all());
        $this->assertSame(30, $board['top'][0]['rating_delta']);
        $this->assertNull($board['top'][1]['rating_delta']);
        $this->assertSame(3, $board['my_result']['rank']);
    }

    public function test_a_college_board_only_holds_that_college_s_students(): void
    {
        $college = College::create(['name' => 'Alpha College', 'short_code' => 'ALP']);
        $mine = $this->readinessStudent(['college_id' => $college->id]);
        $mate = $this->readinessStudent(['college_id' => $college->id]);
        $stranger = $this->readinessStudent(['college_id' => College::create(['name' => 'Beta College', 'short_code' => 'BET'])->id]);
        $this->finishedContest([$stranger->id => 300, $mate->id => 200, $mine->id => 100]);
        Sanctum::actingAs($mine);

        $board = $this->getJson('/api/daily-challenge/leaderboard?scope=college')->assertOk()->json();

        $this->assertSame([$mate->id, $mine->id], collect($board['top'])->pluck('user.id')->all());
        $this->assertSame(2, $board['my_result']['rank']);
    }

    public function test_a_student_with_no_college_cannot_open_the_college_board(): void
    {
        Sanctum::actingAs($this->readinessStudent(['college_id' => null]));

        $this->getJson('/api/daily-challenge/leaderboard?scope=college')->assertStatus(422);
    }

    public function test_the_rating_ladder_orders_rated_students_and_finds_the_viewer_beyond_the_top_rows(): void
    {
        $top = $this->readinessStudent(['name' => 'Top', 'current_rating' => 1500, 'rated_contests_count' => 9]);
        $mid = $this->readinessStudent(['name' => 'Mid', 'current_rating' => 1300, 'rated_contests_count' => 4]);
        $me = $this->readinessStudent(['name' => 'Me', 'current_rating' => 1250, 'rated_contests_count' => 2]);
        $this->readinessStudent(['name' => 'Fresh', 'current_rating' => 1200, 'rated_contests_count' => 0]);
        Sanctum::actingAs($me);

        $board = $this->getJson('/api/daily-challenge/leaderboard')->assertOk()->json();

        $this->assertNull($board['edition']);
        $this->assertSame(['Top', 'Mid', 'Me'], collect($board['ladder'])->pluck('user.name')->all(), 'unrated students are not on the ladder');
        $this->assertSame([1, 2, 3], collect($board['ladder'])->pluck('rank')->all());
        $this->assertSame(3, $board['my_ladder']['rank']);
        $this->assertSame(1250, $board['my_ladder']['rating']);
    }

    public function test_an_unrated_student_has_no_ladder_place(): void
    {
        Sanctum::actingAs($this->readinessStudent());

        $this->getJson('/api/daily-challenge/leaderboard')->assertOk()->assertJsonPath('my_ladder', null);
    }

    public function test_the_daily_endpoints_need_a_signed_in_student(): void
    {
        $this->getJson('/api/daily-challenge')->assertUnauthorized();
        $this->getJson('/api/daily-challenge/leaderboard')->assertUnauthorized();
    }
}
