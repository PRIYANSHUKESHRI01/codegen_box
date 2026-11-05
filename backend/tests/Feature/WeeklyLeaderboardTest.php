<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\Contest;
use App\Models\PlatformModule;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * The global leaderboard is contest scores only, in two boards (this week, which starts again every Monday, and all time),
 * and the superadmin can put voucher cards live for a week that the top of the weekly board wins.
 *
 * "Now" is Wednesday 4 Nov 2026, noon IST — so the week is Monday 2 Nov 00:00 IST to Monday 9 Nov 00:00 IST.
 */
class WeeklyLeaderboardTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-04 12:00', 'Asia/Kolkata'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function ist(string $dateTime): Carbon
    {
        return Carbon::parse($dateTime, 'Asia/Kolkata')->utc();
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function names(array $payload): array
    {
        return collect($payload['leaderboard'])->map(fn ($r) => [$r['user']['name'], $r['contest_score'], $r['rank']])->all();
    }

    // ------------------------------------------------------------------ the boards

    public function test_the_leaderboard_counts_contest_scores_and_never_solved_problems(): void
    {
        $solver = $this->readinessStudent(['name' => 'Solver']);
        $competitor = $this->readinessStudent(['name' => 'Competitor']);
        foreach (range(1, 5) as $_) {
            $this->practiceSubmission($solver, 'python', 'accepted');
        }
        $this->finishedContest([$competitor->id => 150], Contest::CONTEST_TYPE_GENERAL, 300, $this->ist('2026-11-03 20:00'));
        Sanctum::actingAs($solver);

        $board = $this->getJson('/api/leaderboard')->assertOk()->json();

        $this->assertSame([['Competitor', 150, 1]], $this->names($board));
        $this->assertArrayNotHasKey('solved_score', $board['leaderboard'][0]);
        $this->assertNull($board['my_rank'], 'solving practice problems earns no place');
    }

    public function test_the_weekly_board_resets_on_monday_while_all_time_keeps_everything(): void
    {
        $a = $this->readinessStudent(['name' => 'Aarav']);
        $b = $this->readinessStudent(['name' => 'Bina']);
        // Last week (Sunday night 1 Nov, 23:30 IST) vs this week (Monday 2 Nov 00:30 IST).
        $this->finishedContest([$a->id => 300, $b->id => 100], Contest::CONTEST_TYPE_DAILY, 300, $this->ist('2026-11-01 23:30'));
        $this->finishedContest([$b->id => 200], Contest::CONTEST_TYPE_DAILY, 300, $this->ist('2026-11-02 00:30'));
        Sanctum::actingAs($a);

        $weekly = $this->getJson('/api/leaderboard?period=weekly')->assertOk()->json();
        $allTime = $this->getJson('/api/leaderboard?period=all_time')->assertOk()->json();

        $this->assertSame([['Bina', 200, 1]], $this->names($weekly));
        $this->assertNull($weekly['my_rank']);
        $this->assertSame([['Aarav', 300, 1], ['Bina', 300, 1]], $this->names($allTime), 'equal points and penalty share a rank');
        $this->assertSame([1, 2], collect($allTime['leaderboard'])->pluck('contests_played')->all());
        $this->assertSame('2026-11-02', $weekly['week']['key']);
        $this->assertSame('2026-11-08 18:30:00', Carbon::parse($weekly['week']['resets_at'])->utc()->format('Y-m-d H:i:s'), 'resets Monday 00:00 IST');
    }

    public function test_weekly_is_the_default_board(): void
    {
        $a = $this->readinessStudent();
        $this->finishedContest([$a->id => 100], Contest::CONTEST_TYPE_DAILY, 300, $this->ist('2026-10-20 20:00'));
        Sanctum::actingAs($a);

        $this->assertSame('weekly', $this->getJson('/api/leaderboard')->json('period'));
        $this->assertSame([], $this->getJson('/api/leaderboard')->json('leaderboard'));
    }

    public function test_only_platform_wide_contests_count_and_zero_scores_are_left_off(): void
    {
        $a = $this->readinessStudent(['name' => 'Aarav']);
        $b = $this->readinessStudent(['name' => 'Bina']);
        $this->finishedContest([$a->id => 100, $b->id => 0], Contest::CONTEST_TYPE_GENERAL, 300, $this->ist('2026-11-03 10:00'));
        $this->finishedContest([$a->id => 300], Contest::CONTEST_TYPE_TPO_MOCK, 300, $this->ist('2026-11-03 11:00'));
        $this->finishedContest([$b->id => 300], Contest::CONTEST_TYPE_COMPANY_HIRING, 300, $this->ist('2026-11-03 12:00'));
        Sanctum::actingAs($a);

        $this->assertSame([['Aarav', 100, 1]], $this->names($this->getJson('/api/leaderboard')->json()));
    }

    public function test_a_contest_that_has_not_started_yet_is_not_on_the_board(): void
    {
        $a = $this->readinessStudent();
        $this->finishedContest([$a->id => 100], Contest::CONTEST_TYPE_DAILY, 300, $this->ist('2026-11-05 20:00'));
        Sanctum::actingAs($a);

        $this->assertSame([], $this->getJson('/api/leaderboard')->json('leaderboard'));
    }

    public function test_the_college_board_only_holds_that_college_and_ranks_inside_it(): void
    {
        $college = College::create(['name' => 'Alpha College', 'short_code' => 'ALP']);
        $mine = $this->readinessStudent(['name' => 'Mine', 'college_id' => $college->id]);
        $mate = $this->readinessStudent(['name' => 'Mate', 'college_id' => $college->id]);
        $stranger = $this->readinessStudent(['name' => 'Stranger', 'college_id' => College::create(['name' => 'Beta College', 'short_code' => 'BET'])->id]);
        $this->finishedContest([$stranger->id => 300, $mate->id => 200, $mine->id => 100], Contest::CONTEST_TYPE_DAILY, 300, $this->ist('2026-11-03 20:00'));
        Sanctum::actingAs($mine);

        $board = $this->getJson('/api/leaderboard?scope=college')->assertOk()->json();

        $this->assertSame([['Mate', 200, 1], ['Mine', 100, 2]], $this->names($board));
        $this->assertSame(2, $board['my_rank']);
        $this->assertSame(3, $this->getJson('/api/leaderboard')->json('my_rank'), 'on the whole platform they are third');
    }

    public function test_unknown_periods_and_a_college_board_without_a_college_are_refused(): void
    {
        Sanctum::actingAs($this->readinessStudent(['college_id' => null]));

        $this->getJson('/api/leaderboard?period=yearly')->assertStatus(422);
        $this->getJson('/api/leaderboard?scope=college')->assertStatus(422);
    }

    // ------------------------------------------------------------------- the rewards

    private function goLive(User $admin, string ...$cards): void
    {
        Sanctum::actingAs($admin);
        foreach ($cards as $card) {
            $this->putJson("/api/superadmin/weekly-rewards/{$card}", ['live' => true])->assertOk();
        }
    }

    public function test_no_banner_is_drawn_until_the_superadmin_puts_a_card_live(): void
    {
        Sanctum::actingAs($this->readinessStudent());

        $this->getJson('/api/weekly-rewards')->assertOk()->assertJsonPath('live', false)->assertJsonPath('prizes', []);
    }

    public function test_live_cards_are_handed_out_biggest_voucher_first_and_show_on_the_board(): void
    {
        $winner = $this->readinessStudent(['name' => 'Winner']);
        $second = $this->readinessStudent(['name' => 'Second']);
        $third = $this->readinessStudent(['name' => 'Third']);
        $fourth = $this->readinessStudent(['name' => 'Fourth']);
        $this->finishedContest([$winner->id => 300, $second->id => 200, $third->id => 100, $fourth->id => 50], Contest::CONTEST_TYPE_DAILY, 300, $this->ist('2026-11-03 20:00'));

        $this->goLive($this->superadmin(), 'dominos', 'burger_king', 'zomato');
        Sanctum::actingAs($winner);

        $banner = $this->getJson('/api/weekly-rewards')->assertOk()->json();
        $this->assertTrue($banner['live']);
        $this->assertSame([[1, 'Burger King', 499], [2, 'Zomato', 399], [3, "Domino's", 299]], collect($banner['prizes'])->map(fn ($p) => [$p['rank'], $p['brand'], $p['amount']])->all());
        $this->assertSame(1, $banner['my']['rank']);
        $this->assertSame('Burger King', $banner['my']['prize']['brand']);

        $board = $this->getJson('/api/leaderboard')->json();
        $this->assertSame(['burger_king', 'zomato', 'dominos', null], collect($board['leaderboard'])->map(fn ($r) => $r['prize']['key'] ?? null)->all());

        // The college board and the all-time board carry no prizes: a rank there is not a rank on this week's global board.
        $this->assertSame([], $this->getJson('/api/leaderboard?period=all_time')->json('prizes'));
    }

    public function test_a_student_below_the_prize_list_sees_where_they_stand(): void
    {
        $top = $this->readinessStudent();
        $me = $this->readinessStudent();
        $this->finishedContest([$top->id => 300, $me->id => 100], Contest::CONTEST_TYPE_DAILY, 300, $this->ist('2026-11-03 20:00'));
        $this->goLive($this->superadmin(), 'dominos');
        Sanctum::actingAs($me);

        $banner = $this->getJson('/api/weekly-rewards')->json();

        $this->assertSame(2, $banner['my']['rank']);
        $this->assertNull($banner['my']['prize']);
    }

    public function test_taking_a_card_off_removes_it_for_everyone_and_every_change_is_audited(): void
    {
        $admin = $this->superadmin();
        $this->goLive($admin, 'kfc');
        $this->putJson('/api/superadmin/weekly-rewards/kfc', ['live' => true])->assertOk()->assertJsonPath('changed', false);
        $this->putJson('/api/superadmin/weekly-rewards/kfc', ['live' => false])->assertOk()->assertJsonPath('changed', true);

        Sanctum::actingAs($this->readinessStudent());
        $this->getJson('/api/weekly-rewards')->assertJsonPath('live', false);

        $this->assertSame(2, ActivityLog::where('target_type', 'Weekly reward')->count(), 'the repeated click is not logged');
    }

    public function test_a_card_is_live_for_its_week_only(): void
    {
        $this->goLive($this->superadmin(), 'zomato');
        $this->assertTrue(PlatformModule::where('key', 'wr:2026-11-02:zomato')->where('enabled', true)->exists());

        Sanctum::actingAs($this->readinessStudent());
        $this->getJson('/api/weekly-rewards')->assertJsonPath('live', true);

        // Monday 9 Nov, 00:10 IST: a new week, a clean shelf — nothing to reset.
        Carbon::setTestNow(Carbon::parse('2026-11-09 00:10', 'Asia/Kolkata'));
        $this->getJson('/api/weekly-rewards')->assertJsonPath('live', false);
    }

    public function test_the_real_platform_modules_are_untouched_by_reward_switches(): void
    {
        $this->goLive($this->superadmin(), 'zomato', 'dominos');

        $keys = collect($this->getJson('/api/superadmin/platform-modules')->assertOk()->json('modules'))->pluck('key')->all();

        $this->assertSame(['merchant_navy'], $keys);
    }

    public function test_the_superadmin_sees_last_weeks_winners_with_where_to_send_the_vouchers(): void
    {
        $a = $this->readinessStudent(['name' => 'Aarav', 'email' => 'aarav@example.test']);
        $b = $this->readinessStudent(['name' => 'Bina', 'email' => 'bina@example.test']);
        $this->finishedContest([$a->id => 300, $b->id => 100], Contest::CONTEST_TYPE_DAILY, 300, $this->ist('2026-11-03 20:00'));
        $admin = $this->superadmin();
        $this->goLive($admin, 'burger_king', 'dominos');

        // The week turns over; the board and prize list of the week just finished are still there to pay out.
        Carbon::setTestNow(Carbon::parse('2026-11-09 09:00', 'Asia/Kolkata'));
        $panel = $this->getJson('/api/superadmin/weekly-rewards')->assertOk()->json();

        $this->assertSame([], collect($panel['cards'])->where('live', true)->all(), 'this week starts with nothing live');
        $this->assertSame(['Aarav' => 'Burger King', 'Bina' => "Domino's"], collect($panel['last_week']['winners'])->mapWithKeys(fn ($w) => [$w['user']['name'] => $w['prize']['brand']])->all());
        $this->assertSame('aarav@example.test', $panel['last_week']['winners'][0]['email']);
        $this->assertSame('2026-11-02', $panel['last_week']['week']['key']);
    }

    public function test_the_panel_lists_every_card_on_the_shelf_with_its_logo(): void
    {
        Sanctum::actingAs($this->superadmin());
        is_dir(base_path('../frontend/public')) || $this->markTestSkipped('The frontend is not next to this copy of the backend.');

        $cards = collect($this->getJson('/api/superadmin/weekly-rewards')->assertOk()->json('cards'));

        $this->assertEqualsCanonicalizing(['burger_king', 'amazon', 'zomato', 'kfc', 'dominos', 'swiggy', 'starbucks', 'mcdonalds'], $cards->pluck('key')->all());
        $cards->each(fn ($c) => $this->assertFileExists(base_path('../frontend/public'.$c['logo']), "logo for {$c['key']}"));
    }

    public function test_only_a_superadmin_can_switch_cards_and_an_unknown_card_is_a_404(): void
    {
        Sanctum::actingAs($this->readinessStudent());
        $this->putJson('/api/superadmin/weekly-rewards/kfc', ['live' => true])->assertForbidden();
        $this->getJson('/api/superadmin/weekly-rewards')->assertForbidden();

        Sanctum::actingAs($this->superadmin());
        $this->putJson('/api/superadmin/weekly-rewards/pizza_palace', ['live' => true])->assertNotFound();
        $this->putJson('/api/superadmin/weekly-rewards/kfc', [])->assertStatus(422);
    }
}
