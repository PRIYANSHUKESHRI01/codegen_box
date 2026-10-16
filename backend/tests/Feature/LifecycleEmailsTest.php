<?php

namespace Tests\Feature;

use App\Enums\LifecycleEmail;
use App\Jobs\SendLifecycleEmail;
use App\Mail\LifecycleMail;
use App\Models\College;
use App\Models\LifecycleEmailLog;
use App\Models\PasswordResetOtp;
use App\Models\PaymentOrder;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Models\VaultProfile;
use App\Services\Payments\CheckoutService;
use App\Services\Payments\GatewayPayment;
use App\Services\Payments\GatewayRefund;
use App\Services\PasswordResetService;
use App\Services\ReadinessScoreService;
use App\Services\SubscriptionService;
use App\Services\Vault\VaultService;
use App\Support\SingleMail;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\URL;
use Laravel\Sanctum\Sanctum;
use Mockery;
use RuntimeException;
use Tests\Concerns\FakesRazorpay;
use Tests\TestCase;

/**
 * The lifecycle e-mails (App\Enums\LifecycleEmail): the ones that go out because something just happened
 * (password changed, payment failed, refund, plan given / extended / ended / expired, Vault status) and the ones
 * that are DUE (plan ending, "close to the Vault", Vault-upgrade reminders, buy-a-plan nudges, win-backs).
 *
 * Queue::fake() runs none of the queue — the same as a production server where nobody started `queue:work` — so
 * every message here can only arrive if the app sent it itself. That is the property that matters most.
 */
