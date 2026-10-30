<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\ContactRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Superadmin -> Marketing Team: what each marketing employee is carrying, handing that work to someone else, deleting an employee
 * without dropping what a prospect asked for, and being told when an enquiry arrives with nobody to take it.
 */
class SuperadminMarketingTeamTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN, 'password' => Hash::make(self::PASSWORD)]);
    }

    private function marketer(string $name, array $extra = []): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING, 'name' => $name, 'permissions' => ['leads'], ...$extra]);
    }

    private function lead(User $owner, string $status = User::LEAD_STATUS_NEW): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'college_id' => null, 'assigned_marketing_id' => $owner->id, 'lead_status' => $status]);
    }

    private function enquiry(?User $owner, string $status = 'new'): ContactRequest
    {
        return ContactRequest::create([
            'name' => 'Priya', 'email' => 'p'.uniqid().'@college.test', 'audience' => ContactRequest::AUDIENCE_INSTITUTION,
            'organization_name' => 'Tulas', 'status' => $status, 'assigned_marketing_id' => $owner?->id,
        ]);
    }

    private function load(User $owner): array
    {
        return [
            User::where('assigned_marketing_id', $owner->id)->count(),
            ContactRequest::where('assigned_marketing_id', $owner->id)->count(),
        ];
    }

    public function test_the_team_lists_each_employee_with_what_they_carry_and_what_nobody_holds(): void
    {
        $asha = $this->marketer('Asha');
        $this->marketer('Ravi', ['is_blocked' => true]);
        $this->lead($asha);
        $this->lead($asha, User::LEAD_STATUS_CONVERTED);
        $this->enquiry($asha);
        $this->enquiry(null);
        $this->lead($asha)->forceFill(['assigned_marketing_id' => null])->save();

        Sanctum::actingAs($this->superadmin());
        $res = $this->getJson('/api/superadmin/marketing-team')->assertOk();

        $res->assertJsonPath('totals.employees', 2)->assertJsonPath('totals.active', 1)->assertJsonPath('totals.open_leads', 1)
            ->assertJsonPath('totals.open_enquiries', 1)->assertJsonPath('totals.unassigned_enquiries', 1)->assertJsonPath('totals.unassigned_leads', 1);

        $row = collect($res->json('employees'))->firstWhere('name', 'Asha');
        $this->assertSame(['open' => 1, 'converted' => 1, 'total' => 2], $row['leads']);
        $this->assertSame(['open' => 1, 'total' => 1], $row['enquiries']);
    }

    public function test_only_a_superadmin_can_see_or_change_the_team(): void
    {
        $asha = $this->marketer('Asha');

        foreach ([User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]), $this->marketer('Other'), User::factory()->create(['role' => User::ROLE_USER])] as $who) {
            Sanctum::actingAs($who);
            $this->getJson('/api/superadmin/marketing-team')->assertForbidden();
            $this->postJson("/api/superadmin/marketing-team/{$asha->id}/reassign", ['reassign_mode' => 'leave'])->assertForbidden();
            $this->deleteJson("/api/superadmin/marketing-team/{$asha->id}", [])->assertForbidden();
        }

        $this->assertDatabaseHas('users', ['id' => $asha->id]);
    }

    public function test_reassigning_to_a_colleague_moves_only_open_work_and_tells_them(): void
    {
        [$asha, $ravi] = [$this->marketer('Asha'), $this->marketer('Ravi')];
        $open = $this->lead($asha);
        $won = $this->lead($asha, User::LEAD_STATUS_CONVERTED);
        $this->enquiry($asha);
        $this->enquiry($asha, 'lost');

        Sanctum::actingAs($this->superadmin());
        $this->postJson("/api/superadmin/marketing-team/{$asha->id}/reassign", ['reassign_mode' => 'to', 'reassign_to' => $ravi->id])
            ->assertOk()->assertJsonPath('leads', 1)->assertJsonPath('enquiries', 1);

        $this->assertSame($ravi->id, $open->fresh()->assigned_marketing_id);
        $this->assertSame($asha->id, $won->fresh()->assigned_marketing_id, 'a won lead stays with the person who won it');
        $this->assertSame([1, 1], $this->load($asha));
        $this->assertSame([1, 1], $this->load($ravi));
        $this->assertDatabaseHas('user_notifications', ['user_id' => $ravi->id, 'type' => 'lead.new']);
        $this->assertTrue(ActivityLog::where('action', "Reassigned a marketing employee's work")->exists());
    }

    public function test_distributing_levels_the_work_across_every_active_colleague(): void
    {
        [$asha, $ravi, $meena] = [$this->marketer('Asha'), $this->marketer('Ravi'), $this->marketer('Meena')];
        $this->marketer('Blocked', ['is_blocked' => true]);
        foreach (range(1, 6) as $_) {
            $this->lead($asha);
        }
        $this->enquiry($asha);
        $this->enquiry($asha);
        $this->lead($ravi);

        Sanctum::actingAs($this->superadmin());
        $this->postJson("/api/superadmin/marketing-team/{$asha->id}/reassign", ['reassign_mode' => 'distribute'])->assertOk()->assertJsonPath('leads', 6);

        $this->assertSame(0, $this->load($asha)[0]);
        // Ravi already held 1, Meena 0: six more levels them at 4 and 3 - never all dumped on one person.
        $this->assertEqualsCanonicalizing([4, 3], [$this->load($ravi)[0], $this->load($meena)[0]]);
        $this->assertSame(0, User::where('assigned_marketing_id', User::where('name', 'Blocked')->value('id'))->count());
    }

    public function test_leaving_work_unassigned_and_the_refusals(): void
    {
        [$asha, $ravi] = [$this->marketer('Asha'), $this->marketer('Ravi', ['is_blocked' => true])];
        $this->lead($asha);

        Sanctum::actingAs($this->superadmin());
        // No other ACTIVE colleague: sharing it out has nobody to share with.
        $this->postJson("/api/superadmin/marketing-team/{$asha->id}/reassign", ['reassign_mode' => 'distribute'])->assertStatus(422)->assertJsonValidationErrors('reassign_mode');
        // A blocked colleague cannot be handed work, and neither can oneself.
        $this->postJson("/api/superadmin/marketing-team/{$asha->id}/reassign", ['reassign_mode' => 'to', 'reassign_to' => $ravi->id])->assertStatus(422)->assertJsonValidationErrors('reassign_to');
        $this->postJson("/api/superadmin/marketing-team/{$asha->id}/reassign", ['reassign_mode' => 'to', 'reassign_to' => $asha->id])->assertStatus(422);
        $this->assertSame(1, $this->load($asha)[0]);

        $this->postJson("/api/superadmin/marketing-team/{$asha->id}/reassign", ['reassign_mode' => 'leave'])->assertOk();
        $this->assertSame(0, $this->load($asha)[0]);

        // Only marketing employees are part of this team.
        $ops = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]);
        $this->postJson("/api/superadmin/marketing-team/{$ops->id}/reassign", ['reassign_mode' => 'leave'])->assertNotFound();
    }

    public function test_deleting_needs_the_superadmins_password_and_the_typed_email(): void
    {
        $asha = $this->marketer('Asha');
        Sanctum::actingAs($this->superadmin());
        $url = "/api/superadmin/marketing-team/{$asha->id}";

        $this->deleteJson($url, ['reassign_mode' => 'leave', 'confirm_email' => $asha->email, 'password' => 'wrong'])->assertStatus(422)->assertJsonValidationErrors('password');
        $this->deleteJson($url, ['reassign_mode' => 'leave', 'confirm_email' => 'someone@else.test', 'password' => self::PASSWORD])->assertStatus(422)->assertJsonValidationErrors('confirm_email');
        $this->deleteJson($url, ['password' => self::PASSWORD, 'confirm_email' => $asha->email])->assertStatus(422)->assertJsonValidationErrors('reassign_mode');

        $this->assertDatabaseHas('users', ['id' => $asha->id]);
    }

    public function test_deleting_hands_over_everything_then_removes_the_account_and_its_sessions(): void
    {
        [$asha, $ravi] = [$this->marketer('Asha'), $this->marketer('Ravi')];
        $open = $this->lead($asha);
        $won = $this->lead($asha, User::LEAD_STATUS_CONVERTED);
        $this->enquiry($asha);
        $asha->createToken('web');

        Sanctum::actingAs($this->superadmin());
        $this->deleteJson("/api/superadmin/marketing-team/{$asha->id}", ['reassign_mode' => 'to', 'reassign_to' => $ravi->id, 'confirm_email' => strtoupper($asha->email), 'password' => self::PASSWORD])
            ->assertOk()->assertJsonPath('deleted', true)->assertJsonPath('leads', 2)->assertJsonPath('enquiries', 1);

        $this->assertDatabaseMissing('users', ['id' => $asha->id]);
        $this->assertDatabaseMissing('personal_access_tokens', ['tokenable_id' => $asha->id, 'tokenable_type' => User::class]);
        $this->assertSame($ravi->id, $open->fresh()->assigned_marketing_id);
        $this->assertSame($ravi->id, $won->fresh()->assigned_marketing_id, 'closed work moves too: it would otherwise fall back into the unassigned pile');
        $this->assertSame(1, ContactRequest::where('assigned_marketing_id', $ravi->id)->count());
        $this->assertTrue(ActivityLog::where('action', 'Deleted a marketing employee')->exists());
    }

    public function test_a_delete_that_cannot_place_the_work_deletes_nothing(): void
    {
        $asha = $this->marketer('Asha');
        $lead = $this->lead($asha);

        Sanctum::actingAs($this->superadmin());
        $this->deleteJson("/api/superadmin/marketing-team/{$asha->id}", ['reassign_mode' => 'distribute', 'confirm_email' => $asha->email, 'password' => self::PASSWORD])->assertStatus(422);

        $this->assertDatabaseHas('users', ['id' => $asha->id]);
        $this->assertSame($asha->id, $lead->fresh()->assigned_marketing_id);

        // "Leave unassigned" is always possible, and the work simply waits for the next hire.
        $this->deleteJson("/api/superadmin/marketing-team/{$asha->id}", ['reassign_mode' => 'leave', 'confirm_email' => $asha->email, 'password' => self::PASSWORD])->assertOk();
        $this->assertNull($lead->fresh()->assigned_marketing_id);
    }

    public function test_an_enquiry_with_nobody_to_take_it_alerts_the_superadmins_once(): void
    {
        $admin = $this->superadmin();

        $this->postJson('/api/contact-requests', ['name' => 'Priya', 'email' => 'priya@tulas.test', 'audience' => 'institution', 'organization_name' => 'Tulas'])->assertCreated();

        $this->assertDatabaseHas('user_notifications', ['user_id' => $admin->id, 'type' => 'lead.new', 'title' => 'An enquiry has nobody to take it']);
        $this->assertSame(1, \DB::table('user_notifications')->where('user_id', $admin->id)->count());

        // Hiring someone sweeps it up without a second alert.
        Sanctum::actingAs($admin);
        $this->postJson('/api/superadmin/users', ['name' => 'Asha', 'email' => 'asha@mellow.test', 'role' => 'admin_marketing', 'permissions' => ['leads']])->assertCreated();
        $this->assertSame(1, ContactRequest::whereNotNull('assigned_marketing_id')->count());
        $this->assertSame(1, \DB::table('user_notifications')->where('user_id', $admin->id)->where('title', 'An enquiry has nobody to take it')->count());
    }

    public function test_no_alert_when_someone_can_take_it(): void
    {
        $admin = $this->superadmin();
        $this->marketer('Asha');

        $this->postJson('/api/contact-requests', ['name' => 'Priya', 'email' => 'priya@tulas.test', 'audience' => 'institution', 'organization_name' => 'Tulas'])->assertCreated();

        $this->assertDatabaseMissing('user_notifications', ['user_id' => $admin->id, 'title' => 'An enquiry has nobody to take it']);
        $this->assertSame(1, ContactRequest::whereNotNull('assigned_marketing_id')->count());
    }

    public function test_unblocking_an_employee_deals_out_what_piled_up(): void
    {
        $asha = $this->marketer('Asha', ['is_blocked' => true]);
        $waiting = $this->enquiry(null);

        Sanctum::actingAs($this->superadmin());
        $this->postJson("/api/superadmin/users/{$asha->id}/toggle-block")->assertOk()->assertJsonPath('user.is_blocked', false);

        $this->assertSame($asha->id, $waiting->fresh()->assigned_marketing_id);
    }
}
