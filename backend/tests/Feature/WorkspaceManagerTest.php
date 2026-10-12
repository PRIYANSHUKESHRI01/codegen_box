<?php

namespace Tests\Feature;

use App\Models\Plan;
use App\Models\ProjectWorkspace;
use App\Models\ProjectWorkspaceSession;
use App\Models\Subscription;
use App\Services\Workspaces\ExecResult;
use App\Services\Workspaces\FakeWorkspaceRuntime;
use App\Services\Workspaces\WorkspaceException;
use App\Services\Workspaces\WorkspaceManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * The workspace control plane against an in-memory host: who may start one,
 * how hours are metered, and what the reaper stops. The rules here are what
 * keeps the self-hosted fleet affordable, so each one is pinned.
 */
class WorkspaceManagerTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    private WorkspaceManager $manager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
        $this->fakeWorkspaces();
        $this->manager = app(WorkspaceManager::class);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    /** A student with Lab and a provisioned (stopped) workspace for a fresh project. */
    private function provisioned(?\App\Models\User $student = null): array
    {
        $student ??= $this->studentWithLab();
        $enrollment = $this->enroll($student);
        $workspace = $this->manager->provision($enrollment);

        return [$student, $enrollment, $workspace];
    }

    // ───────────────────────────── start / stop ─────────────────────────────

    public function test_provisioning_creates_one_stopped_workspace_with_an_unguessable_id(): void
    {
        [, $enrollment, $workspace] = $this->provisioned();

        $this->assertSame(ProjectWorkspace::STATUS_STOPPED, $workspace->status);
        $this->assertSame('test-host', $workspace->host);
        $this->assertMatchesRegularExpression('/^[a-z0-9]{24}$/', $workspace->public_id);
        $this->assertSame('ws-'.$workspace->public_id, $workspace->container_name);
        $this->assertSame($workspace->id, $this->manager->provision($enrollment)->id, 'provisioning twice must not create a second workspace');
        $this->assertSame([], FakeWorkspaceRuntime::$containers, 'provisioning alone starts nothing');
    }

    public function test_starting_creates_a_container_a_session_and_hands_the_owner_a_tokenised_url(): void
    {
        [$student, , $workspace] = $this->provisioned();

        $started = $this->manager->start($workspace, $student);

        $this->assertSame(ProjectWorkspace::STATUS_RUNNING, $started->status);
        $this->assertArrayHasKey($workspace->container_name, FakeWorkspaceRuntime::$containers);
        $this->assertSame(1, ProjectWorkspaceSession::count());

        $payload = $this->manager->present($started);
        $this->assertTrue($payload['ready']);
        $this->assertStringStartsWith('https://ws-'.$workspace->public_id.'.ws.test/?tkn=', $payload['ide_url']);
        $this->assertStringContainsString('&folder=%2Fhome%2Fworkspace', $payload['ide_url']);
        $this->assertSame('https://p{port}--ws-'.$workspace->public_id.'.ws.test/', $payload['preview_url_template']);
    }

    public function test_the_connection_token_is_encrypted_at_rest_hidden_from_serialisation_and_rotates(): void
    {
        [$student, , $workspace] = $this->provisioned();
        $started = $this->manager->start($workspace, $student);
        $token = $started->connection_token;

        $this->assertSame(40, strlen($token));
        $this->assertNotSame($token, DB::table('project_workspaces')->where('id', $workspace->id)->value('connection_token'));
        $this->assertArrayNotHasKey('connection_token', $started->toArray());
        $this->assertStringNotContainsString($token, json_encode($started));

        $this->manager->stop($started->fresh());
        $this->assertNull($started->fresh()->connection_token, 'a stopped workspace holds no token');

        $second = $this->manager->start($started->fresh(), $student);
        $this->assertNotSame($token, $second->connection_token, 'every start gets a new token');
    }

    public function test_the_container_is_created_with_the_owners_token_and_labels(): void
    {
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        $spec = FakeWorkspaceRuntime::$containers[$workspace->container_name]['spec'];

        $this->assertSame($workspace->fresh()->connection_token, $spec->connectionToken);
        $this->assertSame($workspace->public_id, $spec->labels['aptrun.workspace']);
        $this->assertSame((string) $student->id, $spec->labels['aptrun.user']);
        $this->assertSame(13370, $spec->idePort);
    }

    public function test_starting_twice_is_idempotent(): void
    {
        [$student, , $workspace] = $this->provisioned();

        $this->manager->start($workspace, $student);
        $this->manager->start($workspace->fresh(), $student);

        $this->assertCount(1, FakeWorkspaceRuntime::$containers);
        $this->assertSame(1, ProjectWorkspaceSession::count());
    }

    public function test_a_workspace_stays_starting_until_the_editor_is_healthy(): void
    {
        FakeWorkspaceRuntime::$healthyOnStart = false;
        [$student, , $workspace] = $this->provisioned();

        $started = $this->manager->start($workspace, $student);

        $this->assertSame(ProjectWorkspace::STATUS_STARTING, $started->status);
        $this->assertFalse($this->manager->present($started)['ready']);

        FakeWorkspaceRuntime::$containers[$workspace->container_name]['healthy'] = true;
        $this->assertSame(ProjectWorkspace::STATUS_RUNNING, $this->manager->refresh($started->fresh())->status);
    }

    public function test_a_workspace_that_never_becomes_healthy_is_failed_after_three_minutes(): void
    {
        FakeWorkspaceRuntime::$healthyOnStart = false;
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        Carbon::setTestNow(now()->addMinutes(4));
        $result = $this->manager->refresh($workspace->fresh());

        $this->assertSame(ProjectWorkspace::STATUS_FAILED, $result->status);
        $this->assertEmpty(FakeWorkspaceRuntime::$containers);
    }

    public function test_starter_files_are_written_once_the_editor_is_up(): void
    {
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        $written = collect(FakeWorkspaceRuntime::$execLog)->pluck('command')->map(fn ($c) => end($c))->all();

        $this->assertContains('/home/workspace/.aptrun/SOW.md', $written);
        $this->assertContains('/home/workspace/.aptrun/MILESTONES.md', $written);
        $this->assertContains('/home/workspace/START-HERE.md', $written);

        $sow = collect(FakeWorkspaceRuntime::$execLog)->first(fn ($e) => end($e['command']) === '/home/workspace/.aptrun/SOW.md');
        $this->assertStringContainsString('Out of scope', $sow['input']);
        $milestones = collect(FakeWorkspaceRuntime::$execLog)->first(fn ($e) => end($e['command']) === '/home/workspace/.aptrun/MILESTONES.md');
        $this->assertStringContainsString('- [ ] Criterion A0', $milestones['input']);
    }

    // ───────────────────────────── who may start ─────────────────────────────

    public function test_a_student_without_lab_cannot_start_a_workspace(): void
    {
        $student = $this->student();
        $workspace = $this->manager->provision($this->enroll($student));

        try {
            $this->manager->start($workspace, $student);
            $this->fail('expected a 402');
        } catch (WorkspaceException $e) {
            $this->assertSame('project_lab_required', $e->errorCode);
            $this->assertSame(402, $e->status);
        }

        $this->assertEmpty(FakeWorkspaceRuntime::$containers);
    }

    public function test_a_student_out_of_hours_cannot_start(): void
    {
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);
        ProjectWorkspaceSession::query()->update(['seconds' => 80 * 3600]);
        $this->manager->stop($workspace->fresh());

        try {
            $this->manager->start($workspace->fresh(), $student);
            $this->fail('expected hours to be exhausted');
        } catch (WorkspaceException $e) {
            $this->assertSame('workspace_hours_exhausted', $e->errorCode);
        }
    }

    public function test_starting_another_project_stops_the_first_one(): void
    {
        $student = $this->studentWithLab();
        [, , $first] = $this->provisioned($student);
        [, , $second] = $this->provisioned($student);

        $this->manager->start($first, $student);
        $this->manager->start($second, $student);

        $this->assertSame(ProjectWorkspace::STATUS_STOPPED, $first->fresh()->status);
        $this->assertSame(ProjectWorkspace::STOP_USER, $first->fresh()->stop_reason);
        $this->assertSame(ProjectWorkspace::STATUS_RUNNING, $second->fresh()->status);
        $this->assertSame([$second->container_name], array_keys(FakeWorkspaceRuntime::$containers));
    }

    public function test_a_full_host_refuses_a_new_workspace_with_a_retryable_error(): void
    {
        $this->fakeWorkspaces(capacity: 1);
        $manager = app(WorkspaceManager::class);

        $a = $this->studentWithLab();
        $b = $this->studentWithLab();
        $first = $manager->provision($this->enroll($a));
        $second = $manager->provision($this->enroll($b));
        $manager->start($first, $a);

        try {
            $manager->start($second, $b);
            $this->fail('expected capacity error');
        } catch (WorkspaceException $e) {
            $this->assertSame('workspace_capacity', $e->errorCode);
            $this->assertSame(503, $e->status);
        }

        $this->assertSame(ProjectWorkspace::STATUS_STOPPED, $second->fresh()->status, 'a refused start must not leave the row half-started');
        $this->assertSame(0, ProjectWorkspaceSession::where('user_id', $b->id)->count());
    }

    public function test_workspaces_are_spread_to_the_least_loaded_host(): void
    {
        config(['workspaces.hosts' => [
            ['name' => 'big', 'capacity' => 10, 'domain' => 'a.test', 'scheme' => 'https'],
            ['name' => 'small', 'capacity' => 2, 'domain' => 'b.test', 'scheme' => 'https'],
        ]]);
        $manager = app(WorkspaceManager::class);

        $hosts = [];
        foreach (range(1, 4) as $i) {
            $student = $this->studentWithLab();
            $workspace = $manager->provision($this->enroll($student));
            $manager->start($workspace, $student);
            $hosts[] = $workspace->fresh()->host;
        }

        // Ties go to the first host; after that it is by load RATIO (0/10 vs 0/2 tie → big; then
        // small is emptier → small; then big 0.1 < small 0.5 → big, big) — not round-robin.
        $this->assertSame(['big', 'small', 'big', 'big'], $hosts);
    }

    public function test_a_host_failure_is_reported_generically_and_leaves_nothing_running(): void
    {
        FakeWorkspaceRuntime::$failStartWith = 'docker run on test-host failed: no space left on device';
        [$student, , $workspace] = $this->provisioned();

        try {
            $this->manager->start($workspace, $student);
            $this->fail('expected a host error');
        } catch (WorkspaceException $e) {
            $this->assertSame('workspace_host_error', $e->errorCode);
            $this->assertSame(503, $e->status);
            $this->assertStringNotContainsString('docker', $e->getMessage(), 'operator detail must not reach the student');
        }

        $fresh = $workspace->fresh();
        $this->assertSame(ProjectWorkspace::STATUS_FAILED, $fresh->status);
        $this->assertStringContainsString('no space left', $fresh->error, 'the detail is kept for operators');
        $this->assertNull($fresh->connection_token);
        $this->assertNotNull(ProjectWorkspaceSession::first()->ended_at, 'a failed start must not leave a session open and billing');

        $payload = $this->manager->present($fresh);
        $this->assertStringNotContainsString('docker', $payload['error']);
        $this->assertStringNotContainsString('no space left', $payload['error']);
        $this->assertStringNotContainsString('test-host', $payload['error']);

        // …and the student can simply try again once the host is healthy.
        FakeWorkspaceRuntime::$failStartWith = null;
        $this->assertSame(ProjectWorkspace::STATUS_RUNNING, $this->manager->start($fresh, $student)->status);
    }

    // ───────────────────────────── hours ─────────────────────────────

    public function test_heartbeats_meter_the_time_between_them(): void
    {
        Carbon::setTestNow('2026-10-10 10:00:00');
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        Carbon::setTestNow('2026-10-10 10:01:00');
        $this->manager->heartbeat($workspace->fresh());
        Carbon::setTestNow('2026-10-10 10:02:00');
        $this->manager->heartbeat($workspace->fresh());

        $this->assertSame(120, ProjectWorkspaceSession::first()->seconds);
    }

    public function test_a_long_gap_between_heartbeats_is_capped_not_billed(): void
    {
        Carbon::setTestNow('2026-10-10 10:00:00');
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        // A laptop that slept for three hours, then woke and beat once.
        Carbon::setTestNow('2026-10-10 13:00:00');
        $this->manager->heartbeat($workspace->fresh());

        $this->assertSame(120, ProjectWorkspaceSession::first()->seconds, 'one beat is worth at most heartbeat_credit_seconds');
    }

    public function test_a_heartbeat_on_a_stopped_workspace_does_nothing(): void
    {
        [, , $workspace] = $this->provisioned();

        $this->manager->heartbeat($workspace);

        $this->assertSame(0, ProjectWorkspaceSession::count());
    }

    public function test_hours_are_summed_across_sessions_since_the_current_period_began(): void
    {
        [$student, , $workspace] = $this->provisioned();
        // Lab was (re)bought 10 days ago: the 40-day-old session belongs to an earlier period, yesterday's to this one.
        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', Plan::CODE_PROJECT_LAB))
            ->update(['started_at' => now()->subDays(10)]);
        $oldPeriod = ProjectWorkspaceSession::create([
            'project_workspace_id' => $workspace->id, 'user_id' => $student->id,
            'started_at' => now()->subDays(40), 'ended_at' => now()->subDays(40), 'seconds' => 70 * 3600,
        ]);
        ProjectWorkspaceSession::create([
            'project_workspace_id' => $workspace->id, 'user_id' => $student->id,
            'started_at' => now()->subDay(), 'ended_at' => now()->subDay(), 'seconds' => 3 * 3600,
        ]);

        Sanctum::actingAs($student);
        $this->getJson('/api/me/subscription')
            ->assertJsonPath('project_lab.hours.used', 3)
            ->assertJsonPath('project_lab.hours.remaining', 77);
        $this->assertNotNull($oldPeriod->id);
    }

    // ───────────────────────────── the reaper ─────────────────────────────

    public function test_the_reaper_stops_a_workspace_nobody_has_open(): void
    {
        Carbon::setTestNow('2026-10-10 10:00:00');
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        Carbon::setTestNow('2026-10-10 10:10:00');
        $this->assertSame(0, array_sum($this->manager->reap()['stopped']), '10 minutes is within the idle allowance');

        Carbon::setTestNow('2026-10-10 10:16:00');
        $summary = $this->manager->reap();

        $this->assertSame(['idle' => 1], $summary['stopped']);
        $fresh = $workspace->fresh();
        $this->assertSame(ProjectWorkspace::STATUS_STOPPED, $fresh->status);
        $this->assertSame(ProjectWorkspace::STOP_IDLE, $fresh->stop_reason);
        $this->assertEmpty(FakeWorkspaceRuntime::$containers);
        $this->assertNotNull(ProjectWorkspaceSession::first()->ended_at);
    }

    public function test_a_heartbeat_keeps_a_workspace_alive_past_the_idle_window(): void
    {
        Carbon::setTestNow('2026-10-10 10:00:00');
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        foreach (range(1, 20) as $minute) {
            Carbon::setTestNow(Carbon::parse('2026-10-10 10:00:00')->addMinutes($minute));
            $this->manager->heartbeat($workspace->fresh());
            $this->manager->reap();
        }

        $this->assertSame(ProjectWorkspace::STATUS_RUNNING, $workspace->fresh()->status);
    }

    public function test_the_reaper_enforces_the_maximum_session_length(): void
    {
        Carbon::setTestNow('2026-10-10 00:00:00');
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        foreach (range(1, 9 * 60) as $minute) {
            if ($minute % 5 !== 0) {
                continue;
            }
            Carbon::setTestNow(Carbon::parse('2026-10-10 00:00:00')->addMinutes($minute));
            $this->manager->heartbeat($workspace->fresh());
            $this->manager->reap();
        }

        $this->assertSame(ProjectWorkspace::STOP_MAX_SESSION, $workspace->fresh()->stop_reason);
    }

    public function test_the_reaper_stops_a_workspace_whose_plan_lapsed(): void
    {
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', Plan::CODE_PROJECT_LAB))
            ->update(['current_period_end' => now()->subMinute()]);

        $this->assertSame(['lapsed' => 1], $this->manager->reap()['stopped']);
        $this->assertSame(ProjectWorkspace::STOP_LAPSED, $workspace->fresh()->stop_reason);
    }

    public function test_the_reaper_stops_a_workspace_that_ran_out_of_hours(): void
    {
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);
        ProjectWorkspaceSession::query()->update(['seconds' => 80 * 3600]);

        $this->assertSame(['hours_exhausted' => 1], $this->manager->reap()['stopped']);
    }

    public function test_the_reaper_stops_a_workspace_over_its_disk_cap(): void
    {
        config(['workspaces.session.disk_check_minutes' => 1]); // check every run
        FakeWorkspaceRuntime::$execResults = ['du -sm' => new ExecResult(0, "9000\t/home/workspace\n")];
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        $this->assertSame(['disk_full' => 1], $this->manager->reap()['stopped']);
        $this->assertSame(9000, $workspace->fresh()->disk_mb);
    }

    public function test_the_reaper_marks_a_dead_container_failed_and_closes_its_session(): void
    {
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);
        unset(FakeWorkspaceRuntime::$containers[$workspace->container_name]); // it crashed

        $this->manager->reap();

        $fresh = $workspace->fresh();
        $this->assertSame(ProjectWorkspace::STATUS_FAILED, $fresh->status);
        $this->assertSame(ProjectWorkspace::STOP_HOST_ERROR, $fresh->stop_reason);
        $this->assertNotNull(ProjectWorkspaceSession::first()->ended_at);
    }

    public function test_the_reaper_kills_containers_the_database_does_not_know_about(): void
    {
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student); // gives the host a workspace row, so it gets swept
        FakeWorkspaceRuntime::$containers['ws-stray'] = [
            'host' => 'test-host', 'healthy' => true,
            'spec' => FakeWorkspaceRuntime::$containers[$workspace->container_name]['spec'],
        ];

        $summary = $this->manager->reap();

        $this->assertSame(1, $summary['orphans']);
        $this->assertArrayNotHasKey('ws-stray', FakeWorkspaceRuntime::$containers);
        $this->assertArrayHasKey($workspace->container_name, FakeWorkspaceRuntime::$containers, 'a legitimate workspace is never swept');
    }

    public function test_stopping_succeeds_in_the_database_even_if_the_host_is_unreachable(): void
    {
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);

        $this->app->instance(\App\Services\Workspaces\WorkspaceRuntime::class, new class extends FakeWorkspaceRuntime
        {
            public function stop(\App\Services\Workspaces\WorkspaceHost $host, string $containerName): void
            {
                throw WorkspaceException::hostError('host unreachable');
            }
        });

        app(WorkspaceManager::class)->stop($workspace->fresh());

        $this->assertSame(ProjectWorkspace::STATUS_STOPPED, $workspace->fresh()->status, 'a dead host must never leave a student "running" and billed');
        $this->assertNotNull(ProjectWorkspaceSession::first()->ended_at);
    }

    public function test_destroying_removes_the_volume(): void
    {
        [$student, , $workspace] = $this->provisioned();
        $this->manager->start($workspace, $student);
        $this->assertArrayHasKey($workspace->volume_name, FakeWorkspaceRuntime::$volumes);

        $this->manager->destroy($workspace->fresh());

        $this->assertSame(ProjectWorkspace::STATUS_DESTROYED, $workspace->fresh()->status);
        $this->assertArrayNotHasKey($workspace->volume_name, FakeWorkspaceRuntime::$volumes);
        $this->assertEmpty(FakeWorkspaceRuntime::$containers);
    }

    // ───────────────────────────── through the API ─────────────────────────────

    public function test_the_api_start_poll_heartbeat_stop_cycle(): void
    {
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student);
        Sanctum::actingAs($student);
        $base = "/api/project-lab/enrollments/{$enrollment->id}/workspace";

        $this->postJson("$base/start")
            ->assertOk()
            ->assertJsonPath('workspace.status', 'running')
            ->assertJsonPath('workspace.ready', true);

        $this->getJson($base)->assertOk()->assertJsonPath('workspace.status', 'running');
        $this->postJson("$base/heartbeat")->assertOk()->assertJsonPath('status', 'running')->assertJsonPath('enabled', true);
        $this->postJson("$base/stop")->assertOk()->assertJsonPath('workspace.status', 'stopped')->assertJsonPath('workspace.ide_url', null);
    }

    public function test_a_heartbeat_notices_a_vanished_container_without_the_scheduler(): void
    {
        // Found when a running workspace's container was deleted behind the app's back: with no scheduler
        // running (a laptop, or a platform whose scheduler is down) nothing ever noticed, and the page said
        // "Running" over an editor that could not load.
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student);
        Sanctum::actingAs($student);
        $base = "/api/project-lab/enrollments/{$enrollment->id}/workspace";

        $this->postJson("$base/start")->assertOk()->assertJsonPath('workspace.status', 'running');
        $workspace = ProjectWorkspace::firstOrFail();
        unset(FakeWorkspaceRuntime::$containers[$workspace->container_name]);
        $this->travel(60)->seconds();

        $this->postJson("$base/heartbeat")
            ->assertOk()
            ->assertJsonPath('status', 'failed')
            ->assertJsonPath('stop_reason', 'host_error');

        $session = ProjectWorkspaceSession::firstOrFail();
        $this->assertNotNull($session->ended_at, 'the session is closed');
        $this->assertSame(0, $session->seconds, 'a container that is gone earns no workspace hours');

        // And the student can simply start again: same workspace, a new container.
        $this->postJson("$base/start")->assertOk()->assertJsonPath('workspace.status', 'running');
        $this->assertArrayHasKey($workspace->fresh()->container_name, FakeWorkspaceRuntime::$containers);
    }

    public function test_the_heartbeat_asks_docker_at_most_once_per_window(): void
    {
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student);
        Sanctum::actingAs($student);
        $base = "/api/project-lab/enrollments/{$enrollment->id}/workspace";

        $this->postJson("$base/start")->assertOk();
        $workspace = ProjectWorkspace::firstOrFail();

        $this->postJson("$base/heartbeat")->assertOk()->assertJsonPath('status', 'running'); // checks: alive
        unset(FakeWorkspaceRuntime::$containers[$workspace->container_name]);

        $this->travel(60)->seconds();
        $this->postJson("$base/heartbeat")->assertOk()->assertJsonPath('status', 'running');  // inside the window: no Docker call

        $this->travel(60)->seconds();
        $this->postJson("$base/heartbeat")->assertOk()->assertJsonPath('status', 'failed');   // window over: noticed
    }

    public function test_each_route_family_has_its_own_rate_limit_bucket(): void
    {
        // Regression (found by the real-Docker end-to-end run): an unnamed `throttle:N,1`
        // is keyed by user alone, so every route shared one counter and polling the boot
        // status used up the Start button's allowance. Named limiters give each its own.
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student);
        Sanctum::actingAs($student);
        $base = "/api/project-lab/enrollments/{$enrollment->id}";

        foreach (range(1, 40) as $i) {
            $this->getJson("$base/workspace")->assertOk();      // the boot poll, far past Start's own limit
            if ($i <= 10) {
                $this->postJson("$base/workspace/heartbeat")->assertOk();
            }
        }

        $this->postJson("$base/workspace/start")->assertOk();   // Start still has its full allowance
    }

    public function test_the_start_limit_is_ten_a_minute_per_student(): void
    {
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student);
        Sanctum::actingAs($student);

        foreach (range(1, 10) as $i) {
            $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/workspace/start")->assertOk();
        }

        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/workspace/start")->assertStatus(429);

        // …and it is per student: someone else is unaffected.
        $other = $this->studentWithLab();
        $otherEnrollment = $this->enroll($other);
        Sanctum::actingAs($other);
        $this->postJson("/api/project-lab/enrollments/{$otherEnrollment->id}/workspace/start")->assertOk();
    }

    public function test_the_api_start_is_refused_when_workspaces_are_switched_off(): void
    {
        config(['workspaces.enabled' => false]);
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student);
        Sanctum::actingAs($student);

        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/workspace/start")
            ->assertStatus(503)->assertJsonPath('code', 'workspaces_disabled');
    }

    public function test_the_api_will_not_start_a_workspace_for_a_finished_project(): void
    {
        $student = $this->studentWithLab();
        $enrollment = $this->enroll($student, null, \App\Models\ProjectEnrollment::STATUS_REVIEWED);
        Sanctum::actingAs($student);

        $this->postJson("/api/project-lab/enrollments/{$enrollment->id}/workspace/start")
            ->assertStatus(409)->assertJsonPath('code', 'enrollment_not_active');
    }
}
