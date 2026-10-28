<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CollegeDepartmentService;
use App\Support\AcademicYear;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A TPO corrects a student's year or section - one student at a time, or a selection - and it takes effect straight away: the answer
 * carries the refreshed roster row, the section coordinator's view follows, and the student's own open tab is told through the plan
 * signal's academic marker (without that ever reading as a plan change).
 */
class TpoEditStudentYearSectionTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seed(PlanSeeder::class);
        $this->travelTo(now()->setDate(2026, 10, 28)->setTime(10, 0));
    }

    private function college(): College
    {
        $n = ++$this->seq;
        $college = College::create(['name' => "Edit College {$n}", 'short_code' => "EC{$n}", 'tier' => 'Standard']);
        app(CollegeDepartmentService::class)->initialise($college, ['engineering'], User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $plan = Plan::create([
            'code' => 'ed-'.uniqid(), 'name' => 'Standard', 'audience' => Plan::AUDIENCE_INSTITUTION, 'list_price' => null,
            'annual_price' => 149000, 'duration_days' => 365, 'is_active' => true, 'sort_order' => 1, 'drive_access' => true, 'max_students' => 500,
        ]);
        Subscription::create([
            'subscriber_type' => College::class, 'subscriber_id' => $college->id, 'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE, 'started_at' => now()->subMonth(), 'current_period_end' => now()->addYear(), 'auto_renew' => false,
        ]);

        return $college;
    }

    private function tpo(College $college): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
    }

    private function student(College $college, ?int $year = null, ?string $section = 'A'): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college->id, 'branch' => 'CSE', 'section' => $section]);

        if ($year !== null) {
            $student->forceFill(['graduation_year' => AcademicYear::graduationYearFor($year)])->save();
        }

        return $student->fresh();
    }

    // ───────────────────────── one student ─────────────────────────

    public function test_a_tpo_changes_a_students_year_and_gets_the_refreshed_row_back(): void
    {
        $college = $this->college();
        $student = $this->student($college, 3);
        Sanctum::actingAs($this->tpo($college));

        $this->patchJson("/api/tpo/students/{$student->id}", ['year' => 4])
            ->assertOk()
            ->assertJsonPath('student.id', $student->id)
            ->assertJsonPath('student.study_year', 4)
            ->assertJsonPath('student.year_label', '4th year');

        $this->assertSame(4, $student->fresh()->study_year);
    }

    public function test_a_tpo_changes_a_students_section(): void
    {
        $college = $this->college();
        $student = $this->student($college, 3, 'A');
        Sanctum::actingAs($this->tpo($college));

        $this->patchJson("/api/tpo/students/{$student->id}", ['section' => '  B  '])
            ->assertOk()
            ->assertJsonPath('student.section', 'B');

        $this->assertSame('B', $student->fresh()->section);
        $this->assertSame(3, $student->fresh()->study_year, 'the year was not sent, so it is not touched');
    }

    public function test_year_and_section_can_change_together(): void
    {
        $college = $this->college();
        $student = $this->student($college, 2, 'A');
        Sanctum::actingAs($this->tpo($college));

        $this->patchJson("/api/tpo/students/{$student->id}", ['year' => 3, 'section' => 'C'])->assertOk();

        $fresh = $student->fresh();
        $this->assertSame(3, $fresh->study_year);
        $this->assertSame('C', $fresh->section);
    }

    public function test_a_year_can_be_taken_back_to_not_set_and_a_blank_section_to_none(): void
    {
        $college = $this->college();
        $student = $this->student($college, 3, 'A');
        Sanctum::actingAs($this->tpo($college));

        $this->patchJson("/api/tpo/students/{$student->id}", ['year' => null, 'section' => ''])
            ->assertOk()
            ->assertJsonPath('student.study_year', null)
            ->assertJsonPath('student.section', null);

        $fresh = $student->fresh();
        $this->assertNull($fresh->graduation_year);
        $this->assertNull($fresh->section);
    }

    public function test_the_row_carries_the_new_vault_ai_standing_at_once(): void
    {
        $college = $this->college();
        $student = $this->student($college, 3);
        $student->forceFill(['first_login_at' => now()->subDays(10)])->save();
        Sanctum::actingAs($this->tpo($college));

        $this->patchJson("/api/tpo/students/{$student->id}", ['year' => 4])
            ->assertOk()
            ->assertJsonPath('student.vault_ai.required_days', 45)
            ->assertJsonPath('student.vault_ai.days_remaining', 35);
    }

    public function test_an_edit_that_changes_nothing_asked_for_is_refused(): void
    {
        $college = $this->college();
        $student = $this->student($college, 3);
        Sanctum::actingAs($this->tpo($college));

        $this->patchJson("/api/tpo/students/{$student->id}", [])->assertUnprocessable();
    }

    public function test_only_real_years_and_sane_sections_are_accepted(): void
    {
        $college = $this->college();
        $student = $this->student($college, 3);
        Sanctum::actingAs($this->tpo($college));

        $this->patchJson("/api/tpo/students/{$student->id}", ['year' => 5])->assertUnprocessable()->assertJsonValidationErrors('year');
        $this->patchJson("/api/tpo/students/{$student->id}", ['year' => 0])->assertUnprocessable()->assertJsonValidationErrors('year');
        $this->patchJson("/api/tpo/students/{$student->id}", ['section' => str_repeat('x', 21)])->assertUnprocessable()->assertJsonValidationErrors('section');
        $this->assertSame(3, $student->fresh()->study_year);
    }

    public function test_another_colleges_student_is_a_404_and_stays_untouched(): void
    {
        $mine = $this->college();
        $theirs = $this->college();
        $stranger = $this->student($theirs, 2, 'Z');
        Sanctum::actingAs($this->tpo($mine));

        $this->patchJson("/api/tpo/students/{$stranger->id}", ['year' => 4, 'section' => 'A'])->assertNotFound();

        $this->assertSame(2, $stranger->fresh()->study_year);
        $this->assertSame('Z', $stranger->fresh()->section);
    }

    public function test_staff_of_the_same_college_cannot_be_edited_as_students(): void
    {
        $college = $this->college();
        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $college->id]);
        Sanctum::actingAs($this->tpo($college));

        $this->patchJson("/api/tpo/students/{$coordinator->id}", ['year' => 4])->assertNotFound();
        $this->assertNull($coordinator->fresh()->graduation_year);
    }

    public function test_a_student_cannot_edit_themselves_or_anyone(): void
    {
        $college = $this->college();
        $student = $this->student($college, 3);
        Sanctum::actingAs($student);

        $this->patchJson("/api/tpo/students/{$student->id}", ['year' => 4])->assertForbidden();
        $this->assertSame(3, $student->fresh()->study_year);
    }

    // ───────────────────────── a selection, by section ─────────────────────────

    public function test_a_tpo_moves_a_selection_to_a_section(): void
    {
        $college = $this->college();
        $a = $this->student($college, 3, 'A');
        $b = $this->student($college, 4, null);
        $left = $this->student($college, 3, 'A');
        Sanctum::actingAs($this->tpo($college));

        $this->postJson('/api/tpo/students/section', ['student_ids' => [$a->id, $b->id], 'section' => ' C '])
            ->assertOk()
            ->assertJsonPath('updated', 2)
            ->assertJsonPath('section', 'C')
            ->assertJsonPath('message', 'Moved 2 student(s) to section C.');

        $this->assertSame('C', $a->fresh()->section);
        $this->assertSame('C', $b->fresh()->section);
        $this->assertSame('A', $left->fresh()->section);
        $this->assertSame(4, $b->fresh()->study_year, 'years are untouched');
    }

    public function test_a_selection_can_be_taken_out_of_its_section(): void
    {
        $college = $this->college();
        $a = $this->student($college, 3, 'A');
        Sanctum::actingAs($this->tpo($college));

        $this->postJson('/api/tpo/students/section', ['student_ids' => [$a->id], 'section' => null])->assertOk()->assertJsonPath('section', null);

        $this->assertNull($a->fresh()->section);
    }

    public function test_bulk_section_cannot_reach_another_college_or_staff(): void
    {
        $mine = $this->college();
        $theirs = $this->college();
        $stranger = $this->student($theirs, 2, 'Z');
        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $mine->id, 'section' => 'Q']);
        Sanctum::actingAs($this->tpo($mine));

        $this->postJson('/api/tpo/students/section', ['student_ids' => [$stranger->id, $coordinator->id], 'section' => 'A'])->assertOk()->assertJsonPath('updated', 0);

        $this->assertSame('Z', $stranger->fresh()->section);
        $this->assertSame('Q', $coordinator->fresh()->section);
    }

    public function test_bulk_section_requires_the_section_to_be_stated(): void
    {
        $college = $this->college();
        $s = $this->student($college, 3);
        Sanctum::actingAs($this->tpo($college));

        $this->postJson('/api/tpo/students/section', ['student_ids' => [$s->id]])->assertUnprocessable()->assertJsonValidationErrors('section');
        $this->postJson('/api/tpo/students/section', ['student_ids' => [], 'section' => 'A'])->assertUnprocessable()->assertJsonValidationErrors('student_ids');
    }

    // ───────────────────────── real time, on the student's side ─────────────────────────

    public function test_the_students_plan_signal_tells_their_open_tab_when_the_college_changes_their_year_or_section(): void
    {
        $college = $this->college();
        $student = $this->student($college, 3, 'A');
        $tpo = $this->tpo($college);

        Sanctum::actingAs($student);
        $before = $this->getJson('/api/me/plan-signal')->assertOk()->json();
        $this->assertNotNull($before['academic_signature']);
        $this->assertSame($before['academic_signature'], $this->getJson('/api/me/plan-signal')->json('academic_signature'), 'stable while nothing changes');

        Sanctum::actingAs($tpo);
        $this->patchJson("/api/tpo/students/{$student->id}", ['year' => 4])->assertOk();

        Sanctum::actingAs($student->fresh());
        $afterYear = $this->getJson('/api/me/plan-signal')->json();
        $this->assertNotSame($before['academic_signature'], $afterYear['academic_signature']);
        $this->assertSame($before['signature'], $afterYear['signature'], 'a year change is never a plan change');

        Sanctum::actingAs($tpo);
        $this->patchJson("/api/tpo/students/{$student->id}", ['section' => 'B'])->assertOk();

        Sanctum::actingAs($student->fresh());
        $this->assertNotSame($afterYear['academic_signature'], $this->getJson('/api/me/plan-signal')->json('academic_signature'));
    }

    public function test_the_changed_year_reaches_the_students_vault_ai_countdown_immediately(): void
    {
        $college = $this->college();
        $student = $this->student($college, 3);
        $student->forceFill(['first_login_at' => now()])->save();

        Sanctum::actingAs($student->fresh());
        $this->getJson('/api/vault-qualification/access')->assertJsonPath('access.days_remaining', 90);

        Sanctum::actingAs($this->tpo($college));
        $this->patchJson("/api/tpo/students/{$student->id}", ['year' => 4])->assertOk();

        Sanctum::actingAs($student->fresh());
        $this->getJson('/api/vault-qualification/access')->assertJsonPath('access.days_remaining', 45)->assertJsonPath('access.required_days', 45);
    }

    public function test_a_year_moved_down_to_second_year_takes_the_interview_away(): void
    {
        $college = $this->college();
        $student = $this->student($college, 4);
        Sanctum::actingAs($this->tpo($college));
        $this->patchJson("/api/tpo/students/{$student->id}", ['year' => 2])->assertOk();

        Sanctum::actingAs($student->fresh());
        $this->getJson('/api/vault-qualification/access')->assertJsonPath('access.state', 'unavailable');
    }

    public function test_the_signal_carries_no_academic_marker_for_staff(): void
    {
        Sanctum::actingAs($this->tpo($this->college()));

        $this->getJson('/api/me/plan-signal')->assertOk()->assertJsonPath('academic_signature', null);
    }
}
