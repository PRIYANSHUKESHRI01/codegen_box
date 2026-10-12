<?php

namespace Tests\Feature;

use App\Models\ProjectEnrollment;
use App\Models\ProjectSubmission;
use App\Models\ProjectTopic;
use App\Models\ProjectWorkspace;
use App\Models\ProjectWorkspaceIntegrityEvent;
use App\Models\ProjectWorkspaceSession;
use App\Models\User;
use App\Services\Workspaces\AuthorshipReport;
use App\Services\Workspaces\ExecResult;
use App\Services\Workspaces\FakeWorkspaceRuntime;
use App\Services\Workspaces\GitHistoryScript;
use App\Services\Workspaces\WorkspaceManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * The evidence a reviewer sees: what the guard reported, what the git history says, what is installed, and the plain
 * rules that turn those into a label. The label is a pointer for a human; none of this may ever block a submission.
 */
class AuthorshipReportTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->fakeWorkspaces();
    }

    // ───────────────────────────── the git history reader (pure) ─────────────────────────────

    private function sampleLog(): string
    {
        return implode("\n", [
            '@@REPO ./hospital-management-system',
            '@@C|aaa111|1760000000|Asha Verma|Add billing and payments',
            "12\t3\tapp/Services/Billing.php",
            "5\t0\tcomposer.lock",
            "-\t-\tpublic/logo.png",
            '@@C|bbb222|1759999000|Asha Verma|Add appointment booking',
            "200\t10\tapp/Http/Controllers/AppointmentController.php",
            "300\t0\tvendor/foo/bar.php",
            "8\t0\tpublic/build/app.js",
            '@@C|ccc333|1759000000|Asha Verma|Initial Laravel project',
            "2500\t0\tconfig/app.php",
            '@@REPO ./scratch',
            '@@C|ddd444|1758000000|Asha Verma|just a note',
            "1\t0\tREADME.md",
            '@@EXT bmewburn.vscode-intelephense-client-1.18.5-universal',
            '@@EXT continue.continue-1.0.0-universal',
            '@@EXT ms-python.python-2026.4.0-universal',
            '',
        ]);
    }

    public function test_it_reads_commits_and_counts_only_the_students_own_lines(): void
    {
        $parsed = GitHistoryScript::parse($this->sampleLog());

        $this->assertCount(2, $parsed['repos']);
        $project = $parsed['repos'][0];
        $this->assertSame('hospital-management-system', $project['path']);
        $this->assertCount(3, $project['commits']);

        // composer.lock, a binary and vendor/ + public/build/ are not the student's lines.
        $this->assertSame(12, $project['commits'][0]['added']);
        $this->assertSame(1, $project['commits'][0]['files']);
        $this->assertSame(200, $project['commits'][1]['added']);
        $this->assertSame('Add billing and payments', $project['commits'][0]['subject']);
    }

    public function test_the_summary_leaves_out_the_starting_commit_and_finds_the_biggest_one(): void
    {
        $summary = GitHistoryScript::summarise(GitHistoryScript::parse($this->sampleLog())['repos']);

        $this->assertSame('hospital-management-system', $summary['path'], 'the repository with the most commits');
        $this->assertSame(3, $summary['commits']);
        $this->assertSame(2, $summary['commits_after_first']);
        $this->assertSame(212, $summary['added_after_first'], 'the 2,500-line skeleton is not counted');
        $this->assertSame(200, $summary['largest']['lines']);
        $this->assertEqualsWithDelta(0.943, $summary['largest']['share'], 0.001);
        $this->assertSame(17, $summary['span_minutes']);
        $this->assertSame(1, $summary['other_repositories']);
        $this->assertCount(2, $summary['top']);
    }

    public function test_no_repository_means_no_summary_rather_than_an_error(): void
    {
        $this->assertNull(GitHistoryScript::summarise([]));
        $this->assertNull(GitHistoryScript::summarise(GitHistoryScript::parse("@@REPO ./empty\n")['repos']));
        $this->assertSame(['repos' => [], 'extensions' => []], GitHistoryScript::parse(''));
    }

    public function test_extensions_beyond_the_curated_set_are_found_by_id_whatever_the_version_suffix(): void
    {
        $folders = GitHistoryScript::parse($this->sampleLog())['extensions'];

        $extra = GitHistoryScript::extraExtensions($folders, (array) config('authorship.curated_extensions'));

        $this->assertSame(['continue.continue'], $extra);
    }

    public function test_the_curated_list_in_config_matches_the_image_extension_list(): void
    {
        $file = base_path('../infra/workspaces/extensions.txt');
        if (! is_file($file)) {
            $this->markTestSkipped('infra/workspaces/extensions.txt is not part of this checkout.');
        }

        $curated = array_map('strtolower', (array) config('authorship.curated_extensions'));
        foreach (preg_split('/\R/', (string) file_get_contents($file)) as $line) {
            $id = strtolower(trim(explode(' ', trim($line))[0]));
            if ($id === '' || str_starts_with($id, '#')) {
                continue;
            }
            $this->assertContains($id, $curated, "{$id} is installed in the image but missing from config/authorship.php, so the review would call it extra");
        }
    }

    public function test_the_script_only_reads_and_does_not_run_repository_hooks(): void
    {
        $script = GitHistoryScript::build();

        $this->assertStringContainsString('core.hooksPath=/dev/null', $script);
        $this->assertStringContainsString('--no-pager', $script);
        $this->assertStringNotContainsString('git checkout', $script);
        $this->assertStringNotContainsString('rm ', $script);
    }

    // ───────────────────────────── the rules ─────────────────────────────

    /** @return array<string, mixed> a guard summary with nothing unusual in it */
    private function guard(array $over = []): array
    {
        return array_replace_recursive([
            'session_seconds' => 4 * 3600, 'active_seconds' => 4 * 3600, 'coverage' => 1.0,
            'last_seen_at' => null, 'version' => '1.0.0', 'counts' => [],
            'refused' => ['attempts' => 0, 'chars' => 0, 'largest' => 0, 'would_have_been' => 0],
            'internal' => ['pastes' => 12, 'chars' => 900, 'sow_commands' => 1],
            'typing' => ['fast' => 0, 'robotic' => 0], 'synthetic' => 0, 'windows_refused' => 0,
        ], $over);
    }

    private function git(array $over = []): array
    {
        return array_replace_recursive([
            'path' => 'hms', 'commits' => 18, 'commits_after_first' => 17, 'first_at' => null, 'last_at' => null,
            'span_minutes' => 3000, 'added_after_first' => 4200,
            'largest' => ['lines' => 400, 'share' => 0.1, 'subject' => 'Add billing'], 'top' => [], 'authors' => 1, 'other_repositories' => 0,
        ], $over);
    }

    private function report(): AuthorshipReport
    {
        return app(AuthorshipReport::class);
    }

    private function codes(array $signals): array
    {
        return array_column($signals, 'code');
    }

    public function test_an_ordinary_project_is_clear(): void
    {
        $signals = $this->report()->signals($this->guard(), $this->git(), []);

        $this->assertSame([], $signals);
        $this->assertSame('clear', $this->report()->label($signals));
    }

    public function test_a_few_refused_pastes_are_normal_but_many_or_large_ones_are_worth_a_look(): void
    {
        $normal = $this->report()->signals($this->guard(['refused' => ['attempts' => 4, 'chars' => 300, 'largest' => 120]]), null, []);
        $this->assertSame([], $normal, 'a habitual Ctrl+V is not a finding');

        $many = $this->report()->signals($this->guard(['refused' => ['attempts' => 14, 'chars' => 500, 'largest' => 90]]), null, []);
        $this->assertSame(['refused_volume'], $this->codes($many));
        $this->assertSame('review', $this->report()->label($many));

        $large = $this->report()->signals($this->guard(['refused' => ['attempts' => 2, 'chars' => 1500, 'largest' => 900]]), null, []);
        $this->assertSame('review', $this->report()->label($large));

        $huge = $this->report()->signals($this->guard(['refused' => ['attempts' => 30, 'chars' => 45000, 'largest' => 9000]]), null, []);
        $this->assertSame('attention', $this->report()->label($huge));
    }

    public function test_a_guard_that_was_not_running_for_much_of_the_session_is_flagged_once_there_was_real_work(): void
    {
        $low = $this->report()->signals($this->guard(['active_seconds' => 3600, 'coverage' => 0.25]), null, []);
        $this->assertSame(['low_coverage'], $this->codes($low));
        $this->assertSame('attention', $this->report()->label($low));
        $this->assertStringContainsString('25%', $low[0]['text']);

        $some = $this->report()->signals($this->guard(['active_seconds' => 12000, 'coverage' => 0.8]), null, []);
        $this->assertSame('review', $this->report()->label($some));

        $short = $this->report()->signals($this->guard(['session_seconds' => 300, 'active_seconds' => 0, 'coverage' => 0.0]), null, []);
        $this->assertSame([], $short, 'a five-minute visit proves nothing');
    }

    public function test_scripted_input_and_typing_no_person_produces_are_flagged(): void
    {
        $this->assertSame(['scripted_input'], $this->codes($this->report()->signals($this->guard(['synthetic' => 2]), null, [])));
        $this->assertSame(['scripted_input'], $this->codes($this->report()->signals($this->guard(['counts' => ['bulk_insert_blocked' => 1]]), null, [])));

        $fast = $this->report()->signals($this->guard(['typing' => ['fast' => 1]]), null, []);
        $this->assertSame('review', $this->report()->label($fast));

        $bot = $this->report()->signals($this->guard(['typing' => ['robotic' => 4]]), null, []);
        $this->assertSame('attention', $this->report()->label($bot));
    }

    public function test_history_that_looks_dumped_is_flagged_but_a_small_project_is_left_alone(): void
    {
        $few = $this->report()->signals($this->guard(), $this->git(['commits_after_first' => 1, 'span_minutes' => 0, 'largest' => ['lines' => 4200, 'share' => 1.0]]), []);
        $this->assertEqualsCanonicalizing(['few_commits', 'one_big_commit'], $this->codes($few));

        $quick = $this->report()->signals($this->guard(), $this->git(['commits_after_first' => 9, 'span_minutes' => 6]), []);
        $this->assertSame(['compressed_history'], $this->codes($quick));

        $tiny = $this->report()->signals($this->guard(), $this->git(['commits_after_first' => 1, 'added_after_first' => 90, 'span_minutes' => 0, 'largest' => ['lines' => 90, 'share' => 1.0]]), []);
        $this->assertSame([], $tiny, 'too little code to judge');
    }

    public function test_extra_extensions_are_mentioned(): void
    {
        $signals = $this->report()->signals($this->guard(), $this->git(), ['continue.continue']);

        $this->assertSame(['extra_extensions'], $this->codes($signals));
        $this->assertStringContainsString('continue.continue', $signals[0]['text']);
    }

    public function test_the_worst_signal_decides_the_label_and_each_comes_with_its_reason(): void
    {
        $signals = $this->report()->signals(
            $this->guard(['typing' => ['fast' => 1], 'active_seconds' => 3600, 'coverage' => 0.25]),
            $this->git(['commits_after_first' => 1, 'largest' => ['lines' => 4200, 'share' => 1.0]]),
            [],
        );

        $this->assertSame('attention', $this->report()->label($signals));
        foreach ($signals as $signal) {
            $this->assertNotSame('', $signal['text']);
            $this->assertContains($signal['level'], ['review', 'attention']);
        }
    }

    // ───────────────────────────── the evidence as stored ─────────────────────────────

    private function withRunningWorkspace(string $authorship = 'strict'): array
    {
        $student = $this->studentWithLab();
        $topic = $this->topic(['authorship_mode' => $authorship]);
        $enrollment = $this->enroll($student, $topic);
        $manager = app(WorkspaceManager::class);
        $workspace = $manager->start($manager->provision($enrollment), $student);

        return [$student, $enrollment->fresh(), $workspace];
    }

    private function recordEvents(ProjectWorkspace $workspace, array $kinds): void
    {
        foreach ($kinds as $i => [$kind, $size]) {
            ProjectWorkspaceIntegrityEvent::create([
                'project_workspace_id' => $workspace->id, 'user_id' => $workspace->user_id, 'client_event_id' => 'seed'.$i.$kind,
                'kind' => $kind, 'size' => $size, 'target' => 'editor', 'occurred_at' => now()->subMinutes(10 - $i),
            ]);
        }
    }

    public function test_the_stats_add_up_what_the_guard_reported(): void
    {
        [, , $workspace] = $this->withRunningWorkspace();
        ProjectWorkspaceSession::where('project_workspace_id', $workspace->id)->update(['seconds' => 7200, 'guard_active_seconds' => 5400]);
        $this->recordEvents($workspace, [['paste_blocked', 300], ['paste_blocked', 900], ['clipboard_read_blocked', 50], ['paste_internal', 200], ['paste_trusted', 40], ['fast_typing', 80], ['window_blocked', 0]]);

        $stats = $this->report()->guardStats($workspace);

        $this->assertSame(0.75, $stats['coverage']);
        $this->assertSame(3, $stats['refused']['attempts']);
        $this->assertSame(1250, $stats['refused']['chars']);
        $this->assertSame(900, $stats['refused']['largest']);
        $this->assertSame(1, $stats['internal']['pastes']);
        $this->assertSame(1, $stats['internal']['sow_commands']);
        $this->assertSame(1, $stats['typing']['fast']);
        $this->assertSame(1, $stats['windows_refused']);
    }

    public function test_building_a_report_reads_history_and_extensions_from_the_container(): void
    {
        [, $enrollment, $workspace] = $this->withRunningWorkspace();
        FakeWorkspaceRuntime::$execResults['--numstat'] = new ExecResult(0, $this->sampleLog());

        $report = $this->report()->build($workspace, $enrollment, inspectContainer: true);

        $this->assertSame('enforce', $report['mode']);
        $this->assertSame(3, $report['git']['commits']);
        $this->assertSame(['continue.continue'], $report['extensions']['extra']);
        $this->assertContains('extra_extensions', $this->codes($report['signals']));
        $this->assertNotSame('clear', $report['label']);
    }

    public function test_a_container_that_cannot_be_read_leaves_git_unknown_and_does_not_fail(): void
    {
        [, $enrollment, $workspace] = $this->withRunningWorkspace();
        FakeWorkspaceRuntime::$execResults['--numstat'] = new ExecResult(1, '', 'boom');

        $report = $this->report()->build($workspace, $enrollment, inspectContainer: true);

        $this->assertNull($report['git']);
        $this->assertSame([], $report['extensions']['extra']);
    }

    public function test_a_project_that_allows_pasting_is_not_judged(): void
    {
        [, $enrollment, $workspace] = $this->withRunningWorkspace('open');
        $this->recordEvents($workspace, [['paste_blocked', 50000]]);

        $report = $this->report()->build($workspace, $enrollment, inspectContainer: false);

        $this->assertSame('open', $report['mode']);
        $this->assertSame('not_checked', $report['label']);
        $this->assertSame([], $report['signals']);
    }

    // ───────────────────────────── on submit ─────────────────────────────

    public function test_submitting_freezes_the_evidence_on_the_submission(): void
    {
        [$student, $enrollment, $workspace] = $this->withRunningWorkspace();
        FakeWorkspaceRuntime::$execResults['--numstat'] = new ExecResult(0, $this->sampleLog());
        $this->recordEvents($workspace, [['paste_blocked', 300]]);
        Sanctum::actingAs($student);

        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/submit", ['notes' => 'done'])->assertCreated();

        $integrity = ProjectSubmission::firstOrFail()->integrity;
        $this->assertSame(1, $integrity['guard']['refused']['attempts']);
        $this->assertSame(3, $integrity['git']['commits']);
        $this->assertSame(1, $integrity['version']);
        $this->assertContains($integrity['label'], ['clear', 'review', 'attention']);
    }

    public function test_a_failing_report_never_stops_a_submission(): void
    {
        [$student, $enrollment] = $this->withRunningWorkspace();
        $this->app->bind(AuthorshipReport::class, fn () => new class(app(\App\Services\Workspaces\WorkspaceRuntime::class), app(\App\Services\Workspaces\WorkspaceHosts::class)) extends AuthorshipReport
        {
            public function build($workspace, $enrollment, bool $inspectContainer): array
            {
                throw new \RuntimeException('the evidence builder exploded');
            }
        });
        Sanctum::actingAs($student);

        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/submit", ['notes' => 'done'])->assertCreated();

        $this->assertNull(ProjectSubmission::firstOrFail()->integrity);
        $this->assertSame(ProjectEnrollment::STATUS_SUBMITTED, $enrollment->fresh()->status);
    }

    // ───────────────────────────── for the reviewer ─────────────────────────────

    private function submitted(): ProjectSubmission
    {
        [$student, $enrollment, $workspace] = $this->withRunningWorkspace();
        FakeWorkspaceRuntime::$execResults['--numstat'] = new ExecResult(0, $this->sampleLog());
        $this->recordEvents($workspace, [['paste_blocked', 300], ['paste_internal', 100], ['drop_asset', 5], ['fast_typing', 90]]);
        Sanctum::actingAs($student);
        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/submit", ['notes' => 'done'])->assertCreated();

        return ProjectSubmission::firstOrFail();
    }

    public function test_a_reviewer_sees_the_label_in_the_queue_and_the_full_evidence_on_the_submission(): void
    {
        $submission = $this->submitted();
        Sanctum::actingAs($this->staff());

        $this->getJson('/api/admin/project-lab/submissions')
            ->assertOk()
            ->assertJsonPath('submissions.0.authorship', $submission->integrity['label']);

        $response = $this->getJson("/api/admin/project-lab/submissions/{$submission->id}")->assertOk();
        $response->assertJsonPath('submission.integrity.guard.refused.attempts', 1)
            ->assertJsonPath('submission.integrity.git.commits', 3);

        $timeline = $response->json('submission.integrity_events');
        $kinds = array_column($timeline, 'kind');
        $this->assertContains('paste_blocked', $kinds);
        $this->assertContains('fast_typing', $kinds);
        $this->assertNotContains('paste_internal', $kinds, 'routine internal pastes are not listed');
        $this->assertNotContains('drop_asset', $kinds);
        foreach ($timeline as $row) {
            $this->assertSame(['kind', 'size', 'target', 'at', 'report_only'], array_keys($row), 'metadata only: there is no text to show');
        }
    }

    public function test_students_cannot_read_the_evidence_about_themselves(): void
    {
        $submission = $this->submitted();
        Sanctum::actingAs($submission->user);

        $this->getJson("/api/admin/project-lab/submissions/{$submission->id}")->assertForbidden();
    }

    public function test_a_project_can_be_set_to_allow_pasting_and_the_setting_is_validated(): void
    {
        Sanctum::actingAs($this->staff());
        $payload = [
            'title' => 'Open Project', 'category' => 'Web Apps', 'summary' => 'Anything.', 'difficulty' => 'beginner', 'estimated_hours' => 5,
            'sow_markdown' => str_repeat("Some real content for the statement of work.\n\n", 5), 'status' => 'draft',
            'milestones' => [['title' => 'One', 'acceptance_criteria' => ['Works']]],
        ];

        $this->postJson('/api/admin/project-lab/topics', $payload)->assertCreated()->assertJsonPath('topic.authorship_mode', 'strict');
        $this->postJson('/api/admin/project-lab/topics', ['title' => 'Open Two', 'authorship_mode' => 'open'] + $payload)
            ->assertCreated()->assertJsonPath('topic.authorship_mode', 'open');
        $this->postJson('/api/admin/project-lab/topics', ['title' => 'Bad', 'authorship_mode' => 'whatever'] + $payload)->assertUnprocessable();

        $this->assertSame(ProjectTopic::AUTHORSHIP_OPEN, ProjectTopic::where('title', 'Open Two')->firstOrFail()->authorship_mode);
    }

    public function test_the_default_for_a_project_is_strict(): void
    {
        $this->assertSame(ProjectTopic::AUTHORSHIP_STRICT, $this->topic()->fresh()->authorship_mode);
        $this->assertInstanceOf(User::class, $this->staff());
    }
}
