<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A checkpoint of a student's workspace taken by AptRun ("Save progress"). See the project_saves migration and ProjectSaveService. */
class ProjectSave extends Model
{
    protected $fillable = [
        'project_enrollment_id', 'user_id', 'snapshot_path', 'snapshot_size_bytes', 'snapshot_sha256', 'files_count',
        'milestones_done', 'milestones_total', 'provenance',
    ];

    /** The storage path of a student's code is an internal detail; people download through an authorised route. */
    protected $hidden = ['snapshot_path'];

    protected function casts(): array
    {
        return [
            'snapshot_size_bytes' => 'integer',
            'files_count' => 'integer',
            'milestones_done' => 'integer',
            'milestones_total' => 'integer',
            'provenance' => 'array',
        ];
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(ProjectEnrollment::class, 'project_enrollment_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return array<string, mixed> */
    public function present(): array
    {
        $p = $this->provenance ?? [];

        return [
            'id' => $this->id,
            'saved_at' => $this->created_at?->toIso8601String(),
            'size_bytes' => $this->snapshot_size_bytes,
            'files' => $this->files_count,
            'milestones_done' => $this->milestones_done,
            'milestones_total' => $this->milestones_total,
            'imported_files' => (int) ($p['predating'] ?? 0),
            'archives' => count($p['archives'] ?? []),
        ];
    }
}
