<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Two optional facts about a Mock AI Interview question, both needed by the Merchant Navy orals bank:
 *  - topic: the syllabus section it belongs to ("Lights, Shapes & Sound Signals"). A sitting draws across topics instead of ten
 *    random questions from one, the way an examiner covers a function.
 *  - needs_review: the reference answer carries a figure someone must check against the current SOLAS / MARPOL / Load Line text before
 *    it is relied on. The scorer is told to judge the concept, not the figure, for these; staff see a badge until it is cleared.
 * Every existing (IT) question has neither, and behaves exactly as before.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mock_interview_questions', function (Blueprint $table) {
            $table->string('topic', 100)->nullable()->after('round_number');
            $table->boolean('needs_review')->default(false)->after('note');
        });
    }

    public function down(): void
    {
        Schema::table('mock_interview_questions', function (Blueprint $table) {
            $table->dropColumn(['topic', 'needs_review']);
        });
    }
};
