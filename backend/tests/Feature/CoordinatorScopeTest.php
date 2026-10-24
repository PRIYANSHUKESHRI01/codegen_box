<?php

namespace Tests\Feature;

use App\Jobs\SendProctoringViolationReport;
use App\Mail\ProctoringViolationReportMail;
use App\Models\ActivityLog;
use App\Models\College;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ProctoringSession;
use App\Models\ProctoringViolation;
use App\Models\Submission;
use App\Models\User;
use App\Services\SectionCoordinatorService;
use App\Services\StudentBulkNotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesCodingActivityFixtures;
use Tests\TestCase;

/**
 * "A Section Coordinator sees the students of THEIR section of THEIR college, and nothing else" — proven for every
 * endpoint a coordinator can reach, against every way of being out of scope: another section, another college, another
 * branch of the same section, a student whose branch is unknown, staff and coordinator ids, guessed and unknown ids. Plus
 * the branch scope itself (one coordinator per branch of a section), the rules that keep two coordinators from covering
 * the same student, and the hardening around blocking and bulk messages.
 */
class CoordinatorScopeTest extends TestCase
{
    use CreatesCodingActivityFixtures;
    use RefreshDatabase;

    private College $college;

    private College $other;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        $this->college = College::create(['name' => 'Scope College', 'short_code' => 'SC']);
        $this->other = College::create(['name' => 'Other College', 'short_code' => 'OC']);
    }

    private function student(string $branch, ?string $section, ?College $college = null, array $over = []): User
    {
        $n = ++$this->seq;

        return User::factory()->create(array_merge([
            'name' => "Student {$n} {$branch} {$section}", 'role' => User::ROLE_USER, 'college_id' => ($college ?? $this->college)->id,
            'branch' => $branch, 'section' => $section, 'must_change_password' => false,
        ], $over));
    }

    private function coordinator(string $section, ?array $scope = null, ?College $college = null, array $over = []): User
    {
        $n = ++$this->seq;
        $coordinator = User::factory()->create(array_merge([
            'name' => "Coordinator {$n} {$section}", 'role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => ($college ?? $this->college)->id,
            'section' => $section, 'must_change_password' => false,
        ], $over));
        $coordinator->forceFill(['coordinator_scope' => $scope])->save();

        return $coordinator;
    }

    private function tpo(?College $college = null): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => ($college ?? $this->college)->id]);
    }

    /** The roster as this coordinator sees it: student ids. */
    private function roster(User $coordinator): array
    {
        Sanctum::actingAs($coordinator);

        return collect($this->getJson('/api/coordinator/students')->assertOk()->json('students'))->pluck('id')->sort()->values()->all();
    }

    private function ids(User ...$users): array
    {
        return collect($users)->pluck('id')->sort()->values()->all();
    }

    /** A little world: section A mixes CSE / ECE / Mechanical / unknown; section B is separate; another college has its own "A". */
    private function world(): array
    {
        return [
            'cse' => $this->student('CSE', 'A'),
            'ece' => $this->student('ECE', 'A'),
            'ece_spaced' => $this->student('Electronics and Communication', ' a '),
            'mech' => $this->student('Mechanical', 'A'),
            'unknown' => $this->student('Quantum Basket Weaving', 'A'),
            'b_cse' => $this->student('CSE', 'B'),
            'x_cse' => $this->student('CSE', 'A', $this->other),
            'x_ece' => $this->student('ECE', 'A', $this->other),
            'unsectioned' => $this->student('CSE', null, null, ['section' => null]),
        ];
    }

    // ───────────────────────────── the roster ─────────────────────────────

    public function test_a_coordinator_sees_exactly_the_students_of_their_section_of_their_college(): void
    {
        $w = $this->world();
        $coordinator = $this->coordinator('A');

        // All of section A at THIS college — every branch, the unknown one, and the " a " spelling — and nothing else.
        $this->assertSame($this->ids($w['cse'], $w['ece'], $w['ece_spaced'], $w['mech'], $w['unknown']), $this->roster($coordinator));
    }

    public function test_the_same_section_name_at_another_college_is_a_different_roster(): void
    {
        $w = $this->world();
        $theirs = $this->coordinator('A', null, $this->other);

        $this->assertSame($this->ids($w['x_cse'], $w['x_ece']), $this->roster($theirs));
    }

    public function test_a_branch_scoped_coordinator_sees_only_their_branches_of_the_section(): void
    {
        $w = $this->world();

        $this->assertSame($this->ids($w['ece'], $w['ece_spaced']), $this->roster($this->coordinator('A', ['disciplines' => ['ece'], 'branches' => []])));
        $this->assertSame($this->ids($w['cse']), $this->roster($this->coordinator('A', ['disciplines' => [], 'branches' => ['cse']], null, ['email' => 'only-cse@example.com'])));
    }

    public function test_a_branch_scoped_coordinator_never_sees_a_student_whose_branch_is_unknown(): void
    {
        $w = $this->world();
        $everyBranch = $this->coordinator('A', ['disciplines' => ['cse', 'ece', 'eee', 'mech', 'civil', 'other'], 'branches' => []]);

        $this->assertNotContains($w['unknown']->id, $this->roster($everyBranch), 'unknown-branch students belong to the TPO until their branch is mapped');
    }

    public function test_a_coordinator_with_no_section_or_no_college_sees_nobody(): void
    {
        $this->world();

        $this->assertSame([], $this->roster($this->coordinator('A', null, null, ['section' => null])));
        $this->assertSame([], $this->roster($this->coordinator('A', null, null, ['section' => '  '])));

        $collegeless = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => null, 'section' => 'A', 'must_change_password' => false]);
        $this->assertSame([], $this->roster($collegeless), 'no college, no roster — never every unsectioned student');
    }

    public function test_the_roster_carries_no_staff_and_no_coordinators(): void
    {
        $this->world();
        $this->tpo()->forceFill(['section' => 'A'])->save();
        $this->coordinator('A', null, null, ['email' => 'second@example.com'])->forceFill(['section' => 'A'])->save();
        $coordinator = $this->coordinator('A', ['disciplines' => ['cse'], 'branches' => []]);

        Sanctum::actingAs($coordinator);
        $roles = collect($this->getJson('/api/coordinator/students')->assertOk()->json('students'))->pluck('id')
            ->map(fn ($id) => User::find($id)->role)->unique()->values()->all();

        $this->assertSame([User::ROLE_USER], $roles);
    }

    // ───────────────────────────── one student at a time ─────────────────────────────

    public function test_a_coordinator_can_open_the_report_of_a_student_they_look_after(): void
    {
        $w = $this->world();
        Sanctum::actingAs($this->coordinator('A'));

        $this->getJson("/api/coordinator/students/{$w['ece']->id}/report")->assertOk()->assertJsonPath('student.id', $w['ece']->id);
        $this->getJson("/api/coordinator/students/{$w['ece_spaced']->id}/report")->assertOk();
    }

    public function test_every_out_of_scope_student_is_a_404_not_a_403_on_every_report_route(): void
    {
        $w = $this->world();
        $scoped = $this->coordinator('A', ['disciplines' => ['ece'], 'branches' => []]);
        $other = $this->coordinator('B', null, null, ['email' => 'bee@example.com']);
        $submission = $this->practiceSubmission($w['cse'], 'python', 'accepted');
        $contestAttempt = $this->contestAttempt($w['cse'], 'python', 'accepted');

        $outOfScope = [
            'another branch of the section' => $w['cse'],
            'an unknown-branch student' => $w['unknown'],
            'another section' => $w['b_cse'],
            'another college, same section name' => $w['x_cse'],
            'a student with no section' => $w['unsectioned'],
            'the TPO' => $this->tpo(),
            'another coordinator' => $other,
            'the coordinator themselves' => $scoped,
        ];

        Sanctum::actingAs($scoped);

        foreach ($outOfScope as $why => $target) {
            $this->getJson("/api/coordinator/students/{$target->id}/report")->assertNotFound();
            $this->getJson("/api/coordinator/students/{$target->id}/submissions/{$submission->id}")->assertNotFound();
            $this->getJson("/api/coordinator/students/{$target->id}/contest-submissions/{$contestAttempt->id}")->assertNotFound();
            $this->postJson("/api/coordinator/students/{$target->id}/toggle-block", ['reason' => 'x'])->assertNotFound();
            $this->assertFalse((bool) $target->fresh()->is_blocked, "{$why} must be untouched");
        }

        $this->getJson('/api/coordinator/students/999999/report')->assertNotFound();
    }

    public function test_a_submission_belonging_to_another_student_cannot_be_read_through_an_in_scope_student(): void
    {
        $w = $this->world();
        $theirs = $this->practiceSubmission($w['b_cse'], 'python', 'accepted');
        $mine = $this->practiceSubmission($w['cse'], 'python', 'accepted');

        Sanctum::actingAs($this->coordinator('A'));

        $this->getJson("/api/coordinator/students/{$w['cse']->id}/submissions/{$theirs->id}")->assertNotFound();
        $this->getJson("/api/coordinator/students/{$w['cse']->id}/submissions/{$mine->id}")->assertOk();
    }

    // ───────────────────────────── blocking ─────────────────────────────

    public function test_blocking_needs_a_reason_and_is_written_to_the_activity_log(): void
    {
        $w = $this->world();
        $coordinator = $this->coordinator('A');
        Sanctum::actingAs($coordinator);

        $this->postJson("/api/coordinator/students/{$w['cse']->id}/toggle-block")->assertStatus(422);
        $this->assertFalse((bool) $w['cse']->fresh()->is_blocked);

        $this->postJson("/api/coordinator/students/{$w['cse']->id}/toggle-block", ['reason' => 'Shared account with another student'])
            ->assertOk()->assertJsonPath('student.is_blocked', true);

        $fresh = $w['cse']->fresh();
        $this->assertTrue($fresh->is_blocked);
        $this->assertSame('Shared account with another student', $fresh->blocked_reason);
        $this->assertSame($coordinator->id, $fresh->blocked_by);

        $log = ActivityLog::where('action', 'Section coordinator blocked a student')->firstOrFail();
        $this->assertSame($coordinator->id, $log->actor_id);
        $this->assertSame('Shared account with another student', $log->meta['reason']);

        $this->postJson("/api/coordinator/students/{$w['cse']->id}/toggle-block")->assertOk()->assertJsonPath('student.is_blocked', false);
        $this->assertNull($w['cse']->fresh()->blocked_reason);
        $this->assertTrue(ActivityLog::where('action', 'Section coordinator unblocked a student')->exists());
    }

    public function test_a_coordinator_cannot_lift_a_block_that_mellow_staff_placed(): void
    {
        $w = $this->world();
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
        $w['cse']->forceFill(['is_blocked' => true, 'blocked_at' => now(), 'blocked_by' => $staff->id, 'blocked_reason' => 'Fraud'])->save();

        Sanctum::actingAs($this->coordinator('A'));

        $this->postJson("/api/coordinator/students/{$w['cse']->id}/toggle-block")->assertForbidden();
        $this->assertTrue($w['cse']->fresh()->is_blocked);
    }

    public function test_a_coordinator_can_lift_a_block_a_colleague_placed_but_not_one_from_another_college(): void
    {
        $w = $this->world();
        $colleague = $this->coordinator('B', null, null, ['email' => 'colleague@example.com']);
        $w['cse']->forceFill(['is_blocked' => true, 'blocked_at' => now(), 'blocked_by' => $colleague->id])->save();

        Sanctum::actingAs($this->coordinator('A'));
        $this->postJson("/api/coordinator/students/{$w['cse']->id}/toggle-block")->assertOk();

        $foreign = $this->coordinator('A', null, $this->other, ['email' => 'foreign@example.com']);
        $w['ece']->forceFill(['is_blocked' => true, 'blocked_at' => now(), 'blocked_by' => $foreign->id])->save();
        $this->postJson("/api/coordinator/students/{$w['ece']->id}/toggle-block")->assertForbidden();
    }

    public function test_a_blocked_coordinator_is_cut_off_on_the_next_request(): void
    {
        $this->world();
        $coordinator = $this->coordinator('A');
        $coordinator->forceFill(['is_blocked' => true, 'blocked_at' => now()])->save();

        Sanctum::actingAs($coordinator);

        $this->getJson('/api/coordinator/students')->assertForbidden()->assertJsonPath('code', 'account_blocked');
        $this->getJson('/api/coordinator/proctoring')->assertForbidden();
    }

    // ───────────────────────────── notifying ─────────────────────────────

    public function test_bulk_notify_reaches_only_students_in_scope_whatever_ids_are_sent(): void
    {
        $w = $this->world();
        $captured = null;
        $this->mock(StudentBulkNotificationService::class, function ($mock) use (&$captured) {
            $mock->shouldReceive('send')->once()->andReturnUsing(function (Collection $recipients) use (&$captured) {
                $captured = $recipients->pluck('id')->sort()->values()->all();

                return ['queued_count' => $recipients->count(), 'skipped_no_phone' => 0];
            });
        });

        Sanctum::actingAs($this->coordinator('A', ['disciplines' => ['ece'], 'branches' => []]));

        $this->postJson('/api/coordinator/students/bulk-notify', [
            'student_ids' => [$w['ece']->id, $w['cse']->id, $w['b_cse']->id, $w['x_ece']->id, $this->tpo()->id],
            'channel' => 'email', 'template' => 'generic', 'recipient' => 'student',
        ])->assertOk()->assertJsonPath('queued_count', 1);

        $this->assertSame([$w['ece']->id], $captured, 'only the ECE student of this section');
        $this->assertTrue(ActivityLog::where('action', 'Section coordinator sent a bulk notification')->exists());
    }

    public function test_bulk_notify_to_students_all_outside_the_scope_is_refused(): void
    {
        $w = $this->world();
        Sanctum::actingAs($this->coordinator('A'));

        $this->postJson('/api/coordinator/students/bulk-notify', ['student_ids' => [$w['b_cse']->id, $w['x_cse']->id], 'channel' => 'email', 'template' => 'generic', 'recipient' => 'student'])
            ->assertStatus(422);
    }

    public function test_bulk_notify_is_rate_limited_per_coordinator(): void
    {
        $w = $this->world();
        $this->mock(StudentBulkNotificationService::class, fn ($mock) => $mock->shouldReceive('send')->andReturn(['queued_count' => 1, 'skipped_no_phone' => 0]));
        Sanctum::actingAs($this->coordinator('A'));

        $payload = ['student_ids' => [$w['cse']->id], 'channel' => 'email', 'template' => 'generic', 'recipient' => 'student'];
        foreach (range(1, 12) as $i) {
            $this->postJson('/api/coordinator/students/bulk-notify', $payload)->assertOk();
        }
        $this->postJson('/api/coordinator/students/bulk-notify', $payload)->assertStatus(429);
    }

    // ───────────────────────────── proctoring ─────────────────────────────

    private function flaggedSession(User $student, int $violations = 2): ProctoringSession
    {
        $contest = Contest::create(['title' => 'Mock', 'slug' => 'mock-'.uniqid(), 'start_at' => now()->subHour(), 'end_at' => now()->addHour(), 'status' => 'published', 'contest_type' => 'general']);
        $participant = ContestParticipant::create(['contest_id' => $contest->id, 'user_id' => $student->id, 'registered_at' => now()]);
        $session = ProctoringSession::create(['contest_participant_id' => $participant->id, 'status' => 'locked', 'violation_count' => $violations, 'locked_at' => now(), 'consented_at' => now()]);
        ProctoringViolation::create(['proctoring_session_id' => $session->id, 'type' => 'tab_switch', 'counted_toward_lock' => true, 'occurred_at' => now()]);

        return $session;
    }

    public function test_proctoring_shows_only_sessions_of_students_in_scope_and_cannot_be_reached_by_id(): void
    {
        $w = $this->world();
        $mine = $this->flaggedSession($w['ece']);
        $sameSectionOtherBranch = $this->flaggedSession($w['cse']);
        $otherSection = $this->flaggedSession($w['b_cse']);
        $otherCollege = $this->flaggedSession($w['x_ece']);

        Sanctum::actingAs($this->coordinator('A', ['disciplines' => ['ece'], 'branches' => []]));

        $listed = collect($this->getJson('/api/coordinator/proctoring')->assertOk()->json('sessions'))->pluck('id')->all();
        $this->assertSame([$mine->id], $listed);

        $this->getJson("/api/coordinator/proctoring/{$mine->id}")->assertOk();
        foreach ([$sameSectionOtherBranch, $otherSection, $otherCollege] as $session) {
            $this->getJson("/api/coordinator/proctoring/{$session->id}")->assertNotFound();
            $this->postJson("/api/coordinator/proctoring/{$session->id}/reinstate")->assertNotFound();
            $this->assertSame('locked', $session->fresh()->status, 'an out-of-scope session must stay locked');
        }

        $this->postJson("/api/coordinator/proctoring/{$mine->id}/reinstate")->assertOk();
        $this->assertSame('active', $mine->fresh()->status);
    }

    public function test_the_violation_report_reaches_the_coordinator_who_looks_after_that_student_only(): void
    {
        Mail::fake();
        $w = $this->world();
        $tpo = $this->tpo();
        $ece = $this->coordinator('A', ['disciplines' => ['ece'], 'branches' => []], null, ['email' => 'ece-coord@example.com']);
        $cse = $this->coordinator('A', ['disciplines' => ['cse'], 'branches' => []], null, ['email' => 'cse-coord@example.com']);
        $blockedMech = $this->coordinator('A', ['disciplines' => ['mech'], 'branches' => []], null, ['email' => 'mech-coord@example.com']);
        $blockedMech->forceFill(['is_blocked' => true])->save();
        $elsewhere = $this->coordinator('B', null, null, ['email' => 'b-coord@example.com']);

        (new SendProctoringViolationReport($this->flaggedSession($w['ece'])->id))->handle();
        (new SendProctoringViolationReport($this->flaggedSession($w['mech'])->id))->handle();

        Mail::assertSent(ProctoringViolationReportMail::class, fn ($m) => $m->hasTo($tpo->email));
        Mail::assertSent(ProctoringViolationReportMail::class, fn ($m) => $m->hasTo('ece-coord@example.com'));
        Mail::assertNotSent(ProctoringViolationReportMail::class, fn ($m) => $m->hasTo('cse-coord@example.com'));
        Mail::assertNotSent(ProctoringViolationReportMail::class, fn ($m) => $m->hasTo('mech-coord@example.com'));
        Mail::assertNotSent(ProctoringViolationReportMail::class, fn ($m) => $m->hasTo('b-coord@example.com'));
    }

    // ───────────────────────────── nothing else is reachable ─────────────────────────────

    public function test_a_coordinator_cannot_reach_tpo_ops_or_student_routes(): void
    {
        $this->world();
        Sanctum::actingAs($this->coordinator('A'));

        foreach ([
            '/api/tpo/students/cohort', '/api/tpo/coordinators', '/api/tpo/reports/data', '/api/tpo/branches', '/api/tpo/core-insights/heatmap',
            '/api/admin/users', '/api/admin/colleges', '/api/superadmin/users', '/api/company/candidates',
            '/api/core', '/api/me/stats', '/api/contests',
        ] as $path) {
            $this->assertContains($this->getJson($path)->status(), [401, 403, 404], "a coordinator must not read {$path}");
        }

        $this->postJson('/api/tpo/students', ['name' => 'x'])->assertForbidden();
        $this->postJson('/api/tpo/coordinators', ['name' => 'x', 'email' => 'x@example.com', 'section' => 'A'])->assertForbidden();
    }

    public function test_other_roles_cannot_use_the_coordinator_routes(): void
    {
        $w = $this->world();

        foreach ([$this->tpo(), $w['cse'], User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]), User::factory()->create(['role' => User::ROLE_SUPERADMIN])] as $user) {
            Sanctum::actingAs($user);
            $this->getJson('/api/coordinator/students')->assertForbidden();
            $this->getJson("/api/coordinator/students/{$w['cse']->id}/report")->assertForbidden();
            $this->postJson("/api/coordinator/students/{$w['cse']->id}/toggle-block", ['reason' => 'x'])->assertForbidden();
            $this->getJson('/api/coordinator/proctoring')->assertForbidden();
        }
    }

    public function test_nothing_is_reachable_without_signing_in(): void
    {
        $this->getJson('/api/coordinator/students')->assertUnauthorized();
        $this->getJson('/api/coordinator/proctoring')->assertUnauthorized();
        $this->postJson('/api/coordinator/students/bulk-notify', [])->assertUnauthorized();
    }

    // ───────────────────────────── the one definition ─────────────────────────────

    public function test_the_sql_scope_and_the_in_memory_check_always_agree(): void
    {
        $w = $this->world();
        $service = app(SectionCoordinatorService::class);

        $scopes = [
            null,
            ['disciplines' => ['ece'], 'branches' => []],
            ['disciplines' => [], 'branches' => ['cse']],
            ['disciplines' => ['mech'], 'branches' => ['cse']],
            ['disciplines' => ['cse', 'ece', 'eee', 'mech', 'civil', 'other'], 'branches' => []],
        ];

        foreach ($scopes as $scope) {
            foreach (['A', 'a', ' A ', 'B', 'Z'] as $section) {
                $coordinator = $this->coordinator($section, $scope, null, ['email' => 'p'.++$this->seq.'@example.com']);

                foreach ($w as $name => $student) {
                    $this->assertSame(
                        $service->covers($coordinator, $student->fresh()),
                        $coordinator->coordinates($student->fresh()),
                        "scope ".json_encode($scope)." section '{$section}' student {$name}"
                    );
                }
            }
        }
    }

    public function test_a_blocked_student_is_still_on_the_roster_so_they_can_be_unblocked(): void
    {
        $w = $this->world();
        $w['cse']->forceFill(['is_blocked' => true, 'blocked_at' => now()])->save();

        $this->assertContains($w['cse']->id, $this->roster($this->coordinator('A')));
    }

    public function test_the_roster_endpoint_does_not_leak_other_sections_through_its_summary_fields(): void
    {
        $this->world();
        Sanctum::actingAs($this->coordinator('A', ['disciplines' => ['ece'], 'branches' => []]));

        $json = $this->getJson('/api/coordinator/students')->assertOk()->json();

        $this->assertSame('A', $json['section']);
        $this->assertSame('ECE', $json['scope']['label']);
        $this->assertCount(2, $json['students']);
    }
}
