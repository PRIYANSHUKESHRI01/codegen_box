<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One screen opened inside a visit: how long it was looked at and how far it was scrolled. */
class ActivityPageView extends Model
{
    public $timestamps = false;

    protected $fillable = ['visit_id', 'user_id', 'college_id', 'seq', 'path', 'section', 'entered_at', 'active_seconds', 'max_scroll'];

    protected function casts(): array
    {
        return ['entered_at' => 'datetime'];
    }

    public function visit(): BelongsTo
    {
        return $this->belongsTo(ActivityVisit::class, 'visit_id');
    }
}
