<?php

namespace Tests\Feature;

use App\Jobs\SendAccountCredentialsEmail;
use App\Mail\AccountCredentialsMail;
use App\Mail\PasswordResetOtpMail;
use App\Models\College;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\SingleMail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use ReflectionProperty;
use RuntimeException;
use Tests\TestCase;

/**
 * An email caused by ONE action for ONE recipient must reach the inbox on a
 * server where nobody runs `queue:work` (production uses the `database` queue,
 * where an un-worked job just sits in the jobs table). Only bulk fan-out may
 * depend on a worker.
 *
 * phpunit.xml sets QUEUE_CONNECTION=sync, which would hide exactly that
 * problem (everything runs inline), so these tests use Queue::fake(): the
 * fake queue captures anything pushed and runs none of it — the same as a
 * queue with no worker. An email can therefore only be "sent" here if the app
 * sent it itself.
 */
class SingleEmailWithoutQueueWorkerTest extends TestCase
{
    use RefreshDatabase;

    private function institutionPlan(): Plan
    {
        return Plan::create([
            'code' => 'standard',
            'name' => 'Standard',
            'audience' => Plan::AUDIENCE_INSTITUTION,
            'list_price' => null,
            'annual_price' => 149000,
            'duration_days' => 365,
            'is_active' => true,
            'sort_order' => 1,
            'drive_access' => true,
            'max_students' => 500,
        ]);
    }

    private function demoCollegePayload(): array
    {
        return [
            'name' => 'Demo University',
            'tier' => 'Standard',
            'tpo_name' => 'Demo TPO',
            'tpo_email' => 'demo.tpo@example.com',
            'is_demo' => true,
            'demo_days' => 14,
        ];
    }

    public function test_demo_college_tpo_receives_credentials_with_no_queue_worker(): void
    {
        $this->institutionPlan();
        Queue::fake();
        Mail::fake();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $response = $this->postJson('/api/admin/colleges', $this->demoCollegePayload());

        $response->assertStatus(201)->assertJsonPath('credentials_email_sent', true);

        // The email carries the very password the API returned, and went to the TPO.
        Mail::assertSent(AccountCredentialsMail::class, function (AccountCredentialsMail $mail) use ($response) {
            return $mail->hasTo('demo.tpo@example.com')
                && $mail->plainPassword === $response->json('temporary_password');
        });
        Mail::assertSent(AccountCredentialsMail::class, 1);

        // Nothing waiting on a worker, and the temp password never touched the jobs table.
        Queue::assertNothingPushed();
        $this->assertNotNull(User::where('email', 'demo.tpo@example.com')->value('credentials_email_sent_at'));
    }

    public function test_a_failed_send_does_not_fail_onboarding_and_tells_the_admin(): void
    {
        $this->institutionPlan();
        Queue::fake();
        Mail::shouldReceive('to')->once()->andThrow(new RuntimeException('SMTP server unreachable'));

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $response = $this->postJson('/api/admin/colleges', $this->demoCollegePayload());

        // The college and TPO exist and the password is still handed to the admin…
        $response->assertStatus(201)
            ->assertJsonPath('credentials_email_sent', false)
            ->assertJsonStructure(['temporary_password']);
        $this->assertDatabaseHas('users', ['email' => 'demo.tpo@example.com', 'role' => User::ROLE_ADMIN_TPO]);
        $this->assertNull(User::where('email', 'demo.tpo@example.com')->value('credentials_email_sent_at'));

        // …and the email is left on the queue so a worker, if one runs, retries it.
        Queue::assertPushed(SendAccountCredentialsEmail::class, 1);
    }

    public function test_adding_a_student_emails_their_login_after_the_response_with_no_queue_worker(): void
    {
        Queue::fake();
        Mail::fake();

        $plan = $this->institutionPlan();
        $college = College::create(['name' => 'Test College', 'short_code' => 'TC1', 'tier' => 'Standard']);
        Subscription::create([
            'subscriber_type' => College::class,
            'subscriber_id' => $college->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'started_at' => now()->subMonth(),
            'current_period_end' => now()->addYear(),
            'auto_renew' => false,
        ]);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]));
        $this->postJson('/api/tpo/students', ['name' => 'New Student', 'email' => 'new.student@example.com'])
            ->assertStatus(201);

        Mail::assertSent(AccountCredentialsMail::class, fn (AccountCredentialsMail $mail) => $mail->hasTo('new.student@example.com'));
        Queue::assertNothingPushed();
    }

    public function test_password_reset_code_is_emailed_with_no_queue_worker_and_unknown_emails_get_nothing(): void
    {
        Queue::fake();
        Mail::fake();
        $user = User::factory()->create(['email' => 'real.user@example.com']);

        $known = $this->postJson('/api/password/forgot', ['email' => 'real.user@example.com'])->assertOk();
        $unknown = $this->postJson('/api/password/forgot', ['email' => 'nobody@example.com'])->assertOk();

        // Same answer either way — the endpoint must not reveal which addresses exist.
        $this->assertSame($known->json(), $unknown->json());

        Mail::assertSent(PasswordResetOtpMail::class, 1);
        Mail::assertSent(PasswordResetOtpMail::class, fn (PasswordResetOtpMail $mail) => $mail->hasTo($user->email) && preg_match('/^\d{6}$/', $mail->code) === 1);
        Queue::assertNothingPushed();
    }

    public function test_after_response_holds_the_mail_until_the_response_is_out_then_sends_it_exactly_once(): void
    {
        Queue::fake();
        Mail::fake();
        $user = User::factory()->create();

        // PHPUnit runs in the CLI, where afterResponse() sends immediately (there is no
        // response to wait for). Pretend to be a web request to exercise the real path.
        (new ReflectionProperty($this->app, 'isRunningInConsole'))->setValue($this->app, false);

        SingleMail::afterResponse(new SendAccountCredentialsEmail($user->id, 'Temp-Pass-123'));
        Mail::assertNothingSent(); // the response hasn't gone out yet

        $this->app->terminate();
        Mail::assertSent(AccountCredentialsMail::class, 1);

        // Laravel never clears terminating callbacks; a second request on the same app
        // instance must not re-send the first request's mail.
        $this->app->terminate();
        Mail::assertSent(AccountCredentialsMail::class, 1);
        Queue::assertNothingPushed();
    }

    public function test_single_mail_is_not_throttled_by_the_bulk_rate_limit(): void
    {
        Queue::fake();
        Mail::fake();

        // Far more than the 60/minute `transactional-emails` ceiling a worker enforces on bulk jobs.
        $users = User::factory()->count(65)->create();
        foreach ($users as $user) {
            $this->assertTrue(SingleMail::now(new SendAccountCredentialsEmail($user->id, 'Temp-Pass-123')));
        }

        Mail::assertSent(AccountCredentialsMail::class, 65);
        Queue::assertNothingPushed();
    }
}
