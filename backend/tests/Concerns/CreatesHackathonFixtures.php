<?php

namespace Tests\Concerns;

use App\Models\College;
use App\Models\Company;
use App\Models\Hackathon;
use App\Models\HackathonParticipant;
use App\Models\HackathonSubmission;
use App\Models\HackathonTeam;
use App\Models\Plan;
use App\Models\User;
use App\Services\PurchaseQuoteService;
use App\Services\SubscriptionService;
use Database\Seeders\PlanSeeder;

/**
 * Shared setup for the Hack Arena tests: people in every role, and hackathons
 * caught at each point of their life. Dates are relative to now() so the
 * phase a fixture is in never depends on when the suite happens to run.
 */
trait CreatesHackathonFixtures
{
    /** Creating a student attaches the free plan, which has to exist first — as in production. */
    protected function seedPlans(): void
    {
        $this->seed(PlanSeeder::class);
    }

    /**
     * A student who can take part in a hackathon. Taking part is an Expert feature, so — when the plans
     * have been seeded — the student is put on that plan; pass `false` for the free-plan student the gate
     * is meant to turn away (see PlanAccessGatesTest).
     */
    protected function student(array $attributes = [], bool $withArenaAccess = true): User
    {
        $user = User::factory()->create(['role' => User::ROLE_USER] + $attributes);

        if ($withArenaAccess && Plan::where('code', Plan::CODE_EXPERT)->exists()) {
            app(SubscriptionService::class)->purchase($user, app(PurchaseQuoteService::class)->quote($user, Plan::CODE_EXPERT));
        }

        return $user;
    }

