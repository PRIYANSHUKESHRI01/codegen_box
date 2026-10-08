<?php

namespace Tests\Feature;

use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillProctoringSession;
use App\Models\SoftSkillProctoringViolation;
use App\Models\SoftSkillQuestion;
use App\Models\SoftSkillSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Proctoring for Soft Skills attempts: consent/start, strike counting, the
 * locking strike (which grades the saved answers and ends the attempt, never
 * as a pass), server-side lock enforcement on answer/submit, and the
 * guarantees that keep it from harming an un-proctored or already-finished
 * attempt. Mirrors the contest/interview proctoring behaviour — see
 * SoftSkillProctoringService.
 */
class SoftSkillProctoringTest extends TestCase
{
    use RefreshDatabase;

    private function studentUser(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    /** Three questions with correct_index 0, 1, 2 — pass_percentage 60. */
    private function generalAssessment(?int $maxAttempts = null): SoftSkillAssessment
    {
        $assessment = SoftSkillAssessment::create([
            'title' => 'Proctored Readiness Check',
            'slug' => SoftSkillAssessment::uniqueSlug('Proctored Readiness Check'),
            'status' => SoftSkillAssessment::STATUS_PUBLISHED,
            'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
            'duration_minutes' => 30,
            'pass_percentage' => 60,
            'max_attempts' => $maxAttempts,
        ]);

        foreach ([0, 1, 2] as $i => $correct) {
            $q = SoftSkillQuestion::create([
                'category' => $i < 2 ? 'aptitude' : 'reasoning',
                'question_text' => 'Q'.($i + 1),
                'options' => ['a', 'b', 'c', 'd'],
                'correct_index' => $correct,
            ]);
            SoftSkillAssessmentQuestion::create([
                'soft_skill_assessment_id' => $assessment->id,
                'soft_skill_question_id' => $q->id,
                'display_order' => $i,
            ]);
        }

        return $assessment;
    }

    /** @return array{0: int, 1: array, 2: SoftSkillAssessment} [sessionId, questions, assessment] */
    private function startAttempt(): array
    {
        $assessment = $this->generalAssessment();
        $start = $this->postJson("/api/soft-skills/{$assessment->slug}/start")->json();

        return [$start['session']['id'], $start['questions'], $assessment];
    }

    private function violation(int $sessionId, string $type)
    {
        return $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/violations", ['type' => $type]);
    }

    private function answerAll(int $sessionId, array $questions, array $indexes): void
    {
        foreach ($indexes as $i => $selected) {
            $this->postJson("/api/soft-skills/sessions/{$sessionId}/answer", ['response_id' => $questions[$i]['response_id'], 'selected_index' => $selected])->assertStatus(200);
        }
    }

    public function test_show_tells_the_client_whether_proctoring_is_required(): void
    {
        Sanctum::actingAs($this->studentUser());
        $assessment = $this->generalAssessment();

        $this->getJson("/api/soft-skills/{$assessment->slug}")->assertStatus(200)->assertJsonPath('proctoring_required', true);

        config(['proctoring.soft_skills_enabled' => false]);
        $this->getJson("/api/soft-skills/{$assessment->slug}")->assertJsonPath('proctoring_required', false);
    }

    public function test_start_creates_a_proctoring_session_and_is_idempotent(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId] = $this->startAttempt();

        $first = $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start", ['device_info' => ['platform' => 'Win32']]);
        $first->assertStatus(200)
            ->assertJsonPath('session.status', 'active')
            ->assertJsonPath('session.violation_count', 0)
            ->assertJsonPath('session.max_violations', 3);

        $this->violation($sessionId, 'tab_switch')->assertStatus(200);

        // A refresh re-calls start: it must resume the same session with its real strike count, never reset it.
        $second = $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");
        $second->assertJsonPath('session.violation_count', 1);
        $this->assertSame(1, SoftSkillProctoringSession::count());
    }

    public function test_first_consent_restarts_the_attempt_clock_but_only_once_and_only_before_any_answer(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId, $questions] = $this->startAttempt();

