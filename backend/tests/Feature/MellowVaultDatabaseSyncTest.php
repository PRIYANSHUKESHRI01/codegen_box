<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Plan;
use App\Models\User;
use App\Models\VaultProfile;
use App\Models\VaultSyncEvent;
use App\Services\SubscriptionService;
use App\Services\PurchaseQuoteService;
use App\Services\Vault\VaultService;
use App\Services\Vault\VaultSyncService;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * VAULT_SYNC_DRIVER=database: a student who is ready (readiness >= 60) and has said yes is written into Mellow Vault's developer_details_tb,
 * taken down again when they withdraw, and marked hired when Mellow Vault books them - all through the same outbox the HTTP push uses.
 * The Mellow Vault table is stood up on a second in-memory connection with the same columns as the real one.
 */
class MellowVaultDatabaseSyncTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    private const CONN = 'mellow_vault';

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seed(PlanSeeder::class);

        config([
            'vault.driver' => 'database',
            'database.connections.'.self::CONN => ['driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => false],
        ]);
        DB::purge(self::CONN);
        $this->app->forgetInstance(\App\Services\Vault\MellowVaultDeveloperWriter::class);
        $this->app->forgetInstance(VaultSyncService::class);

        Schema::connection(self::CONN)->create('developer_details_tb', function ($t) {
            $t->increments('dev_id');
            $t->integer('pro_id');
            $t->string('name', 20);
            $t->string('last_name', 20);
            $t->tinyInteger('gender')->default(0);
            $t->string('phone', 10);
            $t->string('email', 50);
            $t->string('password', 500);
            $t->string('show_password', 500);
            $t->tinyInteger('professional_status')->nullable();
            $t->string('tpo_hod_email')->nullable();
            $t->tinyInteger('hod_verified')->default(0);
            $t->string('language', 50)->nullable();
            $t->string('clg_name', 100)->nullable();
            $t->string('education', 500)->nullable();
            $t->string('degree', 100)->nullable();
            $t->string('passing_year', 20)->nullable();
            $t->string('description', 1000)->nullable();
            $t->string('skills', 255)->nullable();
            $t->tinyInteger('developer_status')->nullable()->default(0);
            $t->integer('profile_complete')->nullable();
            $t->integer('login_status')->default(0);
            $t->date('date');
            $t->integer('college_id')->nullable();
            $t->tinyInteger('is_working_in_org')->default(0);
            $t->tinyInteger('is_aptrun_synced')->default(0);
            $t->unsignedBigInteger('aptrun_user_id')->nullable();
            $t->timestamp('aptrun_synced_at')->nullable();
        });
    }

    private function mv()
    {
        return DB::connection(self::CONN)->table('developer_details_tb');
    }

    private function buy(User $student): void
    {
        app(SubscriptionService::class)->purchase($student, app(PurchaseQuoteService::class)->quote($student, Plan::CODE_EXPERT));
    }

    /** A ready college student on a plan that includes the Vault, who has said yes. Returns [student, profile]. */
    private function listedStudent(array $attributes = []): array
    {
        $college = College::create(['name' => 'Tulas Institute of Technology', 'short_code' => 'TITM', 'tier' => 'Standard', 'city' => 'Dehradun']);
        User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id, 'email' => 'tpo@tulas.test']);

        $student = $this->strongStudent($attributes + [
            'name' => 'Asha Verma Nair', 'email' => 'asha@tulas.test', 'college_id' => $college->id, 'branch' => 'Computer Science',
            'bio' => 'Final-year student who likes backend work.', 'skills' => ['Laravel', 'MySQL'], 'primary_language' => 'PHP', 'graduation_year' => 2027,
        ]);
        $this->buy($student);

        Sanctum::actingAs($student->fresh());
        $this->postJson('/api/me/vault/consent')->assertOk()->assertJsonPath('profile.status', 'visible');

        return [$student->fresh(), VaultProfile::where('user_id', $student->id)->firstOrFail()];
    }

    private function sync(): void
    {
        $this->artisan('vault:sync')->assertSuccessful();
    }

    private function event(VaultProfile $profile, string $type): VaultSyncEvent
    {
        return VaultSyncEvent::where('profile_public_id', $profile->public_id)->where('type', $type)->latest('id')->firstOrFail();
    }

    // ───────────────────────────── listing ─────────────────────────────

    public function test_a_student_who_is_ready_and_has_agreed_becomes_a_developer_in_mellow_vault(): void
    {
        [$student, $profile] = $this->listedStudent();
        $this->sync();

        $this->assertSame(1, $this->mv()->count());
        $row = $this->mv()->first();

        $this->assertSame('Asha', $row->name);
        $this->assertSame('Verma Nair', $row->last_name);
        $this->assertSame('asha@tulas.test', $row->email);
        $this->assertSame('Tulas Institute of Technology', $row->clg_name);
        $this->assertSame('Computer Science', $row->degree);
        $this->assertSame('2027', $row->passing_year);
        $this->assertSame('Laravel, MySQL', $row->skills);
        $this->assertSame('PHP', $row->language);
        $this->assertSame(2, (int) $row->developer_status, 'available to employers');
        $this->assertSame(1, (int) $row->is_aptrun_synced);
        $this->assertSame($student->id, (int) $row->aptrun_user_id);
        $this->assertNotNull($row->aptrun_synced_at);

        // The college's own TPO vouches for a college student.
        $this->assertSame('tpo@tulas.test', $row->tpo_hod_email);
        $this->assertSame(1, (int) $row->hod_verified);

        // Nothing secret travels: no phone; the password is an unusable hash and show_password is empty.
        $this->assertSame('', $row->phone);
        $this->assertStringStartsWith('$2y$', $row->password);
        $this->assertSame('', $row->show_password);

        $this->assertSame((string) $row->dev_id, $profile->fresh()->external_id, 'the dev_id is remembered on the profile');
        $this->assertSame(VaultSyncEvent::STATUS_DELIVERED, $this->event($profile, VaultSyncEvent::TYPE_UPSERT)->status);
        $this->assertSame(VaultProfile::SYNC_DELIVERED, $profile->fresh()->sync_state);
    }

    public function test_the_domain_map_decides_pro_id_and_everyone_else_gets_the_default(): void
    {
        config(['vault.database.default_pro_id' => 7, 'vault.database.pro_ids' => ['laravel_developer' => 24]]);
        [, $profile] = $this->listedStudent();
        $profile->forceFill(['ai_interview_stack' => 'laravel_developer'])->save();

        $this->sync();
        $this->assertSame(24, (int) $this->mv()->value('pro_id'));
    }

    public function test_an_unmapped_student_gets_the_default_pro_id(): void
    {
        config(['vault.database.default_pro_id' => 7]);
        $this->listedStudent();
        $this->sync();

        $this->assertSame(7, (int) $this->mv()->value('pro_id'));
    }

    public function test_a_later_change_updates_the_same_developer_instead_of_adding_another(): void
    {
        [$student, $profile] = $this->listedStudent();
        $this->sync();

        $student->forceFill(['skills' => ['Laravel', 'MySQL', 'Redis']])->save();
        app(VaultService::class)->profileChanged($student);

        Carbon::setTestNow(now()->addHours(2));
        $this->sync();

        $this->assertSame(1, $this->mv()->count());
        // Skills were already filled in, and what is filled in is not overwritten: it is Mellow Vault's now.
        $this->assertSame('Laravel, MySQL', $this->mv()->value('skills'));
        $this->assertSame(2, $this->event($profile, VaultSyncEvent::TYPE_UPSERT)->sequence);
        Carbon::setTestNow();
    }

    public function test_college_verification_can_be_turned_off(): void
    {
        config(['vault.database.college_verified' => false]);
        $this->listedStudent();
        $this->sync();

        $row = $this->mv()->first();
        $this->assertSame(0, (int) $row->hod_verified);
    }

    // ───────────────────────────── somebody already there ─────────────────────────────

    public function test_a_developer_already_in_mellow_vault_is_linked_not_duplicated_and_nothing_of_theirs_is_overwritten(): void
    {
        [$student] = $this->listedStudent();

        $this->mv()->insert([
            'pro_id' => 61, 'name' => 'Asha', 'last_name' => 'V', 'phone' => '9876543210', 'email' => 'ASHA@tulas.test',
            'password' => 'their-own-hash', 'show_password' => 'their-own', 'description' => 'My own words.', 'developer_status' => 0,
            'login_status' => 1, 'date' => '2026-01-01', 'is_aptrun_synced' => 0, 'aptrun_user_id' => null,
        ]);

        $this->sync();

        $this->assertSame(1, $this->mv()->count(), 'matched by email, case-insensitively');
        $row = $this->mv()->first();

        // Theirs, untouched.
        $this->assertSame('V', $row->last_name);
        $this->assertSame('9876543210', $row->phone);
        $this->assertSame('their-own-hash', $row->password);
        $this->assertSame('My own words.', $row->description);
        $this->assertSame(61, (int) $row->pro_id);
        $this->assertSame(1, (int) $row->login_status);

        // Linked, filled where empty, and findable by employers again.
        $this->assertSame($student->id, (int) $row->aptrun_user_id);
        $this->assertSame(1, (int) $row->is_aptrun_synced);
        $this->assertSame('Tulas Institute of Technology', $row->clg_name);
        $this->assertSame('Laravel, MySQL', $row->skills);
        $this->assertSame(2, (int) $row->developer_status);
    }

    public function test_an_existing_aptrun_link_is_never_overwritten_and_a_developer_in_a_pipeline_stays_there(): void
    {
        $this->listedStudent();
        $this->mv()->insert([
            'pro_id' => 60, 'name' => 'Asha', 'last_name' => 'N', 'phone' => '', 'email' => 'asha@tulas.test', 'password' => 'x', 'show_password' => '',
            'developer_status' => 3, 'login_status' => 0, 'date' => '2026-01-01', 'is_aptrun_synced' => 1, 'aptrun_user_id' => 99999,
        ]);

        $this->sync();

        $row = $this->mv()->first();
        $this->assertSame(99999, (int) $row->aptrun_user_id, "that id is another system's");
        $this->assertSame(3, (int) $row->developer_status, 'in an interview pipeline: Mellow Vault owns it');
    }

    public function test_an_email_too_long_for_mellow_vault_fails_for_good_with_the_reason_and_writes_nothing(): void
    {
        $this->listedStudent(['email' => 'a.very.long.student.email.address.here@some-long-college-domain.ac.in']);
        // A parked event makes the command report failure, which is how the scheduler's log shows something needs a look.
        $this->artisan('vault:sync')->assertExitCode(1);

        $this->assertSame(0, $this->mv()->count());
        $event = VaultSyncEvent::firstOrFail();
        $this->assertSame(VaultSyncEvent::STATUS_DEAD, $event->status, 'retrying cannot make it shorter');
        $this->assertSame(1, $event->attempts);
        $this->assertStringContainsString('longer than', $event->last_error);
    }

    // ───────────────────────────── taking down ─────────────────────────────

    public function test_withdrawing_consent_takes_the_developer_out_of_view_but_not_out_of_the_table(): void
    {
        [$student, $profile] = $this->listedStudent();
        $this->sync();
        $devId = $this->mv()->value('dev_id');

        Sanctum::actingAs($student);
        $this->deleteJson('/api/me/vault/consent')->assertOk();
        $this->sync();

        $row = $this->mv()->where('dev_id', $devId)->first();
        $this->assertNotNull($row, 'never deleted: the developer may have a Mellow Vault account of their own');
        $this->assertSame(0, (int) $row->developer_status);
        $this->assertSame(VaultSyncEvent::STATUS_DELIVERED, $this->event($profile, VaultSyncEvent::TYPE_WITHDRAW)->status);
        // Who was taken down is not kept once it is done.
        $this->assertArrayNotHasKey('target', $this->event($profile, VaultSyncEvent::TYPE_WITHDRAW)->payload);
        $this->assertNull($profile->fresh()->vault_listed_at);
    }

    public function test_a_withdrawal_leaves_a_developer_in_a_pipeline_alone(): void
    {
        [$student] = $this->listedStudent();
        $this->sync();
        $this->mv()->update(['developer_status' => 3]);

        Sanctum::actingAs($student);
        $this->deleteJson('/api/me/vault/consent')->assertOk();
        $this->sync();

        $this->assertSame(3, (int) $this->mv()->value('developer_status'));
    }

    public function test_listing_comes_back_when_the_student_says_yes_again(): void
    {
        [$student] = $this->listedStudent();
        $this->sync();
        Sanctum::actingAs($student);
        $this->deleteJson('/api/me/vault/consent')->assertOk();
        $this->sync();
        $this->assertSame(0, (int) $this->mv()->value('developer_status'));

        $this->postJson('/api/me/vault/consent')->assertOk();
        $this->sync();

        $this->assertSame(1, $this->mv()->count());
        $this->assertSame(2, (int) $this->mv()->value('developer_status'));
    }

    // ───────────────────────────── optional columns ─────────────────────────────

    public function test_aptruns_own_scores_are_filled_when_mellow_vault_has_added_the_columns(): void
    {
        Schema::connection(self::CONN)->table('developer_details_tb', function ($t) {
            $t->string('aptrun_profile_id', 36)->nullable();
            $t->unsignedTinyInteger('aptrun_readiness_score')->nullable();
            $t->string('aptrun_readiness_tier', 30)->nullable();
            $t->decimal('aptrun_ai_interview_score', 5, 2)->nullable();
            $t->string('aptrun_ai_interview_stack', 60)->nullable();
            $t->tinyInteger('aptrun_listed')->default(0);
        });

        [, $profile] = $this->listedStudent();
        $this->sync();

        $row = DB::connection(self::CONN)->table('developer_details_tb')->first();
        $this->assertSame($profile->public_id, $row->aptrun_profile_id);
        $this->assertGreaterThanOrEqual(60, (int) $row->aptrun_readiness_score);
        $this->assertNotNull($row->aptrun_readiness_tier);
        $this->assertSame(1, (int) $row->aptrun_listed);
    }

    // ───────────────────────────── when Mellow Vault is down ─────────────────────────────

    public function test_an_unreachable_database_is_retried_not_given_up_on(): void
    {
        [, $profile] = $this->listedStudent();
        config(['database.connections.'.self::CONN.'.database' => '/this/does/not/exist/mellow.sqlite']);
        DB::purge(self::CONN);
        $this->app->forgetInstance(\App\Services\Vault\MellowVaultDeveloperWriter::class);
        $this->app->forgetInstance(VaultSyncService::class);

        $this->artisan('vault:sync');

        $event = $this->event($profile, VaultSyncEvent::TYPE_UPSERT);
        $this->assertSame(VaultSyncEvent::STATUS_FAILED, $event->status, 'waiting for the next attempt');
        $this->assertTrue($event->available_at->isFuture());
        $this->assertSame(VaultProfile::SYNC_FAILED, $profile->fresh()->sync_state);
    }

    public function test_the_admin_summary_says_which_hand_off_is_in_use_and_whether_it_can_reach_it(): void
    {
        $health = app(VaultSyncService::class)->health();

        $this->assertSame('database', $health['driver']);
        $this->assertTrue($health['configured']);
        $this->assertTrue($health['database_reachable']);

        config(['vault.driver' => 'http']);
        $this->app->forgetInstance(VaultSyncService::class);
        $this->assertSame('http', app(VaultSyncService::class)->health()['driver']);
        $this->assertNull(app(VaultSyncService::class)->health()['database_reachable']);
    }

    // ───────────────────────────── the way back ─────────────────────────────

    public function test_a_student_mellow_vault_has_booked_is_marked_hired_here(): void
    {
        [, $profile] = $this->listedStudent();
        $this->sync();
        $this->mv()->update(['developer_status' => 4]);

        // A different developer that is booked but that AptRun never delivered must not be mistaken for anyone.
        $this->mv()->insert([
            'pro_id' => 1, 'name' => 'Other', 'last_name' => 'Person', 'phone' => '', 'email' => 'other@x.test', 'password' => 'x', 'show_password' => '',
            'developer_status' => 4, 'login_status' => 0, 'date' => '2026-01-01', 'is_aptrun_synced' => 1, 'aptrun_user_id' => $profile->user_id,
        ]);

        $this->artisan('vault:pull-outcomes')->assertSuccessful();

        $profile = $profile->fresh();
        $this->assertSame(VaultProfile::STATUS_HIRED, $profile->visibility_status);
        $this->assertSame(VaultProfile::HIRED_VIA_VAULT, $profile->hired_via);
    }

    public function test_pulling_outcomes_does_nothing_on_the_http_driver(): void
    {
        [, $profile] = $this->listedStudent();
        $this->sync();
        $this->mv()->update(['developer_status' => 4]);
        config(['vault.driver' => 'http']);
        $this->app->forgetInstance(VaultSyncService::class);

        $this->artisan('vault:pull-outcomes')->assertSuccessful();

        $this->assertSame(VaultProfile::STATUS_VISIBLE, $profile->fresh()->visibility_status);
    }
}
