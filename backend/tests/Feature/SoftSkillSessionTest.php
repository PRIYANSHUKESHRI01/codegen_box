<?php

namespace Tests\Feature;

use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillQuestion;
use App\Models\SoftSkillSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers SoftSkillController's core student flow — start/answer/submit —
 * and the scoring/category-breakdown/max_attempts logic that flow
 * produces. No Gemini involved anywhere here: grading is exact
 * selected_index === correct_index matching, server-authoritative.
 */
class SoftSkillSessionTest extends TestCase
{
    use RefreshDatabase;

    private function studentUser(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    /** Two aptitude questions (correct_index 0 and 1) + one reasoning question (correct_index 2), attached in order. */
    private function generalAssessment(?int $maxAttempts = null): SoftSkillAssessment
    {
        $assessment = SoftSkillAssessment::create([
            'title' => 'Test Readiness Check',
            'slug' => SoftSkillAssessment::uniqueSlug('Test Readiness Check'),
            'status' => SoftSkillAssessment::STATUS_PUBLISHED,
            'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
            'duration_minutes' => 30,
            'pass_percentage' => 60,
            'max_attempts' => $maxAttempts,
        ]);

        $questions = [
            SoftSkillQuestion::create(['category' => 'aptitude', 'question_text' => 'Q1', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0]),
            SoftSkillQuestion::create(['category' => 'aptitude', 'question_text' => 'Q2', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 1]),
            SoftSkillQuestion::create(['category' => 'reasoning', 'question_text' => 'Q3', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 2]),
        ];

        foreach ($questions as $i => $q) {
            SoftSkillAssessmentQuestion::create([
                'soft_skill_assessment_id' => $assessment->id,
                'soft_skill_question_id' => $q->id,
                'display_order' => $i,
            ]);
        }

        return $assessment;
    }

    public function test_start_creates_a_session_with_every_question_pre_created(): void
    {
        Sanctum::actingAs($this->studentUser());
        $assessment = $this->generalAssessment();

        $response = $this->postJson("/api/soft-skills/{$assessment->slug}/start");

        $response->assertStatus(200);
        $this->assertCount(3, $response->json('questions'));
        $this->assertSame(SoftSkillSession::STATUS_IN_PROGRESS, $response->json('session.status'));
        $this->assertSame(3, SoftSkillSession::first()->responses()->count());
    }

    public function test_start_resumes_an_existing_in_progress_session_instead_of_creating_a_new_one(): void
    {
        Sanctum::actingAs($this->studentUser());
        $assessment = $this->generalAssessment();

        $first = $this->postJson("/api/soft-skills/{$assessment->slug}/start")->json('session.id');
        $second = $this->postJson("/api/soft-skills/{$assessment->slug}/start")->json('session.id');

        $this->assertSame($first, $second);
        $this->assertSame(1, SoftSkillSession::count());
    }

    public function test_answers_can_be_saved_in_any_order_and_submit_grades_correctly(): void
    {
        Sanctum::actingAs($this->studentUser());
        $assessment = $this->generalAssessment();

        $start = $this->postJson("/api/soft-skills/{$assessment->slug}/start")->json();
        $sessionId = $start['session']['id'];
        $questions = $start['questions']; // [Q1(correct=0), Q2(correct=1), Q3(correct=2)]

        // Answer out of order, and get two right, one wrong.
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/answer", ['response_id' => $questions[2]['response_id'], 'selected_index' => 2])->assertStatus(200); // correct
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/answer", ['response_id' => $questions[0]['response_id'], 'selected_index' => 0])->assertStatus(200); // correct
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/answer", ['response_id' => $questions[1]['response_id'], 'selected_index' => 3])->assertStatus(200); // wrong

        $result = $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->json('session');

        $this->assertEqualsWithDelta(66.67, $result['score_percent'], 0.01);
        $this->assertTrue($result['passed']); // 66.67% >= the 60% pass_percentage
        $this->assertSame(['aptitude' => ['correct' => 1, 'total' => 2], 'reasoning' => ['correct' => 1, 'total' => 1]], $result['category_breakdown']);
    }

    public function test_a_passing_score_is_marked_passed(): void
    {
        Sanctum::actingAs($this->studentUser());
        $assessment = $this->generalAssessment(); // pass_percentage = 60

        $start = $this->postJson("/api/soft-skills/{$assessment->slug}/start")->json();
        $sessionId = $start['session']['id'];
        $questions = $start['questions'];

        // Answer all 3 correctly (correct indexes are 0, 1, 2 in order attached).
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/answer", ['response_id' => $questions[0]['response_id'], 'selected_index' => 0]);
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/answer", ['response_id' => $questions[1]['response_id'], 'selected_index' => 1]);
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/answer", ['response_id' => $questions[2]['response_id'], 'selected_index' => 2]);

        $result = $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->json('session');

        $this->assertEquals(100.0, $result['score_percent']);
        $this->assertTrue($result['passed']);
    }

    public function test_cannot_submit_the_same_session_twice(): void
    {
        Sanctum::actingAs($this->studentUser());
        $assessment = $this->generalAssessment();
        $sessionId = $this->postJson("/api/soft-skills/{$assessment->slug}/start")->json('session.id');

        $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(200);
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(422);
    }

    public function test_max_attempts_is_enforced_once_reached(): void
    {
        Sanctum::actingAs($this->studentUser());
        $assessment = $this->generalAssessment(maxAttempts: 1);

        $sessionId = $this->postJson("/api/soft-skills/{$assessment->slug}/start")->json('session.id');
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(200);

        $second = $this->postJson("/api/soft-skills/{$assessment->slug}/start");
        $second->assertStatus(403);
    }

    public function test_unlimited_attempts_allows_retaking(): void
    {
        Sanctum::actingAs($this->studentUser());
        $assessment = $this->generalAssessment(maxAttempts: null);

        $firstSessionId = $this->postJson("/api/soft-skills/{$assessment->slug}/start")->json('session.id');
        $this->postJson("/api/soft-skills/sessions/{$firstSessionId}/submit")->assertStatus(200);

        $second = $this->postJson("/api/soft-skills/{$assessment->slug}/start");
        $second->assertStatus(200);
        $this->assertSame(2, $second->json('session.attempt_number'));
    }

    public function test_a_draft_assessment_is_not_visible_or_startable(): void
    {
        Sanctum::actingAs($this->studentUser());
        $assessment = $this->generalAssessment();
        $assessment->update(['status' => SoftSkillAssessment::STATUS_DRAFT]);

        $this->getJson('/api/soft-skills')->assertJsonCount(0, 'assessments');
        $this->postJson("/api/soft-skills/{$assessment->slug}/start")->assertStatus(404);
    }

    public function test_history_only_includes_completed_sessions(): void
    {
        $student = $this->studentUser();
        Sanctum::actingAs($student);
        $assessment = $this->generalAssessment();

        $sessionId = $this->postJson("/api/soft-skills/{$assessment->slug}/start")->json('session.id');

        $this->getJson('/api/me/soft-skills')->assertJsonCount(0, 'soft_skills');

        $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(200);

        $this->getJson('/api/me/soft-skills')->assertJsonCount(1, 'soft_skills');
    }
}
