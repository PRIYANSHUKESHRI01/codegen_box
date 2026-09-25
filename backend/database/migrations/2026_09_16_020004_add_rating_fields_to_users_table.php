<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cached/denormalized on purpose: rating is read on every page header for
 * every student, but only ever written once per contest a user participates
 * in (via ContestFinalizeService) — a classic read-hot/write-rare column,
 * same reasoning as College::tier being kept in sync by SubscriptionService
 * rather than recomputed live. `rated_contests_count` is what lets the UI
 * show "Unrated" instead of the starting 1200 for anyone who has never
 * actually competed — never display an unearned-looking number.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->integer('current_rating')->default(1200)->after('backlogs');
            $table->unsignedInteger('rated_contests_count')->default(0)->after('current_rating');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['current_rating', 'rated_contests_count']);
        });
    }
};
