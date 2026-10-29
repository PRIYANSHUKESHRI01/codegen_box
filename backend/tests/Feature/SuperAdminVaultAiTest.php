<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\Plan;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\VaultInterviewQualification;
use App\Models\VaultProfile;
use App\Services\InterviewTrackAdvancementService;
use App\Services\SubscriptionService;
use App\Services\Vault\VaultInterviewQualificationService;
use App\Support\AcademicYear;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Superadmin → Vault AI: giving a blocked student their attempts back, correcting marks, qualifying someone outright, taking a
 * qualification back, opening the interview at the gate. The student's own screens must follow at once, and a fresh start must be
 * fresh - nothing sat before it may leak into the new cycle.
 */
class SuperAdminVaultAiTest extends TestCase
{
    use RefreshDatabase;

    private const STACK = 'laravel';

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        Cache::flush();
        $this->seed(PlanSeeder::class);
        config(['vault.sync_url' => 'https://vault.example.test/hook', 'vault.sync_secret' => 'secret']);
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    /** A direct student on Expert (the Vault + no trial cap on mock interviews). */
    private function student(array $attrs = []): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE'] + $attrs);
        $plan = Plan::where('code', Plan::CODE_EXPERT)->firstOrFail();
        app(SubscriptionService::class)->grantIndividualPlan($student, $plan, User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
            'days' => 365, 'kind' => 'complimentary', 'reason' => 'Test',
        ]);

        return $student->fresh();
    }

    private function qual(User $student, array $attrs = [], string $stack = self::STACK): VaultInterviewQualification
    {
        $qual = app(VaultInterviewQualificationService::class)->getOrCreateQualification($student, $stack);
        $qual->update($attrs);

        return $qual->fresh();
    }

    private function failedAttempt(int $attempt, int $mark = 40): array
    {
        return [
            'attempt' => $attempt, 'series_number' => $attempt, 'scores' => ['1' => $mark, '2' => $mark, '3' => $mark],
            'average' => (float) $mark, 'evaluated_at' => now()->subDays(10)->toIso8601String(), 'passed' => false,
        ];
    }

    /** The state of a student who failed all three series and is waiting out the 45 days. */
    private function blocked(User $student, string $stack = self::STACK): VaultInterviewQualification
    {
        return $this->qual($student, [
            'current_attempt' => 3,
            'status' => VaultInterviewQualification::STATUS_COOLING_DOWN,
            'cooldown_until' => now()->addDays(30),
            'series_scores' => [],
            'attempt_history' => [$this->failedAttempt(1, 40), $this->failedAttempt(2, 50), $this->failedAttempt(3, 30)],
        ], $stack);
    }

    private function url(User $student, string $tail = '', string $stack = self::STACK): string
    {
        return "/api/superadmin/vault-ai/students/{$student->id}/stacks/{$stack}{$tail}";
    }

    private function actAsAdmin(): User
    {
        Sanctum::actingAs($admin = $this->superadmin());

        return $admin;
    }

    private function studentStatus(User $student): array
    {
        Sanctum::actingAs($student);

        return $this->getJson('/api/vault-qualification/status?stack='.self::STACK)->assertOk()->json();
    }

    private function sitAndScore(User $student, Interview $interview, int $score): void
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

        app(InterviewTrackAdvancementService::class)->finalizeStandaloneScoring($session->fresh());
    }

    // ───────────────────────────── access & the student page ─────────────────────────────

    public function test_only_a_superadmin_can_use_it(): void
    {
        $student = $this->student();
        $this->blocked($student);

        foreach ([User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]), $student] as $who) {
            Sanctum::actingAs($who);
            $this->getJson("/api/superadmin/vault-ai/students/{$student->id}")->assertForbidden();
            $this->postJson($this->url($student, '/reset'), ['reason' => 'Please'])->assertForbidden();
        }

        $this->assertSame(VaultInterviewQualification::STATUS_COOLING_DOWN, VaultInterviewQualification::where('user_id', $student->id)->value('status'));
    }

    public function test_the_student_page_has_the_gate_every_stack_and_their_attempt_history(): void
    {
        $student = $this->student();
        $this->blocked($student);
        $this->actAsAdmin();

        $res = $this->getJson("/api/superadmin/vault-ai/students/{$student->id}")->assertOk();
        $res->assertJsonPath('gate.state', 'open')
            ->assertJsonPath('qualifications.0.stack_key', self::STACK)
            ->assertJsonPath('qualifications.0.failed_attempts', 3);
        $this->assertCount(3, $res->json('qualifications.0.attempt_history'));
        $this->assertContains(self::STACK, array_column($res->json('stacks'), 'key'));
    }

    // ───────────────────────────── give access again ─────────────────────────────

    public function test_resetting_a_blocked_student_gives_all_three_attempts_back_at_once(): void
    {
        $student = $this->student();
        $this->blocked($student);
        $admin = $this->actAsAdmin();

        $this->postJson($this->url($student, '/reset'), ['reason' => 'AI scoring was down that week'])->assertOk();

        $qual = VaultInterviewQualification::where('user_id', $student->id)->firstOrFail();
        $this->assertSame(VaultInterviewQualification::STATUS_IN_PROGRESS, $qual->status);
        $this->assertSame(1, $qual->current_attempt);
        $this->assertNull($qual->cooldown_until);
        $this->assertCount(3, $qual->attempt_history, 'the failed series stay on record');
        $this->assertSame('reset', $qual->admin_log[0]['action']);
        $this->assertSame($admin->id, $qual->admin_log[0]['by_id']);

        // The student sees a clean slate - not three red markers from the cycle that was wiped...
        $status = $this->studentStatus($student);
        $this->assertSame('in_progress', $status['status']);
        $this->assertSame(1, $status['current_attempt']);
        $this->assertSame([], $status['past_attempts']);
        $this->assertFalse($status['is_cooling_down']);

        // ...and can sit straight away, with no waiting.
        Sanctum::actingAs($student);
        $this->postJson('/api/vault-qualification/start-set', ['stack' => self::STACK, 'set_number' => 1])->assertOk();

        $this->assertDatabaseHas('activity_logs', ['action' => 'Reset a student\'s Vault AI Interview']);
        $this->assertSame(1, UserNotification::where('user_id', $student->id)->where('title', 'like', '%fresh start')->count());
    }

    public function test_a_reset_needs_a_reason_and_refuses_when_there_is_nothing_to_reset(): void
    {
        $student = $this->student();
        $this->actAsAdmin();

        $this->postJson($this->url($student, '/reset'), [])->assertStatus(422)->assertJsonValidationErrors('reason');

        $this->postJson($this->url($student, '/reset'), ['reason' => 'Just in case'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This student has not used any attempts on this stack, so there is nothing to reset.');
    }

    public function test_an_unknown_stack_and_a_non_student_are_not_found(): void
    {
        $student = $this->student();
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
        $this->actAsAdmin();

        $this->postJson($this->url($student, '/reset', 'cobol'), ['reason' => 'x y z'])->assertNotFound();
        $this->getJson("/api/superadmin/vault-ai/students/{$staff->id}")->assertNotFound();
    }

    public function test_a_reset_in_the_middle_of_a_series_cannot_be_polluted_by_the_old_interview(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        $first = Interview::findOrFail($this->postJson('/api/vault-qualification/start-set', ['stack' => self::STACK, 'set_number' => 1])->assertOk()->json('interview.id'));
        $this->sitAndScore($student, $first, 40);
        $this->assertSame(40, $this->studentStatus($student)['active_series']['sets'][0]['score_percent']);

        $this->actAsAdmin();
        $this->postJson($this->url($student, '/reset'), ['reason' => 'Wrong set was loaded'])->assertOk();

        // The finished interview of the wiped cycle is not taken for Set 1 of the new one, and does not re-score into it.
        $set1 = $this->studentStatus($student)['active_series']['sets'][0];
        $this->assertSame('not_started', $set1['status']);
        $this->assertNull($set1['score_percent']);

        Sanctum::actingAs($student);
        $second = $this->postJson('/api/vault-qualification/start-set', ['stack' => self::STACK, 'set_number' => 1])->assertOk()->json('interview.id');
        $this->assertNotSame($first->id, $second);
    }

    public function test_after_a_natural_cooldown_expiry_the_old_failures_no_longer_show_either(): void
    {
        $student = $this->student();
        $this->blocked($student)->update(['cooldown_until' => now()->subMinute()]);

        $status = $this->studentStatus($student);

        $this->assertSame('in_progress', $status['status']);
        $this->assertSame([], $status['past_attempts']);
    }

    // ───────────────────────────── marks ─────────────────────────────

    public function test_entering_three_passing_marks_qualifies_the_student_and_puts_them_in_the_vault(): void
    {
        $student = $this->student();
        $this->qual($student);
        $this->actAsAdmin();

        $this->putJson($this->url($student, '/scores'), ['scores' => ['1' => 70, '2' => 60, '3' => 65], 'reason' => 'Marked from the paper test'])->assertOk()
            ->assertJsonPath('qualifications.0.status', 'qualified')
            ->assertJsonPath('qualifications.0.series_average', 65);

        $profile = VaultProfile::where('user_id', $student->id)->firstOrFail();
        $this->assertTrue($profile->is_eligible);
        $this->assertSame(VaultProfile::SOURCE_AI_INTERVIEW, $profile->qualification_source);
        $this->assertEquals(65, (float) User::find($student->id)->vault_ai_score);
        $this->assertSame(1, UserNotification::where('user_id', $student->id)->where('title', 'Mellow Vault Qualified!')->count());
        $this->assertTrue($this->studentStatus($student)['is_qualified']);
    }

    public function test_failing_marks_move_the_student_on_exactly_as_a_real_failure_would(): void
    {
        $student = $this->student();
        $this->qual($student);
        $this->actAsAdmin();

        $this->putJson($this->url($student, '/scores'), ['scores' => ['1' => 30, '2' => 30, '3' => 30], 'reason' => 'Entered by hand'])->assertOk()
            ->assertJsonPath('qualifications.0.status', 'in_progress')
            ->assertJsonPath('qualifications.0.current_attempt', 2)
            ->assertJsonPath('qualifications.0.failed_attempts', 1);
    }

    public function test_a_partial_entry_is_kept_and_nothing_is_decided_until_all_three_sets_have_marks(): void
    {
        $student = $this->student();
        $this->qual($student);
        $this->actAsAdmin();

        $this->putJson($this->url($student, '/scores'), ['scores' => ['2' => 88], 'reason' => 'Only set 2 was done'])->assertOk()
            ->assertJsonPath('qualifications.0.status', 'in_progress')
            ->assertJsonPath('qualifications.0.series_scores.2', 88);
    }

    public function test_a_blocked_student_cannot_have_the_current_series_edited_but_a_past_attempt_can_be_corrected(): void
    {
        $student = $this->student();
        $this->blocked($student);
        $this->actAsAdmin();

        $this->putJson($this->url($student, '/scores'), ['scores' => ['1' => 90], 'reason' => 'Try'])->assertStatus(422);

        // Attempt 3 (index 2) was 30/30/30; lifting set 1 to 100 makes it 53 - corrected, still failed, still blocked.
        $this->putJson($this->url($student, '/scores'), ['scores' => ['1' => 100], 'attempt_index' => 2, 'reason' => 'Set 1 was mis-scored'])->assertOk()
            ->assertJsonPath('qualifications.0.status', 'cooling_down')
            ->assertJsonPath('qualifications.0.attempt_history.2.average', 53.33)
            ->assertJsonPath('qualifications.0.attempt_history.2.edited_by_admin', true);

        // Lifting it to a pass qualifies the student and ends the block.
        $this->putJson($this->url($student, '/scores'), ['scores' => ['2' => 90, '3' => 90], 'attempt_index' => 2, 'reason' => 'Sets 2 and 3 were mis-scored'])->assertOk()
            ->assertJsonPath('qualifications.0.status', 'qualified')
            ->assertJsonPath('qualifications.0.attempt_history.2.passed', true);

        $qual = VaultInterviewQualification::where('user_id', $student->id)->firstOrFail();
        $this->assertNull($qual->cooldown_until);
        $this->assertSame(3, $qual->current_attempt);
        $this->assertTrue(VaultProfile::where('user_id', $student->id)->firstOrFail()->is_eligible);
    }

    public function test_marks_must_be_whole_percentages_for_sets_one_to_three(): void
    {
        $student = $this->student();
        $this->qual($student);
        $this->actAsAdmin();

        $this->putJson($this->url($student, '/scores'), ['scores' => ['1' => 101], 'reason' => 'Too high'])->assertStatus(422);
        $this->putJson($this->url($student, '/scores'), ['scores' => ['4' => 50], 'reason' => 'No set four'])->assertStatus(422);
        $this->putJson($this->url($student, '/scores'), ['scores' => [], 'reason' => 'Nothing'])->assertStatus(422);
        $this->putJson($this->url($student, '/scores'), ['scores' => ['1' => 50]])->assertStatus(422)->assertJsonValidationErrors('reason');
    }

    public function test_a_qualified_students_marks_can_be_raised_but_not_dropped_under_the_line(): void
    {
        $student = $this->student();
        $this->qual($student);
        $this->actAsAdmin();
        $this->putJson($this->url($student, '/scores'), ['scores' => ['1' => 70, '2' => 70, '3' => 70], 'reason' => 'First entry'])->assertOk();

        $this->putJson($this->url($student, '/scores'), ['scores' => ['1' => 10], 'reason' => 'Drop'])->assertStatus(422);
        $this->assertSame('qualified', VaultInterviewQualification::where('user_id', $student->id)->value('status'));

        $this->putJson($this->url($student, '/scores'), ['scores' => ['1' => 100], 'reason' => 'Raise'])->assertOk()
            ->assertJsonPath('qualifications.0.series_average', 80);
        $this->assertEquals(80, (float) VaultProfile::where('user_id', $student->id)->value('ai_interview_score'));
    }

    // ───────────────────────────── mark qualified / take back ─────────────────────────────

    public function test_marking_a_blocked_student_qualified_ends_the_block_and_records_who_did_it(): void
    {
        $student = $this->student();
        $this->blocked($student);
        $admin = $this->actAsAdmin();

        $this->postJson($this->url($student, '/qualify'), ['average' => 72, 'reason' => 'Cleared the offline round'])->assertOk()
            ->assertJsonPath('qualifications.0.status', 'qualified')
            ->assertJsonPath('qualifications.0.qualified_by_admin', true)
            ->assertJsonPath('qualifications.0.series_average', 72);

        $qual = VaultInterviewQualification::where('user_id', $student->id)->firstOrFail();
        $this->assertSame($admin->id, $qual->qualified_by_admin_id);
        $this->assertNull($qual->cooldown_until);
        $this->assertTrue(VaultProfile::where('user_id', $student->id)->firstOrFail()->is_eligible);
        $this->assertSame(1, UserNotification::where('user_id', $student->id)->where('title', 'Mellow Vault Qualified!')->count());

        $this->postJson($this->url($student, '/qualify'), ['average' => 72, 'reason' => 'Again'])->assertStatus(422);
    }

    public function test_the_average_to_qualify_at_cannot_be_under_the_line(): void
    {
        $student = $this->student();
        $this->qual($student);
        $this->actAsAdmin();

        $this->postJson($this->url($student, '/qualify'), ['average' => 59, 'reason' => 'Close enough'])->assertStatus(422)->assertJsonValidationErrors('average');
        $this->postJson($this->url($student, '/qualify'), ['average' => 101, 'reason' => 'Too good'])->assertStatus(422);
    }

    public function test_starting_over_a_qualified_student_takes_the_qualification_back_and_the_vault_follows(): void
    {
        $student = $this->student();
        $this->qual($student);
        $this->actAsAdmin();
        $this->postJson($this->url($student, '/qualify'), ['average' => 75, 'reason' => 'Granted'])->assertOk();
        $this->assertTrue(VaultProfile::where('user_id', $student->id)->firstOrFail()->is_eligible);

        $this->postJson($this->url($student, '/reset'), ['reason' => 'Granted by mistake'])->assertOk()
            ->assertJsonPath('qualifications.0.status', 'in_progress');

        $profile = VaultProfile::where('user_id', $student->id)->firstOrFail();
        $this->assertFalse($profile->is_eligible);
        $this->assertNull($profile->ai_interview_score);
        $this->assertNull($profile->ai_interview_stack);
        $this->assertNull(User::find($student->id)->vault_ai_score);
        $this->assertNull(VaultInterviewQualification::where('user_id', $student->id)->value('qualified_by_admin_id'));
    }

    public function test_taking_back_one_stack_keeps_the_students_other_qualification(): void
    {
        $student = $this->student();
        $this->qual($student, [], 'laravel');
        $this->qual($student, [], 'nodejs');
        $this->actAsAdmin();
        $this->postJson($this->url($student, '/qualify', 'laravel'), ['average' => 70, 'reason' => 'One'])->assertOk();
        $this->postJson($this->url($student, '/qualify', 'nodejs'), ['average' => 85, 'reason' => 'Two'])->assertOk();

        $this->postJson($this->url($student, '/reset', 'nodejs'), ['reason' => 'Undo the second'])->assertOk();

        $profile = VaultProfile::where('user_id', $student->id)->firstOrFail();
        $this->assertTrue($profile->is_eligible, 'still qualified through Laravel');
        $this->assertSame('laravel', $profile->ai_interview_stack);
        $this->assertEquals(70, (float) $profile->ai_interview_score);
    }

    // ───────────────────────────── the gate ─────────────────────────────

    public function test_a_student_waiting_at_the_gate_can_be_let_in(): void
    {
        $college = College::create(['name' => 'Gate College', 'short_code' => 'GC', 'tier' => 'Standard']);
        $student = $this->student(['college_id' => $college->id]);
        $student->forceFill(['graduation_year' => AcademicYear::graduationYearFor(4), 'first_login_at' => now()])->save();
        $this->actAsAdmin();

        $this->getJson("/api/superadmin/vault-ai/students/{$student->id}")->assertJsonPath('gate.state', 'locked');
        Sanctum::actingAs($student);
        $this->postJson('/api/vault-qualification/start-set', ['stack' => self::STACK, 'set_number' => 1])->assertForbidden();

        $this->actAsAdmin();
        $this->postJson("/api/superadmin/vault-ai/students/{$student->id}/unlock-access", ['reason' => 'Placement drive next week'])->assertOk()
            ->assertJsonPath('gate.state', 'open');

        Sanctum::actingAs($student->fresh()); // a real request loads the student from the database, unlock included
        $this->postJson('/api/vault-qualification/start-set', ['stack' => self::STACK, 'set_number' => 1])->assertOk();
        $this->assertTrue(ActivityLog::where('action', 'Unlocked the Vault AI Interview for a student')->exists());
    }
}