class LifecycleEmailsTest extends TestCase
{
    use FakesRazorpay;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seed(PlanSeeder::class);
        $this->setUpRazorpay();
        config(['lifecycle_mail.engagement_enabled' => true]);
    }

    // ───────────────────────────── helpers ─────────────────────────────

    private function student(array $attributes = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER] + $attributes);
    }

    private function admin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    /** How many lifecycle mails of this kind went to this student (or to anyone). */
    private function mails(LifecycleEmail $type, ?User $to = null): int
    {
        return Mail::sent(LifecycleMail::class, fn (LifecycleMail $m) => $m->type === $type && ($to === null || $m->hasTo($to->email)))->count();
    }

    private function lastMail(LifecycleEmail $type, User $to): LifecycleMail
    {
        return Mail::sent(LifecycleMail::class, fn (LifecycleMail $m) => $m->type === $type && $m->hasTo($to->email))->last();
    }

    private function grantExpert(User $student, int $days): Subscription
    {
        return app(SubscriptionService::class)->grantIndividualPlan(
            $student,
            Plan::where('code', Plan::CODE_EXPERT)->firstOrFail(),
            $this->admin(),
            ['days' => $days, 'kind' => 'complimentary', 'reason' => 'test']
        );
    }

    private function order(User $student, array $overrides = []): PaymentOrder
    {
        return PaymentOrder::create($overrides + [
            'user_id' => $student->id,
            'payer_name' => $student->name,
            'payer_email' => $student->email,
            'gateway' => PaymentOrder::GATEWAY_RAZORPAY,
            'gateway_order_id' => 'order_'.uniqid(),
            'status' => PaymentOrder::STATUS_CREATED,
            'amount_paise' => 299900,
            'plan_code' => 'expert',
            'cart' => ['plan' => 'expert', 'addons' => []],
            'quote' => ['lines' => [['name' => 'Expert', 'list_price' => 4999, 'duration_days' => 365]], 'discount' => 2000, 'total' => 2999],
        ]);
    }

    /** ReadinessScoreService answering with fixed scores, so the sweeps are tested on their rules, not on scoring. */
    private function scores(array $byUserId, array $steps = ['Take another AI mock interview.']): void
    {
        $this->mock(ReadinessScoreService::class, function ($mock) use ($byUserId, $steps) {
            $mock->shouldReceive('compute')->andReturnUsing(function ($students) use ($byUserId, $steps) {
                $out = [];

                foreach ($students as $s) {
                    $out[$s->id] = ['breakdown' => ['score' => $byUserId[$s->id] ?? 0, 'next_steps' => $steps], 'practice_score' => 0];
                }

                return $out;
            });
        });
    }

    private function paymentsAvailable(bool $available = true): void
    {
        $this->partialMock(CheckoutService::class, fn ($m) => $m->shouldReceive('isAvailable')->andReturn($available));
    }

    private function breakdown(int $score): array
    {
        return ['score' => $score, 'tier' => 'In Progress', 'components' => [], 'next_steps' => ['Take another AI mock interview.']];
    }

    // ───────────────────────────── security & money ─────────────────────────────

    public function test_changing_your_password_in_settings_emails_a_security_notice_with_no_queue_worker(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);

        $this->putJson('/api/me/password', ['current_password' => 'password', 'password' => 'a-new-password', 'password_confirmation' => 'a-new-password'])->assertOk();

        $this->assertSame(1, $this->mails(LifecycleEmail::PasswordChanged, $student));
        $this->assertSame('settings', $this->lastMail(LifecycleEmail::PasswordChanged, $student)->data['via']);
        Queue::assertNothingPushed();
    }

    public function test_resetting_a_forgotten_password_emails_the_notice_too(): void
    {
        $student = $this->student();
        PasswordResetOtp::create([
            'user_id' => $student->id,
            'code_hash' => Hash::make('123456'),
            'reset_token_hash' => Hash::make('the-token'),
            'expires_at' => now()->addMinutes(10),
        ]);

        app(PasswordResetService::class)->resetPassword($student, 'the-token', 'a-brand-new-password');

        $this->assertSame('reset', $this->lastMail(LifecycleEmail::PasswordChanged, $student)->data['via']);
    }

    private function resetPasswordOf(User $user): void
    {
        PasswordResetOtp::where('user_id', $user->id)->delete();
        PasswordResetOtp::create([
            'user_id' => $user->id,
            'code_hash' => Hash::make('123456'),
            'reset_token_hash' => Hash::make('the-token'),
            'expires_at' => now()->addMinutes(10),
        ]);

        app(PasswordResetService::class)->resetPassword($user->fresh(), 'the-token', 'a-brand-new-password');
    }

    public function test_signing_up_sends_the_welcome_email_with_no_queue_worker(): void
    {
        $this->postJson('/api/register', ['name' => 'Asha Rao', 'email' => 'asha@example.com', 'handle' => 'asha_rao', 'password' => 'a-good-password', 'password_confirmation' => 'a-good-password'])->assertCreated();

        Mail::assertSent(\App\Mail\WelcomeMail::class, fn ($m) => $m->hasTo('asha@example.com'));
        Queue::assertNothingPushed();
    }

    public function test_a_student_a_college_added_is_welcomed_when_they_first_set_their_own_password(): void
    {
        $college = College::create(['name' => 'APEX Institute', 'short_code' => 'APX', 'tier' => 'Standard']);
        $student = $this->student(['college_id' => $college->id, 'must_change_password' => true]);

        $this->resetPasswordOf($student);

        $this->assertSame(1, $this->mails(LifecycleEmail::WelcomeActivated, $student));
        $this->assertSame(0, $this->mails(LifecycleEmail::PasswordChanged, $student), 'the welcome replaces the security notice');
        $mail = $this->lastMail(LifecycleEmail::WelcomeActivated, $student);
        $this->assertStringContainsString('APEX Institute', implode(' ', $mail->content['paragraphs']));
        $this->assertFalse($student->fresh()->must_change_password);
        Queue::assertNothingPushed();
    }

    public function test_a_section_coordinator_a_tpo_added_gets_the_credentials_then_a_welcome_naming_their_section_and_college(): void
    {
        $college = College::create(['name' => 'XYZ University', 'short_code' => 'XYZ', 'tier' => 'Standard']);
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
        $coordinator = app(\App\Services\SectionCoordinatorService::class)->create($college->id, ['name' => 'Ravi Menon', 'email' => 'ravi@xyz.edu', 'section' => 'CSE-B', 'phone' => null], $tpo);

        // 1. the credentials e-mail, sent with the request itself
        Mail::assertSent(\App\Mail\AccountCredentialsMail::class, fn ($m) => $m->hasTo('ravi@xyz.edu'));
        Queue::assertNothingPushed();
        $this->assertSame(0, $this->mails(LifecycleEmail::WelcomeActivated));

        // 2. they set their own password through the reset-code flow
        $this->resetPasswordOf($coordinator);

        $this->assertSame(1, $this->mails(LifecycleEmail::WelcomeActivated, $coordinator));
        $this->assertSame(0, $this->mails(LifecycleEmail::PasswordChanged, $coordinator));
        $mail = $this->lastMail(LifecycleEmail::WelcomeActivated, $coordinator);
        $this->assertSame('Welcome to AptRun — Section Coordinator for Section CSE-B at XYZ University', $mail->content['subject']);
        $this->assertStringContainsString('/coordinator', $mail->content['cta']['url']);
        $this->assertStringNotContainsString('Practice Arena', implode(' ', $mail->content['list']), 'a coordinator is not told to go solve problems');
    }

    /** @return array<string, array{0: string, 1: array<string, mixed>, 2: string, 3: string}> role => [role, attributes, subject, cta fragment] */
    public static function staffRoles(): array
    {
        return [
            'TPO' => [User::ROLE_ADMIN_TPO, [], 'Welcome to AptRun — Training & Placement Officer at XYZ University', '/admin?view=tpo'],
            'company hiring team' => [User::ROLE_ADMIN_COMPANY, [], 'Welcome to AptRun — Hiring Team member at Acme Technologies', '/admin?view=company'],
            'Mellow internal staff' => [User::ROLE_ADMIN_INTERNAL, ['permissions' => [User::PERM_CONTESTS, User::PERM_VAULT]], 'Welcome to AptRun — Internal team member at Mellow', '/admin?view=mellow'],
            'Mellow marketing' => [User::ROLE_ADMIN_MARKETING, ['permissions' => [User::PERM_LEADS]], 'Welcome to AptRun — Marketing team member at Mellow', '/marketing'],
        ];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('staffRoles')]
    public function test_every_staff_role_is_welcomed_when_it_first_sets_its_own_password(string $role, array $attributes, string $subject, string $cta): void
    {
        $college = College::create(['name' => 'XYZ University', 'short_code' => 'XYZ', 'tier' => 'Standard']);
        $company = \App\Models\Company::create(['name' => 'Acme Technologies', 'slug' => 'acme-'.uniqid()]);
        $user = User::factory()->create([
            'role' => $role,
            'must_change_password' => true,
            'college_id' => $role === User::ROLE_ADMIN_TPO ? $college->id : null,
            'company_id' => $role === User::ROLE_ADMIN_COMPANY ? $company->id : null,
        ] + $attributes);

        $this->resetPasswordOf($user);

        $this->assertSame(1, $this->mails(LifecycleEmail::WelcomeActivated, $user));
        $this->assertSame(0, $this->mails(LifecycleEmail::PasswordChanged, $user));
        $mail = $this->lastMail(LifecycleEmail::WelcomeActivated, $user);
        $this->assertSame($subject, $mail->content['subject']);
        $this->assertStringContainsString($cta, $mail->content['cta']['url']);
        $this->assertStringContainsString('</html>', $mail->render());
        Queue::assertNothingPushed();
    }

    public function test_staff_are_told_only_about_the_areas_their_permissions_open(): void
    {
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'must_change_password' => true, 'permissions' => [User::PERM_CONTESTS, User::PERM_VAULT]]);
        $none = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'must_change_password' => true, 'permissions' => []]);

        $this->resetPasswordOf($staff);
        $this->resetPasswordOf($none);

        $this->assertSame(['Contests', 'The Vault'], $this->lastMail(LifecycleEmail::WelcomeActivated, $staff)->content['list']);
        $this->assertStringContainsString('has not switched any areas on', $this->lastMail(LifecycleEmail::WelcomeActivated, $none)->content['list'][0]);
    }

    public function test_a_superadmin_is_never_sent_the_welcome(): void
    {
        $superadmin = $this->admin();
        $superadmin->forceFill(['must_change_password' => true])->save();

        $this->resetPasswordOf($superadmin);

        $this->assertSame(0, $this->mails(LifecycleEmail::WelcomeActivated));
        $this->assertSame(1, $this->mails(LifecycleEmail::PasswordChanged, $superadmin), 'they still get the security notice');
    }

    public function test_the_credentials_email_for_a_marketing_account_does_not_read_like_a_students(): void
    {
        $marketing = User::factory()->create(['role' => User::ROLE_ADMIN_MARKETING]);

        $html = (new \App\Mail\AccountCredentialsMail($marketing, 'Temp-pass-123'))->render();

        $this->assertStringContainsString('marketing team account', $html);
        $this->assertStringNotContainsString('start practicing', $html);
    }

    public function test_the_welcome_is_sent_once_ever_and_an_ordinary_reset_gets_the_security_notice(): void
    {
        $student = $this->student(['must_change_password' => true]);
        $this->resetPasswordOf($student);

        // A superadmin later issues a temporary password; the student resets again.
        $student->forceFill(['must_change_password' => true])->save();
        $this->resetPasswordOf($student);
        $this->assertSame(1, $this->mails(LifecycleEmail::WelcomeActivated, $student));
        $this->assertSame(1, $this->mails(LifecycleEmail::PasswordChanged, $student));

        // A student who chose their own password at sign-up is never "welcomed" by a reset.
        $selfRegistered = $this->student(['must_change_password' => false]);
        $this->resetPasswordOf($selfRegistered);
        $this->assertSame(0, $this->mails(LifecycleEmail::WelcomeActivated, $selfRegistered));
        $this->assertSame(1, $this->mails(LifecycleEmail::PasswordChanged, $selfRegistered));
    }

    public function test_a_failed_payment_emails_the_student_once_per_order_however_often_they_retry(): void
    {
        $student = $this->student();
        $order = $this->order($student);
        $checkout = app(CheckoutService::class);

        $checkout->recordFailure($order, new GatewayPayment('pay_1', $order->gateway_order_id, GatewayPayment::FAILED, 299900, 'INR', 'upi', null, null, 'BAD_REQUEST', 'Your card was declined.'));
        $checkout->recordFailure($order->fresh(), new GatewayPayment('pay_2', $order->gateway_order_id, GatewayPayment::FAILED, 299900, 'INR', 'upi', null, null, 'BAD_REQUEST', 'UPI timed out.'));
        // The very same failed payment reported again (a webhook re-delivery) changes nothing.
        $checkout->recordFailure($order->fresh(), new GatewayPayment('pay_2', $order->gateway_order_id, GatewayPayment::FAILED, 299900, 'INR', 'upi'));

        $this->assertSame(1, $this->mails(LifecycleEmail::PaymentFailed, $student));
        $mail = $this->lastMail(LifecycleEmail::PaymentFailed, $student);
        $this->assertStringContainsString('Your card was declined.', implode(' ', $mail->content['paragraphs']));
        $this->assertSame('₹2,999', $mail->content['facts']['Amount']);
        $this->assertStringContainsString('/dashboard/billing', $mail->content['cta']['url']);
    }

    public function test_a_refund_emails_the_student_once_per_refund_and_says_whether_the_plan_ended(): void
    {
        $student = $this->student();
        $paid = $this->order($student, ['status' => PaymentOrder::STATUS_PAID, 'gateway_payment_id' => 'pay_ok', 'fulfilled_at' => now()]);
        $checkout = app(CheckoutService::class);

        $checkout->applyRefund($paid, new GatewayRefund('rfnd_part', 50000, 'goodwill'));
        $checkout->applyRefund($paid->fresh(), new GatewayRefund('rfnd_part', 50000, 'goodwill'));   // the same event again
        $checkout->applyRefund($paid->fresh(), new GatewayRefund('rfnd_rest', 249900, 'rest'));

        $this->assertSame(2, $this->mails(LifecycleEmail::RefundProcessed, $student), 'one per refund id, not per delivery');
        $mails = Mail::sent(LifecycleMail::class, fn (LifecycleMail $m) => $m->type === LifecycleEmail::RefundProcessed);
        $this->assertFalse($mails->first()->data['full']);
        $this->assertSame(500, $mails->first()->data['amount']);
        $this->assertTrue($mails->last()->data['full']);
        $this->assertStringContainsString('has ended', implode(' ', $mails->last()->content['paragraphs']));
    }

    // ───────────────────────────── plans given, extended, ended, expired ─────────────────────────────

    public function test_giving_extending_and_ending_a_plan_each_email_the_student(): void
    {
        $student = $this->student();

        $subscription = $this->grantExpert($student, 30);
        $this->assertSame(1, $this->mails(LifecycleEmail::PlanGranted, $student));
        $granted = $this->lastMail(LifecycleEmail::PlanGranted, $student);
        $this->assertSame(30, $granted->data['days']);
        $this->assertTrue($granted->data['complimentary']);
        $this->assertContains('Vault listing — be found by hiring partners and Mellow Vault employers', $granted->content['list'], 'the perks come from the plan row');

        app(SubscriptionService::class)->extend($subscription, 10, $this->admin(), 'goodwill');
        $this->assertSame(1, $this->mails(LifecycleEmail::PlanExtended, $student));
        $this->assertSame(10, $this->lastMail(LifecycleEmail::PlanExtended, $student)->data['days']);

        app(SubscriptionService::class)->cancel($subscription->fresh(), $this->admin(), 'internal reason that must not leak');
        $this->assertSame(1, $this->mails(LifecycleEmail::PlanEnded, $student));
        $this->assertStringNotContainsString('internal reason', json_encode($this->lastMail(LifecycleEmail::PlanEnded, $student)->content));
    }

    public function test_a_college_plan_being_extended_emails_no_student(): void
    {
        $college = College::create(['name' => 'Test College', 'short_code' => 'TC1', 'tier' => 'Standard']);
        $plan = Plan::where('audience', Plan::AUDIENCE_INSTITUTION)->first() ?? Plan::create([
            'code' => 'standard', 'name' => 'Standard', 'audience' => Plan::AUDIENCE_INSTITUTION, 'annual_price' => 100000,
            'duration_days' => 365, 'is_active' => true, 'sort_order' => 9, 'drive_access' => true, 'max_students' => 100,
        ]);
        $subscription = app(SubscriptionService::class)->assignInstitutionPlan($college, $plan, $this->admin());

        app(SubscriptionService::class)->extend($subscription, 30, $this->admin(), 'renewal');

        Mail::assertNotSent(LifecycleMail::class);
    }

    public function test_an_expired_plan_is_announced_once_and_only_if_it_ended_recently(): void
    {
        $recent = $this->student();
        $old = $this->student();
        $this->grantExpert($recent, 5)->forceFill(['current_period_end' => now()->subDay()])->save();
        $this->grantExpert($old, 5)->forceFill(['current_period_end' => now()->subDays(40)])->save();
        Mail::fake();

        $this->artisan('subscriptions:expire')->assertSuccessful();
        $this->artisan('subscriptions:expire')->assertSuccessful();

        $this->assertSame(1, $this->mails(LifecycleEmail::PlanExpired, $recent));
        $this->assertSame(0, $this->mails(LifecycleEmail::PlanExpired, $old), 'a plan that lapsed long ago is not news');
        $this->assertTrue($this->lastMail(LifecycleEmail::PlanExpired, $recent)->data['had_vault']);
    }

    public function test_a_plan_about_to_end_is_reminded_at_seven_days_and_at_one_each_once(): void
    {
        $student = $this->student();
        $free = $this->student();
        $this->grantExpert($student, 7);
        Mail::fake();

        $this->artisan('lifecycle:send')->assertSuccessful();
        $this->artisan('lifecycle:send')->assertSuccessful();   // the same day again
        $this->assertSame(1, $this->mails(LifecycleEmail::PlanExpiring, $student));
        $this->assertSame(7, $this->lastMail(LifecycleEmail::PlanExpiring, $student)->data['days_left']);

        $this->travel(3)->days();
        $this->artisan('lifecycle:send')->assertSuccessful();
        $this->assertSame(1, $this->mails(LifecycleEmail::PlanExpiring, $student), 'nothing new between the two reminders');

        $this->travel(3)->days();   // one day left
        $this->artisan('lifecycle:send')->assertSuccessful();
        $this->assertSame(2, $this->mails(LifecycleEmail::PlanExpiring, $student));
        $this->assertSame(0, $this->mails(LifecycleEmail::PlanExpiring, $free), 'the free plan never ends');
    }

    public function test_extending_a_plan_after_a_reminder_earns_a_fresh_reminder_for_the_new_end(): void
    {
        $student = $this->student();
        $subscription = $this->grantExpert($student, 6);
        Mail::fake();
        $this->artisan('lifecycle:send')->assertSuccessful();
        $this->assertSame(1, $this->mails(LifecycleEmail::PlanExpiring, $student));

        app(SubscriptionService::class)->extend($subscription, 20, $this->admin(), 'goodwill');
        $this->travel(21)->days();   // inside the final week of the new end
        $this->artisan('lifecycle:send')->assertSuccessful();

        $this->assertSame(2, $this->mails(LifecycleEmail::PlanExpiring, $student));
    }

    // ───────────────────────────── the Vault ─────────────────────────────

    public function test_a_ready_student_whose_plan_has_no_vault_is_told_to_upgrade_once(): void
    {
        $student = $this->student();
        $vault = app(VaultService::class);

        $vault->applyReadiness($student, $this->breakdown(63));
        $vault->applyReadiness($student, $this->breakdown(64));   // the refresh runs every few minutes

        $this->assertSame(VaultProfile::STATUS_UPGRADE_REQUIRED, VaultProfile::where('user_id', $student->id)->value('visibility_status'));
        $this->assertSame(1, $this->mails(LifecycleEmail::VaultUpgrade, $student));
        $this->assertSame(63, $this->lastMail(LifecycleEmail::VaultUpgrade, $student)->data['score']);
        Mail::assertNotSent(\App\Mail\VaultReadyMail::class);
    }

    public function test_a_ready_student_on_expert_gets_the_ready_mail_not_the_upgrade_one(): void
    {
        $student = $this->student();
        $this->grantExpert($student, 365);
        Mail::fake();

        app(VaultService::class)->applyReadiness($student->fresh(), $this->breakdown(65));

        Mail::assertSent(\App\Mail\VaultReadyMail::class, 1);
        $this->assertSame(0, $this->mails(LifecycleEmail::VaultUpgrade));
        Queue::assertNothingPushed();
    }

    public function test_a_listed_student_who_falls_out_of_the_vault_is_told_and_one_who_was_not_listed_is_not(): void
    {
        $vault = app(VaultService::class);

        $listed = $this->student();
        $this->grantExpert($listed, 365);
        $vault->applyReadiness($listed->fresh(), $this->breakdown(62));
        $vault->giveConsent($listed);
        $vault->applyReadiness($listed->fresh(), $this->breakdown(62));
        $this->assertSame(VaultProfile::STATUS_VISIBLE, VaultProfile::where('user_id', $listed->id)->value('visibility_status'));

        $waiting = $this->student();
        $this->grantExpert($waiting, 365);
        $vault->applyReadiness($waiting->fresh(), $this->breakdown(62));   // ready, never said yes

        Mail::fake();
        $vault->applyReadiness($listed->fresh(), $this->breakdown(50));
        $vault->applyReadiness($waiting->fresh(), $this->breakdown(50));

        $this->assertSame(1, $this->mails(LifecycleEmail::VaultDelisted, $listed));
        $this->assertSame(50, $this->lastMail(LifecycleEmail::VaultDelisted, $listed)->data['score']);
        $this->assertSame(0, $this->mails(LifecycleEmail::VaultDelisted, $waiting));
    }

    public function test_vault_upgrade_reminders_follow_the_first_message_at_14_and_30_days_and_then_stop(): void
    {
        $student = $this->student();
        VaultProfile::create(['user_id' => $student->id, 'is_eligible' => true, 'visibility_status' => VaultProfile::STATUS_UPGRADE_REQUIRED, 'readiness_score' => 64]);

        $this->artisan('lifecycle:send --only=vault_upgrade')->assertSuccessful();   // never told: the first one
        $this->assertSame(1, $this->mails(LifecycleEmail::VaultUpgrade, $student));

        $this->travel(10)->days();
        $this->artisan('lifecycle:send --only=vault_upgrade')->assertSuccessful();
        $this->assertSame(1, $this->mails(LifecycleEmail::VaultUpgrade, $student));

        $this->travel(5)->days();   // 15 days after the first
        $this->artisan('lifecycle:send --only=vault_upgrade')->assertSuccessful();
        $this->assertSame(2, $this->mails(LifecycleEmail::VaultUpgrade, $student));

        $this->travel(10)->days();
        $this->artisan('lifecycle:send --only=vault_upgrade')->assertSuccessful();
        $this->assertSame(2, $this->mails(LifecycleEmail::VaultUpgrade, $student), 'not yet 30 days from the first');

        $this->travel(10)->days();   // 35
        $this->artisan('lifecycle:send --only=vault_upgrade')->assertSuccessful();
        $this->travel(60)->days();
        $this->artisan('lifecycle:send --only=vault_upgrade')->assertSuccessful();
        $this->assertSame(3, $this->mails(LifecycleEmail::VaultUpgrade, $student), 'a first message and two reminders, then silence');
    }

    // ───────────────────────────── "a few points short of the Vault" ─────────────────────────────

    public function test_a_student_a_few_points_short_is_nudged_and_the_right_ones_only(): void
    {
        $close = $this->student(['last_seen_at' => now()->subDay()]);
        $far = $this->student(['last_seen_at' => now()->subDay()]);
        $gone = $this->student(['last_seen_at' => now()->subDays(40)]);
        $optedOut = $this->student(['last_seen_at' => now()->subDay(), 'email_nudges_opt_out_at' => now()]);
        $blocked = $this->student(['last_seen_at' => now()->subDay()]);
        $blocked->forceFill(['is_blocked' => true])->save();
        $already = $this->student(['last_seen_at' => now()->subDay()]);
        VaultProfile::create(['user_id' => $already->id, 'is_eligible' => true, 'visibility_status' => VaultProfile::STATUS_UPGRADE_REQUIRED]);

        $this->scores([$close->id => 52, $far->id => 30, $gone->id => 52, $optedOut->id => 52, $blocked->id => 52, $already->id => 52]);

        $this->artisan('lifecycle:send --only=readiness_push')->assertSuccessful();

        $this->assertSame(1, $this->mails(LifecycleEmail::ReadinessPush));
        $mail = $this->lastMail(LifecycleEmail::ReadinessPush, $close);
        $this->assertSame(52, $mail->data['score']);
        $this->assertSame(8, $mail->data['needed']);
        $this->assertTrue($mail->data['needs_plan'], 'a free-plan student is told listing is part of Expert');
        $this->assertSame('8 points to go', $mail->content['title']);
    }

    public function test_the_close_to_the_vault_nudge_is_paced_and_capped(): void
    {
        $student = $this->student(['last_seen_at' => now()]);
        $this->scores([$student->id => 55]);

        $send = function () use ($student) {
            $student->forceFill(['last_seen_at' => now()])->save();
            $this->artisan('lifecycle:send --only=readiness_push')->assertSuccessful();

            return $this->mails(LifecycleEmail::ReadinessPush, $student);
        };

        $this->assertSame(1, $send());
        $this->travel(2)->days();
        $this->assertSame(1, $send(), 'not twice in a few days');
        $this->travel(9)->days();   // 11 days later
        $this->assertSame(2, $send());
        $this->travel(11)->days();
        $this->assertSame(3, $send());
        $this->travel(11)->days();
        $this->assertSame(4, $send());
        $this->travel(11)->days();
        $this->assertSame(4, $send(), 'four nudges, then they are left alone');
    }

    // ───────────────────────────── "buy a plan" ─────────────────────────────

    public function test_upgrade_nudges_go_to_free_plan_students_only_in_three_paced_stages(): void
    {
        $this->paymentsAvailable();

        $free = $this->student(['created_at' => now()->subDays(30)]);
        $tooNew = $this->student(['created_at' => now()->subDay()]);
        $paid = $this->student(['created_at' => now()->subDays(30)]);
        $this->grantExpert($paid, 365);
        $lapsed = $this->student(['created_at' => now()->subDays(30)]);
        $this->grantExpert($lapsed, 5)->forceFill(['status' => Subscription::STATUS_EXPIRED])->save();
        $college = $this->student(['created_at' => now()->subDays(30), 'college_id' => College::create(['name' => 'Test College', 'short_code' => 'TC1', 'tier' => 'Standard'])->id]);
        $optedOut = $this->student(['created_at' => now()->subDays(30), 'email_nudges_opt_out_at' => now()]);
        Mail::fake();

        $run = function () {
            $this->artisan('lifecycle:send --only=upgrade_nudge')->assertSuccessful();
        };

        $run();
        $this->assertSame(1, $this->mails(LifecycleEmail::UpgradeNudge), 'only the free, established, reachable student');
        $this->assertSame(1, $this->lastMail(LifecycleEmail::UpgradeNudge, $free)->data['stage']);
        foreach ([$tooNew, $paid, $lapsed, $college, $optedOut] as $excluded) {
            $this->assertSame(0, $this->mails(LifecycleEmail::UpgradeNudge, $excluded));
        }

        // From here on only $free is followed: time moves, so the "too new" student grows up and would qualify.
        $nudgesToFree = fn () => $this->mails(LifecycleEmail::UpgradeNudge, $free);

        $this->travel(2)->days();
        $run();
        $this->travel(2)->days();   // 4 days in: past the 3-day gap between any two nudges, inside the 5-day gap between these
        $run();
        $this->assertSame(1, $nudgesToFree());

        $this->travel(2)->days();   // 6 days
        $run();
        $this->travel(6)->days();
        $run();
        $this->travel(60)->days();
        $run();

        $stages = Mail::sent(LifecycleMail::class, fn (LifecycleMail $m) => $m->type === LifecycleEmail::UpgradeNudge && $m->hasTo($free->email))->map(fn ($m) => $m->data['stage'])->values()->all();
        $this->assertSame([1, 2, 3], $stages, 'three messages then silence');
        foreach ([$paid, $lapsed, $college, $optedOut] as $excluded) {
            $this->assertSame(0, $this->mails(LifecycleEmail::UpgradeNudge, $excluded));
        }
    }

    public function test_nobody_is_told_to_buy_when_payments_are_not_set_up(): void
    {
        $this->paymentsAvailable(false);
        $this->student(['created_at' => now()->subDays(30)]);

        $this->artisan('lifecycle:send --only=upgrade_nudge')->assertSuccessful();

        $this->assertSame(0, $this->mails(LifecycleEmail::UpgradeNudge));
    }

    public function test_the_nudge_quotes_the_price_on_the_plan_row_not_one_baked_into_the_copy(): void
    {
        Plan::where('code', Plan::CODE_EXPERT)->update(['list_price' => 3000, 'discount_percent' => 0]);
        $user = $this->student();

        $mail = new LifecycleMail($user, LifecycleEmail::UpgradeNudge, ['stage' => 2]);

        $this->assertSame('₹3,000 a year', $mail->content['facts']['Expert plan']);
        $this->assertArrayNotHasKey('Discount', $mail->content['facts']);
    }

    // ───────────────────────────── "we miss you" ─────────────────────────────

    public function test_a_student_who_stopped_coming_gets_two_win_backs_for_one_absence(): void
    {
        $away = $this->student(['last_seen_at' => now()->subDays(15)]);
        $recent = $this->student(['last_seen_at' => now()->subDays(5)]);
        $longGone = $this->student(['last_seen_at' => now()->subDays(120)]);
        $neverCame = $this->student(['last_seen_at' => null]);
        $this->scores([$away->id => 41]);

        $this->artisan('lifecycle:send --only=inactivity')->assertSuccessful();
        $this->assertSame(1, $this->mails(LifecycleEmail::Inactivity), 'only the student who is away, but not gone for good');
        foreach ([$recent, $longGone, $neverCame] as $other) {
            $this->assertSame(0, $this->mails(LifecycleEmail::Inactivity, $other));
        }
        $first = $this->lastMail(LifecycleEmail::Inactivity, $away);
        $this->assertSame(15, $first->data['days']);
        $this->assertSame(41, $first->data['score']);

        $this->artisan('lifecycle:send --only=inactivity')->assertSuccessful();
        $this->assertSame(1, $this->mails(LifecycleEmail::Inactivity, $away), 'not twice in a day');

        $this->travel(31)->days();   // 46 days away
        $this->artisan('lifecycle:send --only=inactivity')->assertSuccessful();
        $this->assertSame(2, $this->mails(LifecycleEmail::Inactivity, $away));

        $this->travel(5)->days();
        $this->artisan('lifecycle:send --only=inactivity')->assertSuccessful();
        $this->assertSame(2, $this->mails(LifecycleEmail::Inactivity, $away), 'two per absence, then stop');

        // The student comes back, then drifts away again: that is a new absence.
        $away->forceFill(['last_seen_at' => now()])->save();
        $this->travel(15)->days();
        $this->artisan('lifecycle:send --only=inactivity')->assertSuccessful();
        $this->assertSame(3, $this->mails(LifecycleEmail::Inactivity, $away));
    }

    // ───────────────────────────── pacing across kinds ─────────────────────────────

    public function test_a_student_who_qualifies_for_several_nudges_gets_the_most_useful_one_first_and_the_rest_wait(): void
    {
        $this->paymentsAvailable();
        $student = $this->student(['created_at' => now()->subDays(30), 'last_seen_at' => now()->subDay()]);
        $this->scores([$student->id => 54]);

        $this->artisan('lifecycle:send')->assertSuccessful();

        $this->assertSame(1, $this->mails(LifecycleEmail::ReadinessPush, $student));
        $this->assertSame(0, $this->mails(LifecycleEmail::UpgradeNudge, $student), 'one engagement mail per student per run');

        $this->travel(1)->days();
        $this->artisan('lifecycle:send')->assertSuccessful();
        $this->assertSame(0, $this->mails(LifecycleEmail::UpgradeNudge, $student), 'still inside the minimum gap');

        $this->travel(3)->days();
        $student->forceFill(['last_seen_at' => now()->subDay()])->save();
        $this->artisan('lifecycle:send')->assertSuccessful();
        $this->assertSame(1, $this->mails(LifecycleEmail::UpgradeNudge, $student), 'its turn has come');
    }

    public function test_one_run_never_sends_more_than_its_cap_and_a_dry_run_sends_nothing(): void
    {
        $this->paymentsAvailable();
        foreach (range(1, 4) as $i) {
            $this->student(['created_at' => now()->subDays(30)]);
        }

        $this->artisan('lifecycle:send --only=upgrade_nudge --dry-run')->expectsOutputToContain('would send 4')->assertSuccessful();
        Mail::assertNotSent(LifecycleMail::class);

        $this->artisan('lifecycle:send --only=upgrade_nudge --max=2')->assertSuccessful();
        $this->assertSame(2, $this->mails(LifecycleEmail::UpgradeNudge));

        $this->artisan('lifecycle:send --only=upgrade_nudge --max=2')->assertSuccessful();
        $this->assertSame(4, $this->mails(LifecycleEmail::UpgradeNudge), 'the next run picks up the rest');
    }

    public function test_the_master_switch_pauses_nudges_but_not_plan_ending_reminders(): void
    {
        $this->paymentsAvailable();
        $this->student(['created_at' => now()->subDays(30)]);
        $paid = $this->student();
        $this->grantExpert($paid, 3);
        Mail::fake();
        config(['lifecycle_mail.engagement_enabled' => false]);

        $this->artisan('lifecycle:send')->assertSuccessful();

        $this->assertSame(0, $this->mails(LifecycleEmail::UpgradeNudge));
        $this->assertSame(1, $this->mails(LifecycleEmail::PlanExpiring, $paid));
    }

    public function test_an_unknown_kind_is_refused(): void
    {
        $this->artisan('lifecycle:send --only=spam')->assertFailed();
    }

    // ───────────────────────────── unsubscribe ─────────────────────────────

    public function test_the_unsubscribe_link_asks_first_and_changes_nothing_until_confirmed(): void
    {
        $student = $this->student();
        $url = URL::signedRoute('email.preferences', ['user' => $student->id]);

        $this->get($url)->assertOk()->assertSee('Stop reminders and nudges?');
        $this->assertNull($student->fresh()->email_nudges_opt_out_at, 'a link scanner that merely fetches the page must not unsubscribe anyone');

        $this->post($url, ['action' => 'unsubscribe'])->assertOk()->assertSee("You're unsubscribed", false);
        $this->assertNotNull($student->fresh()->email_nudges_opt_out_at);

        $this->post($url, ['action' => 'subscribe'])->assertOk()->assertSee('Welcome back');
        $this->assertNull($student->fresh()->email_nudges_opt_out_at);
    }

    public function test_a_mail_clients_one_click_unsubscribe_works(): void
    {
        $student = $this->student();

        $this->post(URL::signedRoute('email.preferences', ['user' => $student->id]), ['List-Unsubscribe' => 'One-Click'])->assertOk();

        $this->assertNotNull($student->fresh()->email_nudges_opt_out_at);
    }

    public function test_the_unsubscribe_page_cannot_be_used_without_the_signature_or_on_someone_elses_account(): void
    {
        $student = $this->student();
        $other = $this->student();

        $this->get("/api/email/preferences/{$student->id}")->assertForbidden();
        $this->post("/api/email/preferences/{$student->id}")->assertForbidden();

        $mine = URL::signedRoute('email.preferences', ['user' => $student->id]);
        $this->post(str_replace("/{$student->id}?", "/{$other->id}?", $mine))->assertForbidden();
        $this->assertNull($other->fresh()->email_nudges_opt_out_at);
    }

    public function test_unsubscribing_stops_nudges_even_for_a_job_already_waiting_but_not_account_mail(): void
    {
        $student = $this->student(['email_nudges_opt_out_at' => now()]);

        // A nudge that was queued before they unsubscribed: dropped at send time.
        (new SendLifecycleEmail($student->id, LifecycleEmail::UpgradeNudge->value, ['stage' => 1], 'stage1'))->handle();
        $this->assertSame(0, $this->mails(LifecycleEmail::UpgradeNudge));
        $this->assertSame(0, LifecycleEmailLog::count());

        // But a security notice about their own account still goes.
        (new SendLifecycleEmail($student->id, LifecycleEmail::PasswordChanged->value, ['via' => 'settings'], 'x'))->handle();
        $this->assertSame(1, $this->mails(LifecycleEmail::PasswordChanged, $student));
    }

    // ───────────────────────────── never twice, never lost ─────────────────────────────

    public function test_the_same_message_is_sent_once_however_many_times_the_job_runs(): void
    {
        $student = $this->student();
        $job = fn () => new SendLifecycleEmail($student->id, LifecycleEmail::PlanEnded->value, ['plan' => 'Expert'], 'sub1');

        $job()->handle();
        $job()->handle();
        SingleMail::now($job());

        $this->assertSame(1, $this->mails(LifecycleEmail::PlanEnded, $student));
        $this->assertSame(1, LifecycleEmailLog::count());
    }

    public function test_a_failed_send_is_handed_to_the_queue_and_can_still_be_delivered_on_retry(): void
    {
        $student = $this->student();
        $broken = Mockery::mock();
        $broken->shouldReceive('to')->andThrow(new RuntimeException('SMTP server is down'));
        Mail::swap($broken);

        $delivered = SingleMail::now(new SendLifecycleEmail($student->id, LifecycleEmail::PlanEnded->value, ['plan' => 'Expert'], 'sub1'));

        $this->assertFalse($delivered);
        Queue::assertPushed(SendLifecycleEmail::class, 1);
        $this->assertSame(0, LifecycleEmailLog::count(), 'the reservation is released, so the retry is not mistaken for a duplicate');

        Mail::clearResolvedInstances();   // the mail server is back
        app()->forgetInstance('mail.manager');
        Mail::fake();
        (new SendLifecycleEmail($student->id, LifecycleEmail::PlanEnded->value, ['plan' => 'Expert'], 'sub1'))->handle();

        $this->assertSame(1, $this->mails(LifecycleEmail::PlanEnded, $student));
    }

    public function test_a_business_action_never_fails_because_its_email_could_not_be_sent(): void
    {
        $student = $this->student();
        $broken = Mockery::mock();
        $broken->shouldReceive('to')->andThrow(new RuntimeException('SMTP server is down'));
        Mail::swap($broken);
        Sanctum::actingAs($student);

        $this->putJson('/api/me/password', ['current_password' => 'password', 'password' => 'a-new-password', 'password_confirmation' => 'a-new-password'])->assertOk();

        $this->assertTrue(Hash::check('a-new-password', $student->fresh()->password), 'the password was changed regardless');
    }

    // ───────────────────────────── what actually leaves the server ─────────────────────────────

    public function test_engagement_mail_carries_the_unsubscribe_link_and_headers_and_account_mail_does_not(): void
    {
        // Through the real Symfony mailer into the in-memory transport: what a mail server would receive.
        Mail::clearResolvedInstances();
        app()->forgetInstance('mail.manager');
        config(['mail.default' => 'array']);
        $student = $this->student();

        Mail::to($student->email)->send(new LifecycleMail($student, LifecycleEmail::UpgradeNudge, ['stage' => 1]));
        Mail::to($student->email)->send(new LifecycleMail($student, LifecycleEmail::PaymentFailed, ['plan' => 'Expert', 'amount' => 2999]));

        [$nudge, $receipt] = array_map(fn ($sent) => $sent->getOriginalMessage(), Mail::mailer('array')->getSymfonyTransport()->messages()->all());

        $this->assertSame($student->email, $nudge->getTo()[0]->getAddress());
        $this->assertStringContainsString('/api/email/preferences/'.$student->id, $nudge->getHeaders()->get('List-Unsubscribe')->getBodyAsString());
        $this->assertSame('List-Unsubscribe=One-Click', $nudge->getHeaders()->get('List-Unsubscribe-Post')->getBodyAsString());
        $this->assertStringContainsString('Unsubscribe', $nudge->getHtmlBody());
        $this->assertStringContainsString('signature=', $nudge->getHtmlBody());

        $this->assertNull($receipt->getHeaders()->get('List-Unsubscribe'));
        $this->assertStringNotContainsString('Unsubscribe', $receipt->getHtmlBody());
    }

    public function test_every_lifecycle_email_renders_cleanly(): void
    {
        $dir = sys_get_temp_dir().DIRECTORY_SEPARATOR.'aptrun-mail-preview-'.uniqid();

        try {
            $this->artisan('mail:preview', ['--out' => $dir])->assertSuccessful();

            $files = glob($dir.DIRECTORY_SEPARATOR.'*.html');
            $this->assertGreaterThanOrEqual(count(LifecycleEmail::cases()), count($files));

            foreach ($files as $file) {
                $html = file_get_contents($file);
                $name = basename($file);
                $engagement = (bool) array_filter(LifecycleEmail::cases(), fn (LifecycleEmail $t) => $t->isEngagement() && str_starts_with($name, $t->value));

                $this->assertStringContainsString('</html>', $html, $name);
                $this->assertDoesNotMatchRegularExpression('/\{\{|\}\}|@include|\*\*|Undefined|Array to string/', $html, "{$name} has unrendered markup");
                $this->assertSame($engagement, str_contains($html, 'Unsubscribe'), "{$name}: unsubscribe link must be on engagement mail and only there");
            }
        } finally {
            File::deleteDirectory($dir);
        }
    }

    public function test_copy_is_escaped_so_a_name_cannot_inject_markup(): void
    {
        $user = $this->student(['name' => '<script>alert(1)</script> Eve']);
        $mail = new LifecycleMail($user, LifecycleEmail::PlanEnded, ['plan' => '<b>Expert</b>']);

        $html = $mail->render();

        $this->assertStringNotContainsString('<script>', $html);
        $this->assertStringNotContainsString('<b>Expert</b>', $html);
    }

    // ───────────────────────────── plumbing ─────────────────────────────

    public function test_the_daily_run_is_on_the_schedule(): void
    {
        $this->artisan('schedule:list')->expectsOutputToContain('lifecycle:send')->assertSuccessful();
    }

    public function test_mail_check_refuses_a_mailer_that_delivers_nothing(): void
    {
        config(['mail.default' => 'log']);

        $this->artisan('mail:check')->expectsOutputToContain('NEVER delivered')->assertFailed();
    }

    public function test_mail_check_catches_missing_smtp_credentials(): void
    {
        config(['mail.default' => 'smtp', 'mail.mailers.smtp.username' => null, 'mail.mailers.smtp.password' => null, 'mail.from.address' => 'support@example.org']);

        $this->artisan('mail:check')->expectsOutputToContain('MAIL_USERNAME / MAIL_PASSWORD are empty')->assertFailed();
    }
}
