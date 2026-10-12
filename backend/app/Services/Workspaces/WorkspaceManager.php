<?php

namespace App\Services\Workspaces;

use App\Models\ProjectEnrollment;
use App\Models\ProjectWorkspace;
use App\Models\ProjectWorkspaceSession;
use App\Models\User;
use App\Services\ProjectLab\ProjectLabAccess;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * The control plane for workspaces: provision, start, stop, keep the hours,
 * and reap the ones nobody is using. It owns every rule about WHO may have a
 * container and for HOW LONG; the runtime (DockerCliRuntime) only knows how to
 * run one.
 *
 * Invariants worth knowing before changing anything:
 *  - One live workspace per student. Starting another stops the first.
 *  - The row says `starting` BEFORE Docker is asked to start anything, and that
 *    change is committed first — so a concurrent start sees it, and the orphan
 *    sweep never mistakes a container that is mid-creation for a stray.
 *  - Hours are advanced only by heartbeats from the open workspace page, each
 *    worth at most heartbeat_credit_seconds, so neither an idle tab nor a sleeping
 *    laptop can bill or bank time it didn't use.
 *  - Stopping always succeeds from the database's point of view: if the host is
 *    unreachable the row still goes to `stopped` and the orphan sweep retries
 *    the container later. A dead host must never leave a student "running" (and
 *    billed) forever.
 */
class WorkspaceManager
{
    /**
     * How often an open page's heartbeat also asks Docker whether the container is still there. A heartbeat
     * arrives every 60 s, so this checks about every other beat: cheap enough for a remote (ssh://) host, and a
     * vanished container is noticed within ~3 minutes.
     */
    private const HEALTH_CHECK_SECONDS = 100;

    public function __construct(
        private readonly WorkspaceRuntime $runtime,
        private readonly WorkspaceHosts $hosts,
        private readonly ProjectLabAccess $access,
    ) {}

    /** The student's workspace for an enrollment, created (stopped) on first use. */
    public function provision(ProjectEnrollment $enrollment): ProjectWorkspace
    {
        $existing = $enrollment->workspace;

        if ($existing !== null && $existing->status !== ProjectWorkspace::STATUS_DESTROYED) {
            return $existing;
        }

        $host = $this->hosts->leastLoaded()
            ?? throw WorkspaceException::hostError('no workspace hosts are configured');

        $publicId = ProjectWorkspace::newPublicId();

        // Names embed the enrollment so a stray volume can be traced to its owner by hand.
        $workspace = $enrollment->workspace()->updateOrCreate([], [
            'public_id' => $publicId,
            'user_id' => $enrollment->user_id,
            'host' => $host->name,
            'container_name' => 'ws-'.$publicId,
            'volume_name' => 'wsvol-'.$enrollment->id.'-'.Str::lower(Str::random(6)),
            'status' => ProjectWorkspace::STATUS_STOPPED,
            'connection_token' => null,
            'error' => null,
        ]);

        return $workspace;
    }

