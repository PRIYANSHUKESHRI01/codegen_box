<?php

namespace App\Services\ProjectLab;

use App\Models\Plan;
use App\Models\ProjectEnrollment;
use App\Models\ProjectWorkspaceSession;
use App\Models\User;
use App\Services\Workspaces\WorkspaceException;

/**
 * The gate in front of everything paid in Project Lab, and the numbers the
 * UI shows about it. Entitlement itself is resolved by
 * User::projectLabCoverage() (own add-on first, then the governing plan); this
 * class turns that into refusals (402 with a stable `code`) and a summary the
 * sidebar, paywall and workspace page all read from one place.
 */
class ProjectLabAccess
{
    /**
     * @return array<string, mixed> the user's coverage
     *
     * @throws WorkspaceException 402 project_lab_required
     */
    public function requireAccess(User $user): array
    {
        $coverage = $user->projectLabCoverage();

        if (! $coverage['access']) {
            throw WorkspaceException::projectLabRequired();
        }

        return $coverage;
    }

    /** Whole seconds of running workspace this student has used in the current period. */
    public function secondsUsed(User $user, array $coverage): int
    {
        $since = $coverage['period_started_at'] ?? now()->startOfMonth();

        return (int) ProjectWorkspaceSession::where('user_id', $user->id)
            ->where('started_at', '>=', $since)
            ->sum('seconds');
    }

    /** @throws WorkspaceException 402 workspace_hours_exhausted */
    public function assertHoursRemaining(User $user, array $coverage): void
    {
        $limit = $coverage['max_workspace_hours_per_month'];

        if ($limit !== null && $this->secondsUsed($user, $coverage) >= $limit * 3600) {
            throw WorkspaceException::hoursExhausted((int) $limit);
        }
    }

    public function activeProjectCount(User $user): int
    {
        return ProjectEnrollment::where('user_id', $user->id)
            ->whereIn('status', ProjectEnrollment::OCCUPYING)
            ->count();
    }

    /** @throws WorkspaceException 409 active_projects_full */
    public function assertCanStartAnotherProject(User $user, array $coverage): void
    {
        $limit = $coverage['max_active_projects'];

        if ($limit !== null && $this->activeProjectCount($user) >= $limit) {
            throw WorkspaceException::activeProjectsFull((int) $limit);
        }
    }

    /**
     * What the client needs to decide between "locked", "open" and "out of
     * hours" — in the same shape wherever it appears (GET /me/subscription,
     * the Project Lab catalog).
     *
     * @return array<string, mixed>
     */
    public function summary(User $user): array
    {
        $coverage = $user->projectLabCoverage();
        $hoursLimit = $coverage['max_workspace_hours_per_month'];
        $usedSeconds = $coverage['access'] ? $this->secondsUsed($user, $coverage) : 0;
        $used = round($usedSeconds / 3600, 1);

        $addon = Plan::where('code', Plan::CODE_PROJECT_LAB)->where('is_active', true)->first();

        return [
            'enabled' => $coverage['access'],
            'source' => $coverage['source'],
            'plan' => $coverage['plan'] ? ['code' => $coverage['plan']->code, 'name' => $coverage['plan']->name] : null,
            'days_remaining' => $coverage['days_remaining'],
            'period_ends_at' => $coverage['period_ends_at']?->toIso8601String(),
            'hours' => [
                'limit' => $hoursLimit,
                'used' => $used,
                'remaining' => $hoursLimit === null ? null : max(0, round($hoursLimit - $usedSeconds / 3600, 1)),
            ],
            'projects' => [
                'limit' => $coverage['max_active_projects'],
                'active' => $this->activeProjectCount($user),
            ],
            // What buying it costs this student right now (bundle discount included) — for the lock screen.
            'offer' => $addon === null ? null : [
                'code' => $addon->code,
                'name' => $addon->name,
                'monthly_price' => (int) $addon->monthly_price,
                'duration_days' => $addon->duration_days,
                'workspace_hours' => $addon->max_workspace_hours_per_month,
                'active_projects' => $addon->max_active_projects,
            ],
        ];
    }
}
