<?php

namespace App\Services\Workspaces;

/** Everything needed to create one workspace container. Plain data, so the runtime has no Eloquent in it. */
final readonly class WorkspaceSpec
{
    /**
     * @param  array<string, string>  $labels
     */
    public function __construct(
        public string $containerName,
        public string $volumeName,
        public string $image,
        public string $connectionToken,
        public string $network,
        public int $idePort,
        public string $memory,
        public string $cpus,
        public int $pids,
        public string $tmpSize,
        public ?string $ociRuntime = null,
        public array $labels = [],
    ) {}
}
