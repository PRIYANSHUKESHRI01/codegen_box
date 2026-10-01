<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Learning Centre — Speaking Practice content bank. Seeded (see
 * SpeakingPromptSeeder), not yet admin-editable — same "real, durable
 * content, no CRUD UI in v1" posture articles started with before
 * AdminArticleController existed. target_wpm_min/max drives the deterministic
 * (non-Gemini) pacing label computed in GeminiSpeakingScoringService.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('speaking_prompts', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('passage_text');
            $table->string('category');
            $table->string('difficulty'); // beginner | intermediate | advanced
            $table->unsignedSmallInteger('target_wpm_min')->default(110);
            $table->unsignedSmallInteger('target_wpm_max')->default(160);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->index(['difficulty', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('speaking_prompts');
    }
};
