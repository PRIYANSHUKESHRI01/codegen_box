<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A timestamped note the marketing team logs about a lead — an append-only
 * history (never edited/overwritten) so "what have we already tried with
 * this person" survives across whichever staffer picks them up next.
 */
class LeadNote extends Model
{
    protected $fillable = [
        'user_id',
        'author_id',
        'note',
    ];

    /** The lead this note is about. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The marketing/admin staffer who wrote it. */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
