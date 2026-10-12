<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One thing the editor's guard reported: a paste it refused, a burst of typing no person produces, and so
 * on. METADATA ONLY — kind, size, target, time. The text that was copied or typed is never sent and never
 * stored (there is deliberately no column that could hold it).
 */
class ProjectWorkspaceIntegrityEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'project_workspace_id',
        'user_id',
        'client_event_id',
        'kind',
        'size',
        'target',
        'guard_version',
        'meta',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'meta' => 'array',
            'occurred_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function workspace(): BelongsTo
    {
        return $this->belongsTo(ProjectWorkspace::class, 'project_workspace_id');
    }
}
