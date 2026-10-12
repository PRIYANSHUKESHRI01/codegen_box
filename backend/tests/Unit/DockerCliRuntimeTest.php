<?php

namespace Tests\Unit;

use App\Services\Workspaces\DockerCliRuntime;
use App\Services\Workspaces\ProcessResult;
use App\Services\Workspaces\ProcessRunner;
use App\Services\Workspaces\WorkspaceException;
use App\Services\Workspaces\WorkspaceHost;
use App\Services\Workspaces\WorkspaceSpec;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The isolation baseline is a property of the exact `docker run` command, so it
 * is asserted against that command — not trusted by reading the code. A flag
 * quietly dropped in a refactor should fail here, not in production.
 */
class DockerCliRuntimeTest extends TestCase
{
    private RecordingProcessRunner $runner;

    private DockerCliRuntime $runtime;

    private WorkspaceHost $local;

    protected function setUp(): void
    {
        parent::setUp();
        $this->runner = new RecordingProcessRunner;
        $this->runtime = new DockerCliRuntime($this->runner, 'docker');
        $this->local = new WorkspaceHost('local', null, 4, 'localhost:8081', 'http');
    }

    private function spec(array $overrides = []): WorkspaceSpec
    {
        return new WorkspaceSpec(...($overrides + [
            'containerName' => 'ws-abc123',
            'volumeName' => 'wsvol-7-x1y2z3',
            'image' => 'aptrun/workspace:latest',
            'connectionToken' => 'SECRET-TOKEN-VALUE',
            'network' => 'aptrun-workspaces',
            'idePort' => 13370,
            'memory' => '2g',
            'cpus' => '1.5',
            'pids' => 512,
            'tmpSize' => '1g',
            'ociRuntime' => null,
            'labels' => ['aptrun.workspace' => 'abc123', 'aptrun.user' => '7'],
        ]));
    }

    /** Value following $flag in an argv, or null. */
    private function flagValue(array $argv, string $flag): ?string
    {
        $i = array_search($flag, $argv, true);

        return $i === false ? null : ($argv[$i + 1] ?? null);
    }

    public function test_the_run_command_applies_the_full_isolation_baseline(): void
    {
        $argv = $this->runtime->runArguments($this->spec());

        $this->assertSame('run', $argv[0]);
        $this->assertContains('-d', $argv);
        $this->assertSame('1000:1000', $this->flagValue($argv, '--user'), 'never root');
        $this->assertSame('ALL', $this->flagValue($argv, '--cap-drop'), 'every capability dropped');
        $this->assertSame('no-new-privileges:true', $this->flagValue($argv, '--security-opt'));
        $this->assertSame('2g', $this->flagValue($argv, '--memory'));
        $this->assertSame('2g', $this->flagValue($argv, '--memory-swap'), 'no swap beyond the memory cap');
        $this->assertSame('1.5', $this->flagValue($argv, '--cpus'));
        $this->assertSame('512', $this->flagValue($argv, '--pids-limit'), 'fork-bomb cap');
        $this->assertSame('no', $this->flagValue($argv, '--restart'), 'a stopped workspace must stay stopped');
        $this->assertSame('aptrun-workspaces', $this->flagValue($argv, '--network'));
        $this->assertContains('--init', $argv);
        $this->assertStringContainsString('nosuid', $this->flagValue($argv, '--tmpfs'));
        $this->assertSame('aptrun/workspace:latest', end($argv), 'the image is the last argument');
    }

    public function test_the_only_persistent_mount_is_the_students_own_volume(): void
    {
        $argv = $this->runtime->runArguments($this->spec());
        $joined = implode(' ', $argv);

        $this->assertSame('type=volume,source=wsvol-7-x1y2z3,target=/home/workspace', $this->flagValue($argv, '--mount'));
        $this->assertSame(1, substr_count($joined, '--mount'));
        $this->assertStringNotContainsString('docker.sock', $joined, 'the Docker socket must never reach a workspace');
        $this->assertStringNotContainsString(' -v ', $joined);
        $this->assertStringNotContainsString('--volume', $joined);
    }

    public function test_nothing_that_weakens_isolation_is_ever_passed(): void
    {
        $joined = ' '.implode(' ', $this->runtime->runArguments($this->spec())).' ';

        foreach (['--privileged', '--network host', '--net host', '--pid host', '--pid=host', '--ipc host', '--cap-add', '--device', '--userns host', '--security-opt seccomp=unconfined', '--security-opt apparmor=unconfined', '--add-host'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $joined, "$forbidden must never appear");
        }
    }

