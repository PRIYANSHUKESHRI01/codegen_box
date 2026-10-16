<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Hackathon;
use App\Models\Interview;
use App\Models\PaymentOrder;
use App\Models\Plan;
use App\Models\Problem;
use App\Models\Subscription;
use App\Models\User;
use App\Models\VocabularyAttempt;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\Concerns\FakesRazorpay;
use Tests\TestCase;

/**
 * "Free students get the free tier, paying students get what they paid for — and nothing else."
 *
 * Every student here gets onto their plan the only way a real one can: through the Razorpay purchase
 * flow (open checkout → pay at the fake gateway → verify) — or, for Grandmaster (Mellow Academy), which is
 * never sold online, through the superadmin's grant — never by writing a subscription row. They are
 * then probed through the real endpoints, one per gated feature:
 *
 *   practice problems a day · AI mock interviews · the Learning Centre's AI features · placement drives ·
 *   Hack Arena · the Vault · Project Lab
 *
 * and the same probes are re-run after the things that must take access away: a payment that never
 * completed, a refund, and a plan that ran out.
 *
 * What each plan is allowed (the matrix that ships — PlanSeeder):
 *
 *   Coder        1 problem a day · ONE free try of each AI feature, ever · nothing else
 *   Expert       everything: unlimited problems · 10 interviews a day · AI features unlimited · placement
 *                drives · Hack Arena · the Vault · Project Lab
 *   Grandmaster  Mellow Academy: the same access for three years, granted by the team
 *
 * The Vault (being hired through Mellow Vault) needs Expert or Grandmaster for individual students. Earning the
 * readiness score is open to everyone; only joining is gated, so the probe is the consent endpoint.
 */
class PaidAccessEndToEndTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use FakesRazorpay;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->setUpRazorpay();
        Mail::fake();

        // The judge throttles submissions per minute (10); these probes hit the DAILY plan limit, not that one.
        config(['judge.rate_limits.submit_per_minute' => 1000]);
        config(['piston.nodes' => [['url' => 'http://piston-test:2000', 'slots' => 8]]]);
        Http::fake(['piston-test:2000/*' => Http::response([
            'run' => ['stdout' => "1\n", 'stderr' => '', 'code' => 0, 'signal' => null, 'cpu_time' => 5, 'memory' => 1024],
            'compile' => null,
        ])]);
    }

    // ───────────────────────────── the matrix ─────────────────────────────

    /** @return array<string, array{0: string, 1: array<string, mixed>}> */
    public static function plans(): array
    {
        return [
            'Coder (free)' => ['coder', [
                'arena' => false, 'vault' => false, 'lab' => false, 'drives' => false,
                'problems_a_day' => 1, 'interviews' => 1, 'ai_trial_limited' => true,
            ]],
            'Expert' => ['expert', [
                'arena' => true, 'vault' => true, 'lab' => true, 'drives' => true,
                'problems_a_day' => null, 'interviews' => 10, 'ai_trial_limited' => false,
            ]],
            'Grandmaster (Mellow Academy)' => ['grandmaster', [
                'arena' => true, 'vault' => true, 'lab' => true, 'drives' => true,
                'problems_a_day' => null, 'interviews' => 10, 'ai_trial_limited' => false,
            ]],
        ];
    }

    /** @param array<string, mixed> $expected */
    #[DataProvider('plans')]
    public function test_a_student_gets_exactly_the_features_of_the_plan_they_hold(string $plan, array $expected): void
    {
        $student = $this->studentOn($plan);

        $this->assertSame($expected['arena'], $this->canRegisterForAHackathon(), 'Hack Arena');
        $this->assertSame($expected['vault'], $this->canJoinTheVault(), 'the Vault');
        $this->assertSame($expected['lab'], $this->canStartAProjectLabProject(), 'Project Lab');
        $this->assertSame($expected['drives'], $this->placementDrivesAreOpen(), 'placement drives');
        $this->assertSame($expected['ai_trial_limited'], $this->aiVocabularyQuizIsRefusedAfterOneTry($student), 'one-time AI try');

        // Daily limits, probed by actually hitting them.
        $this->assertSame(
            $expected['problems_a_day'] ?? 12,
            $this->distinctProblemsAcceptedInADay(limit: 12),
            'practice problems a day'
        );
        $this->assertSame($expected['interviews'], $this->mockInterviewsAcceptedInADay(limit: 12), 'AI mock interviews');

        // And what the UI is told matches what the server just enforced.
        $this->getJson('/api/me/subscription')->assertOk()
            ->assertJsonPath('coverage.plan.code', $plan)
            ->assertJsonPath('entitlements.max_practice_problems_per_day', $expected['problems_a_day'])
            ->assertJsonPath('entitlements.hackathon_access', $expected['arena'])
            ->assertJsonPath('entitlements.vault_access', $expected['vault'])
            ->assertJsonPath('project_lab.enabled', $expected['lab']);
    }

    // ───────────────────────────── a payment that does not complete buys nothing ─────────────────────────────

    public function test_every_way_a_payment_can_fail_leaves_the_student_on_the_free_tier(): void
    {
        $student = $this->collegeStudent();
        Sanctum::actingAs($student);

        // 1. Opened the checkout and walked away.
        $this->openCheckout('expert')->assertCreated();
        $this->assertLockedToTheFreeTier();

        // 2. Paid, but the callback is forged.
        $paid = $this->payFor($student, 'expert');
        $forged = $paid['callback'];
        $forged['razorpay_signature'] = str_repeat('0', 64);
        $this->postJson('/api/me/checkout/verify', $forged)->assertStatus(422);
        $this->assertLockedToTheFreeTier();

        // 3. A declined card.
        $declined = $this->razorpay->fail($this->razorpay->lastOrderId());
        $this->postJson('/api/me/checkout/verify', $this->razorpay->callback($declined))->assertStatus(409);
        $this->assertLockedToTheFreeTier();

        // 4. An under-payment.
        $short = $this->payFor($student, 'expert', ['amount' => 100]);
        $this->postJson('/api/me/checkout/verify', $short['callback'])->assertStatus(409);
        $this->assertLockedToTheFreeTier();

        // 5. A signed webhook from Razorpay for a payment that was only `created`, not paid.
        $unpaid = $this->payFor($student, 'expert', ['status' => 'created', 'captured' => false]);
        $this->deliverWebhook('payment.captured', ['payment' => ['status' => 'captured'] + $unpaid['payment']])->assertOk();
        $this->assertLockedToTheFreeTier();

        // The same student then pays properly — and the Expert tier opens.
        Sanctum::actingAs($student);
        $this->purchaseThroughRazorpay($student, 'expert');
        $this->assertSame('expert', $student->fresh()->activeSubscription()->plan->code);
        $this->assertTrue($this->canRegisterForAHackathon(), 'Expert includes the Hack Arena');
        $this->assertTrue($this->placementDrivesAreOpen());
    }

    public function test_an_unconfigured_gateway_cannot_be_used_to_get_a_paid_plan_for_free(): void
    {
        $this->setUpRazorpay(configured: false);
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->openCheckout('expert')->assertStatus(503);
        $this->postJson('/api/me/subscription', ['plan_code' => 'expert'])->assertStatus(405);
        $this->postJson('/api/me/checkout/verify', ['razorpay_order_id' => 'order_x', 'razorpay_payment_id' => 'pay_x', 'razorpay_signature' => 'sig'])->assertStatus(404);

        $this->assertLockedToTheFreeTier();
    }

    // ───────────────────────────── upgrade, refund, expiry ─────────────────────────────

    public function test_paying_opens_exactly_what_was_bought_and_a_refund_closes_it_again(): void
    {
        $student = $this->collegeStudent();
        Sanctum::actingAs($student);

        $this->assertLockedToTheFreeTier();

        // Free → Expert
        $expert = $this->purchaseThroughRazorpay($student, 'expert');
        $this->assertTrue($this->placementDrivesAreOpen());
        $this->assertTrue($this->canRegisterForAHackathon());
        $this->assertTrue($this->canStartAProjectLabProject());
        $this->assertTrue($this->canJoinTheVault());

        // Finance refunds the Expert payment: everything it opened closes at once, no waiting for a job.
        $this->deliverWebhook('refund.processed', ['refund' => [
            'id' => 'rfnd_E2E00001', 'payment_id' => $expert->gateway_payment_id, 'amount' => $expert->amount_paise, 'notes' => [],
        ]])->assertOk();

        Sanctum::actingAs($student->fresh());
        $this->assertFalse($this->placementDrivesAreOpen());
        $this->assertFalse($this->canRegisterForAHackathon());
        $this->assertFalse($this->canStartAProjectLabProject());
        $this->assertFalse($this->canJoinTheVault(), 'the Vault closes with the refunded plan');
        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code, 'back on the free plan');
        $this->assertSame(PaymentOrder::STATUS_REFUNDED, $expert->refresh()->status);
    }

    public function test_a_paid_plan_stops_granting_paid_features_the_moment_it_ends_even_if_the_expiry_job_never_runs(): void
    {
        $student = $this->studentOn('expert');
        $this->assertTrue($this->canRegisterForAHackathon());
        $this->assertTrue($this->canStartAProjectLabProject());

        // The year ends. The nightly `subscriptions:expire` has NOT run (the host's cron is down, or it is 00:01):
        // the row still says `active`, only its end date has passed.
        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'expert'))
            ->update(['current_period_end' => now()->subMinute()]);

        Sanctum::actingAs($student->fresh());
        $this->assertFalse($this->canRegisterForAHackathon(), 'Hack Arena closes');
        $this->assertFalse($this->canStartAProjectLabProject(), 'Project Lab closes');
        $this->assertFalse($this->canJoinTheVault(), 'the Vault closes');
        $this->assertFalse($this->placementDrivesAreOpen(), 'drives close');
        $this->assertSame(1, $this->distinctProblemsAcceptedInADay(limit: 3), 'back to one problem a day');

        $entitlements = $student->fresh()->effectiveEntitlements();
        $this->assertSame(1, $entitlements['max_practice_problems_per_day']);
        $this->assertSame(1, $entitlements['feature_trial_uses']);
        $this->getJson('/api/me/subscription')->assertOk()->assertJsonPath('coverage.days_remaining', 0);
    }

    public function test_the_expiry_job_and_the_date_check_agree(): void
    {
        $student = $this->studentOn('expert');
        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'expert'))
            ->update(['current_period_end' => now()->subDay()]);

        $this->artisan('subscriptions:expire')->assertSuccessful();

        Sanctum::actingAs($student->fresh());
        $this->assertFalse($this->placementDrivesAreOpen());
        $this->assertSame(1, $this->distinctProblemsAcceptedInADay(limit: 3));
    }

    public function test_a_student_can_buy_again_after_their_plan_ended_and_gets_everything_back(): void
    {
        $student = $this->studentOn('expert');
        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'expert'))
            ->update(['current_period_end' => now()->subDay(), 'status' => Subscription::STATUS_EXPIRED]);

        Sanctum::actingAs($student->fresh());
        $this->assertFalse($this->canRegisterForAHackathon());

        $this->purchaseThroughRazorpay($student->fresh(), 'expert');

        $this->assertTrue($this->canRegisterForAHackathon());
        $this->assertTrue($this->canStartAProjectLabProject());
    }

    // ───────────────────────────── the page and the server tell the same story ─────────────────────────────

    public function test_the_public_pricing_numbers_are_the_numbers_the_server_enforces(): void
    {
        $plans = collect($this->getJson('/api/public/plans')->assertOk()->json('plans'))->keyBy('code');

        foreach (['coder', 'expert', 'grandmaster'] as $code) {
            $entitlements = $plans[$code]['entitlements'];
            $plan = Plan::where('code', $code)->firstOrFail();

            $this->assertSame($plan->max_practice_problems_per_day, $entitlements['practice_problems_per_day'], "{$code}: problems a day");
            $this->assertSame($plan->max_mock_interviews_per_day, $entitlements['mock_interviews_per_day'], "{$code}: interviews a day");
            $this->assertSame((bool) $plan->hackathon_access, $entitlements['hackathon_access'], "{$code}: Hack Arena");
            $this->assertSame((bool) $plan->project_lab_access, $entitlements['project_lab_access'], "{$code}: Project Lab");
            $this->assertSame((bool) $plan->drive_access, $entitlements['drive_access'], "{$code}: drives");
        }

        // What a student is charged is what the page shows.
        $student = $this->student();
        Sanctum::actingAs($student);
        $this->openCheckout('expert', expectedTotal: $plans['expert']['sale_price'])->assertCreated()
            ->assertJsonPath('checkout.amount', $plans['expert']['sale_price'] * 100);

        // …and Grandmaster, which the page shows without a price, cannot be bought here at any price.
        $this->assertTrue($plans['grandmaster']['contact_only']);
        $this->openCheckout('grandmaster')->assertStatus(422);
        $this->openCheckout('grandmaster', expectedTotal: 0)->assertStatus(422);
        $this->assertSame('coder', $student->fresh()->activeSubscription()->plan->code);
    }

    // ───────────────────────────── probes ─────────────────────────────

    /**
     * A free-plan student at a college with no plan of its own, so their individual plan is what governs
     * them (and placement drives, which are per college, can be probed at all).
     */
    private function collegeStudent(): User
    {
        $college = College::create(['name' => 'Probe College', 'short_code' => 'PRB'.random_int(100, 999), 'tier' => 'Standard']);

        return $this->student(['college_id' => $college->id]);
    }

    /** A student on `$plan`, put there through the purchase flow. Leaves them as the acting user. */
    private function studentOn(string $plan): User
    {
        $student = $this->collegeStudent();

        if ($plan === Plan::CODE_GRANDMASTER) {
            // Never sold online: the team enrols the student and the superadmin grants the plan.
            $granted = Plan::where('code', $plan)->firstOrFail();
            app(\App\Services\SubscriptionService::class)->grantIndividualPlan($student, $granted, User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
                'days' => (int) $granted->duration_days,
                'kind' => 'complimentary',
                'reason' => 'Test: enrolled in Mellow Academy',
            ]);
        } elseif ($plan !== 'coder') {
            $this->purchaseThroughRazorpay($student, $plan);
        }

        Sanctum::actingAs($student->fresh());

        return $student->fresh();
    }

    private function assertLockedToTheFreeTier(): void
    {
        $this->assertFalse($this->canRegisterForAHackathon(), 'Hack Arena must be locked');
        $this->assertFalse($this->canStartAProjectLabProject(), 'Project Lab must be locked');
        $this->assertFalse($this->placementDrivesAreOpen(), 'placement drives must be locked');
        $this->getJson('/api/me/subscription')->assertOk()->assertJsonPath('coverage.plan.code', 'coder');
    }

    /** Registers for a brand-new hackathon; false only when the PLAN refused (402 plan_required). */
    private function canRegisterForAHackathon(): bool
    {
        $hackathon = Hackathon::create([
            'slug' => 'hack-'.uniqid(), 'title' => 'Probe Hackathon', 'tagline' => 'x', 'description' => str_repeat('A real description. ', 5),
            'accent' => 'indigo', 'themes' => ['AI'], 'mode' => Hackathon::MODE_ONLINE, 'host_type' => Hackathon::HOST_PLATFORM,
            'status' => Hackathon::STATUS_PUBLISHED, 'published_at' => now()->subDay(),
            'registration_opens_at' => now()->subDays(5), 'registration_closes_at' => now()->addDay(),
            'starts_at' => now()->addDays(2), 'ends_at' => now()->addDays(4),
            'min_team_size' => 1, 'max_team_size' => 4, 'prize_pool_amount' => 1000, 'currency' => 'INR', 'prizes' => [],
        ]);

        return $this->refusedByPlan($this->postJson("/api/arena/hackathons/{$hackathon->slug}/register", ['mode' => 'solo']), 'hackathons') === false;
    }

    /** Whether the plan lets the student say yes to the Vault (a refusal is the 402 `plan_required` for feature `vault`). */
    private function canJoinTheVault(): bool
    {
        return $this->refusedByPlan($this->postJson('/api/me/vault/consent'), 'vault') === false
            && $this->getJson('/api/me/vault')->status() === 200;
    }

    private function canStartAProjectLabProject(): bool
    {
        $topic = $this->topic();
        $response = $this->postJson("/api/project-lab/topics/{$topic->slug}/start");

        if ($response->status() === 402) {
            $response->assertJsonPath('code', 'project_lab_required');

            return false;
        }

        $response->assertSuccessful();

        return true;
    }

    private function placementDrivesAreOpen(): bool
    {
        return (bool) $this->getJson('/api/drives')->assertOk()->json('drive_access');
    }

    /** True when the free plan's one try at the AI vocabulary quiz is spent and a second is refused (402 trial_used). */
    private function aiVocabularyQuizIsRefusedAfterOneTry(User $student): bool
    {
        VocabularyAttempt::create(['user_id' => $student->id, 'kind' => 'custom', 'topic' => 'x', 'difficulty' => 'beginner', 'questions' => []]);

        $response = $this->postJson('/api/learning-centre/vocabulary/generate', ['topic' => 'work', 'difficulty' => 'beginner']);

        if ($response->status() === 402) {
            $response->assertJsonPath('code', 'trial_used')->assertJsonPath('feature', 'vocabulary_quiz');

            return true;
        }

        // Past the plan gate (the quiz generator itself is not configured in tests): anything but a plan refusal.
        $this->assertNotSame(402, $response->status());

        return false;
    }

    /** Submits distinct problems until the plan says stop (402), up to `$limit`; returns how many were accepted. */
    private function distinctProblemsAcceptedInADay(int $limit): int
    {
        $accepted = 0;

        for ($i = 0; $i < $limit; $i++) {
            $problem = $this->problem('probe-'.uniqid());
            $response = $this->postJson("/api/problems/{$problem->slug}/submit", ['language' => 'python', 'code' => 'pass']);

            if ($response->status() === 402) {
                return $accepted;
            }

            $response->assertOk();
            $accepted++;
        }

        return $accepted;
    }

    private function mockInterviewsAcceptedInADay(int $limit): int
    {
        $accepted = 0;

        for ($i = 0; $i < $limit; $i++) {
            $interview = Interview::create([
                'title' => "Probe {$i}", 'slug' => Interview::uniqueSlug("Probe {$i}".uniqid()), 'status' => Interview::STATUS_PUBLISHED,
                'interview_type' => Interview::INTERVIEW_TYPE_GENERAL, 'is_mock' => true,
            ]);

            $response = $this->postJson("/api/interviews/{$interview->slug}/start");

            if ($response->status() === 402) {
                return $accepted;
            }

            $response->assertOk();
            $accepted++;
        }

        return $accepted;
    }

    /** True when the response is the plan gate's refusal for `$feature`. */
    private function refusedByPlan(\Illuminate\Testing\TestResponse $response, string $feature): bool
    {
        if ($response->status() === 402) {
            $response->assertJsonPath('code', 'plan_required')->assertJsonPath('feature', $feature);

            return true;
        }

        $response->assertSuccessful();

        return false;
    }

    private function problem(string $slug): Problem
    {
        $problem = Problem::create([
            'slug' => $slug, 'title' => $slug, 'difficulty' => 'easy', 'tags' => [], 'description' => 'A problem.',
            'function_name' => 'solve', 'params' => [['name' => 'n', 'type' => 'integer']], 'return_type' => 'integer',
            'comparison_mode' => Problem::COMPARISON_EXACT, 'display_order' => 1,
        ]);
        $problem->testCases()->create(['inputs' => ['n' => 1], 'expected_output' => 1, 'is_sample' => true, 'display_order' => 0]);

        return $problem;
    }
}
