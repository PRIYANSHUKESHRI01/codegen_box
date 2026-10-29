<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The Mock AI Interview question bank: the questions staff write for each round of each stack (Admin -> Mock interview questions).
 * Separate from the Vault AI Interview's curated_set_questions on purpose - a mock is practice, the Vault interview is the
 * qualifying one, and the two banks are filled (and opened to students) independently.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mock_interview_questions', function (Blueprint $table) {
            $table->id();
            $table->string('stack_key', 60)->index();
            $table->unsignedTinyInteger('round_number');
            $table->unsignedSmallInteger('position')->default(0);
            $table->text('text');
            $table->string('category', 20)->default('technical');
            $table->unsignedSmallInteger('duration_seconds')->default(180);
            $table->text('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['stack_key', 'round_number', 'position'], 'mock_questions_round_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mock_interview_questions');
    }
};
