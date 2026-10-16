<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\ListeningLesson;
use App\Models\Plan;
use App\Models\SpeakingAttempt;
use App\Models\SpeakingPrompt;
use App\Models\Subscription;
use App\Models\User;
use App\Models\VocabularyAttempt;
use App\Services\PlanGate;
use App\Services\PlanRequiredException;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * The plan switches and the free plan's one-time tries (PlanGate), checked
 * through the endpoints a student actually calls. Plans come from the real
 * PlanSeeder, so these tests pin the matrix that ships:
 *
 *   Coder        1 problem a day · one free try of each AI feature · nothing else
 *   Expert       everything — unlimited problems, 10 AI interviews a day, Hack Arena and Project Lab included
 *   Grandmaster  Mellow Academy: the same access, granted by the team (never bought at checkout)
 *
 * The Vault (being hired through Mellow Vault) needs Expert or Grandmaster for individual students — see the
 * Vault section below, and VaultPlanGateTest for the full story (lapses, college plans, upgrades).
 */
class PlanAccessGatesTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->fakeWorkspaces();
    }

    /** A student on the plan: bought at checkout, or — for Grandmaster, which is never sold online — granted by the team. */
    private function onPlan(string $code): User
    {
        if ($code === Plan::CODE_GRANDMASTER) {
            return $this->studentOnAcademy();
        }

        $user = $this->student();
        $this->buy($user, $code);

        return $user->fresh();
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

    // ───────────────────────────── what /me/subscription tells the UI ─────────────────────────────

    public function test_the_subscription_payload_reports_each_plans_switches(): void
    {
        Sanctum::actingAs($this->student());
        $this->getJson('/api/me/subscription')->assertOk()
            ->assertJsonPath('entitlements.max_practice_problems_per_day', 1)
            ->assertJsonPath('entitlements.max_mock_interviews_per_day', null)
            ->assertJsonPath('entitlements.hackathon_access', false)
            ->assertJsonPath('entitlements.feature_trial.uses_per_feature', 1)
            ->assertJsonPath('entitlements.feature_trial.used.mock_interview', 0)
            ->assertJsonPath('project_lab.enabled', false);

        // Expert and Grandmaster (Mellow Academy) carry the very same access.
        foreach (['expert', 'grandmaster'] as $code) {
            Sanctum::actingAs($this->onPlan($code));
            $this->getJson('/api/me/subscription')->assertOk()
                ->assertJsonPath('entitlements.max_practice_problems_per_day', null)
                ->assertJsonPath('entitlements.max_mock_interviews_per_day', 10)
                ->assertJsonPath('entitlements.hackathon_access', true)
                ->assertJsonPath('entitlements.feature_trial', null)
                ->assertJsonPath('project_lab.enabled', true)
                ->assertJsonPath('project_lab.source', 'plan')
                ->assertJsonPath('project_lab.hours.limit', 80)
                ->assertJsonPath('project_lab.projects.limit', 3);
        }
    }

    // ───────────────────────────── the Vault comes with Expert (and Grandmaster) ─────────────────────────────

    public function test_each_plan_reports_whether_it_includes_the_vault(): void
    {
        Sanctum::actingAs($this->student());
        $this->getJson('/api/me/subscription')->assertOk()->assertJsonPath('entitlements.vault_access', false)->assertJsonMissingPath('entitlements.talent_pool_access');

        foreach (['expert', 'grandmaster'] as $code) {
            Sanctum::actingAs($this->onPlan($code));
            $this->getJson('/api/me/subscription')->assertOk()->assertJsonPath('entitlements.vault_access', true);
        }
    }

    public function test_only_the_free_plan_is_turned_away_from_the_vault(): void
    {
        Sanctum::actingAs($this->student());
        $this->postJson('/api/me/vault/consent')
            ->assertStatus(402)
            ->assertJsonPath('code', 'plan_required')
            ->assertJsonPath('feature', 'vault')
            ->assertJsonPath('message', fn (string $message) => str_contains($message, 'Expert plan'));

        foreach (['expert', 'grandmaster'] as $code) {
            Sanctum::actingAs($this->onPlan($code));
            $this->postJson('/api/me/vault/consent')->assertOk()->assertJsonPath('profile.consent.given', true);
        }
    }

    // ───────────────────────────── the free plan's one-time tries ─────────────────────────────

    public function test_a_free_student_gets_one_ai_mock_interview_ever_not_one_a_day(): void
    {
        $student = $this->student();
        $first = $this->mockInterview('Mock A');
        $second = $this->mockInterview('Mock B');
        Sanctum::actingAs($student);

        $this->postJson("/api/interviews/{$first->slug}/start")->assertOk();

        // Resuming the same interview is not a new attempt.
        $this->postJson("/api/interviews/{$first->slug}/start")->assertOk();

        $this->postJson("/api/interviews/{$second->slug}/start")
            ->assertStatus(402)
            ->assertJsonPath('code', 'trial_used')
            ->assertJsonPath('feature', 'mock_interview');

        // Not even tomorrow: the try is spent for good.
        InterviewSession::where('user_id', $student->id)->update(['started_at' => now()->subDays(3)]);
        $this->postJson("/api/interviews/{$second->slug}/start")->assertStatus(402)->assertJsonPath('code', 'trial_used');

        $this->getJson('/api/me/subscription')->assertJsonPath('entitlements.feature_trial.used.mock_interview', 1);
    }

    public function test_the_trial_is_per_feature_so_using_the_interview_leaves_the_others_untouched(): void
    {
        $student = $this->student();
        $interview = $this->mockInterview('Mock A');
        Sanctum::actingAs($student);
        $this->postJson("/api/interviews/{$interview->slug}/start")->assertOk();

        $gate = app(PlanGate::class);
        $gate->assertTrialAvailable($student, PlanGate::TRIAL_VOCABULARY_QUIZ);
        $gate->assertTrialAvailable($student, PlanGate::TRIAL_LISTENING_LESSON);
        $gate->assertTrialAvailable($student, PlanGate::TRIAL_SPEAKING_TAKE);
        $this->assertTrue(true, 'none of those refused');

        $this->expectException(PlanRequiredException::class);
        $gate->assertTrialAvailable($student, PlanGate::TRIAL_MOCK_INTERVIEW);
    }

    public function test_the_learning_centre_ai_features_are_refused_once_their_one_try_is_used(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        VocabularyAttempt::create(['user_id' => $student->id, 'kind' => 'custom', 'topic' => 'x', 'difficulty' => 'beginner', 'questions' => []]);
        $this->postJson('/api/learning-centre/vocabulary/generate', ['topic' => 'work', 'difficulty' => 'beginner'])
            ->assertStatus(402)->assertJsonPath('code', 'trial_used')->assertJsonPath('feature', 'vocabulary_quiz');

        ListeningLesson::create([
            'user_id' => $student->id, 'title' => 'T', 'passage_text' => 'p', 'category' => 'c', 'difficulty' => 'beginner',
            'format' => 'comprehension', 'source' => ListeningLesson::SOURCE_AI, 'questions' => [], 'is_active' => true, 'display_order' => 0,
        ]);
        $this->postJson('/api/learning-centre/listening/lessons/generate', ['topic' => 'work', 'difficulty' => 'beginner'])
            ->assertStatus(402)->assertJsonPath('code', 'trial_used')->assertJsonPath('feature', 'listening_lesson');

        $prompt = SpeakingPrompt::create([
            'title' => 'T', 'passage_text' => 'p', 'category' => 'c', 'difficulty' => 'beginner', 'is_active' => true, 'display_order' => 0,
        ]);
        SpeakingAttempt::create(['user_id' => $student->id, 'speaking_prompt_id' => $prompt->id, 'attempt_number' => 1, 'overall_score' => 80, 'scored_at' => now()]);
        $this->postJson("/api/learning-centre/speaking/prompts/{$prompt->id}/attempts", [])
            ->assertStatus(402)->assertJsonPath('code', 'trial_used')->assertJsonPath('feature', 'speaking_take');

        SpeakingPrompt::create([
            'user_id' => $student->id, 'source' => SpeakingPrompt::SOURCE_AI, 'title' => 'AI', 'passage_text' => 'p', 'category' => 'c',
            'difficulty' => 'beginner', 'is_active' => true, 'display_order' => 0,
        ]);
        $this->postJson('/api/learning-centre/speaking/prompts/generate', ['topic' => 'work', 'difficulty' => 'beginner'])
            ->assertStatus(402)->assertJsonPath('code', 'trial_used')->assertJsonPath('feature', 'speaking_prompt');
    }

    public function test_a_failed_speaking_take_does_not_spend_the_try(): void
    {
        $student = $this->student();
        $prompt = SpeakingPrompt::create(['title' => 'T', 'passage_text' => 'p', 'category' => 'c', 'difficulty' => 'beginner', 'is_active' => true, 'display_order' => 0]);
        SpeakingAttempt::create(['user_id' => $student->id, 'speaking_prompt_id' => $prompt->id, 'attempt_number' => 1, 'scoring_failed_at' => now()]);

        // The student got nothing for it, so it does not count.
        app(PlanGate::class)->assertTrialAvailable($student, PlanGate::TRIAL_SPEAKING_TAKE);

        $this->assertTrue(true);
    }

    public function test_paid_plans_are_never_limited_by_the_free_trial(): void
    {
        $gate = app(PlanGate::class);

        foreach (['expert', 'grandmaster'] as $code) {
            $student = $this->onPlan($code);
            VocabularyAttempt::create(['user_id' => $student->id, 'kind' => 'custom', 'topic' => 'x', 'difficulty' => 'beginner', 'questions' => []]);
            VocabularyAttempt::create(['user_id' => $student->id, 'kind' => 'custom', 'topic' => 'y', 'difficulty' => 'beginner', 'questions' => []]);

            $gate->assertTrialAvailable($student, PlanGate::TRIAL_VOCABULARY_QUIZ);
            $this->assertNull($gate->trialSummary($student));
        }

        $this->assertTrue(true, 'neither was refused');
    }

    public function test_an_expert_is_held_to_ten_ai_interviews_a_day(): void
    {
        $student = $this->onPlan('expert');
        Sanctum::actingAs($student);

        foreach (range(1, 10) as $number) {
            $this->postJson("/api/interviews/{$this->mockInterview("Mock {$number}")->slug}/start")->assertOk();
        }

        $this->postJson("/api/interviews/{$this->mockInterview('Mock 11')->slug}/start")->assertStatus(402);
    }

    // ───────────────────────────── Project Lab through the plan ─────────────────────────────

    public function test_expert_and_grandmaster_include_project_lab_and_the_free_plan_does_not(): void
    {
        $this->assertFalse($this->student()->hasProjectLabAccess());

        foreach (['expert', 'grandmaster'] as $code) {
            $coverage = $this->onPlan($code)->projectLabCoverage();

            $this->assertTrue($coverage['access'], $code);
            $this->assertSame('plan', $coverage['source']);
            $this->assertSame(80, $coverage['max_workspace_hours_per_month']);
            $this->assertSame(3, $coverage['max_active_projects']);
        }
    }

    public function test_the_project_lab_catalog_opens_for_a_paid_plan_and_stays_a_preview_on_the_free_one(): void
    {
        $this->topic(['slug' => 'lms']);

        Sanctum::actingAs($this->student());
        $this->getJson('/api/project-lab/topics')->assertOk()
            ->assertJsonPath('project_lab.enabled', false)
            ->assertJsonPath('project_lab.upgrade.code', 'expert');

        Sanctum::actingAs($this->onPlan('expert'));
        $this->getJson('/api/project-lab/topics')->assertOk()->assertJsonPath('project_lab.enabled', true);
    }

    public function test_ending_a_paid_plan_takes_project_lab_away_with_it(): void
    {
        $student = $this->onPlan('expert');
        $this->assertTrue($student->hasProjectLabAccess());

        app(SubscriptionService::class)->cancel($student->activeSubscription(), User::factory()->create(['role' => User::ROLE_SUPERADMIN]), 'Test: ended by support');

        $this->assertFalse($student->fresh()->hasProjectLabAccess());
    }

    public function test_someone_who_bought_the_add_on_before_it_was_retired_keeps_lab_until_it_expires(): void
    {
        $student = $this->student();
        $addon = $this->grantLegacyProjectLabAddon($student);

        $coverage = $student->fresh()->projectLabCoverage();
        $this->assertTrue($coverage['access']);
        $this->assertSame('addon', $coverage['source']);

        $addon->update(['current_period_end' => now()->subMinute()]);

        $this->assertFalse($student->fresh()->hasProjectLabAccess());
    }

    public function test_the_lock_screen_offer_follows_the_superadmins_live_price(): void
    {
        Plan::where('code', 'expert')->update(['list_price' => 6000, 'discount_percent' => 50]);
        Sanctum::actingAs($this->student());

        $this->getJson('/api/me/subscription')
            ->assertJsonPath('project_lab.upgrade.list_price', 6000)
            ->assertJsonPath('project_lab.upgrade.discount_percent', 50)
            ->assertJsonPath('project_lab.upgrade.sale_price', 3000);
    }

    public function test_a_lapsed_individual_subscription_falls_back_to_the_free_plans_switches(): void
    {
        $student = $this->onPlan('expert');
        $this->assertTrue($student->effectiveEntitlements()['hackathon_access']);

        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'expert'))
            ->update(['status' => Subscription::STATUS_EXPIRED]);

        $entitlements = $student->fresh()->effectiveEntitlements();
        $this->assertFalse($entitlements['hackathon_access']);
        $this->assertFalse($entitlements['vault_access']);
        $this->assertArrayNotHasKey('talent_pool_access', $entitlements);
        $this->assertSame(1, $entitlements['feature_trial_uses']);
    }
}
