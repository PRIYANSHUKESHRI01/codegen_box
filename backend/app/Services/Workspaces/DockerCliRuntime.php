<?php

namespace App\Services\Workspaces;

use Illuminate\Support\Facades\Log;

/**
 * Drives a workspace host through the `docker` CLI. The CLI (rather than the
 * Engine HTTP API) because it already speaks every transport we need —
 * local named pipe/socket on a developer machine, ssh:// or mutually
 * authenticated tcp:// to a production host — and does `exec`, `cp` and volume
 * handling for us. The control plane never builds a shell string: every call
 * is an argv array, and every name that reaches Docker is validated first.
 *
 * Isolation baseline applied to EVERY workspace (see runArguments()):
 * non-root, all capabilities dropped, no privilege escalation, memory/CPU/pid
 * caps, a private tmpfs, and — when configured — a sandboxed OCI runtime such
 * as gVisor. This is the blast radius of student code; production should also
 * set WORKSPACE_OCI_RUNTIME and apply infra/workspaces/host-firewall.sh.
 */
class DockerCliRuntime implements WorkspaceRuntime
{
    private const NAME_PATTERN = '/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/';

    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly string $binary = 'docker',
    ) {}

    public function start(WorkspaceHost $host, WorkspaceSpec $spec): void
    {
        $this->assertName($spec->containerName);
        $this->assertName($spec->volumeName);
        $this->assertName($spec->network);

        $this->ensureNetwork($host, $spec->network);
        $this->docker($host, ['volume', 'create', '--label', 'aptrun.managed=1', $spec->volumeName]);

        // A previous container of the same name (crashed, or from before an image upgrade) must go first.
        $this->docker($host, ['rm', '-f', $spec->containerName], allowFailure: true);

        // The token travels in the CLI's environment, not its argv (`--env NAME`
        // with no value copies it from there), so it never shows up in `ps` on the control plane.
        $this->docker($host, $this->runArguments($spec), timeout: 180, extraEnv: ['CONNECTION_TOKEN' => $spec->connectionToken]);
    }

    /**
     * The full `docker run` argv. Public so the hardening flags can be asserted
     * in a unit test against the real command rather than trusted by reading code.
     *
     * @return list<string>
     */
    public function runArguments(WorkspaceSpec $spec): array
    {
        $args = [
            'run', '-d',
            '--name', $spec->containerName,
            '--hostname', 'workspace',
            '--network', $spec->network,
            '--restart', 'no',
            '--init',
            // Isolation baseline.
            '--user', '1000:1000',
            '--cap-drop', 'ALL',
            '--security-opt', 'no-new-privileges:true',
            '--memory', $spec->memory,
            '--memory-swap', $spec->memory,
            '--cpus', $spec->cpus,
            '--pids-limit', (string) $spec->pids,
            '--ulimit', 'nofile=65536:65536',
            '--tmpfs', "/tmp:rw,exec,nosuid,nodev,size={$spec->tmpSize}",
            // The student's code, and nothing else, persists.
            '--mount', "type=volume,source={$spec->volumeName},target=/home/workspace",
            '--env', 'CONNECTION_TOKEN',
            '--env', "IDE_PORT={$spec->idePort}",
        ];

        if ($spec->ociRuntime !== null && $spec->ociRuntime !== '') {
            $this->assertName($spec->ociRuntime);
            array_push($args, '--runtime', $spec->ociRuntime);
        }

        $labels = ['aptrun.managed' => '1'] + $spec->labels;
        foreach ($labels as $key => $value) {
            array_push($args, '--label', "{$key}={$value}");
        }

        $args[] = $spec->image;

        return $args;
    }

    public function stop(WorkspaceHost $host, string $containerName): void
    {
        $this->assertName($containerName);

        // Not found is success: stop() is idempotent by contract.
        $this->docker($host, ['stop', '-t', '10', $containerName], allowFailure: true, timeout: 60);
        $this->docker($host, ['rm', '-f', $containerName], allowFailure: true);
    }

    public function inspect(WorkspaceHost $host, string $containerName): ContainerState
    {
        $this->assertName($containerName);

        $result = $this->runner->run(
            [$this->binary, 'inspect', '--format', '{{json .State}}', $containerName],
            $host->dockerEnv(),
            null,
            20,
        );

        if (! $result->successful()) {
            // "No such object" is a normal answer; anything else (daemon down, host unreachable)
            // must not be mistaken for "the workspace is gone".
            if (str_contains(strtolower($result->stderr), 'no such')) {
                return ContainerState::missing();
            }

            throw WorkspaceException::hostError("inspect {$containerName} on {$host->name}: ".trim($result->stderr));
        }

        $state = json_decode($result->stdout, true);

        if (! is_array($state)) {
            throw WorkspaceException::hostError("inspect {$containerName} on {$host->name}: unreadable output");
        }

        return new ContainerState(
            exists: true,
            running: (bool) ($state['Running'] ?? false),
            health: $state['Health']['Status'] ?? null,
            exitCode: isset($state['ExitCode']) ? (int) $state['ExitCode'] : null,
        );
    }

    public function exec(WorkspaceHost $host, string $containerName, array $command, ?string $input = null, int $timeout = 60): ExecResult
    {
        $this->assertName($containerName);

        $argv = [$this->binary, 'exec'];

        if ($input !== null) {
            $argv[] = '-i';
        }

        array_push($argv, $containerName, ...$command);

        $result = $this->runner->run($argv, $host->dockerEnv(), $input, $timeout);

        return new ExecResult($result->timedOut ? 124 : $result->exitCode, $result->stdout, $result->stderr);
    }

    public function copyOut(WorkspaceHost $host, string $containerName, string $containerPath, string $localPath): void
    {
        $this->assertName($containerName);

        $this->docker($host, ['cp', "{$containerName}:{$containerPath}", $localPath], timeout: 300);
    }

    public function removeVolume(WorkspaceHost $host, string $volumeName): void
    {
        $this->assertName($volumeName);

        $this->docker($host, ['volume', 'rm', '-f', $volumeName], allowFailure: true);
    }

    public function listRunning(WorkspaceHost $host): array
    {
        $result = $this->docker($host, ['ps', '--filter', 'label=aptrun.managed=1', '--format', '{{.Names}}']);

        return array_values(array_filter(array_map('trim', explode("\n", $result->stdout))));
    }

    private function ensureNetwork(WorkspaceHost $host, string $network): void
    {
        $exists = $this->runner->run([$this->binary, 'network', 'inspect', $network], $host->dockerEnv(), null, 20);

        if (! $exists->successful()) {
            $this->docker($host, ['network', 'create', '--label', 'aptrun.managed=1', $network]);
        }
    }

    /**
     * @param  list<string>  $arguments
     * @param  array<string, string>  $extraEnv  per-call CLI environment, merged over the host's
     *
     * @throws WorkspaceException unless $allowFailure
     */
    private function docker(WorkspaceHost $host, array $arguments, bool $allowFailure = false, int $timeout = 60, array $extraEnv = []): ProcessResult
    {
        $result = $this->runner->run([$this->binary, ...$arguments], $host->dockerEnv() + $extraEnv, null, $timeout);

        if (! $result->successful() && ! $allowFailure) {
            $detail = "docker {$arguments[0]} on {$host->name} failed (exit {$result->exitCode}): ".trim($result->stderr);
            Log::warning($detail);

            throw WorkspaceException::hostError($detail);
        }

        return $result;
    }

    private function assertName(string $name): void
    {
        if (preg_match(self::NAME_PATTERN, $name) !== 1) {
            throw WorkspaceException::hostError("refusing unsafe docker object name [{$name}]");
        }
    }
}
