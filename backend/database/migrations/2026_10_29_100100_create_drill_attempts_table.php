<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per answered Skill Drill question (the questions are generated in the browser, so nothing else is stored). Read for the
 * student's streak, per-skill mastery and recommendations. Insert-only and small: ~40 bytes a row.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('drill_attempts')) {
            return;
        }

        Schema::create('drill_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('pack', 40);
            $table->string('skill', 60);
            $table->unsignedTinyInteger('difficulty');
            $table->boolean('correct');
            $table->unsignedSmallInteger('seconds')->nullable();
            $table->timestamp('created_at')->useCurrent();

            // A skill's most recent answers (mastery) and the student's active days (streak).
            $table->index(['user_id', 'skill', 'id'], 'drill_attempts_user_skill_index');
            $table->index(['user_id', 'created_at'], 'drill_attempts_user_day_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drill_attempts');
    }
};
