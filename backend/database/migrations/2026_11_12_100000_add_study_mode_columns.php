<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Study mode (the Merchant Navy orals): an interview whose answers are not scored by AI but compared, by plain text matching, with the
 * model answer - which the student then sees, to learn from it. Three small additions, all nullable or defaulted so nothing that exists
 * changes:
 *  - mock_interview_questions.origin: 'document' (from the Merchant Navy team's question bank) or 'generated' (written by AptRun to fill
 *    a set; always needs_review), so staff can see which answers nobody outside AptRun has looked at.
 *  - interview_question_banks.reference_unverified: the model answer carries a figure (or is AI-written) still to be checked, so the
 *    student is told that when they are shown it. Carried over from mock_interview_questions.needs_review.
 *  - interview_responses.match_details: what the matcher found for this answer (the percentage, the band, which key points were covered),
 *    kept so the end-of-set summary can show the same thing again without recomputing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mock_interview_questions', function (Blueprint $table) {
            $table->string('origin', 20)->default('document')->after('needs_review');
        });

        Schema::table('interview_question_banks', function (Blueprint $table) {
            $table->boolean('reference_unverified')->default(false)->after('notes_for_reviewer');
        });

        Schema::table('interview_responses', function (Blueprint $table) {
            $table->json('match_details')->nullable()->after('review_notes');
        });
    }

    public function down(): void
    {
        Schema::table('interview_responses', fn (Blueprint $table) => $table->dropColumn('match_details'));
        Schema::table('interview_question_banks', fn (Blueprint $table) => $table->dropColumn('reference_unverified'));
        Schema::table('mock_interview_questions', fn (Blueprint $table) => $table->dropColumn('origin'));
    }
};
