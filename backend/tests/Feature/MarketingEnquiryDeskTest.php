<?php

namespace Tests\Feature;

use App\Mail\ContactRequestConfirmationMail;
use App\Mail\ContactRequestNotificationMail;
use App\Models\ContactRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * "Talk to Our Team" end to end, from the marketing employee's side: an enquiry reaches the employee by e-mail and on their desk, a copy
 * reaches the team's shared inbox (assigned or not), an enquiry nobody could take is visible and claimable, and the employee can search,
 * filter and see what is overdue — without ever seeing a colleague's book.
 */
class MarketingEnquiryDeskTest extends TestCase
{
    use RefreshDatabase;

    private function employee(string $email = 'maya@aptrun.test', array $extra = []): User
    {
        return User::factory()->create(array_merge([
            'role' => User::ROLE_ADMIN_MARKETING, 'email' => $email, 'permissions' => [User::PERM_LEADS, User::PERM_LEAD_OUTREACH],
        ], $extra));
    }

    private function submit(array $overrides = []): void
    {
        $this->postJson('/api/contact-requests', array_merge([
            'name' => 'Asha Rao', 'email' => 'asha@college.edu', 'phone' => '9876543210', 'audience' => 'institution',
            'organization_name' => 'Apex Institute', 'message' => 'We would like a demo for our placement cell.',
        ], $overrides))->assertCreated();
    }

    // ------------------------------------------------------------------------------- the e-mails

    public function test_an_enquiry_mails_the_employee_it_is_assigned_to_and_replying_answers_the_enquirer(): void
    {
        Mail::fake();
        $maya = $this->employee();

        $this->submit();

        Mail::assertSent(ContactRequestNotificationMail::class, function (ContactRequestNotificationMail $m) use ($maya) {
            $this->assertTrue($m->hasTo($maya->email));
            $m->render(); // builds it (Reply-To is set while the mail is built)
            $this->assertTrue($m->hasReplyTo('asha@college.edu'), 'Reply goes to the enquirer, not to our own address');
            $this->assertFalse($m->forTeam);

            return true;
        });
        Mail::assertSent(ContactRequestConfirmationMail::class, fn ($m) => $m->hasTo('asha@college.edu'));
        $this->assertSame($maya->id, ContactRequest::sole()->assigned_marketing_id);
    }

    public function test_the_team_inbox_gets_a_copy_of_every_enquiry_assigned_or_not(): void
    {
        Mail::fake();
        config(['brand.enquiry_email' => 'marketing@aptrun.test']);

        // Nobody is hired yet: the employee mail cannot go, the team copy still does and says so.
        $this->submit(['organization_name' => 'First College']);
        Mail::assertSent(ContactRequestNotificationMail::class, function (ContactRequestNotificationMail $m) {
            $this->assertTrue($m->hasTo('marketing@aptrun.test'));
            $this->assertTrue($m->forTeam);
            $html = $m->render();
            $this->assertTrue($m->hasReplyTo('asha@college.edu'));
            $this->assertStringContainsString('waiting in the unassigned queue', $html);

            return true;
        });
        Mail::assertSentCount(2); // the team copy + the confirmation to the enquirer

        // Once someone is hired both hear of the next one.
        $maya = $this->employee();
        $this->submit(['organization_name' => 'Second College']);
        Mail::assertSent(ContactRequestNotificationMail::class, fn ($m) => $m->hasTo($maya->email) && ! $m->forTeam);
        Mail::assertSent(ContactRequestNotificationMail::class, fn ($m) => $m->hasTo('marketing@aptrun.test') && $m->forTeam && str_contains($m->render(), 'assigned to '.$maya->name));
    }

    public function test_no_inbox_configured_means_no_copy_and_the_same_address_is_not_mailed_twice(): void
    {
        Mail::fake();
        $maya = $this->employee();

        $this->submit();
        Mail::assertSent(ContactRequestNotificationMail::class, 1);

        config(['brand.enquiry_email' => $maya->email]);
        $this->submit(['organization_name' => 'Other']);
        Mail::assertSent(ContactRequestNotificationMail::class, 2); // one more, not two
    }

    // ------------------------------------------------------------------------------- the desk

    public function test_the_employee_sees_their_own_enquiries_and_the_unassigned_queue_but_not_a_colleagues(): void
    {
        $maya = $this->employee();
        $ravi = $this->employee('ravi@aptrun.test');

        $mine = ContactRequest::create(['name' => 'Mine', 'email' => 'a@x.edu', 'audience' => 'institution', 'organization_name' => 'A College', 'assigned_marketing_id' => $maya->id]);
        $theirs = ContactRequest::create(['name' => 'Theirs', 'email' => 'b@x.edu', 'audience' => 'company', 'organization_name' => 'B Corp', 'assigned_marketing_id' => $ravi->id]);
        $waiting = ContactRequest::create(['name' => 'Waiting', 'email' => 'c@x.edu', 'audience' => 'academy', 'organization_name' => 'C Institute']);

        Sanctum::actingAs($maya);

        $this->getJson('/api/marketing/contact-requests')->assertOk()
            ->assertJsonPath('scope', 'mine')
            ->assertJsonCount(1, 'requests.data')
            ->assertJsonPath('requests.data.0.name', 'Mine')
            ->assertJsonPath('kpis.unassigned', 1);

        $this->getJson('/api/marketing/contact-requests?scope=unassigned')->assertOk()->assertJsonCount(1, 'requests.data')->assertJsonPath('requests.data.0.name', 'Waiting');
        $this->getJson('/api/marketing/contact-requests?scope=all')->assertForbidden();

        $this->getJson("/api/marketing/contact-requests/{$theirs->id}")->assertNotFound();
        $this->getJson("/api/marketing/contact-requests/{$waiting->id}")->assertOk()->assertJsonPath('request.can_edit', false);
        $this->getJson("/api/marketing/contact-requests/{$mine->id}")->assertOk()->assertJsonPath('request.can_edit', true);
    }

