<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\Plan;
use App\Models\User;
use App\Models\VaultInterviewQualification;
use App\Models\VaultProfile;
use App\Services\InterviewTrackAdvancementService;
use App\Services\PlanGate;
use App\Services\PlanRequiredException;
use App\Services\SubscriptionService;
use App\Services\Vault\VaultInterviewQualificationService;
use App\Services\Vault\VaultService;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The Vault AI Interview: three sets per series, a 60% series average to qualify, a fresh series after a miss, a 45-day
 * cooldown after the third. These tests drive it the way a student does (start a set, sit it, have it scored) and pin the
 * rules that must hold however the pieces are called.
 */
class VaultInterviewQualificationTest extends TestCase
{
    use RefreshDatabase;

    private const STACK = 'laravel';

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seed(PlanSeeder::class);
        config(['vault.sync_url' => 'https://vault.example.test/hook', 'vault.sync_secret' => 'secret']);
    }

    /** A student on Expert, which has the Vault and no trial cap on mock interviews. */
    private function expertStudent(): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        $plan = Plan::where('code', Plan::CODE_EXPERT)->firstOrFail();
        app(SubscriptionService::class)->grantIndividualPlan($student, $plan, User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
            'days' => 365, 'kind' => 'complimentary', 'reason' => 'Test',
        ]);

        return $student->fresh();
    }

    private function startSet(User $student, int $set, string $stack = self::STACK)
    {
        Sanctum::actingAs($student);

        return $this->postJson('/api/vault-qualification/start-set', ['stack' => $stack, 'set_number' => $set]);
    }

    private function qualStatus(User $student, string $stack = self::STACK): array
    {
        Sanctum::actingAs($student);

        return $this->getJson('/api/vault-qualification/status?stack='.$stack)->assertOk()->json();
    }

    /** Sit and score an interview: a completed session whose every answer carries $score, finalized the way the scoring job does. */
    private function sitAndScore(User $student, Interview $interview, int $score, bool $finalize = true): InterviewSession
    {
        $session = InterviewSession::create([
            'interview_id' => $interview->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => now()->subMinutes(15), 'completed_at' => now(), 'current_question_order' => 5,
        ]);

        foreach (InterviewQuestion::where('interview_id', $interview->id)->get() as $q) {
            InterviewResponse::create([
                'interview_session_id' => $session->id, 'interview_question_id' => $q->id, 'transcript_text' => 'An answer.',
                'answered_at' => now(), 'score' => $score, 'scored_at' => now(), 'ai_scored' => true,
            ]);
        }

        if ($finalize) {
            app(InterviewTrackAdvancementService::class)->finalizeStandaloneScoring($session->fresh());
        }

        return $session->fresh();
    }

    /** Launch set N of the current series and sit it at $score. */
    private function playSet(User $student, int $set, int $score, bool $finalize = true): Interview
    {
        $res = $this->startSet($student, $set)->assertOk();
        $interview = Interview::findOrFail($res->json('interview.id'));
        $this->sitAndScore($student, $interview, $score, $finalize);

        return $interview;
    }

    // ───────────────────────────── access ─────────────────────────────

    public function test_only_students_can_use_the_qualification_endpoints(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $this->getJson('/api/vault-qualification/status?stack=laravel')->assertForbidden();
        $this->postJson('/api/vault-qualification/start-set', ['stack' => 'laravel', 'set_number' => 1])->assertForbidden();
        $this->assertSame(0, VaultInterviewQualification::count());
    }

    public function test_an_unknown_stack_is_a_404_and_creates_nothing(): void
    {
        $student = $this->expertStudent();
        Sanctum::actingAs($student);

        $this->getJson('/api/vault-qualification/status?stack=cobol')->assertNotFound();
        $this->postJson('/api/vault-qualification/start-set', ['stack' => 'cobol', 'set_number' => 1])->assertNotFound();
        $this->assertSame(0, VaultInterviewQualification::count());
    }

    public function test_the_role_comes_from_the_catalog_not_the_request(): void
    {
        $student = $this->expertStudent();
        Sanctum::actingAs($student);

        $this->getJson('/api/vault-qualification/status?stack=laravel&role=devops')->assertOk()
            ->assertJsonPath('role_key', 'backend');

        $qual = VaultInterviewQualification::firstOrFail();
        $this->assertSame('backend', $qual->role_key);
        $this->assertSame('backend-laravel-series-1', $qual->active_series_id);
    }

    public function test_status_shows_three_untouched_sets_of_series_one(): void
    {
        $status = $this->qualStatus($this->expertStudent());

        $this->assertSame(1, $status['current_attempt']);
        $this->assertFalse($status['is_qualified']);
        $this->assertCount(3, $status['active_series']['sets']);
        foreach ($status['active_series']['sets'] as $set) {
            $this->assertSame('not_started', $set['status']);
            $this->assertNull($set['score_percent']);
            $this->assertSame(5, $set['question_count']);
        }
    }

    // ───────────────────────────── launching ─────────────────────────────

    public function test_starting_a_set_creates_a_bound_interview_and_a_second_tap_returns_the_same_one(): void
    {
        $student = $this->expertStudent();

        $first = $this->startSet($student, 2)->assertOk();
        $second = $this->startSet($student, 2)->assertOk();

        $this->assertSame($first->json('interview.id'), $second->json('interview.id'));
        $this->assertSame(1, Interview::where('created_by', $student->id)->count());

        $config = Interview::findOrFail($first->json('interview.id'))->practice_config;
        $this->assertSame(VaultInterviewQualification::firstOrFail()->id, $config['qualification_id']);
        $this->assertSame('backend-laravel-s1-set2', $config['set_id']);
        $this->assertSame(2, $config['set_number']);
    }

    public function test_a_plain_practice_run_of_a_catalog_set_is_not_mistaken_for_the_qualification_set(): void
    {
        $student = $this->expertStudent();
        Sanctum::actingAs($student);

        $practice = $this->postJson('/api/curated-interview-sets/backend-laravel-s1-set1/start')->assertCreated();
        $qualification = $this->startSet($student, 1)->assertOk();

        $this->assertNotSame($practice->json('interview.id'), $qualification->json('interview.id'));
        $this->assertNotEmpty(Interview::findOrFail($qualification->json('interview.id'))->practice_config['qualification_id']);
    }

    public function test_no_plan_is_needed_to_sit_every_set_and_it_spends_none_of_the_free_allowance(): void
    {
        // A free (Coder) student: one mock-interview try, ever, for the practice interviews - which the Vault AI Interview is not.
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        $sessions = [];

        foreach ([1, 2, 3] as $set) {
            $slug = $this->startSet($student, $set)->assertOk()->json('interview.slug');
            Sanctum::actingAs($student);
            $this->postJson("/api/interviews/{$slug}/start")->assertOk();
            $sessions[] = $slug;
        }

        $this->assertCount(3, $sessions);
        $this->assertSame(3, InterviewSession::where('user_id', $student->id)->count());

        // None of it counted: the plan's own mock-interview gate still has the whole allowance, and the usage meter says zero.
        app(PlanGate::class)->assertMockInterviewAllowed($student);
        $this->getJson('/api/me/subscription')->assertOk()->assertJsonPath('entitlements.mock_interviews_used_today', 0);
    }

    public function test_a_normal_practice_interview_still_spends_the_free_try(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        $practice = Interview::create([
            'title' => 'Practice', 'slug' => 'practice-'.uniqid(), 'interview_type' => Interview::INTERVIEW_TYPE_PRACTICE, 'is_mock' => true,
            'status' => Interview::STATUS_PUBLISHED, 'created_by' => $student->id, 'practice_config' => ['role' => 'backend'],
        ]);
        InterviewSession::create(['interview_id' => $practice->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED, 'started_at' => now(), 'current_question_order' => 1]);

        $this->expectException(PlanRequiredException::class);
        app(PlanGate::class)->assertMockInterviewAllowed($student);
    }

    public function test_a_qualification_set_can_be_sat_after_the_free_try_is_gone_too(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        $practice = Interview::create([
            'title' => 'Practice', 'slug' => 'practice-'.uniqid(), 'interview_type' => Interview::INTERVIEW_TYPE_PRACTICE, 'is_mock' => true,
            'status' => Interview::STATUS_PUBLISHED, 'created_by' => $student->id, 'practice_config' => ['role' => 'backend'],
        ]);
        InterviewSession::create(['interview_id' => $practice->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED, 'started_at' => now(), 'current_question_order' => 1]);

        $slug = $this->startSet($student, 1)->assertOk()->json('interview.slug');
        Sanctum::actingAs($student);
        $this->postJson("/api/interviews/{$slug}/start")->assertOk();
    }

    public function test_the_interview_payload_says_it_is_a_vault_set_and_where_it_sits(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        $slug = $this->startSet($student, 2)->assertOk()->json('interview.slug');

        Sanctum::actingAs($student);
        $this->getJson("/api/interviews/{$slug}")
            ->assertOk()
            ->assertJsonPath('is_qualification', true)
            ->assertJsonPath('qualification.stack_key', self::STACK)
            ->assertJsonPath('qualification.series_number', 1)
            ->assertJsonPath('qualification.set_number', 2);
    }

    public function test_an_ordinary_practice_interview_is_not_marked_as_a_vault_set(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        $practice = Interview::create([
            'title' => 'Practice', 'slug' => 'practice-'.uniqid(), 'interview_type' => Interview::INTERVIEW_TYPE_PRACTICE, 'is_mock' => true,
            'status' => Interview::STATUS_PUBLISHED, 'created_by' => $student->id, 'practice_config' => ['role' => 'backend'],
        ]);

        Sanctum::actingAs($student);
        $this->getJson("/api/interviews/{$practice->slug}")->assertOk()->assertJsonPath('is_qualification', false)->assertJsonPath('qualification', null);
    }

    public function test_a_set_closed_by_proctoring_says_so_truthfully_instead_of_sending_the_student_to_an_inviter(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        $slug = $this->startSet($student, 1)->assertOk()->json('interview.slug');
        $interview = Interview::where('slug', $slug)->firstOrFail();
        $session = InterviewSession::create(['interview_id' => $interview->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_IN_PROGRESS, 'started_at' => now(), 'current_question_order' => 1]);
        \App\Models\InterviewProctoringSession::create(['interview_session_id' => $session->id, 'status' => \App\Models\InterviewProctoringSession::STATUS_LOCKED, 'violation_count' => 3, 'locked_at' => now()]);

        Sanctum::actingAs($student);
        $response = $this->postJson("/api/interviews/{$slug}/start")->assertForbidden();

        $this->assertStringContainsString('Vault AI Interview set was closed', $response->json('message'));
        $this->assertStringNotContainsString('whoever invited you', strtolower($response->json('message')));
    }

    // ───────────────────────────── the score is kept on the student ─────────────────────────────

    public function test_a_completed_series_leaves_its_average_on_the_student(): void
    {
        $student = $this->expertStudent();

        $this->playSet($student, 1, 50);
        $this->playSet($student, 2, 60);
        $this->assertNull($student->fresh()->vault_ai_score, 'a series that is not finished has no average yet');

        $this->playSet($student, 3, 70);

        $fresh = $student->fresh();
        $this->assertEquals(60.0, $fresh->vault_ai_score);
        $this->assertNotNull($fresh->vault_ai_scored_at);
    }

    public function test_a_failed_series_is_kept_and_a_better_one_replaces_it(): void
    {
        $student = $this->expertStudent();

        foreach ([1, 2, 3] as $set) {
            $this->playSet($student, $set, 40);
        }
        $this->assertEquals(40.0, $student->fresh()->vault_ai_score, 'a series that did not qualify is still a score');

        foreach ([1, 2, 3] as $set) {
            $this->playSet($student, $set, 80);
        }
        $this->assertEquals(80.0, $student->fresh()->vault_ai_score);
    }

    public function test_a_worse_later_series_never_lowers_the_best_score(): void
    {
        $student = $this->expertStudent();

        foreach ([1, 2, 3] as $set) {
            $this->playSet($student, $set, 55);
        }
        foreach ([1, 2, 3] as $set) {
            $this->playSet($student, $set, 20);
        }

        $this->assertEquals(55.0, $student->fresh()->vault_ai_score);
    }

    // ───────────────────────────── qualifying ─────────────────────────────

    public function test_a_series_average_of_sixty_qualifies_and_joins_the_vault(): void
    {
        $student = $this->expertStudent();

        $this->playSet($student, 1, 50);
        $this->playSet($student, 2, 60);
        $this->assertFalse($this->qualStatus($student)['is_qualified']);
        $this->playSet($student, 3, 70);

        $status = $this->qualStatus($student);
        $this->assertTrue($status['is_qualified']);
        $this->assertEquals(60.0, $status['active_series']['series_average']);

        $profile = VaultProfile::where('user_id', $student->id)->firstOrFail();
        $this->assertTrue($profile->is_eligible);
        $this->assertSame(VaultProfile::SOURCE_AI_INTERVIEW, $profile->qualification_source);
        $this->assertEquals(60.0, (float) $profile->ai_interview_score);
        $this->assertSame('laravel', $profile->ai_interview_stack);
        $this->assertSame(['1' => 50, '2' => 60, '3' => 70], $profile->ai_interview_scores);
        // Qualified, but nobody sees them until they say yes.
        $this->assertSame(VaultProfile::STATUS_PENDING_CONSENT, $profile->visibility_status);
    }

    public function test_consent_makes_a_qualified_student_live_and_a_low_readiness_refresh_does_not_remove_them(): void
    {
        $student = $this->expertStudent();
        foreach ([1, 2, 3] as $set) {
            $this->playSet($student, $set, 80);
        }

        $vault = app(VaultService::class);
        $vault->giveConsent($student);
        $this->assertSame(VaultProfile::STATUS_VISIBLE, VaultProfile::where('user_id', $student->id)->firstOrFail()->visibility_status);

        // The scheduled readiness refresh, with a readiness score far below the exit line.
        $vault->applyReadiness($student, ['score' => 5, 'tier' => 'starting', 'components' => []]);

        $profile = VaultProfile::where('user_id', $student->id)->firstOrFail();
        $this->assertTrue($profile->is_eligible, 'qualifying through the interview must survive the readiness refresh');
        $this->assertSame(VaultProfile::STATUS_VISIBLE, $profile->visibility_status);
        $this->assertSame(5, $profile->readiness_score);
    }

    // ───────────────────────────── failing ─────────────────────────────

    public function test_a_failed_series_unlocks_a_fresh_series_with_different_questions(): void
    {
        $student = $this->expertStudent();
        $first = [];
        foreach ([1, 2, 3] as $set) {
            $first[] = $this->playSet($student, $set, 40)->id;
        }

        $status = $this->qualStatus($student);
        $this->assertFalse($status['is_qualified']);
        $this->assertSame(2, $status['current_attempt']);
        $this->assertCount(1, $status['past_attempts']);
        $this->assertEquals(40.0, $status['past_attempts'][0]['average']);
        foreach ($status['active_series']['sets'] as $set) {
            $this->assertSame('not_started', $set['status'], 'the new series starts clean');
            $this->assertStringContainsString('-s2-', $set['set_id']);
        }

        $second = $this->startSet($student, 1)->assertOk();
        $this->assertNotContains($second->json('interview.id'), $first);
        $this->assertSame('backend-laravel-s2-set1', $second->json('interview.practice_config.set_id'));
    }

    public function test_three_failed_series_start_a_45_day_cooldown_and_block_new_sets(): void
    {
        $student = $this->expertStudent();
        foreach ([1, 2, 3] as $series) {
            foreach ([1, 2, 3] as $set) {
                $this->playSet($student, $set, 30);
            }
        }

        $status = $this->qualStatus($student);
        $this->assertTrue($status['is_cooling_down']);
        $this->assertSame('cooling_down', $status['status']);
        $this->assertGreaterThanOrEqual(44, $status['cooldown_days_remaining']);
        $this->assertCount(3, $status['past_attempts']);

        $this->startSet($student, 1)->assertForbidden();
        $this->assertFalse(VaultProfile::where('user_id', $student->id)->exists() && VaultProfile::where('user_id', $student->id)->value('is_eligible'));
    }

    public function test_after_the_cooldown_a_fresh_cycle_starts_clean_and_old_interviews_are_not_reused(): void
    {
        $student = $this->expertStudent();
        $oldIds = [];
        foreach ([1, 2, 3] as $series) {
            foreach ([1, 2, 3] as $set) {
                $oldIds[] = $this->playSet($student, $set, 30)->id;
            }
        }

        $this->travel(46)->days();

        $status = $this->qualStatus($student);
        $this->assertFalse($status['is_cooling_down']);
        $this->assertSame(1, $status['current_attempt']);
        foreach ($status['active_series']['sets'] as $set) {
            $this->assertSame('not_started', $set['status'], 'scores from the earlier cycle must not show');
            $this->assertNull($set['score_percent']);
        }

        $fresh = $this->startSet($student, 1)->assertOk();
        $this->assertNotContains($fresh->json('interview.id'), $oldIds);

        $this->travelBack();
    }

    // ───────────────────────────── scoring rules ─────────────────────────────

    public function test_a_set_is_scored_once_and_a_second_score_changes_nothing(): void
    {
        $student = $this->expertStudent();
        $interview = $this->playSet($student, 1, 40);

        app(VaultInterviewQualificationService::class)->recordSetScoreAndEvaluate($interview->fresh(), 95);

        $this->assertSame(['1' => 40], VaultInterviewQualification::firstOrFail()->series_scores);
    }

    public function test_a_score_after_qualifying_cannot_unqualify_or_advance(): void
    {
        $student = $this->expertStudent();
        $interviews = [];
        foreach ([1, 2, 3] as $set) {
            $interviews[$set] = $this->playSet($student, $set, 90);
        }

        app(VaultInterviewQualificationService::class)->recordSetScoreAndEvaluate($interviews[1]->fresh(), 0);

        $qual = VaultInterviewQualification::firstOrFail();
        $this->assertSame(VaultInterviewQualification::STATUS_QUALIFIED, $qual->status);
        $this->assertSame(1, $qual->current_attempt);
        $this->assertSame([], $qual->attempt_history ?? []);
    }

    public function test_a_late_score_from_an_earlier_series_is_ignored(): void
    {
        $student = $this->expertStudent();
        $series1Set1 = $this->playSet($student, 1, 10);
        $this->playSet($student, 2, 10);
        $this->playSet($student, 3, 10);
        $this->assertSame(2, VaultInterviewQualification::firstOrFail()->current_attempt);

        app(VaultInterviewQualificationService::class)->recordSetScoreAndEvaluate($series1Set1->fresh(), 99);

        $qual = VaultInterviewQualification::firstOrFail();
        $this->assertSame([], $qual->series_scores);
        $this->assertSame(2, $qual->current_attempt);
    }

    public function test_a_score_that_never_reached_the_qualification_is_picked_up_on_the_next_status_call(): void
    {
        $student = $this->expertStudent();
        foreach ([1, 2, 3] as $set) {
            // Sat and scored, but the qualification hook did not run (finalize is skipped, the score is set directly).
            $interview = Interview::findOrFail($this->startSet($student, $set)->json('interview.id'));
            $session = $this->sitAndScore($student, $interview, 75, finalize: false);
            $session->update(['composite_score_percent' => 75, 'ai_scored_at' => now()]);
        }

        $this->assertSame([], VaultInterviewQualification::firstOrFail()->series_scores ?? []);

        $status = $this->qualStatus($student);

        $this->assertTrue($status['is_qualified']);
        $this->assertSame(['1' => 75, '2' => 75, '3' => 75], VaultInterviewQualification::firstOrFail()->series_scores);
    }

    public function test_a_finished_set_waiting_for_its_score_shows_as_scoring_not_completed(): void
    {
        $student = $this->expertStudent();
        $interview = Interview::findOrFail($this->startSet($student, 1)->json('interview.id'));
        $this->sitAndScore($student, $interview, 80, finalize: false);

        $set = $this->qualStatus($student)['active_series']['sets'][0];

        $this->assertSame('scoring', $set['status']);
        $this->assertNull($set['score_percent']);
    }

    // ───────────────────────────── re-attempting ─────────────────────────────

    public function test_a_qualification_set_cannot_be_re_sat(): void
    {
        $student = $this->expertStudent();
        $interview = $this->playSet($student, 1, 20);
        Sanctum::actingAs($student);

        $this->postJson("/api/interviews/{$interview->slug}/reattempt")->assertStatus(422);
        $this->getJson("/api/interviews/{$interview->slug}/result")
            ->assertOk()->assertJsonPath('is_qualification', true)->assertJsonPath('reattemptable', false);

        $this->assertSame(InterviewSession::STATUS_COMPLETED, InterviewSession::where('interview_id', $interview->id)->value('status'));
    }

    public function test_a_qualification_set_whose_scoring_failed_can_be_sat_again(): void
    {
        $student = $this->expertStudent();
        $res = $this->startSet($student, 1)->assertOk();
        $interview = Interview::findOrFail($res->json('interview.id'));
        $session = $this->sitAndScore($student, $interview, 50, finalize: false);
        $session->update(['scoring_failed_at' => now()]);
        $session->responses()->update(['score' => null]);
        Sanctum::actingAs($student);

        $this->postJson("/api/interviews/{$interview->slug}/reattempt")->assertOk();
        $this->assertSame(InterviewSession::STATUS_IN_PROGRESS, $session->fresh()->status);
    }

    public function test_a_plain_practice_interview_can_still_be_re_attempted(): void
    {
        $student = $this->expertStudent();
        Sanctum::actingAs($student);
        $res = $this->postJson('/api/curated-interview-sets/backend-laravel-s1-set1/start')->assertCreated();
        $interview = Interview::findOrFail($res->json('interview.id'));
        $this->sitAndScore($student, $interview, 30);

        $this->getJson("/api/interviews/{$interview->slug}/result")->assertOk()
            ->assertJsonPath('is_qualification', false)->assertJsonPath('reattemptable', true);
        $this->postJson("/api/interviews/{$interview->slug}/reattempt")->assertOk();
    }

    // ───────────────────────────── elsewhere in the product ─────────────────────────────

    public function test_qualification_and_curated_interviews_stay_out_of_the_students_interview_list(): void
    {
        $student = $this->expertStudent();
        $this->startSet($student, 1)->assertOk();
        Sanctum::actingAs($student);
        $this->postJson('/api/curated-interview-sets/backend-laravel-s1-set2/start')->assertCreated();

        $slugs = collect($this->getJson('/api/interviews')->assertOk()->json('interviews'))->pluck('slug');

        $this->assertSame(0, $slugs->count());
    }

    public function test_the_admin_roster_lists_only_ai_qualifiers(): void
    {
        $qualified = $this->expertStudent();
        foreach ([1, 2, 3] as $set) {
            $this->playSet($qualified, $set, 85);
        }
        $other = $this->expertStudent();
        $this->startSet($other, 1)->assertOk();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $res = $this->getJson('/api/admin/vault/ai-interview-qualifiers')->assertOk();

        $this->assertSame(1, $res->json('stats.total_qualified'));
        $this->assertSame($qualified->id, $res->json('qualifiers.data.0.user_id'));
    }
}
