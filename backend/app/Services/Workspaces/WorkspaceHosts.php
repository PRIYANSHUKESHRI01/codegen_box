<?php

namespace App\Services\Workspaces;

use App\Models\ProjectWorkspace;

/**
 * The configured workspace hosts and which one a new workspace should live on.
 * A workspace is pinned to its host for life (its volume is there), so this
 * choice is made once, at provisioning.
 */
class WorkspaceHosts
{
    /** @return list<WorkspaceHost> */
    public function all(): array
    {
        return array_values(array_map(
            fn (array $entry) => WorkspaceHost::fromConfig($entry),
            (array) config('workspaces.hosts', [])
        ));
    }

    public function find(string $name): ?WorkspaceHost
    {
        foreach ($this->all() as $host) {
            if ($host->name === $name) {
                return $host;
            }
        }

        return null;
    }

    /** Workspaces on the host that hold (or are acquiring) a container right now. */
    public function liveCount(WorkspaceHost $host): int
    {
        return ProjectWorkspace::where('host', $host->name)
            ->whereIn('status', ProjectWorkspace::LIVE)
            ->count();
    }

    /**
     * The host with the most spare room, by load ratio rather than raw count so
     * a small host isn't filled to the brim while a big one idles. Ties go to the
     * first configured. A host already at capacity is still returned if every host
     * is full — capacity is enforced when a workspace STARTS, not when it is assigned.
     */
    public function leastLoaded(): ?WorkspaceHost
    {
        $best = null;
        $bestRatio = null;

        foreach ($this->all() as $host) {
            $ratio = $this->liveCount($host) / $host->capacity;

            if ($bestRatio === null || $ratio < $bestRatio) {
                $best = $host;
                $bestRatio = $ratio;
            }
        }

        return $best;
    }
}
