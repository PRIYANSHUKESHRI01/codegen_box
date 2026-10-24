<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\Discipline;
use App\Models\User;
use App\Support\BranchCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * What the rest of the product says about a core-branch student once Core Prep is live: the TPO's cohort row (Core
 * block, engagement that counts Core practice) and the student's own weekly Core goals.
 */
class CoreCohortAndWeeklyTest extends TestCase
{
    use RefreshDatabase;

    private College $college;

    private User $tpo;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        config(['readiness.core.counts_towards_score' => true]); // these tests are about what Core activity does once it counts

        $this->college = College::create(['name' => 'Core Cohort College', 'short_code' => 'CCC']);
        $this->tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college->id]);
    }

    private function live(string $discipline = 'ece'): void
    {
        Discipline::where('code', $discipline)->update(['is_live' => true, 'live_at' => now()->subDays(90)]);
        app(BranchCatalog::class)->flush();
    }

    private function student(string $branch, array $over = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $this->college->id, 'must_change_password' => false, 'branch' => $branch] + $over);
    }

    private function question(string $subjectCode): CoreQuestion
    {
        $subject = CoreSubject::where('discipline_code', 'ece')->where('code', $subjectCode)->firstOrFail();
        $n = ++$this->seq;

        return CoreQuestion::create([
            'external_id' => "CC-{$n}", 'discipline_code' => 'ece', 'subject_id' => $subject->id, 'topic_id' => $subject->topics()->first()->id, 'type' => 'mcq_single',
            'stem' => "Q{$n}?", 'options' => [['id' => 'a', 'text' => 'right'], ['id' => 'b', 'text' => 'wrong']], 'correct' => ['a'],
            'marks' => 1, 'negative_marks' => 0, 'difficulty' => 'medium', 'usage' => 'both', 'status' => 'published',
        ]);
    }

    private function answer(User $student, CoreQuestion $q, bool $correct, $at = null): void
    {
        $at ??= now()->subHour();
        DB::table('core_practice_answers')->insert([
            'user_id' => $student->id, 'core_question_id' => $q->id, 'subject_id' => $q->subject_id, 'topic_id' => $q->topic_id,
            'is_correct' => $correct, 'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    private function cohort(): array
    {
        Sanctum::actingAs($this->tpo);

        return collect($this->getJson('/api/tpo/students/cohort')->assertOk()->json('students'))->keyBy('id')->all();
    }

    public function test_a_core_student_who_only_practises_core_is_active_and_their_row_names_their_weakest_subject(): void
    {
        $this->live('ece');
        $analog = $this->question('analog_circuits');
        $digital = $this->question('digital_circuits');

        $ece = $this->student('ECE', ['track_focus' => 'core_first']);
        foreach (range(1, 4) as $i) {
            $this->answer($ece, $analog, true, now()->subDays($i));     // 4 of 4 right in Analog
            $this->answer($ece, $digital, $i === 1, now()->subDays($i)); // 1 of 4 right in Digital
        }

        $idle = $this->student('ECE', ['track_focus' => 'core_first']);
        $cse = $this->student('CSE');

        $rows = $this->cohort();

        $this->assertSame('active', $rows[$ece->id]['activity']['engagement'], 'Core practice is practice');
        $this->assertSame(4, $rows[$ece->id]['activity']['active_days_30']);
        $this->assertSame('Digital Circuits', $rows[$ece->id]['core']['weakest_subject']);
        $this->assertSame(25, $rows[$ece->id]['core']['weakest_accuracy']);
        $this->assertSame(8, $rows[$ece->id]['core']['answered_30d']);
        $this->assertContains($rows[$ece->id]['core']['profile'], ['core', 'software'], 'the grace period may keep the software weights');
        $this->assertSame('core', $rows[$idle->id]['core']['profile'] ?? 'core');
        $this->assertSame('not_started', $rows[$idle->id]['activity']['engagement']);
        $this->assertNull($rows[$idle->id]['core']['weakest_subject']);

        $this->assertNull($rows[$cse->id]['core'], 'a CSE row carries no Core block');
    }

    public function test_a_branch_whose_core_prep_is_not_live_has_no_core_block(): void
    {
        $student = $this->student('Mechanical', ['track_focus' => 'core_first']);

        $this->assertNull($this->cohort()[$student->id]['core']);
    }

    public function test_the_heatmap_shows_branch_by_subject_accuracy_for_this_college_only_and_calls_out_a_weak_subject(): void
    {
        $this->live('ece');
        $analog = $this->question('analog_circuits');
        $control = $this->question('control_systems');

        // Four of this college's ECE students: Analog at 20% (10 answers each, 2 right), Control at 90%.
        foreach (range(1, 4) as $i) {
            $s = $this->student('ECE');
            foreach (range(1, 10) as $k) {
                $this->answer($s, $analog, $k <= 2);
                $this->answer($s, $control, $k <= 9);
            }
        }

        // Another college's students are brilliant at Analog — and must not touch this college's numbers.
        $other = College::create(['name' => 'Elsewhere', 'short_code' => 'ELS']);
        $stranger = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $other->id, 'branch' => 'ECE']);
        foreach (range(1, 40) as $k) {
            $this->answer($stranger, $analog, true);
        }

        // A Mechanical student — that family is not live, so it does not appear at all.
        $this->student('Mechanical');

        Sanctum::actingAs($this->tpo);
        $json = $this->getJson('/api/tpo/core-insights/heatmap')->assertOk()->json();

        $this->assertCount(1, $json['disciplines']);
        $ece = $json['disciplines'][0];
        $this->assertSame('ece', $ece['code']);
        $this->assertSame(4, $ece['students']);

        $subjects = collect($ece['subjects'])->keyBy('name');
        $this->assertSame(20, $subjects['Analog Circuits']['accuracy']);
        $this->assertSame(90, $subjects['Control Systems']['accuracy']);
        $this->assertSame(40, $subjects['Analog Circuits']['attempts']);

        $branch = $ece['branches'][0];
        $this->assertSame(4, $branch['students']);
        $this->assertSame(20, $branch['cells'][(string) $analog->subject_id]['accuracy']);

        $this->assertCount(1, $json['insights'], 'only Analog Circuits is weak enough, on enough answers from enough students');
        $this->assertSame('Analog Circuits', $json['insights'][0]['subject']);
        $this->assertSame(4, $json['insights'][0]['students']);
    }

    public function test_one_stray_student_never_raises_a_remedial_alarm(): void
    {
        $this->live('ece');
        $q = $this->question('analog_circuits');
        $s = $this->student('ECE');
        foreach (range(1, 40) as $k) {
            $this->answer($s, $q, false);
        }

        Sanctum::actingAs($this->tpo);
        $json = $this->getJson('/api/tpo/core-insights/heatmap')->assertOk()->json();

        $this->assertSame(0, $json['disciplines'][0]['subjects'][0]['accuracy']);
        $this->assertSame([], $json['insights'], 'one student is not a pattern');
    }

    public function test_the_proficiency_report_has_one_row_per_core_student_with_their_subject_accuracy(): void
    {
        $this->live('ece');
        $analog = $this->question('analog_circuits');

        $a = $this->student('ECE', ['name' => 'Asha', 'track_focus' => 'core_first']);
        $this->answer($a, $analog, true);
        $this->answer($a, $analog, false);
        $this->student('CSE');                  // never in a Core report
        $this->student('ECE', ['name' => 'Bala']); // nothing answered yet

        Sanctum::actingAs($this->tpo);
        $json = $this->getJson('/api/tpo/core-insights/proficiency')->assertOk()->json();

        $this->assertCount(1, $json['disciplines']);
        $this->assertSame(['Analog Circuits'], array_column($json['disciplines'][0]['subjects'], 'name'));

        $rows = collect($json['disciplines'][0]['students'])->keyBy('name');
        $this->assertSame(['Asha', 'Bala'], $rows->keys()->all());
        $this->assertSame(50, $rows['Asha']['subjects'][(string) $analog->subject_id]['accuracy']);
        $this->assertSame(2, $rows['Asha']['answered']);
        $this->assertSame([], $rows['Bala']['subjects']);
        $this->assertArrayHasKey('core_readiness', $rows['Asha']);

        // Another college's TPO sees none of it.
        $otherCollege = College::create(['name' => 'Other', 'short_code' => 'OTH']);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $otherCollege->id]));
        $this->assertSame([], $this->getJson('/api/tpo/core-insights/proficiency')->assertOk()->json('disciplines'));
    }

    public function test_the_core_home_reports_this_weeks_goals_against_the_chosen_pace(): void
    {
        $this->live('ece');
        $q = $this->question('analog_circuits');

        $student = $this->student('ECE', ['weekly_pace' => 'casual']);
        Sanctum::actingAs($student);

        $this->answer($student, $q, true, now()->startOfWeek()->addHour());
        $this->answer($student, $q, false, now()->startOfWeek()->addHours(2));
        $this->answer($student, $q, true, now()->startOfWeek()->subDay()); // last week: not counted

        $home = $this->getJson('/api/core')->assertOk()->json();

        $this->assertSame(['current' => 2, 'target' => 30], $home['week']['questions']);   // casual: 10 problems × 3
        $this->assertSame(['current' => 0, 'target' => 1], $home['week']['tests']);
    }
}
