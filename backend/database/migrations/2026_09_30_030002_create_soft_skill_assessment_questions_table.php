<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors `interview_questions` — attaches a bank question into one
 * specific assessment, in a fixed order every taker sees identically
 * (curator-picked, not randomized per student — see the feature's plan
 * doc for why). restrictOnDelete on the bank question: a question already
 * attached to a published (possibly already-taken) assessment must never
 * silently vanish — deactivate it in the bank instead.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('soft_skill_assessment_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('soft_skill_assessment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('soft_skill_question_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->unique(['soft_skill_assessment_id', 'soft_skill_question_id'], 'soft_skill_assessment_questions_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('soft_skill_assessment_questions');
    }
};
