<?php

namespace Tests\Feature;

use App\Jobs\SendAccountCredentialsEmail;
use App\Models\ActivityLog;
use App\Models\College;
use App\Models\IssuedCredential;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesCodingActivityFixtures;
use Tests\TestCase;

/**
 * A TPO runs THEIR OWN students' accounts (account snapshot, corrected details, block / unblock, a fresh e-mailed login, sign-out,
 * removing an account added by mistake) — and cannot do the things that are Mellow Vault's: see a password, delete a used account,
 * touch another college.
 */
class TpoStudentManageTest extends TestCase
{
    use CreatesCodingActivityFixtures;
    use RefreshDatabase;

    private College $college;

    private College $other;

    private User $tpo;

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();

        $this->college = College::create(['name' => 'Manage College', 'short_code' => 'MC']);
        $this->other = College::create(['name' => 'Elsewhere', 'short_code' => 'EL']);
        $this->tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college->id, 'must_change_password' => false]);
    }

    private function student(array $over = [], ?College $college = null): User
    {
        return User::factory()->create(array_merge([
            'role' => User::ROLE_USER, 'college_id' => ($college ?? $this->college)->id, 'branch' => 'CSE', 'section' => 'CSE_A', 'must_change_password' => false,
        ], $over));
    }

    public function test_show_describes_the_account_without_any_secret(): void
    {
        $s = $this->student(['must_change_password' => true]);
        IssuedCredential::create(['user_id' => $s->id, 'secret' => 'PlainTemp-123', 'source' => 'created', 'expires_at' => now()->addDays(5)]);

        Sanctum::actingAs($this->tpo);
        $res = $this->getJson("/api/tpo/students/{$s->id}/manage")->assertOk();

        $this->assertFalse($res->json('account.activated'));
        $this->assertSame($s->email, $res->json('account.email'));
        $this->assertTrue($res->json('can_remove'));
        $this->assertStringNotContainsString('PlainTemp-123', $res->getContent(), 'a TPO never sees a password');
        $this->assertArrayNotHasKey('password', $res->json('account'));
    }

    public function test_nothing_reaches_another_colleges_student(): void
    {
        $theirs = $this->student([], $this->other);

        Sanctum::actingAs($this->tpo);
        $this->getJson("/api/tpo/students/{$theirs->id}/manage")->assertNotFound();
        $this->patchJson("/api/tpo/students/{$theirs->id}/profile", ['name' => 'X'])->assertNotFound();
        $this->postJson("/api/tpo/students/{$theirs->id}/block", ['reason' => 'nope nope'])->assertNotFound();
        $this->postJson("/api/tpo/students/{$theirs->id}/unblock")->assertNotFound();
        $this->postJson("/api/tpo/students/{$theirs->id}/send-login")->assertNotFound();
        $this->postJson("/api/tpo/students/{$theirs->id}/revoke-sessions")->assertNotFound();
        $this->deleteJson("/api/tpo/students/{$theirs->id}")->assertNotFound();

        // Staff and coordinators are not "students" either.
        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $this->college->id, 'section' => 'CSE_A', 'must_change_password' => false]);
        $this->postJson("/api/tpo/students/{$coordinator->id}/block", ['reason' => 'nope nope'])->assertNotFound();
        $this->assertFalse((bool) $theirs->fresh()->is_blocked);
    }

    public function test_only_a_tpo_may_use_these_endpoints(): void
    {
        $s = $this->student();
        $other = $this->student();

        Sanctum::actingAs($s);
        $this->postJson("/api/tpo/students/{$other->id}/block", ['reason' => 'because'])->assertForbidden();

        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $this->college->id, 'section' => 'CSE_A', 'must_change_password' => false]);
        Sanctum::actingAs($coordinator);
        $this->deleteJson("/api/tpo/students/{$other->id}")->assertForbidden();
    }

    public function test_block_needs_a_reason_signs_the_student_out_and_is_audited_and_unblock_lifts_any_block(): void
    {
        $s = $this->student();
        $s->createToken('web');
        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $this->college->id, 'section' => 'CSE_A', 'must_change_password' => false]);

        Sanctum::actingAs($this->tpo);
        $this->postJson("/api/tpo/students/{$s->id}/block", [])->assertStatus(422)->assertJsonValidationErrors('reason');

        $res = $this->postJson("/api/tpo/students/{$s->id}/block", ['reason' => 'Left the college'])->assertOk();
        $this->assertTrue($res->json('student.is_blocked'));
        $this->assertSame('Left the college', $res->json('student.blocked.reason'));
        $this->assertSame(0, $s->tokens()->count());
        $this->assertTrue(ActivityLog::where('action', 'TPO blocked a student')->where('meta->user_id', $s->id)->exists());

        // A block a coordinator placed is the TPO's to lift.
        $s->forceFill(['is_blocked' => true, 'blocked_by' => $coordinator->id, 'blocked_reason' => 'Exam misconduct', 'blocked_at' => now()])->save();
        $this->postJson("/api/tpo/students/{$s->id}/unblock")->assertOk()->assertJsonPath('student.is_blocked', false);
        $this->assertFalse((bool) $s->fresh()->is_blocked);
    }

    public function test_send_login_sets_a_new_temporary_password_emails_it_and_never_returns_it(): void
    {
        $s = $this->student(['password' => Hash::make('old-password-1')]);
        $s->createToken('web');

        Sanctum::actingAs($this->tpo);
        $res = $this->postJson("/api/tpo/students/{$s->id}/send-login")->assertOk();

        $this->assertTrue($res->json('emailed'));
        $fresh = $s->fresh();
        $this->assertTrue((bool) $fresh->must_change_password);
        $this->assertFalse(Hash::check('old-password-1', $fresh->password));
        $this->assertSame(0, $fresh->tokens()->count());

        // The new password went to the student's inbox (and an encrypted lookup copy for Mellow support), not into the response.
        $kept = IssuedCredential::where('user_id', $s->id)->first();
        $this->assertNotNull($kept);
        $this->assertTrue(Hash::check($kept->secret, $fresh->password));
        $this->assertStringNotContainsString($kept->secret, $res->getContent());
        Mail::assertSent(\App\Mail\AccountCredentialsMail::class, fn ($m) => $m->hasTo($s->email) && $m->plainPassword === $kept->secret);
        $this->assertSame(SendAccountCredentialsEmail::class, SendAccountCredentialsEmail::class);
    }

    public function test_a_blocked_student_cannot_be_sent_a_login(): void
    {
        $s = $this->student(['is_blocked' => true]);

        Sanctum::actingAs($this->tpo);
        $this->postJson("/api/tpo/students/{$s->id}/send-login")->assertStatus(422);
        Mail::assertNothingSent();
    }

    public function test_revoke_sessions_signs_the_student_out_everywhere(): void
    {
        $s = $this->student();
        $s->createToken('a');
        $s->createToken('b');

        Sanctum::actingAs($this->tpo);
        $this->postJson("/api/tpo/students/{$s->id}/revoke-sessions")->assertOk()->assertJsonPath('revoked', 2);
        $this->assertSame(0, $s->tokens()->count());
    }

    public function test_details_can_be_corrected_but_a_signed_in_students_login_email_is_theirs(): void
    {
        $s = $this->student(['name' => 'Wrong Name', 'cgpa' => 6.0]);

        Sanctum::actingAs($this->tpo);
        $res = $this->patchJson("/api/tpo/students/{$s->id}/profile", ['name' => 'Right Name', 'cgpa' => 8.4, 'backlogs' => 0, 'phone' => '9876543210', 'roll_number' => '21CS001'])->assertOk();
        $this->assertSame('Right Name', $res->json('student.name'));
        $this->assertEquals(8.4, (float) $res->json('student.cgpa'));
        $this->assertSame('21CS001', $s->fresh()->roll_number);

        // Nothing changed -> nothing written.
        $this->patchJson("/api/tpo/students/{$s->id}/profile", ['name' => 'Right Name'])->assertOk()->assertJsonPath('message', 'Nothing changed.');

        // Out-of-range data is refused.
        $this->patchJson("/api/tpo/students/{$s->id}/profile", ['cgpa' => 11])->assertStatus(422);

        // Active account: the login e-mail cannot be changed by the TPO.
        $this->patchJson("/api/tpo/students/{$s->id}/profile", ['email' => 'new@example.com'])->assertStatus(422)->assertJsonValidationErrors('email');
        $this->assertNotSame('new@example.com', $s->fresh()->email);
    }

    public function test_an_unactivated_students_email_typo_can_be_fixed_and_the_login_goes_to_the_new_address(): void
    {
        $taken = $this->student(['email' => 'taken@example.com']);
        $s = $this->student(['must_change_password' => true, 'email' => 'typo@exmaple.com']);

        Sanctum::actingAs($this->tpo);
        $this->patchJson("/api/tpo/students/{$s->id}/profile", ['email' => 'taken@example.com'])->assertStatus(422)->assertJsonValidationErrors('email');

        $this->patchJson("/api/tpo/students/{$s->id}/profile", ['email' => 'right@example.com'])->assertOk();
        $this->assertSame('right@example.com', $s->fresh()->email);
        Mail::assertSent(\App\Mail\AccountCredentialsMail::class, fn ($m) => $m->hasTo('right@example.com'));
        $this->assertNotNull($taken->id);
    }

    public function test_only_an_account_never_used_can_be_removed(): void
    {
        $fresh = $this->student(['must_change_password' => true]);
        $signedIn = $this->student(['must_change_password' => false]);
        $busy = $this->student(['must_change_password' => true]);
        $this->practiceSubmission($busy, 'python', 'accepted');

        Sanctum::actingAs($this->tpo);

        $this->deleteJson("/api/tpo/students/{$signedIn->id}")->assertStatus(422);
        $this->deleteJson("/api/tpo/students/{$busy->id}")->assertStatus(422);
        $this->assertNotNull(User::find($signedIn->id));
        $this->assertNotNull(User::find($busy->id));

        $this->assertFalse($this->getJson("/api/tpo/students/{$busy->id}/manage")->json('can_remove'));

        $this->deleteJson("/api/tpo/students/{$fresh->id}")->assertOk();
        $this->assertNull(User::find($fresh->id));
        $this->assertTrue(ActivityLog::where('action', 'Removed a student account that had never been used')->exists());
    }

    public function test_the_history_lists_what_was_done_to_the_student(): void
    {
        $s = $this->student();

        Sanctum::actingAs($this->tpo);
        $this->postJson("/api/tpo/students/{$s->id}/block", ['reason' => 'Test block'])->assertOk();
        $this->postJson("/api/tpo/students/{$s->id}/unblock")->assertOk();

        $history = $this->getJson("/api/tpo/students/{$s->id}/manage")->assertOk()->json('history');
        $this->assertSame(['TPO unblocked a student', 'TPO blocked a student'], array_column($history, 'action'));
        $this->assertSame('Test block', $history[1]['reason']);
    }
}
