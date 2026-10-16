<?php

namespace Tests\Concerns;

use App\Models\Plan;
use App\Models\ProjectEnrollment;
use App\Models\ProjectTopic;
use App\Models\Subscription;
use App\Models\User;
use App\Services\PurchaseQuoteService;
use App\Services\SubscriptionService;
use App\Services\Workspaces\FakeWorkspaceRuntime;
use App\Services\Workspaces\WorkspaceRuntime;
use Database\Seeders\PlanSeeder;

/**
 * Shared setup for the Project Lab tests. Uses the real PlanSeeder so the
 * numbers under test (Expert's 4,999 list price at 40% off, the 499 add-on …) are the numbers
 * that ship, not a copy that can drift from them.
 *
 * Project Lab is part of Expert now; the stand-alone add-on is retired
 * (not for sale), but students who bought it before still hold it until it
 * expires — that is the case studentWithLab() models, because it is the
 * add-on-shaped access (its own period, its own hour and project limits) that
 * the workspace, submission and lapse tests were written against.
 * studentOnExpert() is the way a student gets Lab today.
 */
trait CreatesProjectLabFixtures
{
    protected function seedPlans(): void
    {
        $this->seed(PlanSeeder::class);
    }

    /**
     * A cheaper self-serve plan next to Expert: the old ₹1,999-list Expert (₹1,199 at 40% off, the mid tier
     * without Hack Arena, Lab or the Vault). The shipped catalogue sells ONE paid plan online, but the payment
     * suites are about moving money and several of their cases need two plans at two prices — an upgrade, a
     * refund of an earlier purchase, a receipts list that sums two orders — so they opt in to this one.
     * Never seeded for everyone: it would appear on the public pricing list.
     */
    protected function seedStarterPlan(): Plan
    {
        return Plan::create([
            'code' => 'starter',
            'name' => 'Starter',
            'audience' => Plan::AUDIENCE_INDIVIDUAL,
            'list_price' => 1999,
            'discount_percent' => 40,
            'duration_days' => 365,
            'sort_order' => 1, // below Expert's 2: moving to it from Expert is a downgrade, as the old mid tier was
            'max_practice_problems_per_day' => 10,
            'max_mock_interviews_per_day' => 3,
            'drive_access' => true,
            'hackathon_access' => false,
            'vault_access' => false,
            'project_lab_access' => false,
        ]);
    }

    /** A student on the free Coder plan (needs seedPlans() first, as in production). */
    protected function student(array $attributes = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER] + $attributes);
    }

    /** Buy a cart the way the checkout does: price it, then purchase it. */
    protected function buy(User $user, ?string $planCode = null, array $addons = []): array
    {
        $quote = app(PurchaseQuoteService::class)->quote($user, $planCode, $addons);
        app(SubscriptionService::class)->purchase($user, $quote);

        return $quote;
    }

    /** A student who holds Project Lab the way someone who bought the add-on before it was retired does. */
    protected function studentWithLab(array $attributes = []): User
    {
        $user = $this->student($attributes);
        $this->grantLegacyProjectLabAddon($user);

        return $user->fresh();
    }

    /**
     * An active, in-date Project Lab add-on subscription, created directly: the add-on can no
     * longer be bought through checkout (the plan row is inactive), but rows from before the
     * retirement exist in production and must keep working until they expire.
     */
    protected function grantLegacyProjectLabAddon(User $user, int $pricePaid = 499, int $listPrice = 499): Subscription
    {
        $addon = Plan::where('code', Plan::CODE_PROJECT_LAB)->firstOrFail();

        return Subscription::create([
            'subscriber_type' => User::class,
            'subscriber_id' => $user->id,
            'plan_id' => $addon->id,
            'status' => Subscription::STATUS_ACTIVE,
            'started_at' => now(),
            'current_period_end' => now()->addDays((int) $addon->duration_days),
            'meta' => ['purchase_ref' => 'legacy-test', 'list_price' => $listPrice, 'discount' => $listPrice - $pricePaid, 'price_paid' => $pricePaid],
        ]);
    }

    /** A student on the paid Expert plan — Project Lab and Hack Arena included. */
    protected function studentOnExpert(array $attributes = []): User
    {
        $user = $this->student($attributes);
        $this->buy($user, 'expert');

        return $user->fresh();
    }

    /**
     * An enrolled Mellow Academy student: Grandmaster, which is never bought at checkout — the team enrols
     * the student and the superadmin grants the plan (three years by default), as in production.
     */
    protected function studentOnAcademy(array $attributes = []): User
    {
        $user = $this->student($attributes);
        $superadmin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        $plan = Plan::where('code', Plan::CODE_GRANDMASTER)->firstOrFail();

        app(SubscriptionService::class)->grantIndividualPlan($user, $plan, $superadmin, [
            'days' => (int) $plan->duration_days,
            'kind' => 'complimentary',
            'reason' => 'Test: enrolled in Mellow Academy',
        ]);

        return $user->fresh();
    }

    /** An Ops account holding exactly the given permissions. */
    protected function staff(array $permissions = [User::PERM_PROJECT_LAB]): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => $permissions]);
    }

    protected function topic(array $overrides = [], int $milestones = 2): ProjectTopic
    {
        $topic = ProjectTopic::create($overrides + [
            'slug' => 'topic-'.uniqid(),
            'title' => 'Learning Management System',
            'category' => 'Web Apps',
            'summary' => 'Build a course platform with enrolments, lessons and quizzes.',
            'difficulty' => ProjectTopic::DIFFICULTY_INTERMEDIATE,
            'estimated_hours' => 60,
            'tech_stack' => ['Laravel', 'MySQL', 'React'],
            'outcomes' => ['Design a relational schema', 'Build a REST API'],
            'sow_markdown' => "# Statement of Work\n\n## Objectives\n\nBuild an LMS.\n\n## Out of scope\n\nPayments.\n",
            'sow_version' => 1,
            'status' => ProjectTopic::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);

        for ($i = 0; $i < $milestones; $i++) {
            $topic->milestones()->create([
                'position' => $i,
                'title' => 'Milestone '.($i + 1),
                'description' => 'Secret detail '.($i + 1),
                'acceptance_criteria' => ['Criterion A'.$i, 'Criterion B'.$i],
                'estimated_hours' => 5,
            ]);
        }

        return $topic->fresh('milestones');
    }

    protected function enroll(User $user, ?ProjectTopic $topic = null, string $status = ProjectEnrollment::STATUS_ACTIVE): ProjectEnrollment
    {
        $topic ??= $this->topic();

        return ProjectEnrollment::create([
            'user_id' => $user->id,
            'project_topic_id' => $topic->id,
            'sow_version' => $topic->sow_version,
            'status' => $status,
            'started_at' => now(),
        ]);
    }

    /**
     * Point the app at an in-memory workspace host. $capacity is the host's
     * limit on live workspaces.
     */
    protected function fakeWorkspaces(int $capacity = 3): void
    {
        config([
            'workspaces.runtime' => 'fake',
            'workspaces.enabled' => true,
            'workspaces.hosts' => [[
                'name' => 'test-host',
                'docker_host' => null,
                'capacity' => $capacity,
                'domain' => 'ws.test',
                'scheme' => 'https',
            ]],
            'workspaces.snapshot.disk' => 'local',
        ]);

        FakeWorkspaceRuntime::reset();
        $this->app->instance(WorkspaceRuntime::class, new FakeWorkspaceRuntime);
    }
}
