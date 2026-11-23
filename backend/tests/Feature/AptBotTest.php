<?php

namespace Tests\Feature;

use App\Mail\SupportTicketMail;
use App\Models\AptBotFaq;
use App\Models\SupportTicket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AptBotTest extends TestCase
{
    public function test_aptbot_faqs_index_returns_categories_and_questions(): void
    {
        $response = $this->getJson('/api/aptbot/faqs');

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'categories' => [
                '*' => [
                    'key',
                    'label',
                    'icon',
                    'faqs' => [
                        '*' => [
                            'id',
                            'slug',
                            'question',
                            'answer',
                            'action_label',
                            'action_url',
                            'related_slugs',
                        ],
                    ],
                ],
            ],
        ]);
    }

    public function test_aptbot_submits_support_ticket_and_dispatches_email(): void
    {
        Mail::fake();

        $payload = [
            'name' => 'Kunal Sharma',
            'email' => 'kunal@example.com',
            'category' => 'troubleshooting',
            'subject' => 'Microphone not recording speech in interview',
            'message' => 'Whenever I speak during the interview, the speech bars do not move at all and it shows silence.',
            'metadata' => [
                'current_url' => 'https://aptrun.com/dashboard/interviews',
            ],
        ];

        $response = $this->postJson('/api/aptbot/support-ticket', $payload);

        $response->assertStatus(201);
        $response->assertJson([
            'success' => true,
        ]);

        $ticket = SupportTicket::where('email', 'kunal@example.com')->first();
        $this->assertNotNull($ticket);
        $this->assertStringStartsWith('APT-', $ticket->ticket_number);
        $this->assertEquals('troubleshooting', $ticket->category);

        Mail::assertSent(SupportTicketMail::class, function ($mail) use ($ticket) {
            return $mail->hasTo('support@mellowvault.com') &&
                   $mail->ticket->id === $ticket->id;
        });
    }

    public function test_aptbot_support_ticket_validates_required_fields(): void
    {
        $response = $this->postJson('/api/aptbot/support-ticket', []);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['message']);
    }

    public function test_aptbot_support_ticket_can_be_submitted_with_only_message(): void
    {
        Mail::fake();

        $response = $this->postJson('/api/aptbot/support-ticket', [
            'message' => 'I need assistance regarding my score evaluation.',
        ]);

        $response->assertStatus(201);
        $response->assertJson(['success' => true]);

        $this->assertDatabaseHas('support_tickets', [
            'message' => 'I need assistance regarding my score evaluation.',
        ]);
    }
}