    /**
     * @throws WorkspaceException 402 not entitled / out of hours, 503 no capacity or host error
     */
    public function start(ProjectWorkspace $workspace, User $user): ProjectWorkspace
    {
        $coverage = $this->access->requireAccess($user);

        $host = $this->hosts->find($workspace->host)
            ?? throw WorkspaceException::hostError("workspace {$workspace->id} is pinned to unknown host [{$workspace->host}]");

        $started = DB::transaction(function () use ($workspace, $user, $coverage, $host) {
            $locked = ProjectWorkspace::whereKey($workspace->id)->lockForUpdate()->firstOrFail();

            // Idempotent: a double-click, or a second tab, just gets the running one.
            if ($locked->isLive()) {
                return [$locked, false];
            }

            if ($locked->status === ProjectWorkspace::STATUS_DESTROYED) {
                throw new WorkspaceException('This workspace no longer exists.', 'workspace_destroyed', 410);
            }

            $this->access->assertHoursRemaining($user, $coverage);

            // Switching projects: the other workspace is stopped, not refused.
            ProjectWorkspace::where('user_id', $user->id)
                ->whereKeyNot($locked->id)
                ->whereIn('status', ProjectWorkspace::LIVE)
                ->get()
                ->each(fn (ProjectWorkspace $other) => $this->stop($other, ProjectWorkspace::STOP_USER));

            if ($this->hosts->liveCount($host) >= $host->capacity) {
                throw WorkspaceException::capacity();
            }

            $locked->update([
                'status' => ProjectWorkspace::STATUS_STARTING,
                'connection_token' => Str::random(40),
                'last_started_at' => now(),
                'last_heartbeat_at' => now(),
                'stop_reason' => null,
                'error' => null,
            ]);

            ProjectWorkspaceSession::create([
                'project_workspace_id' => $locked->id,
                'user_id' => $user->id,
                'started_at' => now(),
                'seconds' => 0,
            ]);

            return [$locked, true];
        });

        [$locked, $needsContainer] = $started;

        if (! $needsContainer) {
            return $this->refresh($locked);
        }

        // Outside the transaction on purpose: Docker can take a while, and the row is already `starting`.
        try {
            $this->runtime->start($host, $this->specFor($locked, $host));
        } catch (WorkspaceException $e) {
            $this->markFailed($locked, $e->detail ?? $e->getMessage());

            throw $e;
        }

        return $this->refresh($locked->fresh());
    }

    /**
     * Reconcile the row with the container: promote starting → running once the
     * editor is healthy, and notice a container that died.
     */
    public function refresh(ProjectWorkspace $workspace): ProjectWorkspace
    {
        if (! $workspace->isLive()) {
            return $workspace;
        }

        $host = $this->hosts->find($workspace->host);

        if ($host === null) {
            return $workspace;
        }

        try {
            $state = $this->runtime->inspect($host, $workspace->container_name);
        } catch (WorkspaceException $e) {
            // Host unreachable right now: report what we last knew rather than guessing it dead.
            Log::warning('workspace inspect failed: '.($e->detail ?? $e->getMessage()));

            return $workspace;
        }

        if (! $state->running) {
            $reason = $state->exists
                ? 'The workspace stopped unexpectedly (exit code '.($state->exitCode ?? '?').').'
                : 'The workspace container is gone.';

            $this->closeSession($workspace, ProjectWorkspace::STOP_HOST_ERROR);
            $workspace->update([
                'status' => ProjectWorkspace::STATUS_FAILED,
                'connection_token' => null,
                'last_stopped_at' => now(),
                'stop_reason' => ProjectWorkspace::STOP_HOST_ERROR,
                'error' => $reason,
            ]);

            return $workspace;
        }

        if ($workspace->status === ProjectWorkspace::STATUS_STARTING) {
            if ($state->ready()) {
                $workspace->update(['status' => ProjectWorkspace::STATUS_RUNNING]);
                $this->seedFiles($workspace, $host);
            } elseif ($workspace->last_started_at !== null && now()->getTimestamp() - $workspace->last_started_at->getTimestamp() > 180) {
                // Booting should take seconds. Three minutes means it is not going to.
                $this->stop($workspace, ProjectWorkspace::STOP_HOST_ERROR);
                $workspace->update(['status' => ProjectWorkspace::STATUS_FAILED, 'error' => 'The editor did not start in time.']);
            }
        }

        return $workspace;
    }

