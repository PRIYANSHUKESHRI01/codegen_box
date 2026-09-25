<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The first plan-based feature gating this app has ever had (confirmed by
 * audit: no quota/entitlement/gating logic existed anywhere before this).
 * `null` on either *_per_day column means unlimited — a plan opts INTO a
 * limit by setting a number, rather than every plan needing an explicit
 * "unlimited" sentinel. See User::effectiveEntitlements() for how a given
 * student's actual limits are resolved (their college's plan first, own
 * individual plan as fallback — same precedence effectiveSubscription()
 * already uses for everything else).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->unsignedSmallInteger('max_practice_problems_per_day')->nullable()->after('sort_order');
            $table->unsignedTinyInteger('max_mock_interviews_per_day')->nullable()->after('max_practice_problems_per_day');
            $table->boolean('drive_access')->default(true)->after('max_mock_interviews_per_day');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['max_practice_problems_per_day', 'max_mock_interviews_per_day', 'drive_access']);
        });
    }
};
