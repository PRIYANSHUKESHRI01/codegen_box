<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A timestamped note the marketing team logs about a contact request — an
 * append-only history, the same convention as LeadNote (see its docblock),
 * just against a ContactRequest instead of a User.
 */
class ContactRequestNote extends Model
{
    protected $fillable = [
        'contact_request_id',
        'author_id',
        'note',
    ];

    /** The inquiry this note is about. */
    public function contactRequest(): BelongsTo
    {
        return $this->belongsTo(ContactRequest::class);
    }

    /** The marketing/admin staffer who wrote it. */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
