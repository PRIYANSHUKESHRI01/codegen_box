<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\Plan;
use App\Models\Problem;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the plan-tier entitlement gates — the first feature-gating logic
 * this app has ever had (confirmed greenfield by audit). Each test builds
 * its own Plan rows directly rather than relying on PlanSeeder (tests don't
 * auto-seed), so the exact limits under test are explicit in the test itself.
 */
class SubscriptionEntitlementTest extends TestCase
{
    use RefreshDatabase;

    private function plan(array $overrides = []): Plan
    {
        return Plan::create(array_merge([
            'code' => 'test-plan-'.uniqid(),
            'name' => 'Test Plan',
            'audience' => Plan::AUDIENCE_INDIVIDUAL,
            'monthly_price' => 0,
            'annual_price' => 0,
            'duration_days' => null,
            'is_active' => true,
            'sort_order' => 1,
        ], $overrides));
    }

    private function studentOnPlan(Plan $plan): User
    {
        $user = User::factory()->create(['role' => User::ROLE_USER]);
        Subscription::create([
            'subscriber_type' => User::class,
            'subscriber_id' => $user->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'started_at' => now(),
            'current_period_end' => null,
            'auto_renew' => false,
        ]);

        return $user;
    }

    private function problem(string $slug): Problem
    {
        $problem = Problem::create([
            'slug' => $slug,
            'title' => $slug,
            'difficulty' => 'easy',
            'tags' => [],
            'description' => 'A problem.',
            'function_name' => 'solve',
            'params' => [['name' => 'n', 'type' => 'integer']],
            'return_type' => 'integer',
            'comparison_mode' => Problem::COMPARISON_EXACT,
            'display_order' => 1,
        ]);
        $problem->testCases()->create(['inputs' => ['n' => 1], 'expected_output' => 1, 'is_sample' => true, 'display_order' => 0]);

        return $problem;
    }

    private function fakePiston(): void
    {
        config(['piston.nodes' => [['url' => 'http://piston-test:2000', 'slots' => 8]]]);
        Http::fake(['piston-test:2000/*' => Http::response([
            'run' => ['stdout' => "1\n", 'stderr' => '', 'code' => 0, 'signal' => null, 'cpu_time' => 5, 'memory' => 1024],
            'compile' => null,
        ])]);
    }

    private function mockInterview(string $title): Interview
    {
        return Interview::create([
            'title' => $title,
            'slug' => Interview::uniqueSlug($title),
            'status' => Interview::STATUS_PUBLISHED,
            'interview_type' => Interview::INTERVIEW_TYPE_GENERAL,
            'is_mock' => true,
        ]);
    }

    // --------------------------------------------------------- practice

    public function test_a_free_plan_student_is_blocked_from_a_second_distinct_problem_the_same_day(): void
    {
        $this->fakePiston();
        $plan = $this->plan(['max_practice_problems_per_day' => 1]);
        $student = $this->studentOnPlan($plan);
        $problemA = $this->problem('problem-a');
        $problemB = $this->problem('problem-b');

        Sanctum::actingAs($student);
        $this->postJson("/api/problems/{$problemA->slug}/submit", ['language' => 'python', 'code' => 'pass'])
            ->assertStatus(200);

        $blocked = $this->postJson("/api/problems/{$problemB->slug}/submit", ['language' => 'python', 'code' => 'pass']);
        $blocked->assertStatus(402);
    }

    public function test_a_free_plan_student_can_resubmit_the_same_problem_unlimited_times(): void
    {
        $this->fakePiston();
        $plan = $this->plan(['max_practice_problems_per_day' => 1]);
        $student = $this->studentOnPlan($plan);
        $problem = $this->problem('problem-a');

        Sanctum::actingAs($student);
        $this->postJson("/api/problems/{$problem->slug}/submit", ['language' => 'python', 'code' => 'pass'])->assertStatus(200);
        $this->postJson("/api/problems/{$problem->slug}/submit", ['language' => 'python', 'code' => 'pass'])->assertStatus(200);
    }

    public function test_unlimited_practice_plan_is_never_blocked(): void
    {
        $this->fakePiston();
        $plan = $this->plan(['max_practice_problems_per_day' => null]);
        $student = $this->studentOnPlan($plan);
        $problemA = $this->problem('problem-a');
        $problemB = $this->problem('problem-b');

        Sanctum::actingAs($student);
        $this->postJson("/api/problems/{$problemA->slug}/submit", ['language' => 'python', 'code' => 'pass'])->assertStatus(200);
        $this->postJson("/api/problems/{$problemB->slug}/submit", ['language' => 'python', 'code' => 'pass'])->assertStatus(200);
    }

