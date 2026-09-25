<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Covers Section Coordinator management from both callers of
 * SectionCoordinatorService: the TPO's own self-service surface (regression
 * coverage for the refactor that extracted this logic out of
 * TpoCoordinatorController) and the new Ops/superadmin equivalent
 * (AdminController) that closes the "superadmin can't reach coordinator
 * accounts" gap — every one of these routes was previously admin_tpo-only
 * and 403'd both admin_internal and superadmin.
 */
class SectionCoordinatorManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_tpo_can_create_and_manage_a_coordinator_for_their_own_college(): void
    {
        $college = College::create(['name' => 'College One', 'short_code' => 'C1']);
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);

        Sanctum::actingAs($tpo);

        $create = $this->postJson('/api/tpo/coordinators', [
            'name' => 'Coordinator One',
            'email' => 'coord1@example.com',
            'section' => 'A',
        ]);
        $create->assertStatus(201);
        $coordinatorId = $create->json('coordinator.id');

        $this->assertDatabaseHas('users', [
            'id' => $coordinatorId,
            'role' => User::ROLE_SECTION_COORDINATOR,
            'college_id' => $college->id,
            'section' => 'A',
        ]);

        $update = $this->putJson("/api/tpo/coordinators/{$coordinatorId}", ['section' => 'B']);
        $update->assertStatus(200);
        $this->assertSame('B', $update->json('coordinator.section'));

        $toggle = $this->postJson("/api/tpo/coordinators/{$coordinatorId}/toggle-block");
        $toggle->assertStatus(200);
        $this->assertTrue($toggle->json('coordinator.is_blocked'));
    }

    public function test_duplicate_section_within_the_same_college_is_rejected(): void
    {
        $college = College::create(['name' => 'College Two', 'short_code' => 'C2']);
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
        User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $college->id, 'section' => 'A']);

        Sanctum::actingAs($tpo);

        $response = $this->postJson('/api/tpo/coordinators', [
            'name' => 'Duplicate Section',
            'email' => 'dup@example.com',
            'section' => 'A',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors('section');
    }

    public function test_a_tpo_cannot_manage_a_coordinator_from_another_college(): void
    {
        $ownCollege = College::create(['name' => 'Own College', 'short_code' => 'OC']);
        $otherCollege = College::create(['name' => 'Other College', 'short_code' => 'OTC']);
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $ownCollege->id]);
        $foreignCoordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $otherCollege->id, 'section' => 'A']);

        Sanctum::actingAs($tpo);

        $this->putJson("/api/tpo/coordinators/{$foreignCoordinator->id}", ['section' => 'B'])->assertStatus(404);
    }

    public function test_a_plain_admin_tpo_is_blocked_from_the_ops_coordinator_routes(): void
    {
        $college = College::create(['name' => 'College Three', 'short_code' => 'C3']);
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);

        Sanctum::actingAs($tpo);

        $this->getJson("/api/admin/colleges/{$college->id}/coordinators")->assertStatus(403);
    }

    public function test_superadmin_can_list_create_and_reassign_a_coordinator_for_any_college(): void
    {
        $college = College::create(['name' => 'College Four', 'short_code' => 'C4']);
        $superadmin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);

        Sanctum::actingAs($superadmin);

        $this->getJson("/api/admin/colleges/{$college->id}/coordinators")
            ->assertStatus(200)
            ->assertJson(['coordinators' => []]);

        $create = $this->postJson("/api/admin/colleges/{$college->id}/coordinators", [
            'name' => 'Ops-Provisioned Coordinator',
            'email' => 'ops-coord@example.com',
            'section' => 'A',
        ]);
        $create->assertStatus(201);
        $coordinatorId = $create->json('coordinator.id');

        $this->assertDatabaseHas('users', [
            'id' => $coordinatorId,
            'role' => User::ROLE_SECTION_COORDINATOR,
            'college_id' => $college->id,
        ]);

        $reassign = $this->putJson("/api/admin/coordinators/{$coordinatorId}", ['section' => 'C']);
        $reassign->assertStatus(200);
        $this->assertSame('C', $reassign->json('coordinator.section'));

        $toggle = $this->postJson("/api/admin/coordinators/{$coordinatorId}/toggle-block");
        $toggle->assertStatus(200);
        $this->assertTrue($toggle->json('coordinator.is_blocked'));

        $this->getJson("/api/admin/colleges/{$college->id}/coordinators")
            ->assertStatus(200)
            ->assertJsonCount(1, 'coordinators');
    }

    public function test_admin_internal_shares_the_same_ops_coordinator_reach_as_superadmin(): void
    {
        $college = College::create(['name' => 'College Five', 'short_code' => 'C5']);
        $ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_COLLEGES]]);

        Sanctum::actingAs($ops);

        $this->postJson("/api/admin/colleges/{$college->id}/coordinators", [
            'name' => 'Ops Coordinator',
            'email' => 'ops2@example.com',
            'section' => 'A',
        ])->assertStatus(201);
    }

    public function test_the_ops_toggle_block_route_rejects_a_non_coordinator_target(): void
    {
        $superadmin = User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
        $student = User::factory()->create(['role' => User::ROLE_USER]);

        Sanctum::actingAs($superadmin);

        $this->postJson("/api/admin/coordinators/{$student->id}/toggle-block")->assertStatus(422);
    }
}
