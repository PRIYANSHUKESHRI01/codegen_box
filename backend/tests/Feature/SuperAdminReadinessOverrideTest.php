<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\ReadinessOverride;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\VaultProfile;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A readiness score a superadmin sets by hand replaces the calculated one EVERYWHERE - the student's own payloads, the stored
 * score, the Vault, the history - at once, and is undone by removing it.
 */
class SuperAdminReadinessOverrideTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seed(PlanSeeder::class);
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function student(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
    }

    private function set(User $student, int $score, array $extra = [])
    {
        Sanctum::actingAs($this->superadmin());

        return $this->putJson("/api/superadmin/readiness/{$student->id}", ['score' => $score, 'reason' => 'College asked us to'] + $extra);
    }

    public function test_only_a_superadmin_can_use_it(): void
    {
        $student = $this->student();

        foreach ([User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]), $student] as $who) {
            Sanctum::actingAs($who);
            $this->getJson("/api/superadmin/readiness/{$student->id}")->assertForbidden();
            $this->putJson("/api/superadmin/readiness/{$student->id}", ['score' => 70, 'reason' => 'Nope'])->assertForbidden();
        }
    }

    public function test_setting_a_score_replaces_the_calculated_one_in_every_student_payload(): void
    {
        $student = $this->student();
        $this->assertSame(0, $student->fresh()->readinessScore());

        $this->set($student, 72)->assertOk()
            ->assertJsonPath('score', 72)
            ->assertJsonPath('calculated_score', 0)
            ->assertJsonPath('override.in_force', true)
            ->assertJsonPath('override.reason', 'College asked us to');

        $this->assertSame(72, $student->fresh()->readinessScore());

        // What the student sees: the score, the flag - and never the reason.
        Sanctum::actingAs($student);
        $stats = $this->getJson('/api/me/stats')->assertOk();
        $stats->assertJsonPath('readiness.score', 72)
            ->assertJsonPath('readiness.override.active', true)
            ->assertJsonPath('readiness.override.calculated_score', 0)
            ->assertJsonPath('readiness.decay.points', 0);
        $this->assertStringNotContainsString('College asked us to', $stats->getContent());

        $this->getJson('/api/me/vault')->assertOk()
            ->assertJsonPath('readiness.score', 72)
            ->assertJsonPath('readiness.override.active', true);

        // Stored on the student for sorting, and recorded in today's history.
        $this->assertSame(72, (int) User::find($student->id)->readiness_score);
        $this->assertDatabaseHas('readiness_snapshots', ['user_id' => $student->id, 'score' => 72]);
    }

    public function test_a_score_over_the_vault_line_puts_the_student_in_the_vault_and_taking_it_off_takes_them_out(): void
    {
        $student = $this->student();

        $this->set($student, 80)->assertOk();
        $profile = VaultProfile::where('user_id', $student->id)->firstOrFail();
        $this->assertTrue($profile->is_eligible);
        $this->assertSame(80, (int) $profile->readiness_score);

        Sanctum::actingAs($this->superadmin());
        $this->deleteJson("/api/superadmin/readiness/{$student->id}", ['reason' => 'Mistake'])
            ->assertOk()
            ->assertJsonPath('score', 0)
            ->assertJsonPath('override', null);

        $this->assertSame(0, $student->fresh()->readinessScore());
        $this->assertFalse($profile->fresh()->is_eligible);
        $this->assertSame(0, (int) User::find($student->id)->readiness_score);
    }

    public function test_the_hand_set_score_can_lower_a_score_too_and_keeps_the_tier_in_step(): void
    {
        $student = $this->student();

        $this->set($student, 100)->assertOk();
        $this->assertSame(100, $student->fresh()->readinessScore());
        $tierHigh = $student->fresh()->readinessTier();

        $this->set($student, 10)->assertOk();
        $fresh = $student->fresh();
        $this->assertSame(10, $fresh->readinessScore());
        $this->assertNotSame($tierHigh, $fresh->readinessTier());
        $this->assertSame(1, ReadinessOverride::where('user_id', $student->id)->count(), 'one row per student, changed in place');
    }

    public function test_an_expired_score_hands_the_student_back_to_the_calculated_one(): void
    {
        $student = $this->student();

        $this->set($student, 90, ['days' => 7])->assertOk();
        $this->assertSame(90, $student->fresh()->readinessScore());

        $this->travel(8)->days();

        $this->assertSame(0, User::find($student->id)->readinessScore());

        Sanctum::actingAs($this->superadmin());
        $this->getJson("/api/superadmin/readiness/{$student->id}")->assertOk()
            ->assertJsonPath('score', 0)
            ->assertJsonPath('override.in_force', false);
    }

    public function test_a_reason_and_a_valid_score_are_required(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->superadmin());

        $this->putJson("/api/superadmin/readiness/{$student->id}", ['score' => 70])->assertStatus(422)->assertJsonValidationErrors('reason');
        $this->putJson("/api/superadmin/readiness/{$student->id}", ['score' => 101, 'reason' => 'Too high'])->assertStatus(422)->assertJsonValidationErrors('score');
        $this->putJson("/api/superadmin/readiness/{$student->id}", ['score' => -1, 'reason' => 'Too low'])->assertStatus(422)->assertJsonValidationErrors('score');
        $this->putJson("/api/superadmin/readiness/{$student->id}", ['score' => 70, 'reason' => 'ok', 'days' => 0])->assertStatus(422);
        $this->deleteJson("/api/superadmin/readiness/{$student->id}", ['reason' => 'x'])->assertStatus(422);

        $this->assertSame(0, ReadinessOverride::count());
    }

    public function test_only_students_can_be_scored_by_hand(): void
    {
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
        Sanctum::actingAs($this->superadmin());

        $this->putJson("/api/superadmin/readiness/{$staff->id}", ['score' => 70, 'reason' => 'Why not'])->assertNotFound();
        $this->getJson("/api/superadmin/readiness/{$staff->id}")->assertNotFound();
    }

    public function test_removing_when_nothing_is_set_is_a_clear_error(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->superadmin());

        $this->deleteJson("/api/superadmin/readiness/{$student->id}", ['reason' => 'Nothing there'])->assertStatus(422);
    }

    public function test_every_change_is_audited_and_the_student_is_told(): void
    {
        $student = $this->student();

        $this->set($student, 65)->assertOk();

        $log = ActivityLog::where('target_type', 'Student readiness')->firstOrFail();
        $this->assertSame($student->id, $log->meta['user_id']);
        $this->assertSame(65, $log->meta['score']);
        $this->assertSame('College asked us to', $log->meta['reason']);

        $this->assertSame(1, UserNotification::where('user_id', $student->id)->where('title', 'like', '%readiness score is now 65%')->count());

        Sanctum::actingAs($this->superadmin());
        $history = $this->getJson("/api/superadmin/readiness/{$student->id}")->assertOk()->json('history');
        $this->assertCount(1, $history);
        $this->assertSame(65, $history[0]['score']);
    }



    public function test_the_manage_drawers_student_detail_says_when_the_score_was_set_by_hand(): void
    {
        $student = $this->student();
        Sanctum::actingAs($this->superadmin());

        $this->getJson("/api/superadmin/users/{$student->id}/detail")->assertOk()
            ->assertJsonPath('user.readiness_score', 0)
            ->assertJsonPath('user.readiness_overridden', false);

        $this->set($student, 66)->assertOk();

        $this->getJson("/api/superadmin/users/{$student->id}/detail")->assertOk()
            ->assertJsonPath('user.readiness_score', 66)
            ->assertJsonPath('user.readiness_overridden', true);
    }
}
