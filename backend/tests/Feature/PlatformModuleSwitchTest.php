<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\MockInterviewQuestion;
use App\Models\Plan;
use App\Models\PlatformModule;
use App\Models\User;
use App\Services\Mock\MockInterviewCatalog;
use App\Services\SubscriptionService;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Superadmin -> Merchant Navy: one switch that shows or hides the whole section for every student at once - the sidebar group, the page, the
 * "Merchant Navy" card in the Mock AI Interview - and is enforced by the server, not just hidden by the browser.
 */
class PlatformModuleSwitchTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-battery';

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seed(PlanSeeder::class);
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function student(): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);
        app(SubscriptionService::class)->grantIndividualPlan($student, Plan::where('code', Plan::CODE_EXPERT)->firstOrFail(), $this->superadmin(), [
            'days' => 365, 'kind' => 'complimentary', 'reason' => 'Test',
        ]);

        return $student->fresh();
    }

    /** A Second Mate round with enough questions to be startable. */
    private function seedRound(): void
    {
        foreach (range(1, 6) as $i) {
            MockInterviewQuestion::create([
                'stack_key' => 'second_mate_fg', 'round_number' => 1, 'position' => $i, 'topic' => 'Collision regulations',
                'text' => "What must a give-way vessel do in situation number {$i}?",
                'category' => 'technical', 'duration_seconds' => 90, 'note' => "Take early and substantial action, number {$i}.",
            ]);
        }

        app(MockInterviewCatalog::class)->flush();
    }

    private function switchModule(bool $on): void
    {
        Sanctum::actingAs($this->superadmin());
        $this->putJson('/api/superadmin/platform-modules/merchant_navy', ['enabled' => $on])->assertOk();
    }

    private function domains(): array
    {
        return collect($this->getJson('/api/mock-interviews/catalog')->assertOk()->json('roles'))->pluck('key')->all();
    }

    public function test_it_ships_on_so_deploying_it_changes_nothing(): void
    {
        $this->assertTrue(PlatformModule::where('key', 'merchant_navy')->value('enabled'));

        Sanctum::actingAs($this->student());
        $this->assertContains('merchant_navy', $this->domains());
        $this->getJson('/api/me')->assertJsonPath('user.capabilities.merchant_navy', true);
    }

    public function test_with_no_row_or_no_table_it_stays_on(): void
    {
        PlatformModule::query()->delete();
        Sanctum::actingAs($this->student());
        $this->assertContains('merchant_navy', $this->domains());

        Schema::drop('platform_modules');
        $this->app->forgetInstance(\App\Services\PlatformModules::class);
        $this->assertTrue(app(\App\Services\PlatformModules::class)->enabled('merchant_navy'));
    }

    public function test_switching_off_removes_the_card_the_capability_and_changes_the_signal_at_once(): void
    {
        $student = $this->student();
        Sanctum::actingAs($student);
        $before = $this->getJson('/api/me/plan-signal')->assertOk()->json();
        $this->assertTrue($before['modules']['merchant_navy']);

        $this->switchModule(false);

        Sanctum::actingAs($student);
        $this->assertNotContains('merchant_navy', $this->domains());
        $this->getJson('/api/me')->assertJsonPath('user.capabilities.merchant_navy', false);

        $after = $this->getJson('/api/me/plan-signal')->json();
        $this->assertFalse($after['modules']['merchant_navy']);
        $this->assertNotSame($before['modules_signature'], $after['modules_signature']);
        // Not a plan change: the plan signature must not move, or every student would be told their plan changed.
        $this->assertSame($before['signature'], $after['signature']);
    }

    public function test_switching_back_on_brings_it_back(): void
    {
        $this->switchModule(false);
        $this->switchModule(true);

        Sanctum::actingAs($this->student());
        $this->assertContains('merchant_navy', $this->domains());
        $this->getJson('/api/me')->assertJsonPath('user.capabilities.merchant_navy', true);
    }

    public function test_a_switched_off_round_cannot_be_started_even_by_calling_the_api_directly(): void
    {
        $this->seedRound();
        $student = $this->student();

        Sanctum::actingAs($student);
        $this->postJson('/api/mock-interviews/rounds/mock-second_mate_fg-r1/start')->assertCreated();

        $this->switchModule(false);

        Sanctum::actingAs($student);
        $this->postJson('/api/mock-interviews/rounds/mock-second_mate_fg-r1/start')
            ->assertForbidden()
            ->assertJsonPath('code', 'module_unavailable')
            ->assertJsonPath('module', 'merchant_navy');

        // Other domains are untouched.
        $this->assertNotEmpty($this->domains());
    }

    public function test_a_finished_sitting_cannot_be_re_sat_while_it_is_off(): void
    {
        $this->seedRound();
        $student = $this->student();
        Sanctum::actingAs($student);

        $slug = $this->postJson('/api/mock-interviews/rounds/mock-second_mate_fg-r1/start')->json('interview.slug');
        $interview = Interview::where('slug', $slug)->firstOrFail();
        $this->assertSame('maritime', $interview->discipline);
        // Opening the room is what creates the student's session.
        $this->postJson("/api/interviews/{$slug}/start")->assertOk();

        InterviewSession::where('interview_id', $interview->id)->where('user_id', $student->id)->update(['status' => InterviewSession::STATUS_COMPLETED]);

        $this->switchModule(false);
        Sanctum::actingAs($student);
        $this->postJson("/api/interviews/{$interview->slug}/reattempt")->assertForbidden()->assertJsonPath('code', 'module_unavailable');
    }

    public function test_staff_can_still_prepare_the_question_bank_while_it_is_off(): void
    {
        $this->seedRound();
        $this->switchModule(false);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $stacks = collect($this->getJson('/api/admin/mock-interview-bank/coverage')->assertOk()->json());
        $this->assertStringContainsString('second_mate_fg', $stacks->toJson());
    }

    public function test_only_a_superadmin_can_switch_it_and_the_change_is_audited_once(): void
    {
        Sanctum::actingAs($this->student());
        $this->putJson('/api/superadmin/platform-modules/merchant_navy', ['enabled' => false])->assertForbidden();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]));
        $this->putJson('/api/superadmin/platform-modules/merchant_navy', ['enabled' => false])->assertForbidden();
        $this->assertTrue(PlatformModule::where('key', 'merchant_navy')->value('enabled'));

        $admin = $this->superadmin();
        Sanctum::actingAs($admin);
        $this->putJson('/api/superadmin/platform-modules/merchant_navy', ['enabled' => false])->assertOk()->assertJsonPath('changed', true)->assertJsonPath('module.enabled', false);
        // A repeated click (or a second tab) is a no-op and writes nothing more.
        $this->putJson('/api/superadmin/platform-modules/merchant_navy', ['enabled' => false])->assertOk()->assertJsonPath('changed', false);

        $this->assertSame(1, ActivityLog::where('target_type', 'Platform module')->count());
        $this->assertDatabaseHas('platform_modules', ['key' => 'merchant_navy', 'enabled' => false, 'updated_by' => $admin->id]);
        $this->getJson('/api/superadmin/platform-modules')->assertOk()
            ->assertJsonPath('modules.0.key', 'merchant_navy')
            ->assertJsonPath('modules.0.enabled', false)
            ->assertJsonPath('modules.0.updated_by_name', $admin->name)
            ->assertJsonPath('history.0.enabled', false);
    }

    public function test_it_validates_the_request_and_knows_which_modules_exist(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->putJson('/api/superadmin/platform-modules/merchant_navy', [])->assertStatus(422)->assertJsonValidationErrors('enabled');
        $this->putJson('/api/superadmin/platform-modules/not-a-thing', ['enabled' => true])->assertNotFound();
    }

    public function test_the_superadmin_sees_what_would_go_live(): void
    {
        $this->seedRound();
        Sanctum::actingAs($this->superadmin());

        $content = collect($this->getJson('/api/superadmin/platform-modules')->assertOk()->json('modules.0.content'));
        $secondMate = $content->firstWhere('key', 'second_mate_fg');

        $this->assertNotNull($secondMate);
        $this->assertTrue($secondMate['live']);
        $this->assertSame(6, $secondMate['questions']);
    }
}
