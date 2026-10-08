<?php

namespace App\Models;

use App\Support\VocabularyDecks;
use App\Support\VocabularyText;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * One word (or phrase) a student can learn. Library words (user_id null) are
 * shared and curated; 'ai' words are private to the student whose Gemini quiz
 * they were picked up from — a word they got wrong, kept so it comes back for
 * review. See the creating migration for the full picture.
 */
class VocabularyWord extends Model
{
    public const SOURCE_LIBRARY = 'library';

    public const SOURCE_AI = 'ai';

    protected $fillable = [
        'user_id',
        'source',
        'deck',
        'word',
        'part_of_speech',
        'level',
        'meaning',
        'example',
        'synonyms',
        'distractors',
        'pair_word',
        'note',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'synonyms' => 'array',
            'distractors' => 'array',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function progress(): HasMany
    {
        return $this->hasMany(VocabularyWordProgress::class);
    }

    /** Active library words plus the viewing student's own AI words — never anyone else's. */
    public function scopeVisibleTo(Builder $query, int $userId): Builder
    {
        return $query->where('is_active', true)->where(function (Builder $q) use ($userId) {
            $q->where(fn (Builder $lib) => $lib->whereNull('user_id')->where('source', self::SOURCE_LIBRARY))
                ->orWhere('user_id', $userId);
        });
    }

    public function scopeLibrary(Builder $query): Builder
    {
        return $query->whereNull('user_id')->where('source', self::SOURCE_LIBRARY)->where('is_active', true);
    }

    /** The example with this word blanked out, or null when the example doesn't contain it. */
    public function cloze(): ?string
    {
        return VocabularyText::blank($this->example, $this->word);
    }

    /** True when the sentence-blank question can be built (three authored wrong answers and a blankable example). */
    public function supportsCloze(): bool
    {
        return count($this->distractors ?? []) >= 3 && $this->cloze() !== null;
    }

    /** What a student sees when a word is introduced or reviewed — never contains anything about their progress. */
    public function card(): array
    {
        return [
            'id' => $this->id,
            'word' => $this->word,
            'part_of_speech' => $this->part_of_speech,
            'level' => $this->level,
            'deck' => $this->deck,
            'deck_title' => VocabularyDecks::title($this->deck),
            'meaning' => $this->meaning,
            'example' => $this->example,
            'synonyms' => array_values($this->synonyms ?? []),
            'note' => $this->note,
            'pair_word' => $this->pair_word,
            'is_mine' => $this->source === self::SOURCE_AI,
        ];
    }
}