    /** @param  string  $reason  one of ProjectWorkspace::STOP_* */
    public function stop(ProjectWorkspace $workspace, string $reason = ProjectWorkspace::STOP_USER): ProjectWorkspace
    {
        if (! $workspace->isLive()) {
            return $workspace;
        }

        $host = $this->hosts->find($workspace->host);

        if ($host !== null) {
            try {
                $this->runtime->stop($host, $workspace->container_name);
            } catch (Throwable $e) {
                // See the class docblock: the row still goes to stopped; the orphan sweep retries.
                Log::warning("workspace {$workspace->id} stop failed on {$workspace->host}: ".$e->getMessage());
            }
        }

        $this->closeSession($workspace, $reason);

        $workspace->update([
            'status' => ProjectWorkspace::STATUS_STOPPED,
            'connection_token' => null,
            'last_stopped_at' => now(),
            'stop_reason' => $reason,
        ]);

        return $workspace;
    }

    /**
     * One beat from the open workspace page. Credits the time since the last
     * beat, capped, to the open session.
     *
     * It also notices a container that has vanished (host rebooted, someone removed
     * it, Docker restarted): the row is marked failed so the page can say so and offer
     * "start again", instead of a student staring at an editor that can never load.
     * The scheduled reaper catches the same thing, but it must not be the ONLY thing
     * that does — it does not run on a laptop without `schedule:work`, nor when a
     * platform's scheduler is down — so the check is made here too, throttled
     * per workspace. A vanished container earns no credited time.
     */
    public function heartbeat(ProjectWorkspace $workspace): ProjectWorkspace
    {
        if (! $workspace->isLive()) {
            return $workspace;
        }

        if (Cache::add("workspace-health:{$workspace->id}", 1, self::HEALTH_CHECK_SECONDS)) {
            $workspace = $this->refresh($workspace);

            if (! $workspace->isLive()) {
                return $workspace;
            }
        }

        $now = now();
        $last = $workspace->last_heartbeat_at ?? $workspace->last_started_at ?? $now;
        $cap = (int) config('workspaces.session.heartbeat_credit_seconds', 120);
        $credit = max(0, min($cap, $now->getTimestamp() - $last->getTimestamp()));

        if ($credit > 0) {
            $session = $workspace->sessions()->whereNull('ended_at')->latest('id')->first();
            $session?->increment('seconds', $credit);
        }

        $workspace->update(['last_heartbeat_at' => $now]);

        return $workspace;
    }

    /**
     * Stop whatever should no longer be running, then sweep for containers the
     * database has lost track of. Run every minute by the scheduler.
     *
     * @return array{checked: int, stopped: array<string, int>, orphans: int}
     */
    public function reap(): array
    {
        $summary = ['checked' => 0, 'stopped' => [], 'orphans' => 0];

        $live = ProjectWorkspace::whereIn('status', ProjectWorkspace::LIVE)->with('user')->get();

        foreach ($live as $workspace) {
            $summary['checked']++;

            try {
                $reason = $this->reasonToStop($workspace);

                if ($reason !== null) {
                    $this->stop($workspace, $reason);
                    $summary['stopped'][$reason] = ($summary['stopped'][$reason] ?? 0) + 1;
                }
            } catch (Throwable $e) {
                // One bad workspace must not stop the sweep of the others.
                report($e);
            }
        }

        $summary['orphans'] = $this->sweepOrphans();

        return $summary;
    }

    /** Why this live workspace should be stopped right now, or null to leave it be. */
    private function reasonToStop(ProjectWorkspace $workspace): ?string
    {
        $workspace = $this->refresh($workspace);

        if (! $workspace->isLive()) {
            return null; // refresh() already closed it out (container died / never booted)
        }

        $user = $workspace->user;
        $coverage = $user->projectLabCoverage();

        if (! $coverage['access']) {
            return ProjectWorkspace::STOP_LAPSED;
        }

        $limit = $coverage['max_workspace_hours_per_month'];
        if ($limit !== null && $this->access->secondsUsed($user, $coverage) >= $limit * 3600) {
            return ProjectWorkspace::STOP_HOURS_EXHAUSTED;
        }

        $now = now()->getTimestamp();
        $lastBeat = ($workspace->last_heartbeat_at ?? $workspace->last_started_at)?->getTimestamp() ?? $now;

        if ($now - $lastBeat > (int) config('workspaces.session.idle_minutes', 15) * 60) {
            return ProjectWorkspace::STOP_IDLE;
        }

        $startedAt = $workspace->last_started_at?->getTimestamp() ?? $now;

        if ($now - $startedAt > (int) config('workspaces.session.max_session_minutes', 480) * 60) {
            return ProjectWorkspace::STOP_MAX_SESSION;
        }

        if ($workspace->status === ProjectWorkspace::STATUS_RUNNING && $this->diskCheckDue($workspace)) {
            $this->measureDisk($workspace);

            if ($workspace->disk_mb !== null && $workspace->disk_mb > (int) config('workspaces.limits.disk_mb', 3072)) {
                return ProjectWorkspace::STOP_DISK_FULL;
            }
        }

        return null;
    }

