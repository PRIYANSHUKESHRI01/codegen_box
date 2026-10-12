<?php

namespace App\Services\Workspaces;

/**
 * An in-memory host, for tests and for developing the Project Lab UI on a
 * machine without Docker (WORKSPACE_RUNTIME=fake). It starts nothing: a
 * "running" workspace here has no editor behind its URL. State lives in static
 * properties so it survives the manager being re-resolved from the container,
 * and tests call reset() in setUp.
 */
class FakeWorkspaceRuntime implements WorkspaceRuntime
{
    /** @var array<string, array{host: string, spec: WorkspaceSpec, healthy: bool}> keyed by container name */
    public static array $containers = [];

    /** @var array<string, true> */
    public static array $volumes = [];

    /** @var list<array{container: string, command: list<string>, input: ?string}> */
    public static array $execLog = [];

    /** When set, start() throws — simulates a host that is down. */
    public static ?string $failStartWith = null;

    /** Result of any exec whose command contains the key as a substring of its joined form. */
    public static array $execResults = [];

    /** Bytes copyOut() writes, standing in for the snapshot archive. */
    public static string $snapshotBytes = "FAKE-SNAPSHOT\n";

    /** Whether newly started containers pass their healthcheck immediately. */
    public static bool $healthyOnStart = true;

    public static function reset(): void
    {
        self::$containers = [];
        self::$volumes = [];
        self::$execLog = [];
        self::$failStartWith = null;
        self::$execResults = [];
        self::$snapshotBytes = "FAKE-SNAPSHOT\n";
        self::$healthyOnStart = true;
    }

    public function start(WorkspaceHost $host, WorkspaceSpec $spec): void
    {
        if (self::$failStartWith !== null) {
            throw WorkspaceException::hostError(self::$failStartWith);
        }

        self::$volumes[$spec->volumeName] = true;
        self::$containers[$spec->containerName] = ['host' => $host->name, 'spec' => $spec, 'healthy' => self::$healthyOnStart];
    }

    public function stop(WorkspaceHost $host, string $containerName): void
    {
        unset(self::$containers[$containerName]);
    }

    public function inspect(WorkspaceHost $host, string $containerName): ContainerState
    {
        $container = self::$containers[$containerName] ?? null;

        if ($container === null) {
            return ContainerState::missing();
        }

        return new ContainerState(true, true, $container['healthy'] ? 'healthy' : 'starting');
    }

    public function exec(WorkspaceHost $host, string $containerName, array $command, ?string $input = null, int $timeout = 60): ExecResult
    {
        self::$execLog[] = ['container' => $containerName, 'command' => $command, 'input' => $input];

        $joined = implode(' ', $command);

        foreach (self::$execResults as $needle => $result) {
            if (str_contains($joined, (string) $needle)) {
                return $result;
            }
        }

        return new ExecResult(0);
    }

    public function copyOut(WorkspaceHost $host, string $containerName, string $containerPath, string $localPath): void
    {
        file_put_contents($localPath, self::$snapshotBytes);
    }

    public function removeVolume(WorkspaceHost $host, string $volumeName): void
    {
        unset(self::$volumes[$volumeName]);
    }

    public function listRunning(WorkspaceHost $host): array
    {
        return array_keys(array_filter(self::$containers, fn (array $c) => $c['host'] === $host->name));
    }
}
