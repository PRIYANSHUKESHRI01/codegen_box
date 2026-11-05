<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanyPrepQuestion;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\PlatformModule;
use App\Models\User;
use App\Services\WeeklyRewardService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * GET /api/public/landing — every fact the marketing page quotes. It is unauthenticated, so the tests are as much about what it must NOT
 * say (a student's name, a number that undersells the product) as about what it does.
 *
 * "Now" is Wednesday 4 Nov 2026, noon IST: this week is Monday 2 Nov to Sunday 8 Nov.
 */
class PublicLandingTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-04 12:00', 'Asia/Kolkata'));
        Cache::flush();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function company(string $name, int $questions, bool $active = true): Company
    {
        $company = Company::create(['name' => $name, 'slug' => str($name)->slug()->toString(), 'industry' => 'IT Services', 'is_active' => $active]);

        for ($i = 0; $i < $questions; $i++) {
            CompanyPrepQuestion::create(['company_id' => $company->id, 'asked_year' => 2025, 'category' => 'Technical', 'question' => "Q{$i}", 'display_order' => $i]);
        }

        return $company;
    }

    public function test_it_is_public_and_states_the_rules_the_page_quotes_from_the_settings_that_enforce_them(): void
    {
        config(['vault.enter_score' => 65]);

        $this->getJson('/api/public/landing')
            ->assertOk()
            ->assertJsonPath('policy.vault_bar', 65)
            ->assertJsonPath('policy.daily.name', 'AptRun Daily Challenge')
            ->assertJsonPath('policy.daily.start_label', '8:00 PM IST')
            ->assertJsonPath('policy.daily.duration_minutes', 60)
            ->assertJsonPath('policy.daily.problems', 3)
            ->assertJsonPath('policy.daily.points', 600)
            ->assertJsonPath('policy.week.resets_on', 'Monday');
    }

    public function test_it_may_be_cached_for_a_minute_by_a_cdn_or_the_browser(): void
    {
        $cache = $this->getJson('/api/public/landing')->assertOk()->headers->get('Cache-Control');

        $this->assertStringContainsString('public', $cache);
        $this->assertStringContainsString('s-maxage=60', $cache);
    }

    public function test_depth_numbers_are_the_real_catalogue_and_only_companies_with_a_prep_pack_count(): void
    {
        foreach (['easy', 'medium', 'hard'] as $difficulty) {
            $this->makeProblem($difficulty);
        }
        $this->company('Alpha Systems', 4);
        $this->company('Beta Labs', 2);
        $this->company('No Pack Ltd', 0);
        $this->company('Dormant Co', 5, active: false);

        $res = $this->getJson('/api/public/landing')->assertOk();

        $res->assertJsonPath('stats.depth.problems', 3)
            ->assertJsonPath('stats.depth.company_packs', 2)
            ->assertJsonPath('stats.depth.company_questions', 6);
        $this->assertSame(['Alpha Systems', 'Beta Labs'], collect($res->json('companies'))->pluck('name')->all());
        $this->assertGreaterThan(0, $res->json('stats.depth.departments'));
        $this->assertGreaterThan(0, $res->json('stats.depth.branches'));
    }

    public function test_adoption_numbers_stay_null_until_they_are_worth_printing(): void
    {
        User::factory()->count(3)->create(['role' => User::ROLE_USER]);

        // Under the default floors a handful of students must not be advertised.
        $this->getJson('/api/public/landing')
            ->assertOk()
            ->assertJsonPath('stats.adoption.students', null)
            ->assertJsonPath('stats.adoption.colleges', null)
            ->assertJsonPath('stats.adoption.contests_held', null)
            ->assertJsonPath('stats.adoption.solutions_judged', null)
            ->assertJsonPath('stats.adoption.vouchers_sent', null);

        // Past the floor the real count is printed, exactly.
        Cache::flush();
        config(['landing.floors.students' => 3]);
        $this->getJson('/api/public/landing')->assertOk()->assertJsonPath('stats.adoption.students', 3);
    }

    public function test_a_week_with_no_voucher_on_offer_says_so_but_still_shows_the_shelf(): void
    {
        $res = $this->getJson('/api/public/landing')->assertOk();

        $res->assertJsonPath('rewards.live', false)->assertJsonPath('rewards.prizes', [])->assertJsonPath('rewards.week.key', '2026-11-02');
        $this->assertContains('Domino\'s', collect($res->json('rewards.shelf'))->pluck('brand')->all());
        $this->assertSame(count(config('weekly_rewards.cards')), count($res->json('rewards.shelf')));
    }

    public function test_the_vouchers_the_superadmin_put_live_are_the_ones_the_page_shows_biggest_first(): void
    {
        foreach (['dominos', 'burger_king'] as $card) {
            PlatformModule::create(['key' => "wr:2026-11-02:{$card}", 'enabled' => true]);
        }

        $res = $this->getJson('/api/public/landing')->assertOk();

        $res->assertJsonPath('rewards.live', true)
            ->assertJsonPath('rewards.prizes.0.rank', 1)
            ->assertJsonPath('rewards.prizes.0.brand', 'Burger King')
            ->assertJsonPath('rewards.prizes.0.amount', 499)
            ->assertJsonPath('rewards.prizes.1.brand', "Domino's")
            ->assertJsonPath('rewards.week.resets_at', Carbon::parse('2026-11-09 00:00', 'Asia/Kolkata')->utc()->toIso8601String());
    }

    public function test_next_weeks_lineup_is_shown_once_the_superadmin_has_chosen_it(): void
    {
        $this->getJson('/api/public/landing')->assertOk()->assertJsonPath('rewards.next', null);

        PlatformModule::create(['key' => 'wr:2026-11-09:amazon', 'enabled' => true]);
        Cache::flush();

        $res = $this->getJson('/api/public/landing')->assertOk();

        // this week still has nothing on offer; next week has Amazon, and says when it starts
        $res->assertJsonPath('rewards.live', false)
            ->assertJsonPath('rewards.next.week.key', '2026-11-09')
            ->assertJsonPath('rewards.next.prizes.0.brand', 'Amazon')
            ->assertJsonPath('rewards.next.prizes.0.rank', 1);
        $this->assertSame(Carbon::parse('2026-11-09 00:00', 'Asia/Kolkata')->utc()->toIso8601String(), Carbon::parse($res->json('rewards.next.week.starts_at'))->utc()->toIso8601String());
    }

    public function test_without_an_edition_on_the_calendar_it_names_the_slot_tonights_will_take(): void
    {
        $res = $this->getJson('/api/public/landing')->assertOk();

        $res->assertJsonPath('contest.is_live', false)->assertJsonPath('contest.registration', null);
        $this->assertSame(Carbon::parse('2026-11-04 20:00', 'Asia/Kolkata')->utc()->toIso8601String(), Carbon::parse($res->json('contest.start_at'))->utc()->toIso8601String());
        $this->assertStringContainsString('AptRun Daily Challenge', $res->json('contest.title'));
    }

    public function test_it_reports_the_real_edition_with_its_registration_state(): void
    {
        $start = Carbon::parse('2026-11-04 20:00', 'Asia/Kolkata');
        $edition = Contest::create([
            'title' => 'AptRun Daily Challenge — 04 Nov 2026', 'slug' => 'aptrun-daily-challenge-2026-11-04', 'start_at' => $start->copy()->utc(), 'end_at' => $start->copy()->addHour()->utc(),
            'is_rated' => true, 'status' => Contest::STATUS_PUBLISHED, 'contest_type' => Contest::CONTEST_TYPE_DAILY, 'daily_key' => '2026-11-04',
        ]);
        foreach (User::factory()->count(2)->create(['role' => User::ROLE_USER]) as $student) {
            ContestParticipant::create(['contest_id' => $edition->id, 'user_id' => $student->id, 'registered_at' => now()]);
        }

        $res = $this->getJson('/api/public/landing')->assertOk();

        $res->assertJsonPath('contest.title', 'AptRun Daily Challenge — 04 Nov 2026')->assertJsonPath('contest.registration', 'open');
        // Two students in the room is not a number to print.
        $res->assertJsonPath('contest.registered', null);

        Cache::flush();
        config(['landing.floors.registered_tonight' => 2]);
        $this->getJson('/api/public/landing')->assertOk()->assertJsonPath('contest.registered', 2);
    }

    public function test_it_never_carries_a_student_s_name_email_or_college(): void
    {
        $student = $this->readinessStudent(['name' => 'Zainab Quasimodo', 'email' => 'zainab.q@leak.test']);
        $finished = $this->finishedContest([$student->id => 300]);
        PlatformModule::create(['key' => 'wr:2026-11-02:dominos', 'enabled' => true]);
        $this->assertNotNull($finished);

        $body = $this->getJson('/api/public/landing')->assertOk()->getContent();

        $this->assertStringNotContainsString('Zainab', $body);
        $this->assertStringNotContainsString('leak.test', $body);
    }

    public function test_one_block_failing_leaves_the_rest_of_the_page_standing(): void
    {
        $this->mock(WeeklyRewardService::class)->shouldReceive('prizes')->andThrow(new \RuntimeException('the ledger is down'));

        $res = $this->getJson('/api/public/landing')->assertOk();

        $this->assertNull($res->json('rewards'));
        $this->assertNotNull($res->json('contest'));
        $this->assertNotNull($res->json('stats'));
        $this->assertSame(60, $res->json('policy.vault_bar'));
    }
}
