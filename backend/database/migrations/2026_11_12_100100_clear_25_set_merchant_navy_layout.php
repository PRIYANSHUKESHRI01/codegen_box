<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The Second Mate (FG) orals were loaded as 25 mixed sets of about 25 questions; they are now 23 sets of 30 (10 of each function, with 64
 * questions added to fill the short functions). The seeder matches rows by stack + set + position, so sets 1-23 are simply rewritten, but
 * sets 24 and 25 no longer exist and would be left behind as questions in sets the catalogue does not have.
 *
 * It acts ONLY when it sees the old shape (any row in a set above 23), so it cannot touch a bank already loaded in the new layout, and it
 * touches nothing else: no IT stack, and no interview a student already built (those keep their own copy of their questions).
 */
return new class extends Migration
{
    private const STACK = 'second_mate_fg';

    private const SETS = 23;

    public function up(): void
    {
        DB::table('mock_interview_questions')->where('stack_key', self::STACK)->where('round_number', '>', self::SETS)->delete();
    }

    public function down(): void
    {
        // Irreversible on purpose: the questions are reloaded from the source document by the seeder.
    }
};
