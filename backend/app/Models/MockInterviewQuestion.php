<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A question staff wrote for one round of one stack of the Mock AI Interview. See App\Services\Mock\MockInterviewCatalog (reads them)
 * and App\Services\Mock\MockQuestionAdmin (the only writer).
 */
class MockInterviewQuestion extends Model
{
    protected $fillable = ['stack_key', 'round_number', 'topic', 'position', 'text', 'category', 'duration_seconds', 'note', 'needs_review', 'created_by'];

    protected function casts(): array
    {
        return [
            'round_number' => 'integer',
            'position' => 'integer',
            'duration_seconds' => 'integer',
            'needs_review' => 'boolean',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** The shape a catalog round carries a question in. */
    public function toCatalog(): array
    {
        return [
            'id' => $this->id,
            'text' => $this->text,
            'category' => $this->category,
            'duration_seconds' => $this->duration_seconds,
            'note' => $this->note,
            'topic' => $this->topic,
            'needs_review' => (bool) $this->needs_review,
        ];
    }
}
