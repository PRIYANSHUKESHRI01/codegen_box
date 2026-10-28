<?php

namespace Tests\Feature;

use App\Jobs\ProcessStudentImportJob;
use App\Models\College;
use App\Models\Plan;
use App\Models\StudentImport;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CollegeDepartmentService;
use App\Support\AcademicYear;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * A college's TPO files students under a year of study - adding one, importing a roster (a whole file for one year, or a `year`
 * column), or fixing an existing roster in bulk - and then looks at one year at a time. The year is stored as the year the student
 * passes out, so what the TPO sees moves on by itself each July.
 */
class TpoYearWiseCohortTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Queue::fake();
        Mail::fake();
        $this->travelTo(now()->setDate(2026, 10, 28)->setTime(10, 0));
    }

    private function college(): College
    {
        $n = ++$this->seq;
        $college = College::create(['name' => "TPO Year College {$n}", 'short_code' => "TY{$n}", 'tier' => 'Standard']);
        app(CollegeDepartmentService::class)->initialise($college, ['engineering'], User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $plan = Plan::create([
            'code' => 'ty-'.uniqid(), 'name' => 'Standard', 'audience' => Plan::AUDIENCE_INSTITUTION, 'list_price' => null,
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

    private function student(College $college, ?int $year, string $branch = 'CSE'): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college->id, 'branch' => $branch]);

        if ($year !== null) {
            $student->forceFill(['graduation_year' => AcademicYear::graduationYearFor($year)])->save();
        }

        return $student->fresh();
    }

    /** Uploads a roster as the college's TPO and runs the queued job to completion. @param list<array<int, string>> $rows */
    private function import(College $college, array $rows, ?int $fileYear, bool $withYearColumn = true): StudentImport
    {
        $csv = 'name,email,roll_number,branch,section,cgpa,backlogs,phone,parent_phone'.($withYearColumn ? ',year' : '')."\n";
        foreach ($rows as $row) {
            [$name, $email] = $row;
            $csv .= "\"{$name}\",{$email},R-".md5($email).',CSE,A,8.0,0,,'.($withYearColumn ? ",{$row[2]}" : '')."\n";
        }

        Sanctum::actingAs($this->tpo($college));
        $payload = ['file' => UploadedFile::fake()->createWithContent('roster.csv', $csv)] + ($fileYear === null ? [] : ['year' => $fileYear]);

        $id = $this->post('/api/tpo/students/import', $payload, ['Accept' => 'application/json'])->assertCreated()->json('import.id');

        (new ProcessStudentImportJob($id))->handle();

        return StudentImport::findOrFail($id);
    }

    // ───────────────────────── add one student ─────────────────────────

    public function test_a_tpo_adds_a_student_in_a_year_and_the_row_says_so(): void
    {
        $college = $this->college();
        Sanctum::actingAs($this->tpo($college));

        $response = $this->postJson('/api/tpo/students', ['name' => 'Asha Rao', 'email' => 'asha@college.test', 'branch' => 'CSE', 'year' => 3])->assertCreated();

        $response->assertJsonPath('student.study_year', 3)->assertJsonPath('student.year_label', '3rd year');
        $this->assertSame(AcademicYear::graduationYearFor(3), User::where('email', 'asha@college.test')->value('graduation_year'));
    }

    public function test_the_year_is_optional_when_adding_and_only_a_real_year_is_accepted(): void
    {
        Sanctum::actingAs($this->tpo($this->college()));

        $this->postJson('/api/tpo/students', ['name' => 'No Year', 'email' => 'noyear@college.test'])->assertCreated()->assertJsonPath('student.study_year', null);

        foreach ([0, 5, 'third'] as $bad) {
            $this->postJson('/api/tpo/students', ['name' => 'Bad', 'email' => "bad{$bad}@college.test", 'year' => $bad])->assertUnprocessable()->assertJsonValidationErrors('year');
        }
    }

    // ───────────────────────── the cohort, year by year ─────────────────────────

    public function test_the_cohort_can_be_narrowed_to_one_year(): void
    {
        $college = $this->college();
        $second = $this->student($college, 2);
        $third = $this->student($college, 3);
        $thirdToo = $this->student($college, 3, 'ECE');
        $fourth = $this->student($college, 4);
        $unset = $this->student($college, null);
        Sanctum::actingAs($this->tpo($college));

        $ids = fn (string $query) => collect($this->getJson('/api/tpo/students/cohort'.$query)->assertOk()->json('students'))->pluck('id')->sort()->values()->all();

        $this->assertSame(collect([$second, $third, $thirdToo, $fourth, $unset])->pluck('id')->sort()->values()->all(), $ids(''));
        $this->assertSame(collect([$third, $thirdToo])->pluck('id')->sort()->values()->all(), $ids('?year=3'));
        $this->assertSame([$fourth->id], $ids('?year=4'));
        $this->assertSame([$unset->id], $ids('?year=0'), '0 = the college has not said');
    }

    public function test_passed_out_students_have_their_own_bucket(): void
    {
        $college = $this->college();
        $alumnus = $this->student($college, 4);
        $alumnus->forceFill(['graduation_year' => AcademicYear::graduationYearFor(4) - 1])->save();
        $current = $this->student($college, 4);
        Sanctum::actingAs($this->tpo($college));

        $passedOut = collect($this->getJson('/api/tpo/students/cohort?year=5')->json('students'))->pluck('id')->all();

        $this->assertSame([$alumnus->id], $passedOut);
        $this->assertNotContains($current->id, $passedOut);
    }

    public function test_a_row_carries_the_year_and_the_vault_ai_standing_the_student_sees(): void
    {
        $college = $this->college();
        $student = $this->student($college, 4);
        $student->forceFill(['first_login_at' => now()->subDays(10)])->save();
        Sanctum::actingAs($this->tpo($college));

        $row = $this->getJson('/api/tpo/students/cohort')->json('students.0');

        $this->assertSame(4, $row['study_year']);
        $this->assertSame('4th year', $row['year_label']);
        $this->assertSame('locked', $row['vault_ai']['state']);
        $this->assertSame(35, $row['vault_ai']['days_remaining']);
        $this->assertSame(45, $row['vault_ai']['required_days']);
        $this->assertContains('waiting_period', $row['vault_ai']['reasons']);
    }

    public function test_a_row_carries_the_stored_vault_ai_score(): void
    {
        $college = $this->college();
        $scored = $this->student($college, 4);
        $unscored = $this->student($college, 4);
        app(\App\Services\ScoreLedger::class)->vaultAi($scored->id, 72.25);
        Sanctum::actingAs($this->tpo($college));

        $rows = collect($this->getJson('/api/tpo/students/cohort')->json('students'))->keyBy('id');

        $this->assertEquals(72.25, $rows[$scored->id]['vault_ai_score']);
        $this->assertNull($rows[$unscored->id]['vault_ai_score']);
    }

    public function test_the_year_view_never_leaks_another_colleges_students(): void
    {
        $mine = $this->college();
        $theirs = $this->college();
        $this->student($theirs, 3);
        $ownThird = $this->student($mine, 3);
        Sanctum::actingAs($this->tpo($mine));

        $this->assertSame([$ownThird->id], collect($this->getJson('/api/tpo/students/cohort?year=3')->json('students'))->pluck('id')->all());
    }

    public function test_a_students_year_moves_on_by_itself_in_july(): void
    {
        $college = $this->college();
        $this->student($college, 3);
        Sanctum::actingAs($this->tpo($college));

        $this->assertCount(1, $this->getJson('/api/tpo/students/cohort?year=3')->json('students'));

        $this->travelTo(now()->setDate(2027, 7, 5));

        $this->assertCount(0, $this->getJson('/api/tpo/students/cohort?year=3')->json('students'));
        $this->assertCount(1, $this->getJson('/api/tpo/students/cohort?year=4')->json('students'));
    }

    // ───────────────────────── set a year in bulk ─────────────────────────

    public function test_a_tpo_files_a_selection_under_a_year(): void
    {
        $college = $this->college();
        $a = $this->student($college, null);
        $b = $this->student($college, null);
        $untouched = $this->student($college, null);
        Sanctum::actingAs($this->tpo($college));

        $this->postJson('/api/tpo/students/year', ['student_ids' => [$a->id, $b->id], 'year' => 4])
            ->assertOk()
            ->assertJsonPath('updated', 2)
            ->assertJsonPath('study_year', 4)
            ->assertJsonPath('year_label', '4th year');

        $this->assertSame(4, $a->fresh()->study_year);
        $this->assertSame(4, $b->fresh()->study_year);
        $this->assertNull($untouched->fresh()->study_year);
    }

    public function test_bulk_set_year_cannot_reach_another_colleges_students_or_staff(): void
    {
        $mine = $this->college();
        $theirs = $this->college();
        $stranger = $this->student($theirs, 2);
        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $mine->id]);
        Sanctum::actingAs($this->tpo($mine));

        $this->postJson('/api/tpo/students/year', ['student_ids' => [$stranger->id, $coordinator->id], 'year' => 4])->assertOk()->assertJsonPath('updated', 0);

        $this->assertSame(2, $stranger->fresh()->study_year);
        $this->assertNull($coordinator->fresh()->graduation_year);
    }

    public function test_bulk_set_year_validates_its_input(): void
    {
        $college = $this->college();
        $s = $this->student($college, null);
        Sanctum::actingAs($this->tpo($college));

        $this->postJson('/api/tpo/students/year', ['student_ids' => [$s->id], 'year' => 7])->assertUnprocessable()->assertJsonValidationErrors('year');
        $this->postJson('/api/tpo/students/year', ['student_ids' => [], 'year' => 3])->assertUnprocessable()->assertJsonValidationErrors('student_ids');
        $this->postJson('/api/tpo/students/year', ['student_ids' => [$s->id]])->assertUnprocessable()->assertJsonValidationErrors('year');
    }

    public function test_only_a_tpo_may_set_a_year(): void
    {
        $college = $this->college();
        $s = $this->student($college, null);
        Sanctum::actingAs($s);

        $this->postJson('/api/tpo/students/year', ['student_ids' => [$s->id], 'year' => 4])->assertForbidden();
        $this->assertNull($s->fresh()->study_year);
    }

    // ───────────────────────── import ─────────────────────────

    public function test_a_whole_roster_can_be_imported_as_one_year(): void
    {
        $college = $this->college();

        $import = $this->import($college, [['Asha', 'asha@c.test', ''], ['Ravi', 'ravi@c.test', '']], fileYear: 3);

        $this->assertSame(2, $import->successful_rows);
        $this->assertSame(3, $import->study_year);
        $this->assertSame([3, 3], User::whereIn('email', ['asha@c.test', 'ravi@c.test'])->get()->map->study_year->all());
    }

    public function test_each_row_can_name_its_own_year(): void
    {
        $college = $this->college();

        $import = $this->import($college, [['A', 'a@c.test', '2nd year'], ['B', 'b@c.test', '3'], ['C', 'c@c.test', 'IV'], ['D', 'd@c.test', '2028']], fileYear: null);

        $this->assertSame(4, $import->successful_rows);
        $this->assertSame(2, User::where('email', 'a@c.test')->first()->study_year);
        $this->assertSame(3, User::where('email', 'b@c.test')->first()->study_year);
        $this->assertSame(4, User::where('email', 'c@c.test')->first()->study_year);
        $this->assertSame(3, User::where('email', 'd@c.test')->first()->study_year, 'a passing-out year is read as the year it implies');
    }

    public function test_a_row_with_no_year_takes_the_files_year(): void
    {
        $import = $this->import($this->college(), [['A', 'a@c.test', ''], ['B', 'b@c.test', '3rd year']], fileYear: 3);

        $this->assertSame(2, $import->successful_rows);
        $this->assertSame(3, User::where('email', 'a@c.test')->first()->study_year);
    }

    public function test_a_row_that_contradicts_the_files_year_is_stopped_at_the_door(): void
    {
        $import = $this->import($this->college(), [['A', 'a@c.test', '3rd year'], ['B', 'b@c.test', '2nd year']], fileYear: 3);

        $this->assertSame(1, $import->successful_rows);
        $this->assertSame(1, $import->failed_rows);
        $this->assertStringContainsString('2nd year', $import->errors[0]['error']);
        $this->assertStringContainsString('3rd year', $import->errors[0]['error']);
        $this->assertSame(3, $import->errors[0]['row'], 'the header is row 1');
        $this->assertNull(User::where('email', 'b@c.test')->first());
    }

    public function test_a_year_nobody_can_read_is_a_row_error_not_a_silent_blank(): void
    {
        $import = $this->import($this->college(), [['A', 'a@c.test', 'sometime']], fileYear: null);

        $this->assertSame(0, $import->successful_rows);
        $this->assertStringContainsString('sometime', $import->errors[0]['error']);
        $this->assertStringContainsString('1st, 2nd, 3rd or 4th', $import->errors[0]['error']);
    }

    public function test_a_file_without_a_year_column_or_a_year_leaves_students_unfiled(): void
    {
        $import = $this->import($this->college(), [['A', 'a@c.test']], fileYear: null, withYearColumn: false);

        $this->assertSame(1, $import->successful_rows);
        $this->assertNull(User::where('email', 'a@c.test')->first()->study_year);
    }

    public function test_reimporting_a_student_moves_them_to_the_new_year(): void
    {
        $college = $this->college();
        $this->import($college, [['A', 'a@c.test', '']], fileYear: 3);
        $this->import($college, [['A', 'a@c.test', '']], fileYear: 4);

        $this->assertSame(4, User::where('email', 'a@c.test')->first()->study_year);
        $this->assertSame(1, User::where('email', 'a@c.test')->count());
    }

    public function test_reimporting_without_a_year_does_not_wipe_the_one_they_have(): void
    {
        $college = $this->college();
        $this->import($college, [['A', 'a@c.test', '']], fileYear: 3);
        $this->import($college, [['A', 'a@c.test']], fileYear: null, withYearColumn: false);

        $this->assertSame(3, User::where('email', 'a@c.test')->first()->study_year);
    }

    public function test_an_import_year_outside_the_programme_is_refused_up_front(): void
    {
        Sanctum::actingAs($this->tpo($this->college()));

        $this->post('/api/tpo/students/import', ['file' => UploadedFile::fake()->createWithContent('r.csv', "name,email\nA,a@c.test\n"), 'year' => 6], ['Accept' => 'application/json'])
            ->assertUnprocessable()->assertJsonValidationErrors('year');
    }

    public function test_the_template_asks_for_a_year(): void
    {
        Sanctum::actingAs($this->tpo($this->college()));

        $csv = $this->get('/api/tpo/students/import-template')->assertOk()->getContent();

        $this->assertStringContainsString('parent_phone,year', explode("\n", $csv)[0]);
        $this->assertStringContainsString('3rd year', $csv);
    }
}
