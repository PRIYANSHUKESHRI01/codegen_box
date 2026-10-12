<?php

namespace Tests\Feature;

use App\Models\ProjectEnrollment;
use App\Models\ProjectSubmission;
use App\Services\Workspaces\ExecResult;
use App\Services\Workspaces\FakeWorkspaceRuntime;
use App\Services\Workspaces\WorkspaceManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * Handing a project in: the archive is taken from the student's live
 * workspace, stored privately, and queued for review.
 */
class ProjectSubmissionTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->fakeWorkspaces();
        Storage::fake('local');
        // The snapshot script is the only exec that runs `tar --null`; it prints the archive size.
        FakeWorkspaceRuntime::$execResults = ['tar --null' => new ExecResult(0, "13\n")];
    }

    /** A student with Lab, an active project, and a RUNNING workspace. */
    private function withRunningWorkspace(): array
    {
        $student = $this->studentWithLab();
        $topic = $this->topic();
        $enrollment = $this->enroll($student, $topic);
        $manager = app(WorkspaceManager::class);
        $manager->start($manager->provision($enrollment), $student);

        return [$student, $enrollment, $topic];
    }

    private function submitUrl(ProjectEnrollment $enrollment): string
    {
        return "/api/project-lab/enrollments/{$enrollment->id}/submit";
    }

    public function test_submitting_stores_the_snapshot_privately_and_queues_it_for_review(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        Sanctum::actingAs($student);

        $response = $this->postJson($this->submitUrl($enrollment), [
            'repo_url' => 'https://github.com/asha/lms',
            'live_url' => 'https://lms.example.com',
            'notes' => 'Everything works except the quiz timer.',
        ])->assertCreated();

        $response->assertJsonPath('submission.attempt', 1)
            ->assertJsonPath('submission.status', 'pending_review')
            ->assertJsonPath('submission.has_snapshot', true)
            ->assertJsonPath('submission.snapshot_size_bytes', strlen("FAKE-SNAPSHOT\n"))
            ->assertJsonPath('enrollment.status', 'submitted');

        $submission = ProjectSubmission::firstOrFail();
        $this->assertSame(hash('sha256', "FAKE-SNAPSHOT\n"), $submission->snapshot_sha256);
        Storage::disk('local')->assertExists($submission->snapshot_path);
        $this->assertStringContainsString('/'.$student->id.'/', $submission->snapshot_path);
        $this->assertSame("FAKE-SNAPSHOT\n", Storage::disk('local')->get($submission->snapshot_path));
        $this->assertSame(ProjectEnrollment::STATUS_SUBMITTED, $enrollment->fresh()->status);
    }

    public function test_submitting_stops_the_workspace_and_its_hours_but_keeps_the_files(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        $workspace = $enrollment->fresh()->workspace; // the object we were handed cached its relation before provisioning
        $this->assertCount(1, FakeWorkspaceRuntime::$containers);
        Sanctum::actingAs($student);

        $response = $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])->assertCreated();

        $response->assertJsonPath('enrollment.workspace.status', 'stopped')
            ->assertJsonPath('enrollment.workspace.stop_reason', 'submitted')
            ->assertJsonPath('enrollment.workspace.ide_url', null);
        $this->assertEmpty(FakeWorkspaceRuntime::$containers, 'the container is gone');
        $this->assertArrayHasKey($workspace->volume_name, FakeWorkspaceRuntime::$volumes, 'the files are untouched');
        $this->assertNull(\App\Models\ProjectWorkspaceSession::whereNull('ended_at')->first(), 'no session left open: hours stop counting');
    }

    public function test_after_changes_are_requested_the_student_can_start_the_same_workspace_again(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        Sanctum::actingAs($student);
        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])->assertCreated();
        $submission = ProjectSubmission::firstOrFail();

        Sanctum::actingAs($this->staff());
        $this->postJson("/api/admin/project-lab/submissions/{$submission->id}/review", ['status' => 'needs_changes', 'feedback' => 'Add validation.'])->assertOk();

        Sanctum::actingAs($student);
        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/workspace/start")
            ->assertOk()->assertJsonPath('workspace.status', 'running');
    }

    public function test_a_submitted_project_cannot_open_a_workspace_while_it_is_under_review(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        Sanctum::actingAs($student);
        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])->assertCreated();

        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/workspace/start")
            ->assertStatus(409)->assertJsonPath('code', 'enrollment_not_active');
    }

    public function test_a_failure_to_stop_the_workspace_never_undoes_an_accepted_submission(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        $this->app->instance(\App\Services\Workspaces\WorkspaceRuntime::class, new class extends FakeWorkspaceRuntime
        {
            public function stop(\App\Services\Workspaces\WorkspaceHost $host, string $containerName): void
            {
                throw \App\Services\Workspaces\WorkspaceException::hostError('host unreachable');
            }
        });
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])->assertCreated();

        $this->assertSame(1, ProjectSubmission::count());
        $this->assertSame(ProjectEnrollment::STATUS_SUBMITTED, $enrollment->fresh()->status);
    }

    public function test_the_storage_path_is_never_shown_to_the_student(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        Sanctum::actingAs($student);

        $response = $this->postJson($this->submitUrl($enrollment), ['notes' => 'x', 'repo_url' => 'https://github.com/a/b'])->assertCreated();
        $path = ProjectSubmission::firstOrFail()->snapshot_path;

        $this->assertStringNotContainsString($path, $response->getContent());
        $this->assertStringNotContainsString('project-submissions', $response->getContent());
        $this->assertArrayNotHasKey('snapshot_path', ProjectSubmission::first()->toArray());
    }

    public function test_the_temporary_archive_is_removed_from_the_workspace_afterwards(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])->assertCreated();

        $removed = collect(FakeWorkspaceRuntime::$execLog)->contains(fn ($e) => $e['command'] === ['rm', '-f', '/var/tmp/aptrun-submission.tgz']);
        $this->assertTrue($removed);
    }

    public function test_the_submission_records_how_many_milestones_were_done_and_warns_when_none_were(): void
    {
        [$student, $enrollment, $topic] = $this->withRunningWorkspace();
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])
            ->assertCreated()
            ->assertJsonPath('submission.milestones_done', 0)
            ->assertJsonPath('submission.milestones_total', 2)
            ->assertJsonPath('submission.warnings.0', 'No milestones were marked complete.');
    }

    public function test_a_project_under_review_cannot_be_submitted_again(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        Sanctum::actingAs($student);
        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])->assertCreated();

        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])
            ->assertStatus(409)->assertJsonPath('code', 'submission_not_allowed');
        $this->assertSame(1, ProjectSubmission::count());
    }

    public function test_without_an_open_workspace_a_submission_needs_a_repository_link(): void
    {
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student);
        app(WorkspaceManager::class)->provision($enrollment); // exists but stopped
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), ['notes' => 'only notes'])
            ->assertStatus(409)->assertJsonPath('code', 'workspace_not_running');
        $this->assertSame(0, ProjectSubmission::count());

        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])
            ->assertCreated()
            ->assertJsonPath('submission.has_snapshot', false)
            ->assertJsonPath('submission.warnings.0', 'No code snapshot is attached — the reviewer will rely on the repository link.');
    }

    public function test_an_oversize_project_is_refused_with_advice_and_nothing_is_recorded(): void
    {
        FakeWorkspaceRuntime::$execResults = ['tar --null' => new ExecResult(0, (300 * 1024 * 1024)."\n")];
        [$student, $enrollment] = $this->withRunningWorkspace();
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])
            ->assertStatus(422)
            ->assertJsonPath('code', 'snapshot_too_large');

        $this->assertSame(0, ProjectSubmission::count());
        $this->assertSame(ProjectEnrollment::STATUS_ACTIVE, $enrollment->fresh()->status, 'a refused submission must leave the project open');
        $this->assertTrue(collect(FakeWorkspaceRuntime::$execLog)->contains(fn ($e) => $e['command'] === ['rm', '-f', '/var/tmp/aptrun-submission.tgz']));
    }

    public function test_a_failing_archive_command_is_a_retryable_error_not_a_half_submission(): void
    {
        FakeWorkspaceRuntime::$execResults = ['tar --null' => new ExecResult(2, '', 'tar: write error: No space left on device')];
        [$student, $enrollment] = $this->withRunningWorkspace();
        Sanctum::actingAs($student);

        $response = $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])
            ->assertStatus(503)->assertJsonPath('code', 'workspace_host_error');

        $this->assertStringNotContainsString('No space left', $response->getContent());
        $this->assertSame(0, ProjectSubmission::count());
        $this->assertSame(ProjectEnrollment::STATUS_ACTIVE, $enrollment->fresh()->status);
    }

    public function test_links_must_be_real_urls_and_the_repository_must_be_https(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        Sanctum::actingAs($student);

        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'http://github.com/a/b'])->assertStatus(422)->assertJsonValidationErrors('repo_url');
        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'javascript:alert(1)'])->assertStatus(422)->assertJsonValidationErrors('repo_url');
        $this->postJson($this->submitUrl($enrollment), ['live_url' => 'ftp://x.example.com'])->assertStatus(422)->assertJsonValidationErrors('live_url');
        $this->postJson($this->submitUrl($enrollment), ['notes' => str_repeat('x', 4001)])->assertStatus(422)->assertJsonValidationErrors('notes');
    }

    public function test_a_student_whose_plan_lapsed_cannot_submit(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        \App\Models\Subscription::where('subscriber_id', $student->id)
            ->whereHas('plan', fn ($q) => $q->where('code', \App\Models\Plan::CODE_PROJECT_LAB))
            ->update(['current_period_end' => now()->subMinute()]);
        Sanctum::actingAs($student->fresh());

        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])
            ->assertStatus(402)->assertJsonPath('code', 'project_lab_required');
    }

    public function test_the_whole_review_loop_from_changes_requested_to_a_second_attempt_to_done(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        $reviewer = $this->staff();

        Sanctum::actingAs($student);
        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])->assertCreated();
        $first = ProjectSubmission::firstOrFail();

        Sanctum::actingAs($reviewer);
        $this->postJson("/api/admin/project-lab/submissions/{$first->id}/review", [
            'status' => 'needs_changes', 'feedback' => 'Passwords are stored in plain text.',
        ])->assertOk()->assertJsonPath('submission.status', 'needs_changes');
        $this->assertSame(ProjectEnrollment::STATUS_ACTIVE, $enrollment->fresh()->status, 'changes requested hands the project back');

        Sanctum::actingAs($student);
        $this->getJson("/api/project-lab/enrollments/{$enrollment->id}")
            ->assertJsonPath('enrollment.submissions.0.feedback', 'Passwords are stored in plain text.');
        $this->postJson($this->submitUrl($enrollment), ['repo_url' => 'https://github.com/a/b'])
            ->assertCreated()->assertJsonPath('submission.attempt', 2);

        Sanctum::actingAs($reviewer);
        $second = ProjectSubmission::where('attempt', 2)->firstOrFail();
        $this->postJson("/api/admin/project-lab/submissions/{$second->id}/review", [
            'status' => 'reviewed', 'score' => 88, 'feedback' => 'Good.',
            'rubric' => [['criterion' => 'Security', 'score' => 9, 'max' => 10]],
        ])->assertOk()->assertJsonPath('submission.score', 88);

        $this->assertSame(ProjectEnrollment::STATUS_REVIEWED, $enrollment->fresh()->status);
        $this->assertSame($reviewer->id, $second->fresh()->reviewed_by);
        $this->assertNotNull($second->fresh()->reviewed_at);
    }
}