    public function test_the_connection_token_is_not_in_the_command_line_but_in_the_environment(): void
    {
        $argv = $this->runtime->runArguments($this->spec());
        $this->assertStringNotContainsString('SECRET-TOKEN-VALUE', implode(' ', $argv), 'a token in argv shows up in `ps`');
        $this->assertContains('CONNECTION_TOKEN', $argv, '--env NAME with no value copies it from the CLI environment');

        $this->runtime->start($this->local, $this->spec());

        $run = collect($this->runner->calls)->first(fn ($c) => ($c['command'][1] ?? null) === 'run');
        $this->assertSame('SECRET-TOKEN-VALUE', $run['env']['CONNECTION_TOKEN']);
        foreach ($this->runner->calls as $call) {
            $this->assertStringNotContainsString('SECRET-TOKEN-VALUE', implode(' ', $call['command']));
        }
    }

    public function test_a_sandboxed_oci_runtime_is_used_only_when_configured(): void
    {
        $this->assertNotContains('--runtime', $this->runtime->runArguments($this->spec()));

        $argv = $this->runtime->runArguments($this->spec(['ociRuntime' => 'runsc']));
        $this->assertSame('runsc', $this->flagValue($argv, '--runtime'));
    }

    public function test_workspaces_are_labelled_so_orphans_can_be_found(): void
    {
        $argv = $this->runtime->runArguments($this->spec());
        $labels = array_keys(array_filter($argv, fn ($a) => str_starts_with((string) $a, 'aptrun.')));

        $this->assertContains('aptrun.managed=1', $argv);
        $this->assertContains('aptrun.workspace=abc123', $argv);
        $this->assertContains('aptrun.user=7', $argv);
        $this->assertNotEmpty($labels);
    }

    public function test_start_prepares_the_network_and_volume_and_clears_a_leftover_container_first(): void
    {
        $this->runner->handler = fn (array $c) => ($c[1] === 'network' && $c[2] === 'inspect') ? new ProcessResult(1, '', 'Error: No such network') : new ProcessResult(0);

        $this->runtime->start($this->local, $this->spec());

        $verbs = array_map(fn ($c) => implode(' ', array_slice($c['command'], 1, 2)), $this->runner->calls);
        $this->assertSame(['network inspect', 'network create', 'volume create', 'rm -f', 'run -d'], $verbs);
    }

    public function test_an_existing_network_is_not_recreated(): void
    {
        $this->runtime->start($this->local, $this->spec());

        $verbs = array_map(fn ($c) => implode(' ', array_slice($c['command'], 1, 2)), $this->runner->calls);
        $this->assertNotContains('network create', $verbs);
    }

    public function test_a_remote_host_is_addressed_through_docker_host_never_the_command_line(): void
    {
        $remote = new WorkspaceHost('ws-1', 'ssh://deploy@ws-1.example.com', 24, 'ws.example.com', 'https', true, '/etc/docker/certs');

        $this->runtime->stop($remote, 'ws-abc123');

        foreach ($this->runner->calls as $call) {
            $this->assertSame('ssh://deploy@ws-1.example.com', $call['env']['DOCKER_HOST']);
            $this->assertSame('1', $call['env']['DOCKER_TLS_VERIFY']);
            $this->assertSame('/etc/docker/certs', $call['env']['DOCKER_CERT_PATH']);
            $this->assertNotContains('-H', $call['command']);
        }
    }

    public function test_the_local_host_sets_no_docker_host_so_the_clis_own_default_applies(): void
    {
        $this->runtime->stop($this->local, 'ws-abc123');

        $this->assertArrayNotHasKey('DOCKER_HOST', $this->runner->calls[0]['env']);
    }

    public function test_a_failed_run_becomes_a_host_error_with_operator_detail_kept_apart(): void
    {
        $this->runner->handler = fn (array $c) => $c[1] === 'run' ? new ProcessResult(125, '', 'docker: Error response from daemon: pull access denied for aptrun/workspace') : new ProcessResult(0);

        try {
            $this->runtime->start($this->local, $this->spec());
            $this->fail('expected a WorkspaceException');
        } catch (WorkspaceException $e) {
            $this->assertSame('workspace_host_error', $e->errorCode);
            $this->assertSame(503, $e->status);
            $this->assertStringNotContainsString('pull access denied', $e->getMessage());
            $this->assertStringContainsString('pull access denied', (string) $e->detail);
        }
    }

    #[DataProvider('unsafeNames')]
    public function test_unsafe_object_names_never_reach_docker(string $name): void
    {
        $this->expectException(WorkspaceException::class);

        try {
            $this->runtime->stop($this->local, $name);
        } finally {
            $this->assertSame([], $this->runner->calls, 'nothing may be executed for an unsafe name');
        }
    }

