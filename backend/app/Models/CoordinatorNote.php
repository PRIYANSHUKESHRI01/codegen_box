<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One entry in the follow-up log a Section Coordinator keeps on a student — "called the parent, promised to retake the
 * test by Friday" — with an optional due date. Visible to the coordinators who cover the student and to the college's TPO;
 * never to the student and never across colleges (see CoordinatorNoteController / TpoStudentNoteController).
 */
class CoordinatorNote extends Model
{
    public const KINDS = ['note', 'call', 'message', 'meeting'];

    /** Most notes one student may carry — a log, not a database. */
    public const MAX_PER_STUDENT = 300;

    protected $fillable = ['college_id', 'student_id', 'author_id', 'kind', 'body', 'follow_up_on', 'resolved_at', 'resolved_by'];

    protected function casts(): array
    {
        return [
            'follow_up_on' => 'date',
            'resolved_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereNull('resolved_at');
    }

    public function isOpen(): bool
    {
        return $this->resolved_at === null;
    }

    /** The shape both the coordinator and the TPO see. `$viewer` marks the viewer's own notes (only an author may delete theirs). */
    public function present(?User $viewer = null): array
    {
        $due = $this->follow_up_on?->toDateString();

        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'body' => $this->body,
            'follow_up_on' => $due,
            'overdue' => $this->isOpen() && $due !== null && $due < now()->toDateString(),
            'resolved' => ! $this->isOpen(),
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'author' => $this->author ? ['id' => $this->author->id, 'name' => $this->author->name] : null,
            'mine' => $viewer !== null && $this->author_id !== null && (int) $this->author_id === (int) $viewer->id,
        ];
    }
}