    /** An Ops account holding exactly the given permissions. */
    protected function staff(array $permissions = [User::PERM_HACKATHONS]): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => $permissions]);
    }

    protected function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    protected function tpo(): User
    {
        $college = College::create([
            'name' => 'Apex Institute',
            'short_code' => 'APEX'.random_int(100, 999),
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'tier' => 'Academic Enterprise',
            'placement_rate' => 90,
        ]);

        return User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
    }

    protected function college(string $name = 'Apex Institute', array $overrides = []): College
    {
        return College::create($overrides + [
            'name' => $name,
            'short_code' => strtoupper(substr(preg_replace('/[^A-Za-z]/', '', $name), 0, 4)).random_int(100, 9999),
            'city' => 'Bengaluru',
            'state' => 'Karnataka',
            'tier' => 'Academic Enterprise',
            'placement_rate' => 90,
            'is_active' => true,
        ]);
    }

    /** A student who belongs to `$college` (or to none when null). */
    protected function studentAt(?College $college, array $attributes = []): User
    {
        return $this->student(['college_id' => $college?->id] + $attributes);
    }

    /** A published hackathon mapped to exactly these colleges — no approval step, so it is live for them at once. */
    protected function exclusiveHackathon(array $colleges, array $overrides = []): Hackathon
    {
        $hackathon = $this->hackathon(['audience' => Hackathon::AUDIENCE_COLLEGES] + $overrides);
        $hackathon->colleges()->sync(array_map(fn (College $c) => $c->id, $colleges));

        return $hackathon;
    }

    protected function company(string $name = 'Nimbus Labs'): Company
    {
        return Company::create([
            'name' => $name,
            'slug' => str($name)->slug().'-'.uniqid(),
            'account_type' => Company::ACCOUNT_TYPE_HIRING_TENANT,
        ]);
    }

    protected function companyAdmin(?Company $company = null): User
    {
        $company ??= $this->company();

        return User::factory()->create(['role' => User::ROLE_ADMIN_COMPANY, 'company_id' => $company->id]);
    }

    /** A published hackathon with registration open and kickoff two days away. */
    protected function hackathon(array $overrides = []): Hackathon
    {
        return Hackathon::create($overrides + [
            'slug' => 'hack-'.uniqid(),
            'title' => 'Test Hackathon',
            'tagline' => 'A hackathon for testing.',
            'description' => str_repeat('A long enough description for a real hackathon. ', 3),
            'accent' => 'indigo',
            'themes' => ['AI', 'Web'],
            'mode' => Hackathon::MODE_ONLINE,
            'host_type' => Hackathon::HOST_PLATFORM,
            'status' => Hackathon::STATUS_PUBLISHED,
            'published_at' => now()->subDay(),
            'registration_opens_at' => now()->subDays(5),
            'registration_closes_at' => now()->addDay(),
            'starts_at' => now()->addDays(2),
            'ends_at' => now()->addDays(4),
            'min_team_size' => 1,
            'max_team_size' => 4,
            'prize_pool_amount' => 100000,
            'currency' => 'INR',
            'prizes' => [
                ['place' => 1, 'title' => 'Champion', 'reward' => '₹50,000', 'perks' => []],
                ['place' => 2, 'title' => 'Runner-up', 'reward' => '₹30,000', 'perks' => []],
            ],
        ]);
    }

    /** Kicked off yesterday, deadline in two days, late registration still open. */
    protected function liveHackathon(array $overrides = []): Hackathon
    {
        return $this->hackathon($overrides + [
            'registration_opens_at' => now()->subDays(8),
            'registration_closes_at' => now()->addDay(),
            'starts_at' => now()->subDay(),
            'ends_at' => now()->addDays(2),
        ]);
    }

    /** The deadline passed yesterday; results not yet published. */
    protected function endedHackathon(array $overrides = []): Hackathon
    {
        return $this->hackathon($overrides + [
            'registration_opens_at' => now()->subDays(12),
            'registration_closes_at' => now()->subDays(6),
            'starts_at' => now()->subDays(4),
            'ends_at' => now()->subDay(),
        ]);
    }

    /**
     * Register a student straight into the database (skipping the registration rules, which have their
     * own tests), so a fixture can sit in any phase.
     */
    protected function enter(Hackathon $hackathon, User $user, ?HackathonTeam $team = null, ?string $teamName = null): HackathonParticipant
    {
        $team ??= HackathonTeam::create([
            'hackathon_id' => $hackathon->id,
            'name' => $teamName ?? 'Team '.$user->name.' '.uniqid(),
            'invite_code' => HackathonTeam::generateInviteCode($hackathon->id),
            'leader_id' => $user->id,
        ]);

        return HackathonParticipant::create([
            'hackathon_id' => $hackathon->id,
            'user_id' => $user->id,
            'hackathon_team_id' => $team->id,
            'role' => $team->leader_id === $user->id ? HackathonParticipant::ROLE_LEADER : HackathonParticipant::ROLE_MEMBER,
            'registered_at' => now()->subDays(3),
        ]);
    }

    /** A student's team with a submitted project — ready to be judged. */
    protected function submittedProject(Hackathon $hackathon, array $overrides = [], ?User $student = null): HackathonSubmission
    {
        $student ??= $this->student();
        $participant = $this->enter($hackathon, $student);

        return HackathonSubmission::create($overrides + [
            'hackathon_id' => $hackathon->id,
            'hackathon_team_id' => $participant->hackathon_team_id,
            'submitted_by' => $student->id,
            'title' => 'Project '.uniqid(),
            'tagline' => 'Does a thing.',
            'description' => 'It does the thing well.',
            'repo_url' => 'https://github.com/example/repo',
            'tech_stack' => ['PHP'],
            'status' => HackathonSubmission::STATUS_SUBMITTED,
            'submitted_at' => now()->subHours(5),
        ]);
    }

    /** A valid create/update body for the host endpoints. */
    protected function hostPayload(array $overrides = []): array
    {
        return $overrides + [
            'title' => 'Open Source Sprint',
            'tagline' => 'Ship a contribution in a weekend.',
            'description' => 'Pick a project you love, find a good first issue and get a pull request merged before the deadline.',
            'accent' => 'violet',
            'themes' => ['Open Source'],
            'mode' => 'online',
            'location' => null,
            'registration_opens_at' => now()->addDay()->toIso8601String(),
            'registration_closes_at' => now()->addDays(8)->toIso8601String(),
            'starts_at' => now()->addDays(10)->toIso8601String(),
            'ends_at' => now()->addDays(12)->toIso8601String(),
            'results_expected_at' => now()->addDays(16)->toIso8601String(),
            'min_team_size' => 1,
            'max_team_size' => 4,
            'max_participants' => 100,
            'prize_pool_amount' => 50000,
            'currency' => 'INR',
            'prizes' => [
                ['place' => 1, 'title' => 'Winner', 'reward' => '₹30,000', 'perks' => ['Interview fast-track']],
                ['place' => 2, 'title' => 'Runner-up', 'reward' => '₹20,000', 'perks' => []],
            ],
            'tracks' => [['name' => 'Tooling', 'description' => 'Developer tools']],
            'criteria' => [
                ['name' => 'Impact', 'weight' => 60, 'description' => null],
                ['name' => 'Craft', 'weight' => 40, 'description' => null],
            ],
            'audience' => 'all',
            'rules' => 'Be kind.',
            'eligibility' => 'Any student.',
            'faqs' => [['question' => 'Solo?', 'answer' => 'Yes.']],
            'resources' => [['label' => 'Guide', 'url' => 'https://example.com/guide']],
        ];
    }
}
