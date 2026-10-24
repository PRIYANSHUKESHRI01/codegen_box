<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * What a plan includes of Core Prep (the branch technical practice and tests), editable by the superadmin
 * like every other limit (Plans & Pricing → Edit limits):
 *
 *  • max_core_practice_per_day — practice questions answered per day; null = unlimited.
 *  • core_tests_access        — timed Core tests. Off for the free plan, which instead gets its usual
 *                               one-time free try (feature_trial_uses) of a test; on everywhere else.
 *
 * Only the free individual plan is limited by default (10 practice questions a day, the one test try);
 * Expert, Grandmaster and every college plan stay unlimited — nobody who pays loses anything.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            if (! Schema::hasColumn('plans', 'max_core_practice_per_day')) {
                $table->unsignedInteger('max_core_practice_per_day')->nullable();
            }
            if (! Schema::hasColumn('plans', 'core_tests_access')) {
                $table->boolean('core_tests_access')->default(true);
            }
        });

        DB::table('plans')->where('audience', 'individual')->where('list_price', 0)->update([
            'max_core_practice_per_day' => 10,
            'core_tests_access' => false,
        ]);
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            if (Schema::hasColumn('plans', 'core_tests_access')) {
                $table->dropColumn('core_tests_access');
            }
            if (Schema::hasColumn('plans', 'max_core_practice_per_day')) {
                $table->dropColumn('max_core_practice_per_day');
            }
        });
    }
};
