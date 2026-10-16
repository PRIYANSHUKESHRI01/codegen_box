<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What a student tells us about themselves the first time they sign in — the
 * answers to the short onboarding wizard (see StudentPreferencesController).
 * Every column is nullable and additive: an existing student simply has no
 * answers yet, and the app is asked to prompt them once on their next visit
 * (User::needsOnboarding()), never to break without them.
 *
 * `primary_language` is stored on its own column (not only inside
 * `preferred_languages`) so "stated primary language" can be grouped and
 * filtered in SQL without unpacking JSON. Language values are the judge's
 * own ids (JudgeService::SUPPORTED_LANGUAGES) so a preference can be handed
 * straight to the code editor without translation.
 *
 * `onboarding_skipped_at` exists so "Skip for now" is remembered: a skipped
 * student is asked again after a cool-off, not on every page load.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dateTime('onboarding_completed_at')->nullable();
            $table->dateTime('onboarding_skipped_at')->nullable();
            $table->string('primary_language', 30)->nullable();
            $table->json('preferred_languages')->nullable();
            $table->string('skill_level', 20)->nullable();
            $table->string('career_goal', 40)->nullable();
            $table->json('focus_areas')->nullable();
            $table->string('weekly_pace', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'onboarding_completed_at',
                'onboarding_skipped_at',
                'primary_language',
                'preferred_languages',
                'skill_level',
                'career_goal',
                'focus_areas',
                'weekly_pace',
            ]);
        });
    }
};