    /** Spread the (expensive on a big node_modules) `du` over time instead of running it for everyone every minute. */
    private function diskCheckDue(ProjectWorkspace $workspace): bool
    {
        $every = max(1, (int) config('workspaces.session.disk_check_minutes', 10));

        return (int) now()->format('i') % $every === $workspace->id % $every;
    }

    private function measureDisk(ProjectWorkspace $workspace): void
    {
        $host = $this->hosts->find($workspace->host);

        if ($host === null) {
            return;
        }

        $result = $this->runtime->exec($host, $workspace->container_name, ['du', '-sm', SnapshotScript::ROOT], null, 120);

        if ($result->successful() && preg_match('/^(\d+)/', trim($result->stdout), $m)) {
            $workspace->update(['disk_mb' => (int) $m[1]]);
        }
    }

    /**
     * Containers running on a host that no live row accounts for. Skipped for a
     * host that can't be listed — an unreachable host is not "no containers".
     */
    private function sweepOrphans(): int
    {
        $known = ProjectWorkspace::whereIn('status', ProjectWorkspace::LIVE)->pluck('container_name')->all();
        $stopped = 0;

        foreach ($this->hosts->all() as $host) {
            // A host nothing has ever been placed on (e.g. the app server itself,
            // or a platform that hasn't launched workspaces) is not worth a Docker call a minute.
            if (! ProjectWorkspace::where('host', $host->name)->exists()) {
                continue;
            }

            try {
                foreach ($this->runtime->listRunning($host) as $name) {
                    if (! in_array($name, $known, true)) {
                        $this->runtime->stop($host, $name);
                        $stopped++;
                        Log::warning("workspace orphan {$name} stopped on {$host->name}");
                    }
                }
            } catch (WorkspaceException $e) {
                Log::warning("workspace orphan sweep skipped {$host->name}: ".($e->detail ?? $e->getMessage()));
            }
        }

        return $stopped;
    }

    /** Permanently delete the workspace and the student's code in it. Admin/cleanup only. */
    public function destroy(ProjectWorkspace $workspace): void
    {
        $this->stop($workspace, ProjectWorkspace::STOP_USER);

        $host = $this->hosts->find($workspace->host);

        if ($host !== null) {
            $this->runtime->removeVolume($host, $workspace->volume_name);
        }

        $workspace->update(['status' => ProjectWorkspace::STATUS_DESTROYED]);
    }

    /**
     * The editor URL, with the connection token the owner needs to open it.
     * Null unless the container is live — a stopped workspace has no address.
     */
    public function ideUrl(ProjectWorkspace $workspace): ?string
    {
        $host = $this->hosts->find($workspace->host);

        if ($host === null || ! $workspace->isLive() || $workspace->connection_token === null) {
            return null;
        }

        return $host->urlFor(
            $workspace->hostLabel(),
            '/?tkn='.rawurlencode($workspace->connection_token).'&folder='.rawurlencode(SnapshotScript::ROOT)
        );
    }

    /** URL template for the app preview; the client substitutes {port}. */
    public function previewUrlTemplate(ProjectWorkspace $workspace): ?string
    {
        $host = $this->hosts->find($workspace->host);

        return $host?->urlFor('p{port}--'.$workspace->hostLabel());
    }

