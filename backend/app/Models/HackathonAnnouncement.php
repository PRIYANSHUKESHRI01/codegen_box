<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An organiser update shown under a hackathon's "Updates" tab. */
class HackathonAnnouncement extends Model
{
    protected $fillable = ['hackathon_id', 'author_id', 'title', 'body'];

    public function hackathon(): BelongsTo
    {
        return $this->belongsTo(Hackathon::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }
}