    // ------------------------------------------------------ mock interviews

    public function test_a_free_plan_student_is_blocked_from_a_second_mock_interview_the_same_day(): void
    {
        $plan = $this->plan(['max_mock_interviews_per_day' => 1]);
        $student = $this->studentOnPlan($plan);
        $interviewA = $this->mockInterview('Mock A');
        $interviewB = $this->mockInterview('Mock B');

        Sanctum::actingAs($student);
        $this->postJson("/api/interviews/{$interviewA->slug}/start")->assertStatus(200);

        $blocked = $this->postJson("/api/interviews/{$interviewB->slug}/start");
        $blocked->assertStatus(402);
    }

    public function test_resuming_the_same_mock_interview_never_recounts_against_the_limit(): void
    {
        $plan = $this->plan(['max_mock_interviews_per_day' => 1]);
        $student = $this->studentOnPlan($plan);
        $interview = $this->mockInterview('Mock A');

        Sanctum::actingAs($student);
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertStatus(200);
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertStatus(200);
    }

    public function test_a_real_company_hiring_interview_is_never_throttled_by_the_mock_interview_limit(): void
    {
        $plan = $this->plan(['max_mock_interviews_per_day' => 1]);
        $student = $this->studentOnPlan($plan);

        $mock = $this->mockInterview('Mock A');
        $realInterview = Interview::create([
            'title' => 'Real Company Interview',
            'slug' => Interview::uniqueSlug('Real Company Interview'),
            'status' => Interview::STATUS_PUBLISHED,
            'interview_type' => Interview::INTERVIEW_TYPE_COMPANY_HIRING,
            'is_mock' => false,
            'owning_company_id' => null,
        ]);
        InterviewSession::create([
            'interview_id' => $realInterview->id,
            'user_id' => $student->id,
            'status' => InterviewSession::STATUS_INVITED,
            'invited_at' => now(),
            'current_question_order' => 0,
        ]);

        Sanctum::actingAs($student);
        // Uses up the one mock interview for today...
        $this->postJson("/api/interviews/{$mock->slug}/start")->assertStatus(200);
        // ...but the real, already-invited hiring interview must still start.
        $this->postJson("/api/interviews/{$realInterview->slug}/start")->assertStatus(200);
    }

    // ------------------------------------------------------------- drives

    public function test_a_free_plan_student_sees_no_drive_access(): void
    {
        $plan = $this->plan(['drive_access' => false]);
        $student = $this->studentOnPlan($plan);
        $student->forceFill(['college_id' => College::create(['name' => 'Test College', 'short_code' => 'TC'])->id])->save();

        Sanctum::actingAs($student);
        $response = $this->getJson('/api/drives');
        $response->assertStatus(200);
        $this->assertFalse($response->json('drive_access'));
        $this->assertSame([], $response->json('drives'));
    }

    // -------------------------------------------------- college precedence

    public function test_a_college_covered_student_is_not_limited_by_their_own_free_individual_plan(): void
    {
        $this->fakePiston();

        // The student's own individual plan is free/capped at 1...
        $freePlan = $this->plan(['code' => 'coder-test', 'max_practice_problems_per_day' => 1]);
        $student = $this->studentOnPlan($freePlan);

        // ...but their COLLEGE has an active, unlimited institution plan,
        // which must take precedence (effectiveSubscription()'s existing
        // "college's plan wins if active" rule, unchanged by this feature).
        $unlimitedPlan = $this->plan(['code' => 'standard-test', 'audience' => Plan::AUDIENCE_INSTITUTION, 'max_practice_problems_per_day' => null]);
        $college = College::create(['name' => 'Test College', 'short_code' => 'TC2']);
        Subscription::create([
            'subscriber_type' => College::class,
            'subscriber_id' => $college->id,
            'plan_id' => $unlimitedPlan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'started_at' => now(),
            'current_period_end' => null,
            'auto_renew' => false,
        ]);
        $student->forceFill(['college_id' => $college->id])->save();

        $problemA = $this->problem('problem-a');
        $problemB = $this->problem('problem-b');

        Sanctum::actingAs($student);
        $this->postJson("/api/problems/{$problemA->slug}/submit", ['language' => 'python', 'code' => 'pass'])->assertStatus(200);
        $this->postJson("/api/problems/{$problemB->slug}/submit", ['language' => 'python', 'code' => 'pass'])->assertStatus(200);
    }
}
