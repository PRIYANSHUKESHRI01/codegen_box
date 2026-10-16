<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Expert becomes the complete self-serve plan; Grandmaster becomes the Mellow
 * Academy programme, sold by the team instead of online.
 *
 * What a student could buy before: Expert (₹1,999 list) with practice, interviews
 * and drives, or Grandmaster (₹4,999 list) with all of that plus Hack Arena, the
 * Vault and Project Lab. What they can buy now:
 *
 *   Expert       what Grandmaster was — the same list price, discount, 365-day term and every
 *                limit and switch — still bought online. The numbers are COPIED from the live
 *                Grandmaster row, not re-typed, so a price or limit the superadmin has changed
 *                since launch moves across exactly as it stands.
 *   Grandmaster  the Mellow Academy tier: every AptRun feature for three years (1,095 days), with
 *                the programme itself (MERN, Laravel, full-stack and mobile app development,
 *                assured placement) delivered by the Academy. It has no online price —
 *                `contact_only` — so it cannot be bought at checkout; the superadmin grants it
 *                to an enrolled student (Superadmin → Subscriptions → Give plan), and the
 *                pricing page sends visitors to the team.
 *
 * Schema
 *   contact_only   A plan sold by the team, never at checkout. Judged BEFORE the price everywhere
 *                  a plan is priced or bought (Plan::isFree, PurchaseQuoteService, the superadmin
 *                  price editor), so a missing price can never read as "free".
 *
 * Data
 *   Subscriptions that were on Grandmaster move to Expert: they bought what is now called Expert,
 *   at the price Expert now has. Left where they were, a ₹2,999 buyer would turn into an Academy
 *   student overnight. Each moved row is marked meta.moved_from_plan so down() can put it back.
 *   Their dates, status and price paid are untouched.
 *
 *   Existing Expert subscribers keep their dates and are not repriced; for the rest of their term
 *   they get the complete Expert (a plan's limits live on the plan row, so this cannot be avoided
 *   without keeping a second, retired plan around).
 *
 * A fresh install has no plan rows at this point: the column is added and PlanSeeder creates the
 * rows with the right values, so nothing below runs.
 */
return new class extends Migration
{
    /** The price and everything a plan lets a student do — what moves from Grandmaster onto Expert. */
    private const SHIFTED = [
        'list_price',
        'annual_price',
        'discount_percent',
        'pricing_updated_by',
        'pricing_updated_at',
        'duration_days',
        'max_practice_problems_per_day',
        'max_mock_interviews_per_day',
        'max_learning_centre_ai_attempts_per_day',
        'feature_trial_uses',
        'drive_access',
        'hackathon_access',
        'vault_access',
        'project_lab_access',
        'max_workspace_hours_per_month',
        'max_active_projects',
    ];

    /** Three years, in days: the Mellow Academy term. */
    private const ACADEMY_TERM_DAYS = 1095;

    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->boolean('contact_only')->default(false)->after('is_active');
        });

        $grandmaster = DB::table('plans')->where('code', 'grandmaster')->first();
        $expert = DB::table('plans')->where('code', 'expert')->first();

        if ($grandmaster === null || $expert === null) {
            return;
        }

        DB::transaction(function () use ($grandmaster, $expert) {
            $now = now();

            DB::table('plans')->where('id', $expert->id)->update(
                collect(self::SHIFTED)->mapWithKeys(fn (string $column) => [$column => $grandmaster->{$column}])->all()
                + ['updated_at' => $now]
            );

            DB::table('subscriptions')->where('plan_id', $grandmaster->id)->orderBy('id')->chunkById(200, function ($rows) use ($expert) {
                foreach ($rows as $row) {
                    $meta = json_decode((string) $row->meta, true);
                    $meta = is_array($meta) ? $meta : [];
                    $meta['moved_from_plan'] = 'grandmaster';

                    DB::table('subscriptions')->where('id', $row->id)->update([
                        'plan_id' => $expert->id,
                        'meta' => json_encode($meta),
                    ]);
                }
            });

            // Its limits and switches stay as they are: "every AptRun feature" is exactly what the
            // old Grandmaster row already says. Only the way it is sold and its term change.
            DB::table('plans')->where('id', $grandmaster->id)->update([
                'contact_only' => true,
                'is_active' => true,
                'list_price' => null,
                'annual_price' => null,
                'discount_percent' => 0,
                'pricing_updated_by' => null,
                'pricing_updated_at' => null,
                'duration_days' => self::ACADEMY_TERM_DAYS,
                'updated_at' => $now,
            ]);
        });
    }

    public function down(): void
    {
        $grandmaster = DB::table('plans')->where('code', 'grandmaster')->first();
        $expert = DB::table('plans')->where('code', 'expert')->first();

        if ($grandmaster !== null && $expert !== null) {
            DB::transaction(function () use ($grandmaster, $expert) {
                $now = now();

                // Subscriptions this migration moved go back to Grandmaster, where they were bought.
                DB::table('subscriptions')->where('plan_id', $expert->id)->orderBy('id')->chunkById(200, function ($rows) use ($grandmaster) {
                    foreach ($rows as $row) {
                        $meta = json_decode((string) $row->meta, true);

                        if (! is_array($meta) || ($meta['moved_from_plan'] ?? null) !== 'grandmaster') {
                            continue;
                        }

                        unset($meta['moved_from_plan']);

                        DB::table('subscriptions')->where('id', $row->id)->update([
                            'plan_id' => $grandmaster->id,
                            'meta' => $meta === [] ? null : json_encode($meta),
                        ]);
                    }
                });

                // Grandmaster takes back the price and limits Expert now carries; Expert returns to the
                // launch matrix (the values 2026_10_14_100000 set), as the superadmin's later edits to
                // it cannot be known.
                DB::table('plans')->where('id', $grandmaster->id)->update(
                    collect(self::SHIFTED)->mapWithKeys(fn (string $column) => [$column => $expert->{$column}])->all()
                    + ['contact_only' => false, 'duration_days' => 365, 'updated_at' => $now]
                );

                DB::table('plans')->where('id', $expert->id)->update([
                    'list_price' => 1999,
                    'annual_price' => null,
                    'discount_percent' => 40,
                    'duration_days' => 365,
                    'max_practice_problems_per_day' => 10,
                    'max_mock_interviews_per_day' => 3,
                    'feature_trial_uses' => null,
                    'drive_access' => true,
                    'hackathon_access' => false,
                    'vault_access' => false,
                    'project_lab_access' => false,
                    'max_workspace_hours_per_month' => null,
                    'max_active_projects' => null,
                    'updated_at' => $now,
                ]);
            });
        }

        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn('contact_only');
        });
    }
};
