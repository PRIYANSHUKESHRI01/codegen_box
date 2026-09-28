<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;

/**
 * Mirrors the plans already shown on the /pricing page (see
 * frontend/src/data/pricing.ts) — `code` is that file's plan `id`, kept in
 * sync by hand since pricing copy (taglines, feature bullets, icons) lives
 * only on the frontend and has no reason to round-trip through the API.
 * Must run before any User is created (see AppServiceProvider's
 * User::created listener) and before any College is subscribed.
 */
class PlanSeeder extends Seeder
{
    public function run(): void
    {
        // Entitlements (added alongside the original plan fields — see
        // 2026_09_27_020000_add_entitlements_to_plans_table's docblock):
        // null on a *_per_day column = unlimited. Coder (free) gets 1
        // practice problem + 1 mock interview a day and no drive access;
        // Expert/Grandmaster (the "medium"/"max" tiers) get unlimited
        // practice with 3/10 mock interviews a day respectively; every
        // institution plan is unlimited across the board — a college
        // already paying five/six figures a year for full student-body
        // access shouldn't have its students throttled like a free
        // individual user (see User::effectiveEntitlements()'s docblock).
        $plans = [
            ['code' => 'coder', 'name' => 'Coder', 'audience' => Plan::AUDIENCE_INDIVIDUAL, 'monthly_price' => 0, 'annual_price' => 0, 'duration_days' => null, 'sort_order' => 1, 'max_practice_problems_per_day' => 1, 'max_mock_interviews_per_day' => 1, 'drive_access' => false],
            ['code' => 'expert', 'name' => 'Expert', 'audience' => Plan::AUDIENCE_INDIVIDUAL, 'monthly_price' => 399, 'annual_price' => 3999, 'duration_days' => 30, 'sort_order' => 2, 'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => 3, 'drive_access' => true],
            ['code' => 'grandmaster', 'name' => 'Grandmaster', 'audience' => Plan::AUDIENCE_INDIVIDUAL, 'monthly_price' => 799, 'annual_price' => 7999, 'duration_days' => 30, 'sort_order' => 3, 'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => 10, 'drive_access' => true],
            // max_students mirrors the seat counts already advertised on the
            // pricing page (frontend/src/data/pricing.ts's institution plan
            // feature bullets) — null = unlimited, same as Academic
            // Enterprise's "Unlimited student seats" bullet.
            ['code' => 'standard', 'name' => 'Standard', 'audience' => Plan::AUDIENCE_INSTITUTION, 'monthly_price' => null, 'annual_price' => 149000, 'duration_days' => 365, 'sort_order' => 1, 'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => null, 'drive_access' => true, 'max_students' => 500],
            ['code' => 'pro-campus', 'name' => 'Pro Campus', 'audience' => Plan::AUDIENCE_INSTITUTION, 'monthly_price' => null, 'annual_price' => 449000, 'duration_days' => 365, 'sort_order' => 2, 'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => null, 'drive_access' => true, 'max_students' => 2000],
            ['code' => 'academic-enterprise', 'name' => 'Academic Enterprise', 'audience' => Plan::AUDIENCE_INSTITUTION, 'monthly_price' => null, 'annual_price' => null, 'duration_days' => 365, 'sort_order' => 3, 'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => null, 'drive_access' => true, 'max_students' => null],
            // Company hiring tenant plans — Ops-assigned only (see
            // AdminController::storeCompanyTenant()), never self-serve, same
            // convention as the institution plans above. Practice/interview
            // entitlements don't apply to a company account at all (a
            // hiring-tenant admin never takes a practice problem or mock
            // interview themselves), left null/default.
            ['code' => 'hiring-starter', 'name' => 'Hiring Starter', 'audience' => Plan::AUDIENCE_COMPANY, 'monthly_price' => null, 'annual_price' => 99000, 'duration_days' => 365, 'sort_order' => 1],
            ['code' => 'hiring-growth', 'name' => 'Hiring Growth', 'audience' => Plan::AUDIENCE_COMPANY, 'monthly_price' => null, 'annual_price' => 299000, 'duration_days' => 365, 'sort_order' => 2],
        ];

        foreach ($plans as $plan) {
            Plan::updateOrCreate(['code' => $plan['code']], $plan);
        }
    }
}