    public function test_an_unassigned_enquiry_must_be_claimed_before_it_can_be_worked_and_only_one_person_wins(): void
    {
        $maya = $this->employee();
        $ravi = $this->employee('ravi@aptrun.test');
        $waiting = ContactRequest::create(['name' => 'Waiting', 'email' => 'c@x.edu', 'audience' => 'institution', 'organization_name' => 'C Institute']);

        Sanctum::actingAs($maya);
        $this->postJson("/api/marketing/contact-requests/{$waiting->id}/status", ['status' => 'contacted'])->assertNotFound();
        $this->postJson("/api/marketing/contact-requests/{$waiting->id}/notes", ['note' => 'Called.'])->assertNotFound();

        $this->postJson("/api/marketing/contact-requests/{$waiting->id}/claim")->assertOk()->assertJsonPath('claimed', true);
        $this->assertSame($maya->id, $waiting->fresh()->assigned_marketing_id);
        $this->postJson("/api/marketing/contact-requests/{$waiting->id}/status", ['status' => 'contacted'])->assertOk();
        $this->postJson("/api/marketing/contact-requests/{$waiting->id}/notes", ['note' => 'Called, demo on Friday.'])->assertCreated();

        Sanctum::actingAs($ravi);
        $this->postJson("/api/marketing/contact-requests/{$waiting->id}/claim")->assertStatus(409);
        $this->assertSame($maya->id, $waiting->fresh()->assigned_marketing_id, 'a taken enquiry is never stolen');
    }

    public function test_a_blocked_employee_cannot_claim_and_the_superadmin_does_not_claim(): void
    {
        $blocked = $this->employee('blocked@aptrun.test');
        $blocked->forceFill(['is_blocked' => true])->save();
        $waiting = ContactRequest::create(['name' => 'Waiting', 'email' => 'c@x.edu', 'audience' => 'institution', 'organization_name' => 'C Institute']);

        Sanctum::actingAs($blocked);
        $this->postJson("/api/marketing/contact-requests/{$waiting->id}/claim")->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $this->postJson("/api/marketing/contact-requests/{$waiting->id}/claim")->assertForbidden();
        $this->assertNull($waiting->fresh()->assigned_marketing_id);
    }

    public function test_search_status_and_the_overdue_count(): void
    {
        $maya = $this->employee();
        $mk = fn (array $a) => ContactRequest::create($a + ['audience' => 'institution', 'assigned_marketing_id' => $maya->id]);

        $old = $mk(['name' => 'Old New', 'email' => 'old@x.edu', 'organization_name' => 'Zeta University']);
        $old->forceFill(['created_at' => now()->subHours(30)])->save();
        $mk(['name' => 'Fresh New', 'email' => 'fresh@x.edu', 'organization_name' => 'Alpha College']);
        $mk(['name' => 'Done Deal', 'email' => 'done@x.edu', 'organization_name' => 'Beta Institute', 'status' => 'converted'])->forceFill(['created_at' => now()->subDays(9)])->save();

        Sanctum::actingAs($maya);

        $res = $this->getJson('/api/marketing/contact-requests')->assertOk();
        $res->assertJsonPath('kpis.total', 3)->assertJsonPath('kpis.awaiting_first_contact', 2)->assertJsonPath('kpis.overdue', 1)->assertJsonPath('kpis.by_status.converted', 1);

        $this->getJson('/api/marketing/contact-requests?search=zeta')->assertOk()->assertJsonCount(1, 'requests.data')->assertJsonPath('requests.data.0.name', 'Old New');
        $this->getJson('/api/marketing/contact-requests?search=done@x')->assertOk()->assertJsonCount(1, 'requests.data');
        $this->getJson('/api/marketing/contact-requests?status=converted')->assertOk()->assertJsonCount(1, 'requests.data')->assertJsonPath('requests.data.0.name', 'Done Deal');
        $this->getJson('/api/marketing/contact-requests?status=bogus')->assertStatus(422);
        // wildcard characters in a search are text, not patterns
        $this->getJson('/api/marketing/contact-requests?search=%25')->assertOk()->assertJsonCount(0, 'requests.data');
    }

    public function test_a_new_enquiry_rings_the_employees_bell_with_a_link_to_the_desk(): void
    {
        Mail::fake();
        $maya = $this->employee();

        $this->submit();

        $this->assertDatabaseHas('user_notifications', ['user_id' => $maya->id, 'title' => 'New enquiry assigned to you']);
        $this->assertDatabaseHas('user_notifications', ['user_id' => $maya->id, 'url' => '/marketing/inquiries']);
    }
}
