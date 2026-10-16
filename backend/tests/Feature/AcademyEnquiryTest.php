<?php

namespace Tests\Feature;

use App\Models\ContactRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The Grandmaster card's "Contact our team": a student asking about Mellow Academy goes through the same public
 * "Talk to Our Team" pipeline as a college or an employer — no account is created, the marketing team gets it.
 */
class AcademyEnquiryTest extends TestCase
{
    use RefreshDatabase;

    private function enquiry(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Asha Rao',
            'email' => 'asha@example.com',
            'phone' => '9876543210',
            'audience' => 'academy',
            'organization_name' => 'Apex Institute of Technology',
            'message' => 'Interested in the MERN and Mobile programmes.',
        ], $overrides);
    }

    public function test_a_student_can_ask_about_mellow_academy_without_an_account(): void
    {
        $this->postJson('/api/contact-requests', $this->enquiry())
            ->assertCreated()
            ->assertJsonPath('message', "Thanks — we'll be in touch shortly.");

        $request = ContactRequest::sole();
        $this->assertSame(ContactRequest::AUDIENCE_ACADEMY, $request->audience);
        $this->assertSame('Mellow Academy', $request->audienceLabel());
        $this->assertSame('asha@example.com', $request->email);
        $this->assertDatabaseCount('users', 0);
    }

    public function test_the_other_audiences_still_work_and_are_labelled(): void
    {
        $this->postJson('/api/contact-requests', $this->enquiry(['audience' => 'institution']))->assertCreated();
        $this->postJson('/api/contact-requests', $this->enquiry(['audience' => 'company']))->assertCreated();

        $this->assertSame(['College / TPO', 'Employer'], ContactRequest::orderBy('id')->get()->map->audienceLabel()->all());
    }

    public function test_an_unknown_audience_is_refused(): void
    {
        $this->postJson('/api/contact-requests', $this->enquiry(['audience' => 'recruiter']))->assertStatus(422)->assertJsonValidationErrors('audience');
        $this->assertSame(0, ContactRequest::count());
    }

    public function test_the_basics_are_still_required(): void
    {
        $this->postJson('/api/contact-requests', ['audience' => 'academy'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['name', 'email', 'organization_name']);
    }
}
