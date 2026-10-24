<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\Discipline;
use App\Models\DisciplinePilot;
use App\Models\User;
use App\Support\BranchCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Staged rollout of Core Prep: a branch family can be shown to chosen pilot colleges before it is live for everyone.
 * The pilot opens the student module (nav, practice, tests, the track question) for those colleges only; scoring,
 * the Vault and the TPO analytics keep waiting for the real go-live.
 */
class CorePrepPilotTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    private function college(): College
    {
        $n = ++$this->seq;

        return College::create(['name' => "Pilot College {$n}", 'short_code' => "PC{$n}", 'tier' => 'Standard']);
    }

    private function student(College $college, string $branch = 'ECE'): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'branch' => $branch, 'college_id' => $college->id]);
    }

    private function superadmin(): User
    {
        return User::factory()->create(['role' => User::ROLE_SUPERADMIN]);
    }

    private function publish(int $n = 3, string $discipline = 'ece'): void
    {
        $subject = CoreSubject::where('discipline_code', $discipline)->where('code', 'analog_circuits')->firstOrFail();

        for ($i = 1; $i <= $n; $i++) {
            CoreQuestion::create([
                'external_id' => "P-{$discipline}-{$i}", 'discipline_code' => $discipline, 'subject_id' => $subject->id, 'topic_id' => $subject->topics()->first()->id,
                'type' => 'mcq_single', 'stem' => "Q {$i}", 'options' => [['id' => 'a', 'text' => 'x'], ['id' => 'b', 'text' => 'y']], 'correct' => ['a'],
                'marks' => 1, 'negative_marks' => 0, 'difficulty' => 'medium', 'usage' => 'both', 'status' => 'published',
            ]);
        }
    }

    private function pilot(College $college, string $discipline = 'ece'): void
    {
        DisciplinePilot::create(['discipline_code' => $discipline, 'college_id' => $college->id]);
        app(BranchCatalog::class)->flush();
    }

    // ───────────────────────────── what students see ─────────────────────────────

    public function test_a_pilot_college_sees_core_prep_while_everyone_else_does_not(): void
    {
        $apex = $this->college();
        $other = $this->college();
        $this->publish(3);
        $this->pilot($apex);

        Sanctum::actingAs($this->student($apex));
        $this->getJson('/api/core')->assertOk()->assertJsonPath('available', true)->assertJsonPath('live', false)->assertJsonPath('discipline.code', 'ece');
        $this->getJson('/api/me/subscription')->assertJsonPath('entitlements.core_prep.available', true)->assertJsonPath('entitlements.core_prep.pilot', true);
        $this->postJson('/api/core/practice/next')->assertOk();

        Sanctum::actingAs($this->student($other));
        $this->getJson('/api/core')->assertOk()->assertJsonPath('available', false);
        $this->postJson('/api/core/practice/next')->assertNotFound();
    }

    public function test_a_pilot_is_per_branch_family_and_never_reaches_cse(): void
    {
        $apex = $this->college();
        $this->publish(3);
        $this->pilot($apex, 'ece');

        Sanctum::actingAs($this->student($apex, 'Mechanical'));
        $this->getJson('/api/core')->assertJsonPath('available', false);

        Sanctum::actingAs($this->student($apex, 'CSE'));
        $this->getJson('/api/core')->assertJsonPath('available', false);
    }

    public function test_a_pilot_still_needs_published_questions(): void
    {
        $apex = $this->college();
        $this->pilot($apex);

        Sanctum::actingAs($this->student($apex));
        $this->getJson('/api/core')->assertJsonPath('available', false);
        $this->getJson('/api/me/subscription')->assertJsonPath('entitlements.core_prep.has_content', false)->assertJsonPath('entitlements.core_prep.pilot', true);
    }

    public function test_the_track_question_is_asked_of_pilot_students_only(): void
    {
        $apex = $this->college();
        $other = $this->college();
        $this->pilot($apex);

        $inPilot = $this->student($apex)->fresh();
        $outside = $this->student($other)->fresh();

        $this->assertTrue($inPilot->core_enabled);
        $this->assertTrue($inPilot->branch_pending);      // recognised branch, no track chosen yet → ask
        $this->assertFalse($outside->core_enabled);
        $this->assertFalse($outside->branch_pending);     // nothing to offer them yet → don't ask
        $this->assertFalse($this->student($apex, 'CSE')->fresh()->core_enabled);
    }

    public function test_going_live_opens_it_for_every_college(): void
    {
        $apex = $this->college();
        $other = $this->college();
        $this->publish(3);
        $this->pilot($apex);

        Discipline::where('code', 'ece')->update(['is_live' => true, 'live_at' => now()]);
        app(BranchCatalog::class)->flush();

        Sanctum::actingAs($this->student($other));
        $this->getJson('/api/core')->assertJsonPath('available', true)->assertJsonPath('live', true);

        Sanctum::actingAs($this->student($apex));
        $this->getJson('/api/me/subscription')->assertJsonPath('entitlements.core_prep.pilot', false);   // live, no longer "pilot"
    }

    // ───────────────────────────── managing pilots ─────────────────────────────

    public function test_only_a_superadmin_can_set_pilot_colleges_and_the_change_is_audited(): void
    {
        $apex = $this->college();
        $url = '/api/superadmin/core/disciplines/ece/pilots';

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_CORE_PREP]]));
        $this->putJson($url, ['college_ids' => [$apex->id]])->assertForbidden();

        Sanctum::actingAs($this->superadmin());
        $this->putJson($url, ['college_ids' => [$apex->id]])->assertOk()
            ->assertJsonPath('discipline.stage', 'pilot')
            ->assertJsonPath('discipline.pilots.0.college_id', $apex->id)
            ->assertJsonPath('discipline.pilots.0.name', $apex->name);

        $this->assertDatabaseHas('discipline_pilots', ['discipline_code' => 'ece', 'college_id' => $apex->id]);
        $this->assertSame(1, ActivityLog::where('action', 'Changed Core Prep pilot colleges')->count());
    }

    public function test_pilots_are_replaced_not_appended_and_an_empty_list_ends_the_pilot(): void
    {
        [$a, $b] = [$this->college(), $this->college()];
        Sanctum::actingAs($this->superadmin());
        $url = '/api/superadmin/core/disciplines/ece/pilots';

        $this->putJson($url, ['college_ids' => [$a->id, $b->id]])->assertOk();
        $this->putJson($url, ['college_ids' => [$b->id]])->assertOk()->assertJsonCount(1, 'discipline.pilots');
        $this->assertDatabaseMissing('discipline_pilots', ['college_id' => $a->id]);

        $this->putJson($url, ['college_ids' => []])->assertOk()->assertJsonPath('discipline.stage', 'off');
        $this->assertSame(0, DisciplinePilot::count());
    }

    public function test_removing_a_pilot_takes_effect_immediately(): void
    {
        $apex = $this->college();
        $this->publish(2);
        $student = $this->student($apex);

        Sanctum::actingAs($this->superadmin());
        $this->putJson('/api/superadmin/core/disciplines/ece/pilots', ['college_ids' => [$apex->id]])->assertOk();

        Sanctum::actingAs($student);
        $this->getJson('/api/core')->assertJsonPath('available', true);

        Sanctum::actingAs($this->superadmin());
        $this->putJson('/api/superadmin/core/disciplines/ece/pilots', ['college_ids' => []])->assertOk();

        Sanctum::actingAs($student);
        $this->getJson('/api/core')->assertJsonPath('available', false);
    }

    public function test_pilot_input_is_validated(): void
    {
        Sanctum::actingAs($this->superadmin());

        $this->putJson('/api/superadmin/core/disciplines/ece/pilots', ['college_ids' => [999999]])->assertStatus(422)->assertJsonValidationErrors('college_ids.0');
        $this->putJson('/api/superadmin/core/disciplines/ece/pilots', [])->assertStatus(422)->assertJsonValidationErrors('college_ids');
        $this->putJson('/api/superadmin/core/disciplines/cse/pilots', ['college_ids' => []])->assertNotFound();   // no Core Prep for CSE
    }

    public function test_coverage_reports_the_stage_and_offers_colleges_to_superadmins_only(): void
    {
        $apex = $this->college();
        $this->student($apex);
        $this->student($apex);
        $this->pilot($apex);

        Sanctum::actingAs($this->superadmin());
        $res = $this->getJson('/api/admin/core/coverage')->assertOk();
        $ece = collect($res->json('disciplines'))->firstWhere('discipline', 'ece');
        $this->assertSame('pilot', $ece['stage']);
        $this->assertSame(2, $ece['pilots'][0]['students']);
        $this->assertSame(2, collect($res->json('colleges'))->firstWhere('id', $apex->id)['students']['ece']);
        $this->assertSame('off', collect($res->json('disciplines'))->firstWhere('discipline', 'mech')['stage']);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_CORE_PREP]]));
        $this->getJson('/api/admin/core/coverage')->assertOk()->assertJsonMissingPath('colleges');
    }

    public function test_a_pilot_does_not_switch_on_scoring_or_the_vault(): void
    {
        $apex = $this->college();
        $this->publish(3);
        $this->pilot($apex);

        // Readiness/Vault/TPO analytics still key off the global switch: a pilot is a student-facing preview only.
        $this->assertFalse(app(\App\Services\Core\CoreAccess::class)->liveFamily('ece'));
        $this->assertTrue(app(BranchCatalog::class)->coreEnabledFor('ece', $apex->id));
        $this->assertFalse(app(BranchCatalog::class)->coreEnabledFor('ece', null));
    }

    public function test_deleting_a_college_drops_its_pilot_rows(): void
    {
        $apex = $this->college();
        $this->pilot($apex);

        $apex->delete();

        $this->assertSame(0, DisciplinePilot::count());
    }
}