    /** @return array<string, mixed> the workspace as the client sees it */
    public function present(ProjectWorkspace $workspace): array
    {
        return [
            'id' => $workspace->id,
            'status' => $workspace->status,
            'ready' => $workspace->status === ProjectWorkspace::STATUS_RUNNING,
            'ide_url' => $this->ideUrl($workspace),
            'preview_url_template' => $workspace->isLive() ? $this->previewUrlTemplate($workspace) : null,
            'ide_port' => (int) config('workspaces.ide_port'),
            // What the editor's paste guard does for this project (enforce | report | open); the page relays it to the guard.
            'guard_mode' => WorkspaceIntegrity::modeFor($workspace->enrollment->topic),
            'stop_reason' => $workspace->stop_reason,
            // The stored `error` holds operator detail (Docker output, host names); students get a fixed, safe sentence.
            'error' => $workspace->status === ProjectWorkspace::STATUS_FAILED
                ? 'Your workspace stopped unexpectedly. Start it again — your files are safe.'
                : null,
            'started_at' => $workspace->last_started_at?->toIso8601String(),
            'disk_mb' => $workspace->disk_mb,
        ];
    }

    private function specFor(ProjectWorkspace $workspace, WorkspaceHost $host): WorkspaceSpec
    {
        $limits = config('workspaces.limits');

        return new WorkspaceSpec(
            containerName: $workspace->container_name,
            volumeName: $workspace->volume_name,
            image: (string) config('workspaces.image'),
            connectionToken: (string) $workspace->connection_token,
            network: (string) config('workspaces.network'),
            idePort: (int) config('workspaces.ide_port'),
            memory: (string) $limits['memory'],
            cpus: (string) $limits['cpus'],
            pids: (int) $limits['pids'],
            tmpSize: (string) $limits['tmp_size'],
            ociRuntime: config('workspaces.oci_runtime'),
            labels: [
                'aptrun.workspace' => $workspace->public_id,
                'aptrun.user' => (string) $workspace->user_id,
            ],
        );
    }

    /** SOW.md / MILESTONES.md / START-HERE.md, written once the editor is up. Best effort: a failure must not fail the start. */
    private function seedFiles(ProjectWorkspace $workspace, WorkspaceHost $host): void
    {
        try {
            $topic = $workspace->enrollment->topic()->with('milestones')->firstOrFail();
            $root = SnapshotScript::ROOT;

            foreach (WorkspaceStarterFiles::managed($topic) as $path => $content) {
                $this->runtime->exec(
                    $host,
                    $workspace->container_name,
                    ['sh', '-c', 'mkdir -p "$(dirname "$1")" && cat > "$1"', 'sh', "{$root}/{$path}"],
                    $content
                );
            }

            $this->runtime->exec(
                $host,
                $workspace->container_name,
                ['sh', '-c', '[ -e "$1" ] || cat > "$1"', 'sh', "{$root}/START-HERE.md"],
                WorkspaceStarterFiles::startHere($topic)
            );
        } catch (Throwable $e) {
            Log::warning("workspace {$workspace->id} could not seed starter files: ".$e->getMessage());
        }
    }

    private function closeSession(ProjectWorkspace $workspace, string $reason): void
    {
        $workspace->sessions()
            ->whereNull('ended_at')
            ->update(['ended_at' => now(), 'stop_reason' => $reason]);
    }

    private function markFailed(ProjectWorkspace $workspace, string $detail): void
    {
        $this->closeSession($workspace, ProjectWorkspace::STOP_HOST_ERROR);

        $workspace->update([
            'status' => ProjectWorkspace::STATUS_FAILED,
            'connection_token' => null,
            'last_stopped_at' => now(),
            'stop_reason' => ProjectWorkspace::STOP_HOST_ERROR,
            'error' => $detail,
        ]);
    }
}
