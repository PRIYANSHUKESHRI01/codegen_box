<?php

namespace Tests\Feature;

use App\Models\ProjectTopic;
use App\Models\ProjectWorkspace;
use App\Models\ProjectWorkspaceIntegrityEvent;
use App\Models\ProjectWorkspaceSession;
use App\Services\Workspaces\WorkspaceIntegrity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * What the editor's authorship guard reports to the control plane: accepted narrowly, stored as metadata only,
 * idempotent, bounded, and owner-only. The guard runs in a browser the student controls, so these tests also pin
 * down what a hostile or buggy client CANNOT do.
 */
class WorkspaceIntegrityTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    private string $base;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->fakeWorkspaces();
    }

    /** A student with a running workspace, signed in. */
    private function running(): ProjectWorkspace
    {
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student);
        Sanctum::actingAs($student);
        $this->base = "/api/project-lab/enrollments/{$enrollment->id}/workspace";

        $this->postJson("{$this->base}/start")->assertOk();

        return ProjectWorkspace::firstOrFail();
    }

    /** @return array<string, mixed> */
    private function event(array $overrides = []): array
    {
        return $overrides + [
            'id' => 'ev'.bin2hex(random_bytes(6)),
            't' => (int) (microtime(true) * 1000),
            'kind' => 'paste_blocked',
            'size' => 120,
            'target' => 'editor',
        ];
    }

    private function report(array $events, array $extra = [])
    {
        return $this->postJson("{$this->base}/integrity", ['v' => '1.0.0', 'events' => $events] + $extra);
    }

    // ───────────────────────────── who may report ─────────────────────────────

    public function test_only_the_owner_can_report_for_a_workspace(): void
    {
        $this->running();

        Sanctum::actingAs($this->studentWithLab());
        $this->report([$this->event()])->assertNotFound();

        $this->app['auth']->forgetGuards();
        $this->withHeaders([])->postJson("{$this->base}/integrity", ['events' => []])->assertUnauthorized();

        $this->assertSame(0, ProjectWorkspaceIntegrityEvent::count());
    }

    // ───────────────────────────── what is stored ─────────────────────────────

    public function test_a_valid_report_is_stored_as_metadata_only(): void
    {
        $workspace = $this->running();

        $this->report([$this->event(['id' => 'abc123456', 'kind' => 'paste_blocked', 'size' => 340, 'target' => 'terminal'])])
            ->assertOk()
            ->assertJson(['accepted' => 1, 'duplicates' => 0, 'dropped' => 0]);

        $row = ProjectWorkspaceIntegrityEvent::firstOrFail();
        $this->assertSame($workspace->id, $row->project_workspace_id);
        $this->assertSame($workspace->user_id, $row->user_id);
        $this->assertSame('paste_blocked', $row->kind);
        $this->assertSame(340, $row->size);
        $this->assertSame('terminal', $row->target);
        $this->assertSame('1.0.0', $row->guard_version);
    }

    public function test_the_table_has_no_column_that_could_hold_pasted_text(): void
    {
        $columns = Schema::getColumnListing('project_workspace_integrity_events');

        foreach (['text', 'content', 'body', 'clipboard', 'data', 'value'] as $forbidden) {
            $this->assertNotContains($forbidden, $columns);
        }
    }

    public function test_unknown_kinds_targets_ids_and_stray_fields_are_dropped_not_stored(): void
    {
        $this->running();

        $response = $this->report([
            $this->event(['kind' => 'definitely_not_a_kind']),
            $this->event(['id' => 'x']),                          // too short to be a real id
            $this->event(['id' => 'has spaces and <b>html</b>']),
            $this->event(['id' => 'goodid0001', 'target' => '<script>', 'text' => 'SECRET PASTED CODE', 'clipboard' => 'MORE SECRET']),
        ])->assertOk();

        $response->assertJson(['accepted' => 1, 'dropped' => 3]);

        $row = ProjectWorkspaceIntegrityEvent::firstOrFail();
        $this->assertNull($row->target, 'an unknown target is not stored');
        $this->assertStringNotContainsString('SECRET', json_encode($row->toArray()));
    }

    public function test_meta_keeps_only_allowed_short_values(): void
    {
        $this->running();

        $this->report([$this->event([
            'id' => 'meta000001',
            'kind' => 'upload_blocked',
            'meta' => [
                'kinds' => ['php', 'zip', 'a-very-long-extension-name-that-is-clearly-not-an-extension'],
                'reportOnly' => true,
                'perSecond' => 41,
                'pastedText' => 'PASTED_SECRET',          // not an allowed key
                'via' => str_repeat('x', 200),            // allowed key, value too long
            ],
        ])])->assertOk();

        $meta = ProjectWorkspaceIntegrityEvent::firstOrFail()->meta;
        $this->assertSame(['kinds' => ['php', 'zip', 'a-very-long-extension-na'], 'reportOnly' => true, 'perSecond' => 41], $meta);
        $this->assertStringNotContainsString('PASTED_SECRET', json_encode($meta));
    }

    public function test_a_retried_upload_is_not_counted_twice(): void
    {
        $this->running();
        $event = $this->event(['id' => 'retry000001']);

        $this->report([$event])->assertJson(['accepted' => 1, 'duplicates' => 0]);
        $this->report([$event, $this->event(['id' => 'retry000002'])])->assertJson(['accepted' => 1, 'duplicates' => 1]);

        $this->assertSame(2, ProjectWorkspaceIntegrityEvent::count());
    }

    public function test_the_same_event_id_may_exist_in_two_workspaces(): void
    {
        $this->running();
        $this->report([$this->event(['id' => 'shared00001'])])->assertOk();

        $this->running();
        $this->report([$this->event(['id' => 'shared00001'])])->assertJson(['accepted' => 1]);

        $this->assertSame(2, ProjectWorkspaceIntegrityEvent::count());
    }

    // ───────────────────────────── bounds ─────────────────────────────

    public function test_a_single_report_may_not_carry_more_than_the_limit(): void
    {
        $this->running();
        $many = array_map(fn ($i) => $this->event(['id' => 'bulk'.str_pad((string) $i, 6, '0', STR_PAD_LEFT)]), range(1, 51));

        $this->report($many)->assertUnprocessable();
        $this->assertSame(0, ProjectWorkspaceIntegrityEvent::count());
    }

    public function test_a_workspace_stores_at_most_the_configured_total(): void
    {
        config(['authorship.max_events_per_workspace' => 3]);
        $this->running();

        $this->report(array_map(fn ($i) => $this->event(['id' => 'cap'.str_pad((string) $i, 6, '0', STR_PAD_LEFT)]), range(1, 5)))
            ->assertJson(['accepted' => 3, 'dropped' => 2]);
        $this->report([$this->event()])->assertJson(['accepted' => 0]);

        $this->assertSame(3, ProjectWorkspaceIntegrityEvent::count());
    }

    public function test_sizes_and_times_are_clamped(): void
    {
        $this->running();
        $now = (int) (microtime(true) * 1000);

        $this->report([
            $this->event(['id' => 'future0001', 't' => $now + 86_400_000, 'size' => 9_999_999_999]),
            $this->event(['id' => 'ancient001', 't' => $now - 30 * 86_400_000, 'size' => -5]),
            $this->event(['id' => 'notanumber', 't' => 'yesterday', 'size' => 'lots']),
        ])->assertJson(['accepted' => 3]);

        $future = ProjectWorkspaceIntegrityEvent::where('client_event_id', 'future0001')->firstOrFail();
        $this->assertLessThanOrEqual(now()->addSeconds(2)->timestamp, $future->occurred_at->timestamp, 'never from the future');
        $this->assertSame(100_000_000, $future->size);

        $ancient = ProjectWorkspaceIntegrityEvent::where('client_event_id', 'ancient001')->firstOrFail();
        $this->assertGreaterThanOrEqual(now()->subHours(48)->subMinute()->timestamp, $ancient->occurred_at->timestamp, 'never older than the allowed age');
        $this->assertSame(0, $ancient->size);

        $this->assertNull(ProjectWorkspaceIntegrityEvent::where('client_event_id', 'notanumber')->firstOrFail()->size);
    }

    public function test_the_endpoint_is_rate_limited(): void
    {
        $this->running();

        foreach (range(1, 30) as $i) {
            $this->report([])->assertOk();
        }

        $this->report([])->assertStatus(429);
    }

    // ───────────────────────────── coverage: "the guard was confirmed running" ─────────────────────────────

    public function test_an_active_report_credits_the_open_session_and_remembers_when(): void
    {
        $workspace = $this->running();

        $this->report([], ['active' => true])->assertOk();

        $session = ProjectWorkspaceSession::firstOrFail();
        $this->assertSame((int) config('authorship.first_credit_seconds'), $session->guard_active_seconds);
        $this->assertNotNull($workspace->fresh()->guard_last_seen_at);
        $this->assertSame('1.0.0', $workspace->fresh()->guard_version);
    }

    public function test_later_reports_credit_the_time_since_the_last_one_but_a_long_silence_is_not_backfilled(): void
    {
        $this->running();
        $this->report([], ['active' => true])->assertOk();           // first credit

        $this->travel(30)->seconds();
        $this->report([], ['active' => true])->assertOk();           // +30

        $this->travel(20)->minutes();
        $this->report([], ['active' => true])->assertOk();           // an hour-scale gap: capped, not 1200

        $expected = (int) config('authorship.first_credit_seconds') + 30 + (int) config('authorship.max_credit_seconds');
        $this->assertSame($expected, ProjectWorkspaceSession::firstOrFail()->guard_active_seconds);
    }

    public function test_a_report_without_the_active_flag_credits_nothing(): void
    {
        $this->running();
        $this->report([$this->event()])->assertOk();

        $this->assertSame(0, ProjectWorkspaceSession::firstOrFail()->guard_active_seconds);
        $this->assertNull(ProjectWorkspace::firstOrFail()->guard_last_seen_at);
    }

    public function test_a_stopped_workspace_earns_no_coverage_but_a_late_flush_is_still_kept(): void
    {
        $this->running();
        $this->postJson("{$this->base}/stop")->assertOk();

        $this->report([$this->event(['id' => 'late0000001'])], ['active' => true])->assertJson(['accepted' => 1]);

        $this->assertSame(0, ProjectWorkspaceSession::firstOrFail()->guard_active_seconds);
    }

    public function test_a_junk_version_is_not_stored(): void
    {
        $workspace = $this->running();

        $this->postJson("{$this->base}/integrity", ['v' => '1.0 <script>', 'active' => true, 'events' => []])->assertOk();

        $this->assertNull($workspace->fresh()->guard_version);
    }

    // ───────────────────────────── what the guard is told to do ─────────────────────────────

    public function test_the_workspace_tells_the_page_what_the_guard_should_do(): void
    {
        $workspace = $this->running();

        $this->getJson($this->base)->assertJsonPath('workspace.guard_mode', 'enforce');

        $workspace->enrollment->topic->update(['authorship_mode' => ProjectTopic::AUTHORSHIP_OPEN]);
        $this->getJson($this->base)->assertJsonPath('workspace.guard_mode', 'open');
    }

    public function test_the_mode_follows_the_switch_and_a_project_that_allows_pasting(): void
    {
        $strict = new ProjectTopic(['authorship_mode' => 'strict']);
        $open = new ProjectTopic(['authorship_mode' => 'open']);

        config(['authorship.guard_mode' => 'enforce']);
        $this->assertSame('enforce', WorkspaceIntegrity::modeFor($strict));
        $this->assertSame('open', WorkspaceIntegrity::modeFor($open));

        config(['authorship.guard_mode' => 'report']);
        $this->assertSame('report', WorkspaceIntegrity::modeFor($strict));

        config(['authorship.guard_mode' => 'off']);
        $this->assertSame('open', WorkspaceIntegrity::modeFor($strict));

        config(['authorship.guard_mode' => 'nonsense']);
        $this->assertSame('enforce', WorkspaceIntegrity::modeFor($strict), 'an unknown setting fails closed');
    }

    public function test_old_events_are_pruned_by_the_scheduled_job_but_recent_ones_stay(): void
    {
        $workspace = $this->running();
        $this->report([$this->event(['id' => 'recent00001'])])->assertOk();
        ProjectWorkspaceIntegrityEvent::create([
            'project_workspace_id' => $workspace->id, 'user_id' => $workspace->user_id, 'client_event_id' => 'old0000001',
            'kind' => 'paste_blocked', 'occurred_at' => now()->subDays(200),
        ]);

        $this->artisan('schedule:list')->assertSuccessful(); // boots the schedule from routes/console.php
        $event = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())->first(fn ($e) => $e->description === 'authorship:prune');
        $this->assertNotNull($event, 'the prune job is scheduled');
        $event->run($this->app);

        $this->assertSame(['recent00001'], ProjectWorkspaceIntegrityEvent::pluck('client_event_id')->all());
    }
}
