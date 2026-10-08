<?php

namespace Database\Seeders;

use App\Models\VocabularyWord;
use Illuminate\Database\Seeder;

/**
 * Loads the authored Vocabulary Sprint library (see VocabularyWordBank).
 *
 * Safe to run any number of times: words are matched on their text, so a
 * re-run updates meanings and examples in place and never creates duplicates
 * or touches any student's progress. A library word that has been removed from
 * the bank is switched off rather than deleted, so progress rows pointing at
 * it stay valid and it simply stops appearing.
 */
class VocabularyWordSeeder extends Seeder
{
    public function run(): void
    {
        $words = VocabularyWordBank::words();

        foreach ($words as $entry) {
            VocabularyWord::updateOrCreate(
                ['user_id' => null, 'source' => VocabularyWord::SOURCE_LIBRARY, 'word' => $entry['word']],
                $entry + ['is_active' => true]
            );
        }

        VocabularyWord::whereNull('user_id')
            ->where('source', VocabularyWord::SOURCE_LIBRARY)
            ->whereNotIn('word', array_column($words, 'word'))
            ->update(['is_active' => false]);
    }
}
