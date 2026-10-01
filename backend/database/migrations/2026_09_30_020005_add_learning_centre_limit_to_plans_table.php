<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gates the two Learning Centre endpoints that actually cost a Gemini call
 * (speaking attempt scoring, vocabulary quiz generation) — mirrors
 * max_mock_interviews_per_day exactly (2026_09_27_020000):
 * null = unlimited, a plan opts INTO a limit by setting a number. Defaults
 * to null for every existing plan, so this ships with nobody actually
 * throttled until a real limit is configured per plan.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->unsignedTinyInteger('max_learning_centre_ai_attempts_per_day')->nullable()->after('max_mock_interviews_per_day');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn('max_learning_centre_ai_attempts_per_day');
        });
    }
};
