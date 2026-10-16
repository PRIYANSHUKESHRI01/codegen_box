<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\PaymentOrder;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesProjectLabFixtures;
use Tests\TestCase;

/**
 * Superadmin → manage one account: the 360° view, correcting details, signing
 * someone out, "view as", deleting an account, and the two guards that make all
 * of it real — a blocked account is refused on its next request, and a "view as"
 * session can only read.
 */
class SuperadminAccountManagementTest extends TestCase
{
    use CreatesProjectLabFixtures;
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seedPlans();
    }

    private function superadmin(array $attributes = []): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN, 'password' => Hash::make(self::PASSWORD)] + $attributes);
    }

    private function college(string $name = 'Apex Institute', ?int $maxStudents = 500, bool $active = true): College
    {
        $plan = Plan::create([
            'code' => 'inst-'.uniqid(),
            'name' => 'Standard',
            'audience' => Plan::AUDIENCE_INSTITUTION,
            'kind' => Plan::KIND_BASE,
            'list_price' => null,
            'annual_price' => 149000,
            'duration_days' => 365,
            'is_active' => true,
            'sort_order' => 1,
            'drive_access' => true,
            'max_students' => $maxStudents,
        ]);
        $college = College::create(['name' => $name, 'short_code' => strtoupper(substr(md5($name), 0, 5)), 'tier' => 'Standard']);

        Subscription::create([
            'subscriber_type' => College::class,
            'subscriber_id' => $college->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'started_at' => now()->subMonth(),
            'current_period_end' => $active ? now()->addMonths(6) : now()->subDay(),
        ]);

        return $college;
    }

    /** Act as a different caller on the next request (the auth guard otherwise remembers the previous one). */
    private function actAs(?User $user): void
    {
        app('auth')->forgetGuards();
        if ($user !== null) {
            Sanctum::actingAs($user);
        }
    }

    // ───────────────────────────── the 360° view ─────────────────────────────

    public function test_the_manage_view_gathers_who_they_are_how_they_sign_in_what_plan_they_hold_and_what_was_done(): void
    {
        $college = $this->college();
        $student = $this->student(['name' => 'Anika Rao', 'college_id' => $college->id, 'must_change_password' => true]);
        $student->createToken('laptop');
        PaymentOrder::create([
            'user_id' => $student->id, 'payer_name' => 'Anika Rao', 'payer_email' => $student->email,
            'gateway_order_id' => 'order_abc', 'status' => PaymentOrder::STATUS_PAID, 'amount_paise' => 299900,
            'plan_code' => 'grandmaster', 'cart' => [], 'quote' => ['lines' => [['name' => 'Grandmaster']]],
        ]);
        $admin = $this->superadmin();
        ActivityLog::record($admin, 'Edited an account\'s details', 'User', 'Anika Rao', ['user_id' => $student->id]);

        $this->actAs($admin);
        $response = $this->getJson("/api/superadmin/users/{$student->id}/manage")->assertOk();

        $response->assertJsonPath('user.email', $student->email)
            ->assertJsonPath('user.college.name', 'Apex Institute')
            ->assertJsonPath('login.login_id', $student->email)
            ->assertJsonPath('login.password_state', 'temporary')
            ->assertJsonPath('login.active_sessions', 1)
            ->assertJsonPath('plan.covered_by_college', true)
            ->assertJsonPath('payments.0.description', 'Grandmaster')
            ->assertJsonPath('activity.0.action', "Edited an account's details")
            ->assertJsonPath('capabilities.grant_plan', true)
            ->assertJsonPath('capabilities.delete', true);

        $this->assertStringNotContainsString($student->password, $response->getContent(), 'a password hash never leaves the server');
        $this->assertArrayNotHasKey('password', $response->json('user'));
    }

    public function test_the_manage_view_works_for_a_non_student_and_reports_what_may_be_done_to_them(): void
    {
        $this->actAs($admin = $this->superadmin());
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college()->id]);
        $other = $this->superadmin();

        $this->getJson("/api/superadmin/users/{$tpo->id}/manage")->assertOk()
            ->assertJsonPath('plan', null)
            ->assertJsonPath('capabilities.grant_plan', false)
            ->assertJsonPath('capabilities.delete', false)
            ->assertJsonPath('capabilities.view_as', true);

        $this->getJson("/api/superadmin/users/{$other->id}/manage")->assertOk()
            ->assertJsonPath('capabilities.edit', false)
            ->assertJsonPath('capabilities.view_as', false)
            ->assertJsonPath('capabilities.revoke_sessions', false)
            ->assertJsonPath('capabilities.reset_password', false);

        $this->getJson("/api/superadmin/users/{$admin->id}/manage")->assertOk()
            ->assertJsonPath('capabilities.block', false);
    }

    // ───────────────────────────── editing ─────────────────────────────

    public function test_details_can_be_corrected_and_each_change_is_audited_before_and_after(): void
    {
        $student = $this->student(['name' => 'Anika Rau', 'email' => 'anika@old.test', 'roll_number' => '21CS001']);
        $this->actAs($this->superadmin());

        $this->putJson("/api/superadmin/users/{$student->id}", [
            'name' => 'Anika Rao',
            'email' => 'anika@new.test',
            'roll_number' => '21CS002',
            'cgpa' => 8.4,
            'backlogs' => 0,
        ])->assertOk()->assertJsonPath('user.email', 'anika@new.test');

        $fresh = $student->fresh();
        $this->assertSame('Anika Rao', $fresh->name);
        $this->assertSame('anika@new.test', $fresh->email);
        $this->assertSame('21CS002', $fresh->roll_number);

        $log = ActivityLog::where('action', "Edited an account's details")->firstOrFail();
        $this->assertSame($student->id, $log->meta['user_id']);
        $this->assertSame(['from' => 'anika@old.test', 'to' => 'anika@new.test'], $log->meta['changes']['email']);
        $this->assertArrayNotHasKey('password', $log->meta['changes']);
    }

    public function test_an_edit_that_changes_nothing_writes_nothing(): void
    {
        $student = $this->student(['name' => 'Same Name']);
        $this->actAs($this->superadmin());

        $this->putJson("/api/superadmin/users/{$student->id}", ['name' => 'Same Name'])->assertOk();

        $this->assertSame(0, ActivityLog::where('action', "Edited an account's details")->count());
    }

    public function test_an_email_or_handle_that_belongs_to_someone_else_is_refused(): void
    {
        $taken = $this->student(['email' => 'taken@example.com', 'handle' => 'taken']);
        $student = $this->student();
        $this->actAs($this->superadmin());

        $this->putJson("/api/superadmin/users/{$student->id}", ['email' => 'taken@example.com'])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->putJson("/api/superadmin/users/{$student->id}", ['handle' => 'taken'])->assertStatus(422)->assertJsonValidationErrors('handle');
        // Re-saving their own is fine.
        $this->putJson("/api/superadmin/users/{$taken->id}", ['email' => 'taken@example.com'])->assertOk();
    }

    public function test_changing_a_phone_number_makes_them_verify_it_again(): void
    {
        $student = $this->student(['phone' => '9000000001', 'phone_verified_at' => now()]);
        $this->actAs($this->superadmin());

        $this->putJson("/api/superadmin/users/{$student->id}", ['phone' => '9000000002'])->assertOk();

        $this->assertNull($student->fresh()->phone_verified_at);
    }

    public function test_a_superadmin_account_cannot_be_edited_by_another(): void
    {
        $target = $this->superadmin();
        $this->actAs($this->superadmin());

        $this->putJson("/api/superadmin/users/{$target->id}", ['name' => 'Hijacked'])->assertStatus(422)->assertJsonValidationErrors('user');
        $this->assertNotSame('Hijacked', $target->fresh()->name);
    }

    public function test_a_student_can_move_to_another_college_that_has_room_but_not_one_that_is_full_or_lapsed(): void
    {
        $from = $this->college('From College');
        $roomy = $this->college('Roomy College');
        $full = $this->college('Full College', maxStudents: 1);
        $lapsed = $this->college('Lapsed College', active: false);
        $this->student(['college_id' => $full->id]);
        $student = $this->student(['college_id' => $from->id]);
        $this->actAs($this->superadmin());

        $this->putJson("/api/superadmin/users/{$student->id}", ['college_id' => $full->id])->assertStatus(422)->assertJsonValidationErrors('college_id');
        $this->putJson("/api/superadmin/users/{$student->id}", ['college_id' => $lapsed->id])->assertStatus(422)->assertJsonValidationErrors('college_id');
        $this->assertSame($from->id, $student->fresh()->college_id);

        $this->putJson("/api/superadmin/users/{$student->id}", ['college_id' => $roomy->id])->assertOk();
        $this->assertSame($roomy->id, $student->fresh()->college_id);
    }

    public function test_a_college_less_account_is_not_pulled_into_a_college_by_an_edit(): void
    {
        $lead = $this->student();
        $this->actAs($this->superadmin());

        $this->putJson("/api/superadmin/users/{$lead->id}", ['college_id' => $this->college()->id])
            ->assertStatus(422)->assertJsonValidationErrors('college_id');
        $this->assertNull($lead->fresh()->college_id);
    }

    // ───────────────────────────── sign out ─────────────────────────────

    public function test_signing_an_account_out_ends_every_session_and_is_audited(): void
    {
        $student = $this->student();
        $student->createToken('laptop');
        $student->createToken('phone');
        $this->actAs($this->superadmin());

        $this->postJson("/api/superadmin/users/{$student->id}/revoke-sessions")->assertOk()->assertJsonPath('revoked', 2);

        $this->assertSame(0, $student->tokens()->count());
        $this->assertSame(2, ActivityLog::where('action', 'Signed an account out of all devices')->firstOrFail()->meta['sessions_ended']);
    }

    public function test_a_superadmin_cannot_sign_out_a_superadmin_or_themselves(): void
    {
        $me = $this->superadmin();
        $other = $this->superadmin();
        $this->actAs($me);

        $this->postJson("/api/superadmin/users/{$other->id}/revoke-sessions")->assertStatus(422);
        $this->postJson("/api/superadmin/users/{$me->id}/revoke-sessions")->assertStatus(422);
    }

    // ───────────────────────────── blocking is real-time ─────────────────────────────

    public function test_a_blocked_accounts_open_session_is_refused_on_its_very_next_request(): void
    {
        $student = $this->student();
        $plain = $student->createToken('laptop')->plainTextToken;

        $this->actAs(null);
        $this->withToken($plain)->getJson('/api/me')->assertOk();

        $this->actAs($this->superadmin());
        $this->postJson("/api/superadmin/users/{$student->id}/toggle-block", ['reason' => 'Cheating in contest'])->assertOk();

        $this->actAs(null);
        $this->withToken($plain)->getJson('/api/me')
            ->assertForbidden()
            ->assertJsonPath('code', 'account_blocked');
        $this->withToken($plain)->getJson('/api/me/subscription')->assertForbidden()->assertJsonPath('code', 'account_blocked');

        // …but it can still sign out, so a blocked browser can discard its own token.
        $this->withToken($plain)->postJson('/api/logout')->assertOk();

        // Unblocking restores a fresh login, nothing else.
        $this->actAs($this->superadmin());
        $this->postJson("/api/superadmin/users/{$student->id}/toggle-block")->assertOk();
        $fresh = $student->fresh()->createToken('again')->plainTextToken;
        $this->actAs(null);
        $this->withToken($fresh)->getJson('/api/me')->assertOk();
    }

    // ───────────────────────────── view as ─────────────────────────────

    private function viewAs(User $target, array $body = ['password' => self::PASSWORD])
    {
        return $this->postJson("/api/superadmin/users/{$target->id}/impersonate", $body);
    }

    public function test_view_as_needs_the_superadmins_password(): void
    {
        $student = $this->student();
        $this->actAs($this->superadmin());

        $this->viewAs($student, [])->assertStatus(422)->assertJsonValidationErrors('password');
        $this->viewAs($student, ['password' => 'wrong'])->assertStatus(422)->assertJsonValidationErrors('password');
        $this->assertSame(0, $student->tokens()->count());
    }

    public function test_view_as_gives_a_short_lived_token_that_reads_as_the_user_and_cannot_write(): void
    {
        $college = $this->college();
        $student = $this->student(['name' => 'Anika Rao', 'college_id' => $college->id]);
        $admin = $this->superadmin();
        $this->actAs($admin);

        $response = $this->viewAs($student)->assertOk()->assertJsonPath('user.id', $student->id)->assertJsonPath('minutes', 60);
        $plain = $response->json('token');

        $token = PersonalAccessToken::findToken($plain);
        $this->assertSame(['impersonated'], $token->abilities, 'never a full-access token');
        $this->assertSame("impersonation:{$admin->id}", $token->name);
        $this->assertEqualsWithDelta(60, now()->diffInMinutes($token->expires_at, true), 1);

        // Reads work and are the student's own view.
        $this->actAs(null);
        $this->withToken($plain)->getJson('/api/me')->assertOk()->assertJsonPath('user.id', $student->id);
        $this->withToken($plain)->getJson('/api/me/subscription')->assertOk()->assertJsonPath('scope', 'individual');

        // Writes — anything that would act as the student — are refused, by method, everywhere.
        $this->withToken($plain)->putJson('/api/me/password', ['current_password' => 'password', 'password' => 'new-password-1', 'password_confirmation' => 'new-password-1'])
            ->assertForbidden()->assertJsonPath('code', 'impersonation_read_only');
        $this->withToken($plain)->putJson('/api/me/profile', ['name' => 'Renamed'])->assertForbidden()->assertJsonPath('code', 'impersonation_read_only');
        $this->withToken($plain)->postJson('/api/me/checkout', ['plan_code' => 'expert'])->assertForbidden()->assertJsonPath('code', 'impersonation_read_only');
        $this->assertSame('Anika Rao', $student->fresh()->name);
        $this->assertTrue(Hash::check('password', $student->fresh()->password));
    }

    public function test_a_view_as_session_does_not_make_the_user_look_online(): void
    {
        $student = $this->student(['last_seen_at' => null]);
        $this->actAs($this->superadmin());
        $plain = $this->viewAs($student)->json('token');

        $this->actAs(null);
        $this->withToken($plain)->getJson('/api/me')->assertOk();

        $this->assertNull($student->fresh()->last_seen_at);
    }

    public function test_leaving_view_as_ends_the_token_and_is_audited_both_ways(): void
    {
        $student = $this->student();
        $admin = $this->superadmin();
        $this->actAs($admin);
        $plain = $this->viewAs($student)->json('token');

        $this->actAs(null);
        $this->withToken($plain)->postJson('/api/logout')->assertOk();

        $this->assertSame(0, $student->tokens()->count());
        $this->assertSame(1, ActivityLog::where('action', 'like', 'Started viewing an account%')->where('actor_id', $admin->id)->count());
        $this->assertSame(1, ActivityLog::where('action', 'like', 'Stopped viewing an account%')->where('actor_id', $admin->id)->count());
    }

    public function test_a_view_as_token_stops_working_when_it_expires(): void
    {
        $student = $this->student();
        $this->actAs($this->superadmin());
        $plain = $this->viewAs($student)->json('token');

        $this->actAs(null);
        $this->withToken($plain)->getJson('/api/me')->assertOk();

        Carbon::setTestNow(now()->addMinutes(61));
        $this->actAs(null);
        $this->withToken($plain)->getJson('/api/me')->assertUnauthorized();
        Carbon::setTestNow();
    }

    public function test_view_as_refuses_a_superadmin_yourself_and_a_blocked_account(): void
    {
        $me = $this->superadmin();
        $other = $this->superadmin();
        $blocked = $this->student(['is_blocked' => true]);
        $this->actAs($me);

        $this->viewAs($other)->assertStatus(422)->assertJsonValidationErrors('user');
        $this->viewAs($me)->assertStatus(422)->assertJsonValidationErrors('user');
        $this->viewAs($blocked)->assertStatus(422)->assertJsonValidationErrors('user');
    }

    public function test_view_as_works_for_a_staff_role_too(): void
    {
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college()->id]);
        $this->actAs($this->superadmin());
        $plain = $this->viewAs($tpo)->assertOk()->json('token');

        $this->actAs(null);
        $this->withToken($plain)->getJson('/api/tpo/students/cohort')->assertOk();
        $this->withToken($plain)->postJson('/api/tpo/students', ['name' => 'X', 'email' => 'x@example.com'])->assertForbidden()->assertJsonPath('code', 'impersonation_read_only');
    }

    public function test_only_a_superadmin_can_use_any_of_these_tools(): void
    {
        $student = $this->student();

        foreach ([
            User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => User::PERMISSIONS_INTERNAL]),
            User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college('Other')->id]),
            $this->student(),
        ] as $caller) {
            $this->actAs($caller);
            $this->getJson("/api/superadmin/users/{$student->id}/manage")->assertForbidden();
            $this->putJson("/api/superadmin/users/{$student->id}", ['name' => 'Nope'])->assertForbidden();
            $this->postJson("/api/superadmin/users/{$student->id}/revoke-sessions")->assertForbidden();
            $this->postJson("/api/superadmin/users/{$student->id}/impersonate", ['password' => 'password'])->assertForbidden();
            $this->getJson("/api/superadmin/users/{$student->id}/deletion-preview")->assertForbidden();
            $this->deleteJson("/api/superadmin/users/{$student->id}", ['password' => 'password', 'confirm_email' => $student->email])->assertForbidden();
        }

        $this->assertNotNull($student->fresh());
    }

    // ───────────────────────────── deleting ─────────────────────────────

    public function test_deleting_an_account_needs_the_password_and_the_exact_email(): void
    {
        $student = $this->student(['email' => 'anika@example.com']);
        $this->actAs($this->superadmin());

        $this->deleteJson("/api/superadmin/users/{$student->id}", ['confirm_email' => 'anika@example.com'])->assertStatus(422)->assertJsonValidationErrors('password');
        $this->deleteJson("/api/superadmin/users/{$student->id}", ['password' => 'wrong', 'confirm_email' => 'anika@example.com'])->assertStatus(422)->assertJsonValidationErrors('password');
        $this->deleteJson("/api/superadmin/users/{$student->id}", ['password' => self::PASSWORD, 'confirm_email' => 'someone@else.com'])->assertStatus(422)->assertJsonValidationErrors('confirm_email');

        $this->assertNotNull($student->fresh(), 'none of those deleted anything');
    }

    public function test_deleting_a_student_removes_the_account_its_sessions_plans_and_files_but_keeps_the_payment_record(): void
    {
        Storage::fake('public');
        Storage::fake('local');

        $student = $this->student(['email' => 'anika@example.com', 'avatar_path' => 'avatars/anika.png', 'resume_path' => 'resumes/anika.pdf']);
        Storage::disk('public')->put('avatars/anika.png', 'png');
        Storage::disk('local')->put('resumes/anika.pdf', 'pdf');
        $this->buy($student, 'expert');
        $student->createToken('laptop');
        $order = PaymentOrder::create([
            'user_id' => $student->id, 'payer_name' => 'Anika Rao', 'payer_email' => 'anika@example.com',
            'gateway_order_id' => 'order_keep', 'status' => PaymentOrder::STATUS_PAID, 'amount_paise' => 199900,
            'plan_code' => 'expert', 'cart' => [], 'quote' => [],
        ]);
        $bystander = $this->student();
        $admin = $this->superadmin();
        $this->actAs($admin);

        $preview = $this->getJson("/api/superadmin/users/{$student->id}/deletion-preview")->assertOk();
        $this->assertSame(1, $preview->json('impact.payments_kept'));

        $this->deleteJson("/api/superadmin/users/{$student->id}", ['password' => self::PASSWORD, 'confirm_email' => 'ANIKA@example.com'])
            ->assertOk()->assertJsonPath('deleted', true);

        $this->assertNull(User::find($student->id));
        $this->assertSame(0, PersonalAccessToken::where('tokenable_id', $student->id)->where('tokenable_type', User::class)->count());
        $this->assertSame(0, Subscription::where('subscriber_type', User::class)->where('subscriber_id', $student->id)->count());
        Storage::disk('public')->assertMissing('avatars/anika.png');
        Storage::disk('local')->assertMissing('resumes/anika.pdf');

        $kept = $order->fresh();
        $this->assertNotNull($kept, 'the money trail outlives the person');
        $this->assertNull($kept->user_id);
        $this->assertSame('anika@example.com', $kept->payer_email);

        $this->assertNotNull(User::find($bystander->id), 'nobody else was touched');
        $log = ActivityLog::where('action', 'Permanently deleted an account')->firstOrFail();
        $this->assertSame('anika@example.com', $log->meta['email']);
        $this->assertSame($admin->id, $log->actor_id);
    }

    public function test_only_students_and_coordinators_can_be_deleted_one_at_a_time_and_never_yourself(): void
    {
        $me = $this->superadmin();
        $college = $this->college();
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id, 'email' => 'tpo@example.com']);
        $staff = User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'email' => 'staff@example.com']);
        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $college->id, 'section' => 'A', 'email' => 'coord@example.com']);
        $this->actAs($me);

        foreach ([$tpo, $staff, $me] as $target) {
            $this->deleteJson("/api/superadmin/users/{$target->id}", ['password' => self::PASSWORD, 'confirm_email' => $target->email])
                ->assertStatus(422)->assertJsonValidationErrors('user');
            $this->assertNotNull(User::find($target->id));
        }

        $this->deleteJson("/api/superadmin/users/{$coordinator->id}", ['password' => self::PASSWORD, 'confirm_email' => 'coord@example.com'])->assertOk();
        $this->assertNull(User::find($coordinator->id));
    }

    // ───────────────────────────── listing helpers ─────────────────────────────

    public function test_the_user_directory_reports_each_students_plan_and_can_filter_by_it(): void
    {
        $free = $this->student(['name' => 'Free Fran']);
        $paid = $this->student(['name' => 'Paid Pat']);
        $this->buy($paid, 'expert');
        $this->actAs($this->superadmin());

        $names = fn (string $query) => collect($this->getJson("/api/superadmin/users?role=user&{$query}")->assertOk()->json('data'))
            ->pluck('name')->sort()->values()->all();

        $this->assertSame(['Paid Pat'], $names('plan=paid'));
        $this->assertSame(['Paid Pat'], $names('plan=expert'));
        $this->assertSame(['Free Fran'], $names('plan=free'));
        $this->assertSame([], $names('plan=none'));

        $row = collect($this->getJson('/api/superadmin/users?role=user&plan=paid')->json('data'))->firstWhere('id', $paid->id);
        $this->assertSame('Expert', $row['subscription_plan_name']);
        $this->assertSame('expert', $row['subscription']['plan_code']);
        $this->assertSame('individual', $row['subscription']['source']);
        $this->assertGreaterThan(360, $row['subscription']['days_remaining']);
        $this->assertNotNull($free);
    }

    // ───────────────────────────── plan limits ─────────────────────────────

    /** The complete set of limits, as the editor sends them: by default exactly what Expert ships with. */
    private function limits(array $overrides = []): array
    {
        return array_merge([
            'max_practice_problems_per_day' => null,
            'max_mock_interviews_per_day' => 10,
            'max_learning_centre_ai_attempts_per_day' => null,
            'feature_trial_uses' => null,
            'drive_access' => true,
            'hackathon_access' => true,
            'vault_access' => true,
            'project_lab_access' => true,
            'max_workspace_hours_per_month' => 80,
            'max_active_projects' => 3,
        ], $overrides);
    }

    public function test_what_a_plan_includes_can_be_edited_and_applies_to_people_already_on_it(): void
    {
        $student = $this->student();
        $this->buy($student, 'expert');
        $this->assertTrue($student->fresh()->effectiveEntitlements()['hackathon_access']);

        $this->actAs($this->superadmin());
        $version = collect($this->getJson('/api/superadmin/plans')->assertOk()->json('plans'))->firstWhere('code', 'expert')['limits_version'];

        $this->putJson('/api/superadmin/plans/expert/entitlements', $this->limits([
            'max_practice_problems_per_day' => 25,
            'hackathon_access' => false,
            'version' => $version,
        ]))->assertOk()
            ->assertJsonPath('plan.limits.max_practice_problems_per_day', 25)
            ->assertJsonPath('plan.entitlements.hackathon_access', false);

        $entitlements = $student->fresh()->effectiveEntitlements();
        $this->assertSame(25, $entitlements['max_practice_problems_per_day']);
        $this->assertFalse($entitlements['hackathon_access'], 'someone already on Expert loses the Arena on their next request, without re-buying');

        $this->getJson('/api/public/plans')->assertOk()->assertJsonPath('plans.1.entitlements.practice_problems_per_day', 25);
        $log = ActivityLog::where('action', 'Changed what a plan includes')->firstOrFail();
        $this->assertSame(['from' => null, 'to' => 25], $log->meta['changes']['max_practice_problems_per_day']);
        $this->assertSame(['from' => true, 'to' => false], $log->meta['changes']['hackathon_access']);
    }

    public function test_the_limits_editor_must_send_every_field_so_a_gap_can_never_mean_unlimited(): void
    {
        $this->actAs($this->superadmin());
        $partial = $this->limits();
        unset($partial['max_mock_interviews_per_day']);

        $this->putJson('/api/superadmin/plans/expert/entitlements', $partial)->assertStatus(422)->assertJsonValidationErrors('max_mock_interviews_per_day');
        $this->assertSame(10, Plan::where('code', 'expert')->value('max_mock_interviews_per_day'));

        // Null is how "unlimited" is said — deliberately.
        $this->putJson('/api/superadmin/plans/expert/entitlements', $this->limits(['max_mock_interviews_per_day' => null]))->assertOk();
        $this->assertNull(Plan::where('code', 'expert')->value('max_mock_interviews_per_day'));
    }

    public function test_limits_are_range_checked_and_a_stale_editor_is_refused(): void
    {
        $this->actAs($this->superadmin());

        $this->putJson('/api/superadmin/plans/expert/entitlements', $this->limits(['max_practice_problems_per_day' => 0]))->assertStatus(422)->assertJsonValidationErrors('max_practice_problems_per_day');
        $this->putJson('/api/superadmin/plans/expert/entitlements', $this->limits(['max_mock_interviews_per_day' => -1]))->assertStatus(422);
        $this->putJson('/api/superadmin/plans/expert/entitlements', $this->limits(['hackathon_access' => 'maybe']))->assertStatus(422)->assertJsonValidationErrors('hackathon_access');
        $this->putJson('/api/superadmin/plans/expert/entitlements', $this->limits(['version' => 'stale-token']))->assertStatus(422)->assertJsonValidationErrors('version');
    }

    public function test_only_the_individual_base_plans_have_editable_limits(): void
    {
        $college = $this->college();
        $collegePlanCode = $college->activeSubscription()->plan->code;
        $this->actAs($this->superadmin());

        $this->putJson("/api/superadmin/plans/{$collegePlanCode}/entitlements", $this->limits())->assertStatus(422)->assertJsonValidationErrors('plan');
        $this->putJson('/api/superadmin/plans/project-lab/entitlements', $this->limits())->assertStatus(422)->assertJsonValidationErrors('plan');
    }

    public function test_an_unchanged_save_writes_no_audit_entry_and_a_non_superadmin_cannot_save(): void
    {
        $plan = Plan::where('code', 'expert')->firstOrFail();
        $same = $this->limits([
            'max_practice_problems_per_day' => $plan->max_practice_problems_per_day,
            'max_mock_interviews_per_day' => $plan->max_mock_interviews_per_day,
            'max_learning_centre_ai_attempts_per_day' => $plan->max_learning_centre_ai_attempts_per_day,
            'feature_trial_uses' => $plan->feature_trial_uses,
            'drive_access' => $plan->drive_access,
            'hackathon_access' => $plan->hackathon_access,
            'vault_access' => $plan->vault_access,
            'project_lab_access' => $plan->project_lab_access,
            'max_workspace_hours_per_month' => $plan->max_workspace_hours_per_month,
            'max_active_projects' => $plan->max_active_projects,
        ]);

        $this->actAs($this->superadmin());
        $this->putJson('/api/superadmin/plans/expert/entitlements', $same)->assertOk();
        $this->assertSame(0, ActivityLog::where('action', 'Changed what a plan includes')->count());

        $this->actAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => User::PERMISSIONS_INTERNAL]));
        $this->putJson('/api/superadmin/plans/expert/entitlements', $this->limits(['max_practice_problems_per_day' => 999]))->assertForbidden();
    }
}
