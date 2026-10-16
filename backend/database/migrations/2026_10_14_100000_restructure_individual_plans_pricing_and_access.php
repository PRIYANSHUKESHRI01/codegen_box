<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Individual plans, restructured: three tiers (Coder / Expert / Grandmaster),
 * priced per YEAR, with a superadmin-managed discount, and Project Lab folded
 * into Grandmaster instead of being sold on its own.
 *
 * Schema
 *   monthly_price → list_price     The price of ONE billing term — the amount charged for one
 *                                  activation, i.e. for `duration_days` days. It was called
 *                                  "monthly" while every individual plan was a 30-day plan; the
 *                                  individual plans are now 365-day plans, so the old name would
 *                                  have been a lie sitting in the schema. Institution and company
 *                                  plans keep using `annual_price` (they're sold by Ops, not here).
 *   discount_percent               Whole percent taken off list_price. 0 = no discount. The
 *                                  superadmin edits it live (Plans & Pricing); the price a student
 *                                  pays is list_price minus this, computed in Plan::salePrice().
 *   pricing_updated_by / _at       Who last changed list_price/discount_percent, for the panel.
 *   hackathon_access               Hack Arena: register and submit. A plan opts OUT (false).
 *   talent_pool_access             Join the Talent Pool marketplace. A plan opts OUT (false).
 *   feature_trial_uses             "Taste, don't feast": how many times EACH AI practice feature
 *                                  (mock interview, speaking, listening, vocabulary quiz) may be
 *                                  tried in total, ever. null = no trial cap (daily limits rule).
 *
 * The two *_access columns default to TRUE, the same convention as `drive_access`: every plan that
 * existed before this migration — all college plans, every custom college plan Ops has created —
 * keeps full access with no change, and only the individual plans below are switched off.
 *
 * Data
 *   Coder        free; 1 coding problem a day; one free try of each AI feature; no Hack Arena / Talent Pool
 *   Expert       ₹1,999 / year, 40% off; 10 problems a day; AI interviews 3 a day; no Arena / Lab / Pool
 *   Grandmaster  ₹4,999 / year, 40% off; everything, 10 AI interviews a day; Project Lab included
 *   Project Lab  stops being sold (is_active = false). The row stays — existing subscriptions point
 *                at it, and anyone who already paid keeps their access until their period ends.
 *
 * Subscriptions already running keep their dates and are not repriced; they pay the new yearly
 * price when they next renew.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->renameColumn('monthly_price', 'list_price');
        });

        Schema::table('plans', function (Blueprint $table) {
            $table->unsignedTinyInteger('discount_percent')->default(0)->after('annual_price');
            $table->foreignId('pricing_updated_by')->nullable()->after('discount_percent')->constrained('users')->nullOnDelete();
            $table->timestamp('pricing_updated_at')->nullable()->after('pricing_updated_by');
            $table->boolean('hackathon_access')->default(true)->after('drive_access');
            $table->boolean('talent_pool_access')->default(true)->after('hackathon_access');
            $table->unsignedTinyInteger('feature_trial_uses')->nullable()->after('max_learning_centre_ai_attempts_per_day');
        });

        $plans = DB::table('plans')->where('audience', 'individual');

        (clone $plans)->where('code', 'coder')->update([
            'max_practice_problems_per_day' => 1,
            'max_mock_interviews_per_day' => null, // replaced by the one-time trial below
            'feature_trial_uses' => 1,
            'drive_access' => false,
            'hackathon_access' => false,
            'talent_pool_access' => false,
            'project_lab_access' => false,
        ]);

        (clone $plans)->where('code', 'expert')->update([
            'list_price' => 1999,
            'annual_price' => null,
            'duration_days' => 365,
            'discount_percent' => 40,
            'max_practice_problems_per_day' => 10,
            'max_mock_interviews_per_day' => 3,
            'feature_trial_uses' => null,
            'drive_access' => true,
            'hackathon_access' => false,
            'talent_pool_access' => false,
            'project_lab_access' => false,
        ]);

        (clone $plans)->where('code', 'grandmaster')->update([
            'list_price' => 4999,
            'annual_price' => null,
            'duration_days' => 365,
            'discount_percent' => 40,
            'max_practice_problems_per_day' => null,
            'max_mock_interviews_per_day' => 10,
            'feature_trial_uses' => null,
            'drive_access' => true,
            'hackathon_access' => true,
            'talent_pool_access' => true,
            'project_lab_access' => true,
            'max_workspace_hours_per_month' => 80,
            'max_active_projects' => 3,
        ]);

        // Retired as a product, kept as a row (see the docblock).
        DB::table('plans')->where('code', 'project-lab')->update(['is_active' => false]);
    }

    public function down(): void
    {
        DB::table('plans')->where('code', 'project-lab')->update(['is_active' => true]);

        $plans = DB::table('plans')->where('audience', 'individual');

        (clone $plans)->where('code', 'coder')->update(['max_mock_interviews_per_day' => 1]);
        (clone $plans)->where('code', 'expert')->update([
            'list_price' => 399, 'annual_price' => 3999, 'duration_days' => 30,
            'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => 3,
        ]);
        (clone $plans)->where('code', 'grandmaster')->update([
            'list_price' => 799, 'annual_price' => 7999, 'duration_days' => 30,
            'project_lab_access' => false, 'max_workspace_hours_per_month' => null, 'max_active_projects' => null,
        ]);

        Schema::table('plans', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pricing_updated_by');
            $table->dropColumn(['discount_percent', 'pricing_updated_at', 'hackathon_access', 'talent_pool_access', 'feature_trial_uses']);
        });

        Schema::table('plans', function (Blueprint $table) {
            $table->renameColumn('list_price', 'monthly_price');
        });
    }
};