        // Simulate the student having sat on the intro/consent screen for 10 minutes.
        SoftSkillSession::whereKey($sessionId)->update(['started_at' => now()->subMinutes(10)]);
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start")->assertStatus(200);
        $this->assertTrue(SoftSkillSession::find($sessionId)->started_at->gt(now()->subMinute()), 'the clock should restart at consent');

        // Resuming (a refresh) must NOT restart it again — that would be free extra time.
        SoftSkillSession::whereKey($sessionId)->update(['started_at' => now()->subMinutes(10)]);
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start")->assertStatus(200);
        $this->assertTrue(SoftSkillSession::find($sessionId)->started_at->lt(now()->subMinutes(9)));
    }

    public function test_first_consent_never_restarts_the_clock_once_answers_exist(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId, $questions] = $this->startAttempt();

        // A tampered client answers before ever consenting, then consents to try to buy time.
        $this->answerAll($sessionId, $questions, [0]);
        SoftSkillSession::whereKey($sessionId)->update(['started_at' => now()->subMinutes(10)]);

        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start")->assertStatus(200);
        $this->assertTrue(SoftSkillSession::find($sessionId)->started_at->lt(now()->subMinutes(9)));
    }

    public function test_non_strike_events_are_logged_but_not_counted(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId] = $this->startAttempt();
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");

        foreach (['paste_attempt', 'window_blur', 'context_menu_blocked', 'tab_close_attempt'] as $type) {
            $this->violation($sessionId, $type)->assertStatus(200)->assertJsonPath('session.violation_count', 0)->assertJsonPath('locked', false);
        }

        $this->assertSame(4, SoftSkillProctoringViolation::count());
        $this->assertSame(0, SoftSkillProctoringViolation::where('counted_toward_lock', true)->count());
    }

    public function test_strikes_count_up_and_the_third_one_locks_grades_and_ends_the_attempt(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId, $questions] = $this->startAttempt();
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");

        // All three answers correct — strong enough to pass IF this were a normal submit.
        $this->answerAll($sessionId, $questions, [0, 1, 2]);

        $this->violation($sessionId, 'tab_switch')->assertJsonPath('session.violation_count', 1)->assertJsonPath('locked', false);
        $this->violation($sessionId, 'fullscreen_exit')->assertJsonPath('session.violation_count', 2)->assertJsonPath('locked', false);
        $third = $this->violation($sessionId, 'devtools_detected');
        $third->assertJsonPath('session.violation_count', 3)->assertJsonPath('session.status', 'locked')->assertJsonPath('locked', true);

        $session = SoftSkillSession::find($sessionId);
        $this->assertSame(SoftSkillSession::STATUS_COMPLETED, $session->status, 'the locking strike must end the attempt');
        $this->assertEquals(100.0, (float) $session->score_percent, 'saved answers are graded for transparency');
        $this->assertFalse($session->passed, 'an attempt ended by proctoring can never be a pass');
        $this->assertNotNull($session->completed_at);
    }

    public function test_the_lock_grades_only_what_was_saved(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId, $questions] = $this->startAttempt();
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");

        $this->answerAll($sessionId, $questions, [0]); // 1 of 3 answered, correct
        // Repeats of one type all count server-side (the 1.5s dedupe lives in the client).
        foreach (range(1, 3) as $_) {
            $this->violation($sessionId, 'tab_switch');
        }

        $this->assertEqualsWithDelta(33.33, (float) SoftSkillSession::find($sessionId)->score_percent, 0.01);
    }

    public function test_a_locked_attempt_rejects_further_answers_and_submits(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId, $questions] = $this->startAttempt();
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");

        foreach (['tab_switch', 'fullscreen_exit', 'devtools_detected'] as $type) {
            $this->violation($sessionId, $type);
        }

        $this->postJson("/api/soft-skills/sessions/{$sessionId}/answer", ['response_id' => $questions[0]['response_id'], 'selected_index' => 0])->assertStatus(403);
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(403);

        // The (ended) attempt is still viewable, flagged as terminated by proctoring.
        $this->getJson("/api/soft-skills/sessions/{$sessionId}")
            ->assertStatus(200)
            ->assertJsonPath('session.passed', false)
            ->assertJsonPath('session.proctoring.terminated', true)
            ->assertJsonPath('session.proctoring.violation_count', 3);
    }

    public function test_events_after_a_lock_are_still_logged_and_report_locked(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId] = $this->startAttempt();
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");

        foreach (['tab_switch', 'fullscreen_exit', 'devtools_detected'] as $type) {
            $this->violation($sessionId, $type);
        }
        $this->violation($sessionId, 'tab_switch')->assertStatus(200)->assertJsonPath('locked', true)->assertJsonPath('session.violation_count', 3);

        $this->assertSame(4, SoftSkillProctoringViolation::count());
        $this->assertSame(3, SoftSkillProctoringViolation::where('counted_toward_lock', true)->count());
    }

    public function test_a_normal_submit_with_proctoring_still_works_and_is_not_flagged(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId, $questions] = $this->startAttempt();
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");
        $this->violation($sessionId, 'tab_switch'); // one warning, below the limit

        $this->answerAll($sessionId, $questions, [0, 1, 2]);
        $result = $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(200)->json('session');

        $this->assertTrue($result['passed']);
        $this->assertSame(['violation_count' => 1, 'terminated' => false], $result['proctoring']);
    }

    public function test_events_after_a_normal_submit_never_strike_or_lock_the_finished_attempt(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId] = $this->startAttempt();
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(200);

        // e.g. fullscreen closing while the page navigates to the result screen.
        foreach (['fullscreen_exit', 'tab_switch', 'devtools_detected', 'fullscreen_exit'] as $type) {
            $this->violation($sessionId, $type)->assertStatus(200)->assertJsonPath('locked', false)->assertJsonPath('session.violation_count', 0);
        }

        $this->assertSame('active', SoftSkillProctoringSession::first()->status);
        $this->assertSame(0, SoftSkillProctoringViolation::where('counted_toward_lock', true)->count());
        $this->assertSame(SoftSkillSession::STATUS_COMPLETED, SoftSkillSession::find($sessionId)->status);
    }

    public function test_proctoring_cannot_start_on_a_finished_attempt(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId] = $this->startAttempt();
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(200);

        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start")->assertStatus(422);
        $this->assertSame(0, SoftSkillProctoringSession::count());
    }

    public function test_a_locked_attempt_still_counts_toward_max_attempts(): void
    {
        Sanctum::actingAs($this->studentUser());
        $assessment = $this->generalAssessment(maxAttempts: 1);
        $sessionId = $this->postJson("/api/soft-skills/{$assessment->slug}/start")->json('session.id');
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");

        foreach (['tab_switch', 'fullscreen_exit', 'devtools_detected'] as $type) {
            $this->violation($sessionId, $type);
        }

        // Otherwise "get locked, retry until it goes your way" would be a free loop.
        $this->postJson("/api/soft-skills/{$assessment->slug}/start")->assertStatus(403);
    }

    public function test_another_student_cannot_touch_someone_elses_proctoring(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId] = $this->startAttempt();
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");

        Sanctum::actingAs($this->studentUser());
        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start")->assertStatus(404);
        $this->violation($sessionId, 'tab_switch')->assertStatus(404);
    }

    public function test_violations_need_a_started_proctoring_session_and_a_known_type(): void
    {
        Sanctum::actingAs($this->studentUser());
        [$sessionId] = $this->startAttempt();

        $this->violation($sessionId, 'tab_switch')->assertStatus(404); // never consented

        $this->postJson("/api/soft-skills/sessions/{$sessionId}/proctoring/start");
        $this->violation($sessionId, 'made_up_type')->assertStatus(422);
    }

    public function test_an_unproctored_attempt_is_completely_unaffected(): void
    {
        // The pre-existing flow — start/answer/submit with no proctoring call at all (kill switch off, or an old client).
        Sanctum::actingAs($this->studentUser());
        [$sessionId, $questions] = $this->startAttempt();

        $this->answerAll($sessionId, $questions, [0, 1, 3]);
        $result = $this->postJson("/api/soft-skills/sessions/{$sessionId}/submit")->assertStatus(200)->json('session');

        $this->assertEqualsWithDelta(66.67, $result['score_percent'], 0.01);
        $this->assertTrue($result['passed']);
        $this->assertNull($result['proctoring']);
    }
}
