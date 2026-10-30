<?php

namespace Database\Seeders;

/**
 * Loads ONLY the Merchant Navy orals (Second Mate (FG): 690 questions, Chief Mate (FG): 600, Rule of the Road picture cards: 231) into the
 * Mock AI Interview, so adding or correcting them never rewrites the IT questions staff may have edited. Rebuild the data file first when
 * the source document changes: database/seeders/data/build_merchant_navy.py (Second Mate), build_chief_mate.py (Chief Mate) or
 * build_ror_cards.py (ROR cards; it also copies the pictures into the frontend).
 *
 *   php artisan db:seed --class=MerchantNavyMockQuestionsSeeder
 *
 * Safe to run again: each question is matched by stack, round and position, so a re-run restores the file's wording and answers (it does
 * not duplicate). A question staff added afterwards sits after the file's last position and is left alone.
 */
class MerchantNavyMockQuestionsSeeder extends MockInterviewQuestionsSeeder
{
    protected function files(): array
    {
        return [
            __DIR__.'/data/mock_questions/merchant_navy_mock.php',
            __DIR__.'/data/mock_questions/chief_mate_mock.php',
            __DIR__.'/data/mock_questions/ror_cards_mock.php',
        ];
    }
}
