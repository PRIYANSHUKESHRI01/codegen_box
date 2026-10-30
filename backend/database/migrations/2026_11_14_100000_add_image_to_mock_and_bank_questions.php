<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Picture questions (the Merchant Navy "ROR cards": a drawing of a situation at sea, and the lights seen at night, with two or three
 * questions on it). A question may now carry the address of its picture, on the site's own pages (e.g. /ror-cards/card-005.png).
 *  - mock_interview_questions.image: what staff and the seeder set; null for every question that exists, so nothing changes for them.
 *  - interview_question_banks.image: the interview's own copy, which the room shows beside the question and the summary shows again.
 * Both nullable and unindexed: nothing looks a question up by its picture.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mock_interview_questions', function (Blueprint $table) {
            $table->string('image', 255)->nullable()->after('origin');
        });

        Schema::table('interview_question_banks', function (Blueprint $table) {
            $table->string('image', 255)->nullable()->after('reference_unverified');
        });
    }

    public function down(): void
    {
        Schema::table('interview_question_banks', fn (Blueprint $table) => $table->dropColumn('image'));
        Schema::table('mock_interview_questions', fn (Blueprint $table) => $table->dropColumn('image'));
    }
};
