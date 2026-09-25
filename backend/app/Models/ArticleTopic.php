<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * Groups articles into a reading path (e.g. "DSA", "Go Programming") — see
 * Article's docblock for how display_order drives the student-facing
 * Next/Previous navigation within one topic. Mellow-internal-staff authored
 * only (see User::PERM_ARTICLES); every student can read a topic's
 * published articles once it has any — no college/company ownership tier.
 */
class ArticleTopic extends Model
{
    /** Curated theme keys — mapped to Tailwind classes frontend-side (see TOPIC_COLORS in frontend/src/types/article.ts). Validated server-side so a stray value can never silently break that lookup. */
    public const COLORS = ['indigo', 'emerald', 'amber', 'sky', 'rose'];

    /** Curated lucide-react icon names a topic (or an article overriding it) may use. */
    public const ICONS = ['Binary', 'Code2', 'Terminal', 'Cpu', 'Network', 'Database', 'GitBranch', 'Layers'];

    protected $fillable = [
        'name',
        'slug',
        'description',
        'icon',
        'color',
        'display_order',
        'created_by',
    ];

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    public function articles(): HasMany
    {
        return $this->hasMany(Article::class)->orderBy('display_order');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'topic';
        $slug = $base;
        $suffix = 1;

        while (self::where('slug', $slug)->exists()) {
            $suffix++;
            $slug = "{$base}-{$suffix}";
        }

        return $slug;
    }
}
