<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * What one student remembers about one word: a Leitner box (0–5) and the date
 * it is next due. A row exists from the first time the student answers a
 * question about the word. See VocabularySrsService for the rules that move a
 * word between boxes.
 */
class VocabularyWordProgress extends Model
{
    protected $table = 'vocabulary_word_progress';

    /** From this box up a word counts as mastered. */
    public const MASTERED_BOX = 4;

    public const MAX_BOX = 5;

    public const STATUS_NEW = 'new';

    public const STATUS_LEARNING = 'learning';

    public const STATUS_FAMILIAR = 'familiar';

    public const STATUS_MASTERED = 'mastered';

    protected $fillable = [
        'user_id',
        'vocabulary_word_id',
        'box',
        'streak',
        'seen_count',
        'correct_count',
        'lapse_count',
        'last_seen_at',
        'due_on',
        'mastered_at',
    ];

    protected function casts(): array
    {
        return [
            'box' => 'integer',
            'streak' => 'integer',
            'seen_count' => 'integer',
            'correct_count' => 'integer',
            'lapse_count' => 'integer',
            'last_seen_at' => 'datetime',
            'due_on' => 'date',
            'mastered_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function word(): BelongsTo
    {
        return $this->belongsTo(VocabularyWord::class, 'vocabulary_word_id');
    }

    /** new = never answered (no row) · learning = boxes 0–1 · familiar = 2–3 · mastered = 4–5. */
    public static function statusForBox(?int $box): string
    {
        return match (true) {
            $box === null => self::STATUS_NEW,
            $box >= self::MASTERED_BOX => self::STATUS_MASTERED,
            $box >= 2 => self::STATUS_FAMILIAR,
            default => self::STATUS_LEARNING,
        };
    }

    public function status(): string
    {
        return self::statusForBox($this->box);
    }

    /**
     * A word the student keeps getting wrong: answered at least twice with
     * under 60% right, or knocked back down by a lapse and not yet recovered.
     */
    public function isWeak(): bool
    {
        if ($this->seen_count >= 2 && ($this->correct_count / $this->seen_count) < 0.6) {
            return true;
        }

        return $this->lapse_count > 0 && $this->box <= 1;
    }

    /** Due today or earlier (the app's calendar day) — a word that was never scheduled counts as due. */
    public function isDue(): bool
    {
        return $this->due_on === null || $this->due_on->lte(today());
    }
}
