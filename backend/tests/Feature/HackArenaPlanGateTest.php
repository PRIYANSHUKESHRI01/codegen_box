<?php

namespace Tests\Feature;

use App\Models\Hackathon;
use App\Models\HackathonParticipant;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\PurchaseQuoteService;
use App\Services\SubscriptionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesHackathonFixtures;
use Tests\TestCase;

/**
 * Taking part in a hackathon is an Expert feature (and part of Grandmaster, the Mellow Academy plan). The lobby and a
 * hackathon's page stay open to every student (the shop window), but
 * registering and saving or submitting a project need a plan that includes the
 * Hack Arena — enforced on the server, whatever the client shows.
 */
class HackArenaPlanGateTest extends TestCase
{
    use CreatesHackathonFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
    }

    private function register(Hackathon $hackathon)
    {
        return $this->postJson("/api/arena/hackathons/{$hackathon->slug}/register", ['mode' => 'solo']);
    }

    /** A student on the free plan — the fixtures' default student is already on Expert. */
    private function freeStudent(array $attributes = []): User
    {
        return $this->student($attributes, withArenaAccess: false);
    }

    private function studentOn(string $planCode): User
    {
        $user = $this->freeStudent();

        // Grandmaster (Mellow Academy) is never bought at checkout: the team enrols the student and the superadmin grants it.
        if ($planCode === Plan::CODE_GRANDMASTER) {
            $plan = Plan::where('code', $planCode)->firstOrFail();
            app(SubscriptionService::class)->grantIndividualPlan($user, $plan, $this->superadmin(), [
                'days' => (int) $plan->duration_days,
                'kind' => 'complimentary',
                'reason' => 'Test: enrolled in Mellow Academy',
            ]);
        } else {
            app(SubscriptionService::class)->purchase($user, app(PurchaseQuoteService::class)->quote($user, $planCode));
        }

        return $user->fresh();
    }

    public function test_a_free_plan_student_cannot_register_and_is_told_what_to_upgrade_to(): void
    {
        $hackathon = $this->hackathon();
        Sanctum::actingAs($this->freeStudent());

        $this->register($hackathon)
            ->assertStatus(402)
            ->assertJsonPath('code', 'plan_required')
            ->assertJsonPath('feature', 'hackathons')
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Expert'));

        $this->assertSame(0, HackathonParticipant::count());
    }

    public function test_an_expert_student_registers(): void
    {
        $hackathon = $this->hackathon();
        Sanctum::actingAs($this->studentOn('expert'));

        $this->register($hackathon)->assertCreated();
        $this->assertSame(1, HackathonParticipant::count());
    }

    public function test_a_mellow_academy_student_registers_too(): void
    {
        $hackathon = $this->hackathon();
        Sanctum::actingAs($this->studentOn('grandmaster'));

        $this->register($hackathon)->assertCreated();
        $this->assertSame(1, HackathonParticipant::count());
    }

    public function test_a_student_covered_by_their_college_plan_keeps_the_hack_arena(): void
    {
        $college = $this->college();
        $admin = $this->superadmin();
        app(SubscriptionService::class)->assignInstitutionPlan($college, Plan::where('code', 'standard')->firstOrFail(), $admin);
        $hackathon = $this->hackathon();

        // Still on the free individual plan — the college's plan is what governs them.
        Sanctum::actingAs($this->freeStudent(['college_id' => $college->id]));

        $this->register($hackathon)->assertCreated();
    }

    public function test_the_lobby_and_a_hackathons_page_stay_open_to_a_free_plan_student(): void
    {
        $hackathon = $this->hackathon(['title' => 'Open to look at']);
        Sanctum::actingAs($this->freeStudent());

        $this->getJson('/api/arena/home')->assertOk();
        $this->getJson('/api/arena/hackathons')->assertOk()->assertJsonPath('hackathons.0.title', 'Open to look at');
        $this->getJson("/api/arena/hackathons/{$hackathon->slug}")->assertOk();
    }

    public function test_a_student_whose_plan_lapsed_cannot_keep_saving_a_project_but_can_always_leave(): void
    {
        $hackathon = $this->hackathon();
        $student = $this->studentOn('expert');
        $this->enter($hackathon, $student);

        // The year ends: the paid plan expires and they are back to free.
        Subscription::where('subscriber_id', $student->id)->whereHas('plan', fn ($q) => $q->where('code', 'expert'))
            ->update(['status' => Subscription::STATUS_EXPIRED]);
        Sanctum::actingAs($student->fresh());

        $this->putJson("/api/arena/hackathons/{$hackathon->slug}/submission", ['title' => 'My project'])
            ->assertStatus(402)
            ->assertJsonPath('code', 'plan_required');

        // Leaving is never refused: nobody should be stuck in a team they cannot take part in.
        $this->postJson("/api/arena/hackathons/{$hackathon->slug}/withdraw")->assertOk();
        $this->assertSame(0, HackathonParticipant::count());
    }
}
