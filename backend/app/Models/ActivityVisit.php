<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** One visit of a signed-in person (a browser session). See the activity_visits migration; written by ActivityRecorder. */
class ActivityVisit extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id', 'college_id', 'role', 'token', 'started_at', 'last_seen_at', 'active_seconds', 'pages',
        'current_path', 'current_section', 'entry_path', 'device', 'browser', 'os', 'ip',
    ];

    protected function casts(): array
    {
        return ['started_at' => 'datetime', 'last_seen_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function pageViews(): HasMany
    {
        return $this->hasMany(ActivityPageView::class, 'visit_id');
    }
}
