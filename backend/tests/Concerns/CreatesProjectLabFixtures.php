<?php

namespace Tests\Concerns;

use App\Models\Plan;
use App\Models\ProjectEnrollment;
use App\Models\ProjectTopic;
use App\Models\User;
use App\Services\PurchaseQuoteService;
use App\Services\SubscriptionService;
use App\Services\Workspaces\FakeWorkspaceRuntime;
use App\Services\Workspaces\WorkspaceRuntime;
use Database\Seeders\PlanSeeder;

/**
 * Shared setup for the Project Lab tests. Uses the real PlanSeeder so the
 * numbers under test (499 / 349 / 748 …) are the numbers that ship, not a
 * copy that can drift from them.
 */
trait CreatesProjectLabFixtures
{
    protected function seedPlans(): void
    {
        $this->seed(PlanSeeder::class);
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

    protected function studentWithLab(array $attributes = []): User
    {
        $user = $this->student($attributes);
        $this->buy($user, null, [Plan::CODE_PROJECT_LAB]);

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
