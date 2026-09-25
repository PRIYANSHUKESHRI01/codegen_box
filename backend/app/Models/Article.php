<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * A single piece of long-form, markdown-authored learning content —
 * Mellow-Ops-only to write (see User::PERM_ARTICLES), visible to every
 * student once published. Belongs to one ArticleTopic, which is what the
 * student reader's Next/Previous navigation walks: previousInTopic()/
 * nextInTopic() find the adjacent PUBLISHED sibling by display_order within
 * the same article_topic_id — created_at is never used for ordering here,
 * Ops sets the reading order explicitly.
 *
 * Nothing here is auto-scored or auto-generated — an Ops author writes the
 * whole thing (optionally assisted by an external tool), same "a human
 * authors/reviews, the platform never fabricates" spirit as everywhere else
 * in this app.
 */
class Article extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PUBLISHED = 'published';

    public const STATUSES = [self::STATUS_DRAFT, self::STATUS_PUBLISHED];

    /** Average adult silent reading speed used for the auto-computed reading_time_minutes — see estimateReadingTimeMinutes(). */
    private const WORDS_PER_MINUTE = 200;

    /** Slugs that would otherwise permanently shadow a real frontend route (/dashboard/articles/topic, a future /dashboard/articles/new) — treated as an automatic collision, same handling as a genuine duplicate title below. */
    private const RESERVED_SLUGS = ['topic', 'new'];

    protected $fillable = [
        'article_topic_id',
        'title',
        'slug',
        'excerpt',
        'content',
        'icon',
        'status',
        'display_order',
        'reading_time_minutes',
        'created_by',
        'published_at',
        'view_count',
    ];

    protected function casts(): array
    {
        return [
            'published_at' => 'datetime',
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function articleTopic(): BelongsTo
    {
        return $this->belongsTo(ArticleTopic::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reads(): HasMany
    {
        return $this->hasMany(ArticleRead::class);
    }

    public function isPublished(): bool
    {
        return $this->status === self::STATUS_PUBLISHED;
    }

    public function previousInTopic(): ?self
    {
        return static::where('article_topic_id', $this->article_topic_id)
            ->where('status', self::STATUS_PUBLISHED)
            ->where('display_order', '<', $this->display_order)
            ->orderByDesc('display_order')
            ->first();
    }

    public function nextInTopic(): ?self
    {
        return static::where('article_topic_id', $this->article_topic_id)
            ->where('status', self::STATUS_PUBLISHED)
            ->where('display_order', '>', $this->display_order)
            ->orderBy('display_order')
            ->first();
    }

    public static function uniqueSlug(string $title): string
    {
        $base = Str::slug($title) ?: 'article';
        $slug = $base;
        $suffix = 1;

        while (self::where('slug', $slug)->exists() || in_array($slug, self::RESERVED_SLUGS, true)) {
            $suffix++;
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }

    public static function estimateReadingTimeMinutes(string $content): int
    {
        return max(1, (int) round(str_word_count($content) / self::WORDS_PER_MINUTE));
    }
}