    public static function unsafeNames(): array
    {
        return [
            'option injection' => ['--privileged'],
            'path traversal' => ['../etc'],
            'shell metacharacters' => ['ws-1; rm -rf /'],
            'space' => ['ws 1'],
            'newline' => ["ws-1\nrm"],
            'leading dash' => ['-rf'],
            'empty' => [''],
            'too long' => [str_repeat('a', 81)],
        ];
    }

    public function test_inspect_reads_running_and_health_state(): void
    {
        $this->runner->handler = fn () => new ProcessResult(0, json_encode(['Status' => 'running', 'Running' => true, 'ExitCode' => 0, 'Health' => ['Status' => 'healthy']]));

        $state = $this->runtime->inspect($this->local, 'ws-abc123');

        $this->assertTrue($state->exists);
        $this->assertTrue($state->running);
        $this->assertSame('healthy', $state->health);
        $this->assertTrue($state->ready());
    }

    public function test_a_running_but_unhealthy_container_is_not_ready(): void
    {
        $this->runner->handler = fn () => new ProcessResult(0, json_encode(['Running' => true, 'Health' => ['Status' => 'starting']]));

        $this->assertFalse($this->runtime->inspect($this->local, 'ws-abc123')->ready());
    }

    public function test_an_image_without_a_healthcheck_counts_as_ready_once_running(): void
    {
        $this->runner->handler = fn () => new ProcessResult(0, json_encode(['Running' => true]));

        $this->assertTrue($this->runtime->inspect($this->local, 'ws-abc123')->ready());
    }

    public function test_a_missing_container_is_reported_as_missing(): void
    {
        $this->runner->handler = fn () => new ProcessResult(1, '', 'Error: No such object: ws-abc123');

        $this->assertFalse($this->runtime->inspect($this->local, 'ws-abc123')->exists);
    }

    public function test_an_unreachable_daemon_is_an_error_not_a_missing_container(): void
    {
        // "Cannot connect to the Docker daemon" must never be read as "the workspace is gone".
        $this->runner->handler = fn () => new ProcessResult(1, '', 'Cannot connect to the Docker daemon at unix:///var/run/docker.sock');

        $this->expectException(WorkspaceException::class);

        $this->runtime->inspect($this->local, 'ws-abc123');
    }

    public function test_stop_is_idempotent_when_the_container_is_already_gone(): void
    {
        $this->runner->handler = fn () => new ProcessResult(1, '', 'Error: No such container');

        $this->runtime->stop($this->local, 'ws-abc123');

        $this->assertSame(['stop', 'rm'], array_map(fn ($c) => $c['command'][1], $this->runner->calls));
    }

    public function test_exec_passes_argv_and_input_without_a_shell(): void
    {
        $this->runtime->exec($this->local, 'ws-abc123', ['sh', '-c', 'cat > "$1"', 'sh', '/home/workspace/x'], 'file body');

        $call = $this->runner->calls[0];
        $this->assertSame(['docker', 'exec', '-i', 'ws-abc123', 'sh', '-c', 'cat > "$1"', 'sh', '/home/workspace/x'], $call['command']);
        $this->assertSame('file body', $call['input']);
    }

    public function test_exec_without_input_does_not_hold_stdin_open(): void
    {
        $this->runtime->exec($this->local, 'ws-abc123', ['ls']);

        $this->assertNotContains('-i', $this->runner->calls[0]['command']);
    }

    public function test_a_timed_out_exec_reports_exit_code_124(): void
    {
        $this->runner->handler = fn () => new ProcessResult(-1, '', 'Timed out', true);

        $this->assertSame(124, $this->runtime->exec($this->local, 'ws-abc123', ['sleep', '999'])->exitCode);
    }

    public function test_list_running_returns_container_names_only(): void
    {
        $this->runner->handler = fn () => new ProcessResult(0, "ws-aaa\nws-bbb\n\n");

        $this->assertSame(['ws-aaa', 'ws-bbb'], $this->runtime->listRunning($this->local));
        $this->assertContains('label=aptrun.managed=1', $this->runner->calls[0]['command'], 'only managed containers are ever listed');
    }
}

/** Records every command and answers from a closure (success by default). */
class RecordingProcessRunner implements ProcessRunner
{
    /** @var list<array{command: list<string>, env: array<string, string>, input: ?string, timeout: int}> */
    public array $calls = [];

    /** @var null|\Closure(list<string>): ProcessResult */
    public $handler = null;

    public function run(array $command, array $env = [], ?string $input = null, int $timeout = 60): ProcessResult
    {
        $this->calls[] = compact('command', 'env', 'input', 'timeout');

        return $this->handler ? ($this->handler)($command) : new ProcessResult(0);
    }
}
