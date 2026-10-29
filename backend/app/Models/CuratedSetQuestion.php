<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A question staff added to a Vault AI Interview set. See App\Services\Vault\CuratedCatalog, which merges these onto the
 * catalog's hand-written questions, and App\Services\Vault\CuratedQuestionAdmin, the only writer.
 */
class CuratedSetQuestion extends Model
{
    protected $fillable = ['set_id', 'stack_key', 'series_number', 'set_number', 'position', 'text', 'category', 'duration_seconds', 'note', 'created_by'];

    protected function casts(): array
    {
        return [
            'series_number' => 'integer',
            'set_number' => 'integer',
            'position' => 'integer',
            'duration_seconds' => 'integer',
        ];
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** The shape a catalog set carries a question in. */
    public function toCatalog(): array
    {
        return [
            'id' => $this->id,
            'text' => $this->text,
            'category' => $this->category,
            'duration_seconds' => $this->duration_seconds,
            'note' => $this->note,
            'source' => 'custom',
        ];
    }
}
