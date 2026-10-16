<?php

namespace Database\Seeders;

use App\Models\Plan;
use Illuminate\Database\Seeder;
use Illuminate\Support\Arr;

/**
 * The plan catalogue. Individual plans (Coder / Expert / Grandmaster) are
 * shown on the /pricing page, whose prices come LIVE from these rows — the
 * frontend keeps only the marketing copy (see frontend/src/data/pricing.ts),
 * so there is no second price list to keep in sync. `code` is the plan id the
 * frontend and POST /me/subscription use.
 *
 * What the superadmin owns: `list_price` and `discount_percent` of the
 * individual plans (Superadmin → Plans & Pricing). Those two are written ONLY
 * when a plan row is first created. Re-running this seeder later — `db:seed`
 * on a deploy, a fresh test run — refreshes everything else (entitlements,
 * names) but never puts the shipped price back over the one the superadmin
 * set.
 *
 * Must run before any User is created (see AppServiceProvider's
 * User::created listener) and before any College is subscribed.
 */
class PlanSeeder extends Seeder
{
    /** Columns the superadmin edits at runtime; seeded once, then left alone. */
    private const OPERATOR_OWNED = ['list_price', 'discount_percent'];

    public function run(): void
    {
        // Entitlements — null on a *_per_day column = unlimited:
        //
        //   Coder        1 coding problem a day, and ONE free try of each AI practice
        //                feature, ever (feature_trial_uses). No drive access, Hack
        //                Arena, Vault or Project Lab.
        //   Expert       Everything, bought online: unlimited problems, 10 AI mock
        //                interviews a day, Learning Centre, drives, Hack Arena, the
        //                Vault (direct hiring through Mellow Vault) and Project Lab (80
        //                workspace-hours a month, 3 projects at once — about 2.6 h
        //                a day, enough for a real project a month and the cap that
        //                keeps the workspace fleet's cost per student bounded).
        //   Grandmaster  Mellow Academy: the same platform access as Expert for THREE
        //                years (1,095 days), plus the Academy programme (MERN, Laravel,
        //                full-stack and mobile app development, assured placement),
        //                which the Academy delivers. contact_only: no online price, not
        //                for sale at checkout — the team enrols a student and the
        //                superadmin grants the plan (Superadmin → Subscriptions).
        //
        // Every institution plan is unlimited across the board — a college
        // already paying five/six figures a year for full student-body access
        // shouldn't have its students throttled like a free individual user
        // (see User::effectiveEntitlements()'s docblock) — and, like every plan
        // that doesn't say otherwise, keeps Hack Arena and Vault access (the
        // *_access columns default to true) for the students it covers.
        //
        // Expert's price is per YEAR (duration_days 365): ₹4,999 list price, 40% off at launch
        // (₹2,999). Grandmaster has none.
        $plans = [
            ['code' => 'coder', 'name' => 'Coder', 'audience' => Plan::AUDIENCE_INDIVIDUAL, 'list_price' => 0, 'annual_price' => null, 'duration_days' => null, 'sort_order' => 1, 'max_practice_problems_per_day' => 1, 'max_mock_interviews_per_day' => null, 'feature_trial_uses' => 1, 'drive_access' => false, 'hackathon_access' => false, 'vault_access' => false],
            ['code' => 'expert', 'name' => 'Expert', 'audience' => Plan::AUDIENCE_INDIVIDUAL, 'list_price' => 4999, 'annual_price' => null, 'discount_percent' => 40, 'duration_days' => 365, 'sort_order' => 2, 'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => 10, 'drive_access' => true, 'hackathon_access' => true, 'vault_access' => true, 'project_lab_access' => true, 'max_workspace_hours_per_month' => 80, 'max_active_projects' => 3],
            // Mellow Academy. No price of its own (list_price null, contact_only): it is arranged with the team.
            ['code' => Plan::CODE_GRANDMASTER, 'name' => 'Grandmaster', 'audience' => Plan::AUDIENCE_INDIVIDUAL, 'contact_only' => true, 'list_price' => null, 'annual_price' => null, 'discount_percent' => 0, 'duration_days' => 1095, 'sort_order' => 3, 'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => 10, 'drive_access' => true, 'hackathon_access' => true, 'vault_access' => true, 'project_lab_access' => true, 'max_workspace_hours_per_month' => 80, 'max_active_projects' => 3],
            // Project Lab used to be an add-on (kind=addon) sold next to a base plan; it is now
            // part of Grandmaster. The row stays — existing add-on subscriptions point at it and
            // run to the end of the period they paid for — but it is not for sale (is_active =
            // false), so no new add-on purchase can be made. Same 80 h / 3 projects as before.
            ['code' => Plan::CODE_PROJECT_LAB, 'name' => 'Project Lab', 'audience' => Plan::AUDIENCE_INDIVIDUAL, 'kind' => Plan::KIND_ADDON, 'list_price' => 499, 'annual_price' => 4999, 'duration_days' => 30, 'is_active' => false, 'sort_order' => 10, 'project_lab_access' => true, 'max_workspace_hours_per_month' => 80, 'max_active_projects' => 3],
            // max_students mirrors the seat counts already advertised on the
            // pricing page (frontend/src/data/pricing.ts's institution plan
            // feature bullets) — null = unlimited, same as Academic
            // Enterprise's "Unlimited student seats" bullet.
            ['code' => 'standard', 'name' => 'Standard', 'audience' => Plan::AUDIENCE_INSTITUTION, 'list_price' => null, 'annual_price' => 149000, 'duration_days' => 365, 'sort_order' => 1, 'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => null, 'drive_access' => true, 'max_students' => 500],
            ['code' => 'pro-campus', 'name' => 'Pro Campus', 'audience' => Plan::AUDIENCE_INSTITUTION, 'list_price' => null, 'annual_price' => 449000, 'duration_days' => 365, 'sort_order' => 2, 'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => null, 'drive_access' => true, 'max_students' => 2000],
            ['code' => 'academic-enterprise', 'name' => 'Academic Enterprise', 'audience' => Plan::AUDIENCE_INSTITUTION, 'list_price' => null, 'annual_price' => null, 'duration_days' => 365, 'sort_order' => 3, 'max_practice_problems_per_day' => null, 'max_mock_interviews_per_day' => null, 'drive_access' => true, 'max_students' => null],
            // Company hiring tenant plans — Ops-assigned only (see
            // AdminController::storeCompanyTenant()), never self-serve, same
            // convention as the institution plans above. Practice/interview
            // entitlements don't apply to a company account at all (a
            // hiring-tenant admin never takes a practice problem or mock
            // interview themselves), left null/default.
            ['code' => 'hiring-starter', 'name' => 'Hiring Starter', 'audience' => Plan::AUDIENCE_COMPANY, 'list_price' => null, 'annual_price' => 99000, 'duration_days' => 365, 'sort_order' => 1],
            ['code' => 'hiring-growth', 'name' => 'Hiring Growth', 'audience' => Plan::AUDIENCE_COMPANY, 'list_price' => null, 'annual_price' => 299000, 'duration_days' => 365, 'sort_order' => 2],
        ];

        foreach ($plans as $plan) {
            $existing = Plan::where('code', $plan['code'])->first();

            if ($existing === null) {
                Plan::create($plan);

                continue;
            }

            $existing->update(Arr::except($plan, self::OPERATOR_OWNED));
        }
    }
}
