<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The Second Mate (FG) orals were first loaded as three function-wise rounds (200 / 200 / 226 questions). They are now 25 mixed sets of about
 * 25 (build_merchant_navy.py), so a database that still holds the old layout must be cleared before the seeder loads the new one - the
 * seeder matches by stack + set + position, so the old rows would otherwise sit on top of the new ones.
 *
 * It acts ONLY when it sees the old shape (a "round" holding more than 30 questions - a set never does), so it cannot touch a bank that was
 * loaded as sets, or one staff have been editing since. Nothing else is touched: no IT stack, no student interview already built (those keep
 * their own copy of their questions).
 */
return new class extends Migration
{
    private const STACK = 'second_mate_fg';

    public function up(): void
    {
        $oldLayout = DB::table('mock_interview_questions')->where('stack_key', self::STACK)->where('position', '>', 30)->exists();

        if ($oldLayout) {
            DB::table('mock_interview_questions')->where('stack_key', self::STACK)->delete();
        }
    }

    public function down(): void
    {
        // Irreversible on purpose: the questions are reloaded from the source document by the seeder.
    }
};
