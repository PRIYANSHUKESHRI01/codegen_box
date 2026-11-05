<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One person's activity on one day (India time): what the daily / weekly / monthly active counts are read from. */
class UserActivityDay extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'college_id', 'role', 'day', 'visits', 'page_views', 'active_seconds', 'first_seen_at', 'last_seen_at'];

    protected function casts(): array
    {
        return ['day' => 'date:Y-m-d', 'first_seen_at' => 'datetime', 'last_seen_at' => 'datetime'];
    }
}
