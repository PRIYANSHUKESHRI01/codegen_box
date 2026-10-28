<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Plan;
use App\Models\User;
use App\Services\ReadinessScoreService;
use App\Services\SubscriptionService;
use App\Support\AcademicYear;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Who may take the Vault AI Interview, and when.
 *
 *   - a direct AptRun user (no college): straight away;
 *   - a college student: only once BOTH their wait (4th year 45 days, 3rd year 90, from first sign-in) is over AND their readiness
 *     is at least 60; the unlock is then kept;
 *   - 1st / 2nd year: not offered; a student whose college has not filed their year: locked until it does.
 *
 * Readiness is faked: how it is computed is not what is under test, and these tests must not move when its weights do.
 */
class VaultAiAccessTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        Cache::flush();
        $this->seed(PlanSeeder::class);
        $this->travelTo(now()->setDate(2026, 10, 28)->setTime(10, 0));
        $this->fakeReadiness(0);
    }

    /** Every student's readiness is $score until changed again. */
    private function fakeReadiness(int $score): void
    {
        Cache::flush();

        $this->app->instance(ReadinessScoreService::class, new class($score) extends ReadinessScoreService
        {
            public function __construct(private readonly int $fake) {}

            public function compute(iterable $students): array
            {
                $out = [];
                foreach ($students as $s) {
                    $out[$s->id] = [
                        'breakdown' => ['score' => $this->fake, 'tier' => 'In Progress', 'components' => [], 'next_steps' => []],
                        'practice_score' => 0,
                    ];
                }

                return $out;
            }
        });
    }

    private function college(): College
    {
        $n = ++$this->seq;

        return College::create(['name' => "Year College {$n}", 'short_code' => "YC{$n}", 'tier' => 'Standard']);
    }

    /** A college student in `$year` (null = the college has not said), whose first sign-in was `$signedInDaysAgo` days ago. */
    private function collegeStudent(?int $year, ?int $signedInDaysAgo = 0): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $this->college()->id, 'branch' => 'CSE']);
        $student->forceFill([
            'graduation_year' => $year === null ? null : AcademicYear::graduationYearFor($year),
            'first_login_at' => $signedInDaysAgo === null ? null : now()->subDays($signedInDaysAgo),
        ])->save();

        return $student->fresh();
    }

    private function directStudent(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
    }

    private function access(User $student): array
    {
        Sanctum::actingAs($student);

        return $this->getJson('/api/vault-qualification/access')->assertOk()->json('access');
    }

    /** A student on Expert, who has no trial cap on mock interviews - so a start-set refusal can only be the lock. */
    private function onExpert(User $student): User
    {
        $plan = Plan::where('code', Plan::CODE_EXPERT)->firstOrFail();
        app(SubscriptionService::class)->grantIndividualPlan($student, $plan, User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
            'days' => 365, 'kind' => 'complimentary', 'reason' => 'Test',
        ]);

        return $student->fresh();
    }

    // ───────────────────────── direct users ─────────────────────────

    public function test_a_direct_aptrun_user_has_it_open_straight_away_whatever_their_readiness(): void
    {
        $access = $this->access($this->directStudent());

        $this->assertSame('open', $access['state']);
        $this->assertSame('direct', $access['audience']);
        $this->assertNull($access['days_remaining']);
        $this->assertNull($access['readiness']);
    }

    public function test_a_direct_user_can_start_a_set_without_waiting_or_readiness(): void
    {
        Sanctum::actingAs($this->onExpert($this->directStudent()));

        $this->postJson('/api/vault-qualification/start-set', ['stack' => 'laravel', 'set_number' => 1])->assertOk();
    }

    // ───────────────────────── the wait ─────────────────────────

    public function test_a_fourth_year_waits_45_days_and_the_counter_counts_down_a_day_at_a_time(): void
    {
        $student = $this->collegeStudent(4, signedInDaysAgo: 0);
        $this->fakeReadiness(100);

        $access = $this->access($student);
        $this->assertSame('locked', $access['state']);
        $this->assertSame('college', $access['audience']);
        $this->assertSame(4, $access['study_year']);
        $this->assertSame(45, $access['required_days']);
        $this->assertSame(45, $access['days_remaining']);
        $this->assertSame(['waiting_period'], $access['reasons'], 'readiness is fine; only the wait is missing');

        $this->travel(1)->days();
        $this->assertSame(44, $this->access($student)['days_remaining']);

        $this->travel(1)->days();
        $this->assertSame(43, $this->access($student)['days_remaining']);

        $this->travel(42)->days();
        $this->assertSame(1, $this->access($student)['days_remaining']);
    }

    public function test_a_third_year_waits_90_days(): void
    {
        $access = $this->access($this->collegeStudent(3, signedInDaysAgo: 0));

        $this->assertSame('locked', $access['state']);
        $this->assertSame(90, $access['required_days']);
        $this->assertSame(90, $access['days_remaining']);
    }

    public function test_the_counter_runs_from_the_first_sign_in_not_from_the_import(): void
    {
        // Imported 100 days ago, but only signed in for the first time 10 days ago.
        $student = $this->collegeStudent(4, signedInDaysAgo: 10);
        $student->forceFill(['created_at' => now()->subDays(100)])->save();

        $this->assertSame(35, $this->access($student->fresh())['days_remaining']);
    }

    public function test_a_student_who_has_never_signed_in_has_the_whole_wait_ahead(): void
    {
        $access = $this->access($this->collegeStudent(4, signedInDaysAgo: null));

        $this->assertSame('locked', $access['state']);
        $this->assertSame(45, $access['days_remaining']);
        $this->assertNull($access['unlocks_at']);
    }

    // ───────────────────────── readiness ─────────────────────────

    public function test_a_waited_out_student_is_still_locked_below_60_readiness(): void
    {
        $student = $this->collegeStudent(4, signedInDaysAgo: 60);
        $this->fakeReadiness(59);

        $access = $this->access($student);

        $this->assertSame('locked', $access['state']);
        $this->assertSame(['readiness'], $access['reasons']);
        $this->assertSame(0, $access['days_remaining']);
        $this->assertTrue($access['waiting_period_met']);
        $this->assertSame(59, $access['readiness']['score']);
        $this->assertSame(1, $access['readiness']['points_needed']);
        $this->assertFalse($access['readiness']['met']);
    }

    public function test_high_readiness_does_not_skip_the_wait(): void
    {
        $student = $this->collegeStudent(4, signedInDaysAgo: 5);
        $this->fakeReadiness(100);

        $this->assertSame('locked', $this->access($student)['state']);
    }

    public function test_both_conditions_open_it_and_the_unlock_is_kept(): void
    {
        $student = $this->collegeStudent(4, signedInDaysAgo: 45);
        $this->fakeReadiness(60);

        $access = $this->access($student);

        $this->assertSame('open', $access['state']);
        $this->assertSame([], $access['reasons']);
        $this->assertNotNull($student->fresh()->vault_ai_unlocked_at, 'the unlock is written down');
    }

    public function test_readiness_decay_after_unlocking_never_locks_the_student_out_again(): void
    {
        $student = $this->collegeStudent(4, signedInDaysAgo: 50);
        $this->fakeReadiness(72);
        $this->assertSame('open', $this->access($student)['state']);

        $this->fakeReadiness(20);

        $this->assertSame('open', $this->access($student->fresh())['state']);
    }

    public function test_the_readiness_a_student_is_asked_for_is_the_existing_one_untouched(): void
    {
        // The score is only read: asking about access must not change anything about how readiness is held.
        $student = $this->collegeStudent(4, signedInDaysAgo: 60);
        $this->fakeReadiness(75);

        $before = $student->fresh()->only(['college_id', 'graduation_year']);
        $this->access($student);

        $this->assertSame($before, $student->fresh()->only(['college_id', 'graduation_year']));
    }

    // ───────────────────────── years that are not offered ─────────────────────────

    public function test_second_and_first_years_are_not_offered_it(): void
    {
        $this->fakeReadiness(100);

        foreach ([1, 2] as $year) {
            $access = $this->access($this->collegeStudent($year, signedInDaysAgo: 400));

            $this->assertSame('unavailable', $access['state'], "year {$year}");
            $this->assertSame(['year_not_offered'], $access['reasons']);
        }
    }

    public function test_a_student_whose_college_has_not_filed_their_year_is_locked_until_it_does(): void
    {
        $this->fakeReadiness(100);
        $student = $this->collegeStudent(null, signedInDaysAgo: 400);

        $access = $this->access($student);
        $this->assertSame('locked', $access['state']);
        $this->assertSame(['year_not_set'], $access['reasons']);
        $this->assertNull($access['study_year']);
    }

    public function test_a_batch_that_has_passed_out_is_held_to_the_final_years_rule(): void
    {
        $student = $this->collegeStudent(4, signedInDaysAgo: 30);
        $student->forceFill(['graduation_year' => AcademicYear::graduationYearFor(4) - 1])->save();

        $access = $this->access($student->fresh());

        $this->assertGreaterThan(4, $access['study_year']);
        $this->assertSame(45, $access['required_days']);
        $this->assertSame(15, $access['days_remaining']);
    }

    public function test_a_third_year_becomes_a_fourth_year_in_july_and_follows_the_shorter_wait(): void
    {
        $student = $this->collegeStudent(3, signedInDaysAgo: 0);
        $this->assertSame(90, $this->access($student)['required_days']);

        // Eight months later (July 2027) the same record is a 4th year: 45 days, long since served.
        $this->travelTo(now()->setDate(2027, 7, 2));
        $this->fakeReadiness(80);

        $access = $this->access($student->fresh());
        $this->assertSame(4, $access['study_year']);
        $this->assertSame(45, $access['required_days']);
        $this->assertSame('open', $access['state']);
    }

    // ───────────────────────── enforced by the server ─────────────────────────

    public function test_a_locked_student_cannot_start_a_set_even_by_calling_the_api_directly(): void
    {
        $student = $this->onExpert($this->collegeStudent(4, signedInDaysAgo: 3));
        $this->fakeReadiness(90);
        Sanctum::actingAs($student);

        $response = $this->postJson('/api/vault-qualification/start-set', ['stack' => 'laravel', 'set_number' => 1]);

        $response->assertForbidden()->assertJsonPath('code', 'vault_ai_locked')->assertJsonPath('access.days_remaining', 42);
        $this->assertDatabaseCount('interviews', 0);
    }

    public function test_a_locked_student_cannot_read_the_circuit_either(): void
    {
        Sanctum::actingAs($this->collegeStudent(4, signedInDaysAgo: 3));

        $this->getJson('/api/vault-qualification/status?stack=laravel')->assertForbidden()->assertJsonPath('code', 'vault_ai_locked');
    }

    public function test_a_second_year_is_refused_with_a_message_that_says_so(): void
    {
        Sanctum::actingAs($this->collegeStudent(2, signedInDaysAgo: 400));

        $this->getJson('/api/vault-qualification/status?stack=laravel')
            ->assertForbidden()
            ->assertJsonPath('access.state', 'unavailable')
            ->assertJsonPath('message', 'The Vault AI Interview is not available for your year of study.');
    }

    public function test_an_unlocked_college_student_can_start_a_set(): void
    {
        $student = $this->onExpert($this->collegeStudent(4, signedInDaysAgo: 46));
        $this->fakeReadiness(61);
        Sanctum::actingAs($student);

        $this->postJson('/api/vault-qualification/start-set', ['stack' => 'laravel', 'set_number' => 1])->assertOk();
        $this->getJson('/api/vault-qualification/status?stack=laravel')->assertOk();
    }

    public function test_starting_a_set_checks_readiness_afresh_not_from_the_short_cache(): void
    {
        $student = $this->onExpert($this->collegeStudent(4, signedInDaysAgo: 60));
        $this->fakeReadiness(70);
        $this->assertSame('open', $this->access($student)['state'], 'cached as 70 (and kept)');

        // A student who has NOT been kept open yet: drop the kept unlock and let the score fall - starting must see the fall.
        $student->forceFill(['vault_ai_unlocked_at' => null])->save();
        $this->fakeReadiness(40);
        Cache::put("vault-ai-access:readiness:{$student->id}", 70, 120);
        Sanctum::actingAs($student->fresh());

        $this->postJson('/api/vault-qualification/start-set', ['stack' => 'laravel', 'set_number' => 1])->assertForbidden();
    }

    public function test_staff_are_not_students_of_the_circuit(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $this->getJson('/api/vault-qualification/access')->assertForbidden();
    }

    // ───────────────────────── the clock starts at the first sign-in ─────────────────────────

    public function test_the_first_sign_in_is_stamped_once_and_never_moved(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $this->college()->id]);
        $this->assertNull($student->fresh()->first_login_at);

        Sanctum::actingAs($student);
        $this->getJson('/api/me')->assertOk();

        $first = $student->fresh()->first_login_at;
        $this->assertNotNull($first);

        $this->travel(3)->days();
        $this->getJson('/api/me')->assertOk();

        $this->assertTrue($first->equalTo($student->fresh()->first_login_at), 'a later visit does not restart the wait');
    }

    public function test_a_superadmin_viewing_as_the_student_changes_nothing_on_their_record(): void
    {
        $viewer = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        $neverSignedIn = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $this->college()->id]);
        $waitedOut = $this->collegeStudent(4, signedInDaysAgo: 60);
        $this->fakeReadiness(90);

        // The "view as" token the superadmin tools hand out: a real Sanctum token carrying only the impersonation ability.
        $as = fn (User $student) => ['Authorization' => 'Bearer '.$student->createToken(User::IMPERSONATION_TOKEN_PREFIX.$viewer->id, [User::IMPERSONATION_ABILITY])->plainTextToken];

        $this->withHeaders($as($neverSignedIn))->getJson('/api/me')->assertOk();
        $this->assertNull($neverSignedIn->fresh()->first_login_at, "looking at someone's account does not start their wait");

        $this->app['auth']->forgetGuards(); // the guard remembers the first request's user for the rest of the test

        $this->withHeaders($as($waitedOut))->getJson('/api/vault-qualification/access')->assertOk()->assertJsonPath('access.state', 'open');
        $this->assertNull($waitedOut->fresh()->vault_ai_unlocked_at, 'nor does it keep an unlock for them');
    }

    public function test_a_student_cannot_move_themselves_up_a_year(): void
    {
        $student = User::make(['name' => 'X', 'email' => 'x@example.test', 'graduation_year' => 2027, 'first_login_at' => now(), 'vault_ai_unlocked_at' => now()]);

        $this->assertNull($student->graduation_year);
        $this->assertNull($student->first_login_at);
        $this->assertNull($student->vault_ai_unlocked_at);
    }

    // ───────────────────────── the readiness score is kept on the student ─────────────────────────

    public function test_checking_access_leaves_the_students_readiness_on_them_for_filtering(): void
    {
        $student = $this->collegeStudent(4, signedInDaysAgo: 5);
        $this->fakeReadiness(47);
        $this->assertNull($student->fresh()->readiness_score);

        $this->access($student);

        $fresh = $student->fresh();
        $this->assertSame(47, $fresh->readiness_score);
        $this->assertNotNull($fresh->readiness_scored_at);
    }

    public function test_the_stored_readiness_follows_every_scoring_pass_and_is_written_only_when_it_changes(): void
    {
        $student = $this->collegeStudent(4, signedInDaysAgo: 5);
        $vault = app(\App\Services\Vault\VaultService::class);
        $breakdown = fn (int $score) => ['score' => $score, 'tier' => 'In Progress', 'components' => []];

        $vault->applyReadiness($student, $breakdown(45));
        $firstStamp = $student->fresh()->readiness_scored_at;
        $this->assertSame(45, $student->fresh()->readiness_score);

        $this->travel(2)->hours();
        $vault->applyReadiness($student, $breakdown(45));
        $this->assertTrue($firstStamp->equalTo($student->fresh()->readiness_scored_at), 'the same score is not written again');

        $vault->applyReadiness($student, $breakdown(52));
        $this->assertSame(52, $student->fresh()->readiness_score);
        $this->assertTrue($student->fresh()->readiness_scored_at->gt($firstStamp));
    }

    public function test_storing_a_score_is_bookkeeping_and_does_not_touch_the_record(): void
    {
        $student = $this->collegeStudent(4, signedInDaysAgo: 5);
        $updatedAt = $student->fresh()->updated_at;
        $this->travel(1)->hours();

        app(\App\Services\ScoreLedger::class)->readiness($student->id, 66);
        app(\App\Services\ScoreLedger::class)->vaultAi($student->id, 71.5);

        $fresh = $student->fresh();
        $this->assertSame(66, $fresh->readiness_score);
        $this->assertEquals(71.5, $fresh->vault_ai_score);
        $this->assertTrue($updatedAt->equalTo($fresh->updated_at));
    }

    public function test_scores_are_kept_within_0_to_100(): void
    {
        $student = $this->collegeStudent(4, signedInDaysAgo: 5);

        app(\App\Services\ScoreLedger::class)->readiness($student->id, 140);
        app(\App\Services\ScoreLedger::class)->vaultAi($student->id, -5);

        $this->assertSame(100, $student->fresh()->readiness_score);
        $this->assertEquals(0.0, $student->fresh()->vault_ai_score);
    }
}
