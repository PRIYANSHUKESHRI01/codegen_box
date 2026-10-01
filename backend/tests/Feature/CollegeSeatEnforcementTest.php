<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers the "a college with no active subscription can't add/import new
 * students" gate added to College::activePlan()/hasActiveSubscription() and
 * its five call sites. Before this, a college whose subscription had
 * expired fell through to `$limit !== null && ...` with a null limit — the
 * exact same null a genuinely unlimited ACTIVE plan produces — and was
 * wrongly treated as unlimited instead of blocked. These tests exist to
 * prove that specific regression can't come back, not to re-cover the
 * ordinary "at your seat cap" path (already implicit in the existing error
 * strings these controllers return).
 */
class CollegeSeatEnforcementTest extends TestCase
{
    use RefreshDatabase;

    private function plan(array $overrides = []): Plan
    {
        return Plan::create(array_merge([
            'code' => 'test-institution-plan-'.uniqid(),
            'name' => 'Standard',
            'audience' => Plan::AUDIENCE_INSTITUTION,
            'monthly_price' => null,
            'annual_price' => 149000,
            'duration_days' => 365,
            'is_active' => true,
            'sort_order' => 1,
            'drive_access' => true,
            'max_students' => 500,
        ], $overrides));
    }

    private function collegeWithSubscription(Plan $plan, array $subscriptionOverrides = []): College
    {
        $college = College::create(['name' => 'Test College', 'short_code' => 'TC-'.uniqid(), 'tier' => $plan->name]);

        Subscription::create(array_merge([
            'subscriber_type' => College::class,
            'subscriber_id' => $college->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'started_at' => now()->subYear(),
            'current_period_end' => now()->addMonth(),
            'auto_renew' => false,
        ], $subscriptionOverrides));

        return $college;
    }

    private function tpoFor(College $college): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
    }

    public function test_tpo_cannot_add_a_student_once_the_colleges_subscription_has_expired_even_with_a_numeric_seat_cap(): void
    {
        $plan = $this->plan(['max_students' => 500]); // NOT null — proves the new gate fires, not the old cap
        $college = $this->collegeWithSubscription($plan, ['current_period_end' => now()->subDay()]);

        Sanctum::actingAs($this->tpoFor($college));
        $this->postJson('/api/tpo/students', ['name' => 'New Student', 'email' => 'new.student@example.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_tpo_cannot_add_a_student_with_no_subscription_at_all(): void
    {
        $college = College::create(['name' => 'Never Subscribed College', 'short_code' => 'NSC-'.uniqid()]);

        Sanctum::actingAs($this->tpoFor($college));
        $this->postJson('/api/tpo/students', ['name' => 'New Student', 'email' => 'new.student2@example.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_tpo_can_add_a_student_when_the_colleges_plan_is_genuinely_unlimited_and_active(): void
    {
        $plan = $this->plan(['name' => 'Academic Enterprise', 'max_students' => null]);
        $college = $this->collegeWithSubscription($plan);

        Sanctum::actingAs($this->tpoFor($college));
        $this->postJson('/api/tpo/students', ['name' => 'New Student', 'email' => 'new.student3@example.com'])
            ->assertStatus(201);
    }

    public function test_an_expired_trial_blocks_new_students_the_same_as_an_expired_paid_plan(): void
    {
        $plan = $this->plan(['max_students' => 50]);
        $college = $this->collegeWithSubscription($plan, [
            'is_trial' => true,
            'current_period_end' => now()->subHour(),
        ]);

        Sanctum::actingAs($this->tpoFor($college));
        $this->postJson('/api/tpo/students', ['name' => 'New Student', 'email' => 'new.student4@example.com'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_an_active_trial_still_within_its_window_behaves_like_any_other_active_plan(): void
    {
        $plan = $this->plan(['max_students' => 50]);
        $college = $this->collegeWithSubscription($plan, [
            'is_trial' => true,
            'started_at' => now(),
            'current_period_end' => now()->addDays(13),
        ]);

        Sanctum::actingAs($this->tpoFor($college));
        $this->postJson('/api/tpo/students', ['name' => 'New Student', 'email' => 'new.student5@example.com'])
            ->assertStatus(201);
    }

    public function test_tpo_can_still_hit_the_ordinary_seat_cap_message_on_an_active_subscription(): void
    {
        $plan = $this->plan(['max_students' => 1]);
        $college = $this->collegeWithSubscription($plan);
        User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college->id]); // fills the one seat

        Sanctum::actingAs($this->tpoFor($college));
        $response = $this->postJson('/api/tpo/students', ['name' => 'New Student', 'email' => 'new.student6@example.com']);
        $response->assertStatus(422)->assertJsonValidationErrors('email');
        $this->assertStringContainsString('plan allows up to', $response->json('errors.email.0'));
    }
}
