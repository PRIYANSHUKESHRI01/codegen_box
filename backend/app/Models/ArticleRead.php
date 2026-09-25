<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One student having read one article — see ArticleController::markRead(),
 * which upserts this via firstOrCreate() exactly like InterviewSession.
 * Powers the reader's auto-"mark as read", per-topic read progress, and the
 * read checkmark in a topic's article list.
 */
class ArticleRead extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'article_id',
        'user_id',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
        ];
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
