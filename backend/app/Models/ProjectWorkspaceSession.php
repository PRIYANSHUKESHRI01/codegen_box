<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One start→stop window of a workspace. `seconds` is advanced by heartbeats
 * (capped per beat, see WorkspaceManager::heartbeat), so a crashed browser or
 * host loses at most one beat of accounting and an idle tab can never bill
 * hours it did not use. Summing `seconds` since the add-on period began is the
 * "hours used" the plan's max_workspace_hours_per_month is checked against.
 */
class ProjectWorkspaceSession extends Model
{
    protected $fillable = [
        'project_workspace_id',
        'user_id',
        'started_at',
        'ended_at',
        'seconds',
        'guard_active_seconds',
        'stop_reason',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'seconds' => 'integer',
            'guard_active_seconds' => 'integer',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(ProjectWorkspace::class, 'project_workspace_id');
    }
}
