<?php

namespace App\Services\Workspaces;

/**
 * Everything the control plane needs from a workspace host, and nothing more.
 * Containers are disposable: start() always creates a fresh one (new image,
 * new token) on top of the student's persistent volume, and stop() removes it.
 * The volume — the student's code — is only ever deleted by removeVolume().
 */
interface WorkspaceRuntime
{
    /**
     * Ensure the network and the student's volume exist, replace any leftover
     * container of the same name, and start a new one. Returns once Docker has
     * started it — the editor inside may still be booting (see inspect()).
     *
     * @throws WorkspaceException
     */
    public function start(WorkspaceHost $host, WorkspaceSpec $spec): void;

    /** Stop and remove the container. The volume is untouched. Idempotent. */
    public function stop(WorkspaceHost $host, string $containerName): void;

    public function inspect(WorkspaceHost $host, string $containerName): ContainerState;

    /**
     * Run a command inside a running workspace (as the workspace user).
     *
     * @param  list<string>  $command
     */
    public function exec(WorkspaceHost $host, string $containerName, array $command, ?string $input = null, int $timeout = 60): ExecResult;

    /** Copy ONE file out of a container to a local path. */
    public function copyOut(WorkspaceHost $host, string $containerName, string $containerPath, string $localPath): void;

    /** Delete a student's volume — permanently destroys their code. */
    public function removeVolume(WorkspaceHost $host, string $volumeName): void;

    /**
     * Names of every workspace container currently running on the host, whether
     * or not the database knows about it — how orphans are found.
     *
     * @return list<string>
     */
    public function listRunning(WorkspaceHost $host): array;
}
