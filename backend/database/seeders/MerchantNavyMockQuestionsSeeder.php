<?php

namespace Database\Seeders;

/**
 * Loads ONLY the Merchant Navy orals (Second Mate (FG): 626 questions) into the Mock AI Interview, so adding or correcting them never
 * rewrites the IT questions staff may have edited. Rebuild the data file first when the source document changes:
 * database/seeders/data/build_merchant_navy.py.
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
        return [__DIR__.'/data/mock_questions/merchant_navy_mock.php'];
    }
}
