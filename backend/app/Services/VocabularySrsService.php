<?php

namespace App\Services;

use App\Models\VocabularyWordProgress;

/**
 * The spaced-repetition rules for Vocabulary Sprint — a six-box Leitner system
 * scheduled by calendar day.
 *
 *   box:      0   1   2   3   4    5
 *   comes back in (days) after reaching it:  –   1   3   7  16   35
 *
 * - A correct answer moves a word up one box ONLY when the word was due (or
 *   brand new). Practising a word early, before it's due, still counts toward
 *   accuracy but can't be used to rush it up the boxes — spacing is the whole
 *   point.
 * - A wrong answer drops the word two boxes (never below 0) and makes it due
 *   today, so it comes straight back instead of waiting out an old interval.
 *   Being wrong is always honest, even when practising early.
 * - Boxes 4 and 5 count as mastered.
 * - A word's follow-up question in the same session ("echo") never moves its
 *   box — answering twice in five minutes proves nothing about next month —
 *   but getting it wrong still brings the word back today.
 */
class VocabularySrsService
{
    /** Days until a word is due again, by the box it has just reached. */
    public const INTERVAL_DAYS = [0 => 0, 1 => 1, 2 => 3, 3 => 7, 4 => 16, 5 => 35];

    /** How far a wrong answer knocks a word back. */
    public const LAPSE_DROP = 2;

    /**
     * Record one answer about one word and return what changed.
     *
     * @return array{progress: VocabularyWordProgress, box_before: ?int, box_after: int, was_due: bool, became_mastered: bool, moved_up: bool}
     */
    public function record(int $userId, int $wordId, bool $correct, bool $primary = true): array
    {
        $today = today();

        $progress = VocabularyWordProgress::firstOrNew(['user_id' => $userId, 'vocabulary_word_id' => $wordId]);
        $existed = $progress->exists;

        $boxBefore = $existed ? $progress->box : null;
        $box = $progress->box ?? 0;
        $wasDue = ! $existed || $progress->isDue();
        $wasMastered = $box >= VocabularyWordProgress::MASTERED_BOX;

        if (! $existed) {
            $progress->fill(['box' => 0, 'streak' => 0, 'seen_count' => 0, 'correct_count' => 0, 'lapse_count' => 0]);
        }

        if ($primary) {
            $progress->seen_count++;
            $progress->last_seen_at = now();

            if ($correct) {
                $progress->correct_count++;
                $progress->streak++;

                if ($wasDue) {
                    $box = min(VocabularyWordProgress::MAX_BOX, $box + 1);
                    $progress->due_on = $today->copy()->addDays(self::INTERVAL_DAYS[$box]);
                }
            } else {
                $progress->streak = 0;
                if ($box > 0) {
                    $progress->lapse_count++;
                }
                $box = max(0, $box - self::LAPSE_DROP);
                $progress->due_on = $today->copy();
            }
        } elseif (! $correct) {
            // Echo question: no box change, but a miss means "look at this again today".
            $progress->streak = 0;
            $progress->due_on = $today->copy();
        }

        $progress->box = $box;

        if ($box >= VocabularyWordProgress::MASTERED_BOX) {
            $progress->mastered_at ??= now();
        } else {
            $progress->mastered_at = null;
        }

        // A brand-new word that was only ever "seen" through an echo can't exist (echo follows a primary), but never leave due_on null.
        $progress->due_on ??= $today->copy();
        $progress->save();

        return [
            'progress' => $progress,
            'box_before' => $boxBefore,
            'box_after' => $box,
            'was_due' => $wasDue,
            'became_mastered' => ! $wasMastered && $box >= VocabularyWordProgress::MASTERED_BOX,
            'moved_up' => $primary && $correct && $box > ($boxBefore ?? 0),
        ];
    }

    /** "Tomorrow", "in 3 days" … for a word's next review, from its due date. */
    public static function describeDue(?\DateTimeInterface $dueOn): ?string
    {
        if ($dueOn === null) {
            return null;
        }

        $days = (int) today()->diffInDays(\Illuminate\Support\Carbon::instance($dueOn)->startOfDay(), false);

        return match (true) {
            $days <= 0 => 'today',
            $days === 1 => 'tomorrow',
            $days < 14 => "in {$days} days",
            $days < 60 => 'in '.(int) round($days / 7).' weeks',
            default => 'in '.(int) round($days / 30).' months',
        };
    }
}
