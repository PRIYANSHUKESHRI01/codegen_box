<?php

namespace Database\Seeders;

use App\Models\College;
use App\Models\Company;
use App\Models\Plan;
use App\Models\User;
use App\Services\SubscriptionService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database with the demo accounts referenced by
     * the frontend's login "Quick Demo Logins" buttons, so they work against
     * real authentication instead of the old mocked flow.
     */
    public function run(): void
    {
        // Must run first: every User created below fires the User::created
        // listener in AppServiceProvider, which needs the free "coder" plan
        // to already exist to attach a default subscription.
        $this->call(PlanSeeder::class);

        $apex = College::firstOrCreate(
            ['short_code' => 'APEX'],
            [
                'name' => 'Apex Institute of Technology & Research',
                'city' => 'Bengaluru',
                'state' => 'Karnataka',
                'tier' => 'Academic Enterprise',
                'placement_rate' => 92.50,
            ]
        );

        User::updateOrCreate(
            ['email' => 'aryan@mellow.ai'],
            [
                'name' => 'Aryan Mehta',
                'handle' => 'aryan_root',
                'password' => Hash::make('super_secure_key_2026'),
                'role' => User::ROLE_SUPERADMIN,
            ]
        );

        User::updateOrCreate(
            ['email' => 'priya@mellow.ai'],
            [
                'name' => 'Priya Sundaram',
                'handle' => 'priya_ops',
                'password' => Hash::make('mellow_staff_ops_99'),
                'role' => User::ROLE_ADMIN_INTERNAL,
            ]
        );

        User::updateOrCreate(
            ['email' => 'tpo@apex.edu.in'],
            [
                'name' => 'Dr. Rajeshwar Sharma',
                'handle' => 'rajeshwar_tpo',
                'password' => Hash::make('apex_tpo_placement_2026'),
                'role' => User::ROLE_ADMIN_TPO,
                'college_id' => $apex->id,
            ]
        );

        User::updateOrCreate(
            ['email' => 'alex.chen@student.apex.edu'],
            [
                'name' => 'Alex Chen',
                'handle' => 'alex_coder',
                'password' => Hash::make('alex_coder_codeforge'),
                'role' => User::ROLE_USER,
                'college_id' => $apex->id,
            ]
        );

        User::updateOrCreate(
            ['email' => 'marketing@mellow.ai'],
            [
                'name' => 'Neha Kapoor',
                'handle' => 'neha_marketing',
                'password' => Hash::make('mellow_marketing_growth_26'),
                'role' => User::ROLE_ADMIN_MARKETING,
            ]
        );

        // Demo company hiring tenant — same "Ops-onboarded, one admin
        // account" pattern as the Apex College/TPO pair above, so the
        // Hiring Command Center has a real Quick Demo Login from day one.
        $nimbus = Company::updateOrCreate(
            ['slug' => 'nimbus-labs'],
            [
                'name' => 'Nimbus Labs',
                'logo' => '⚡',
                'website_url' => 'https://nimbuslabs.example.com',
                'industry' => 'Cloud Infrastructure',
                'overview' => 'Nimbus Labs builds developer tooling for cloud-native teams, hiring directly through '
                    .'CodeGen Box for its engineering roles.',
                'account_type' => Company::ACCOUNT_TYPE_HIRING_TENANT,
            ]
        );

        User::updateOrCreate(
            ['email' => 'hiring@nimbuslabs.example.com'],
            [
                'name' => 'Kabir Anand',
                'handle' => 'kabir_hiring',
                'password' => Hash::make('nimbus_hiring_demo_26'),
                'role' => User::ROLE_ADMIN_COMPANY,
                'company_id' => $nimbus->id,
            ]
        );

        // Two "Mellow Direct" leads (self-registered, no college) so the
        // lead -> conversion -> internal-handoff pipeline has real demo data
        // end to end: User::created's listener auto-assigns both to Neha the
        // instant they're created, and subscribeSeededDemoData() below
        // converts the second one via a real paid-plan purchase (exercising
        // LeadAssignmentService::convertLead exactly like a real checkout
        // would), which then hands it to Priya as its internal owner.
        User::updateOrCreate(
            ['email' => 'ananya.raj@gmail.com'],
            [
                'name' => 'Ananya Raj',
                'handle' => 'ananya_codes',
                'password' => Hash::make('ananya_lead_demo_26'),
                'role' => User::ROLE_USER,
            ]
        );

        User::updateOrCreate(
            ['email' => 'rohan.verma@gmail.com'],
            [
                'name' => 'Rohan Verma',
                'handle' => 'rohan_codes',
                'password' => Hash::make('rohan_customer_demo_26'),
                'role' => User::ROLE_USER,
            ]
        );

        $this->call(PlacementSeeder::class);
        // ProblemSeeder before CampusRosterSeeder/CompanyHiringSeeder: both
        // reference real Problem rows (a backdated practice streak, and an
        // assessment's attached problem, respectively).
        $this->call(ProblemSeeder::class);
        $this->call(DsaHundredProblemSeeder::class);
        $this->call(DsaHundredProblemSeederV2::class);
        $this->call(DsaHundredProblemSeederV3::class);
        $this->call(DsaHundredProblemSeederV4::class);
        $this->call(DsaHundredProblemSeederV5::class);
        $this->call(DsaHundredProblemSeederV6::class);
        $this->call(DsaHundredProblemSeederV7::class);
        $this->call(DsaHundredProblemSeederV8::class);
        $this->call(CompanyTagSeeder::class);
        // InterviewQuestionBankSeeder before CampusRosterSeeder: both
        // CompanyHiringSeeder and InterviewSeeder below attach real
        // InterviewQuestionBank rows to their demo interviews.
        $this->call(InterviewQuestionBankSeeder::class);
        $this->call(CampusRosterSeeder::class);
        $this->call(CompanyHiringSeeder::class);
        // Needs users/colleges/companies/drives from everything above.
        $this->call(InterviewSeeder::class);
        // ArticleTopicSeeder before ArticleSeeder: articles attach to a real topic.
        $this->call(ArticleTopicSeeder::class);
        $this->call(ArticleSeeder::class);
        // Learning Centre's other two content-bank modules — independent of
        // Articles/interviews, no ordering dependency on anything above.
        $this->call(SpeakingPromptSeeder::class);
        $this->call(ListeningLessonSeeder::class);
        // Soft Skills — the question bank, then the default published
        // general assessment built from it (requires priya@mellow.ai,
        // already seeded above).
        $this->call(SoftSkillQuestionSeeder::class);
        $this->call(SoftSkillAssessmentSeeder::class);
        $this->call(FeatureFlagSeeder::class);

        $this->subscribeSeededDemoData();
    }

    /**
     * Colleges have no creation hook (unlike User — see
     * AppServiceProvider), so every college seeded above needs its
     * institutional plan activated explicitly, from its `tier`. Also a
     * defensive pass for any student who somehow ended up without a
     * subscription (e.g. seeders re-run against a partially-seeded DB) —
     * ensureDefaultIndividualPlan() is a no-op for anyone who already has one.
     */
    private function subscribeSeededDemoData(): void
    {
        $service = app(SubscriptionService::class);
        $actor = User::where('role', User::ROLE_SUPERADMIN)->first();

        if ($actor === null) {
            return;
        }

        College::all()->each(function (College $college) use ($service, $actor) {
            if ($college->activeSubscription() === null) {
                $plan = Plan::where('audience', Plan::AUDIENCE_INSTITUTION)->where('name', $college->tier)->first();
                if ($plan !== null) {
                    $service->assignInstitutionPlan($college, $plan, $actor);
                }
            }
        });

        // Same defensive activation for the demo hiring tenant — Company has
        // no `tier` field, so this always uses the same plan code rather
        // than deriving it from an attribute.
        Company::where('account_type', Company::ACCOUNT_TYPE_HIRING_TENANT)->get()->each(function (Company $company) use ($service, $actor) {
            if ($company->activeSubscription() === null) {
                $plan = Plan::where('code', 'hiring-growth')->first();
                if ($plan !== null) {
                    $service->assignCompanyPlan($company, $plan, $actor);
                }
            }
        });

        User::where('role', User::ROLE_USER)->get()->each(fn (User $user) => $service->ensureDefaultIndividualPlan($user));

        // Exercises the real conversion path (SubscriptionService::subscribeIndividual
        // -> LeadAssignmentService::convertLead) so the demo data shows one
        // lead already converted-and-handed-to-Internal, not just a raw new
        // one — same real code path a live checkout would run, not a
        // fabricated lead_status write.
        $rohan = User::where('email', 'rohan.verma@gmail.com')->first();
        $expertPlan = Plan::where('code', 'expert')->first();
        if ($rohan !== null && $expertPlan !== null && $rohan->lead_status !== User::LEAD_STATUS_CONVERTED) {
            $service->subscribeIndividual($rohan, $expertPlan);
        }
    }
}
