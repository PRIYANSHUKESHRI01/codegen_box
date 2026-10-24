<?php

namespace Tests\Feature;

use App\Models\BranchAlias;
use App\Models\College;
use App\Models\Plan;
use App\Models\StudentImport;
use App\Models\Subscription;
use App\Models\User;
use App\Services\EligibilityService;
use App\Support\BranchCatalog;
use App\Support\StudentImportSheets;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

/**
 * P1 of the multi-branch work: drive eligibility understands canonical branches and families,
 * a TPO can map their own college's labels, the Vault filter and branch trend use canonical
 * branches, and an Excel roster imports.
 */
class BranchEligibilityAndMappingTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    private function college(): College
    {
        $n = ++$this->seq;

        return College::create(['name' => "Mapping College {$n}", 'short_code' => "MC{$n}", 'tier' => 'Standard']);
    }

    private function student(array $attrs = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER] + $attrs);
    }

    private function tpo(College $college): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
    }

    private function open(array $branches): array
    {
        return ['min_cgpa' => null, 'max_backlogs' => null, 'eligible_branches' => $branches];
    }

    // ─────────────────────────────── eligibility ───────────────────────────────

    public function test_a_legacy_drive_label_matches_however_the_college_spelled_the_branch(): void
    {
        $mechanical = $this->student(['branch' => 'Mechanical']);   // used to FAIL against a drive open to "MECH"

        $this->assertSame('eligible', EligibilityService::evaluate($mechanical, $this->open(['MECH']))['status']);
        $this->assertSame('pass', EligibilityService::evaluate($mechanical, $this->open(['MECH']))['criteria']['branch']);
    }

    public function test_a_canonical_code_and_a_family_token_both_match(): void
    {
        $ece = $this->student(['branch' => 'E&TC']);   // branch etc, family ece

        $this->assertSame('eligible', EligibilityService::evaluate($ece, $this->open(['etc']))['status']);
        $this->assertSame('eligible', EligibilityService::evaluate($ece, $this->open(['family:ece']))['status']);
        $this->assertSame('not_eligible', EligibilityService::evaluate($ece, $this->open(['ece']))['status'], 'a specific branch is not its whole family');
        $this->assertSame('not_eligible', EligibilityService::evaluate($ece, $this->open(['family:mech']))['status']);
    }

    public function test_a_wrong_branch_fails_with_readable_branch_names(): void
    {
        $civil = $this->student(['branch' => 'Civil']);
        $result = EligibilityService::evaluate($civil, $this->open(['MECH', 'family:eee']));

        $this->assertSame('not_eligible', $result['status']);
        $this->assertStringContainsString('Mechanical Engineering', $result['reasons'][0]);
        $this->assertStringContainsString('all Electrical & Electronics branches', $result['reasons'][0]);
        $this->assertStringContainsString('Civil Engineering', $result['reasons'][0]);
    }

    public function test_a_branch_we_cannot_identify_is_unknown_not_a_failure(): void
    {
        $this->assertSame('unknown', EligibilityService::evaluate($this->student(['branch' => 'Mech-A (Day)']), $this->open(['mech']))['status']);
        $this->assertSame('unknown', EligibilityService::evaluate($this->student(), $this->open(['mech']))['status']);
    }

    public function test_an_unrecognised_label_still_matches_the_identical_drive_token(): void
    {
        $s = $this->student(['branch' => 'Quantum Basket Weaving']);

        $this->assertSame('eligible', EligibilityService::evaluate($s, $this->open(['quantum basket weaving']))['status']);
    }

    public function test_a_drive_with_no_branch_requirement_is_unchanged(): void
    {
        $this->assertSame('not_required', EligibilityService::evaluate($this->student(['branch' => 'Civil']), $this->open([]))['criteria']['branch']);
    }

    public function test_a_college_mapping_makes_its_students_eligible(): void
    {
        $college = $this->college();
        $s = $this->student(['college_id' => $college->id, 'branch' => 'Mech-A (Day)']);
        $this->assertSame('unknown', EligibilityService::evaluate($s, $this->open(['mech']))['status']);

        $this->actingAs($this->tpo($college))->postJson('/api/tpo/branches/map', ['key' => $s->branch_key, 'branch_code' => 'mech'])->assertOk();

        $this->assertSame('eligible', EligibilityService::evaluate($s->fresh(), $this->open(['mech']))['status']);
    }

    // ─────────────────────────────── TPO mapping ───────────────────────────────

    public function test_tpo_sees_their_labels_with_suggestions(): void
    {
        $college = $this->college();
        $this->student(['college_id' => $college->id, 'branch' => 'Mechanical']);
        $this->student(['college_id' => $college->id, 'branch' => 'Mech-A (Day)']);
        $this->student(['college_id' => $college->id, 'branch' => 'Mech-A (Day)']);
        $this->student(['college_id' => $college->id]);

        $json = $this->actingAs($this->tpo($college))->getJson('/api/tpo/branches')->assertOk()->json();

        $this->assertSame(4, $json['summary']['students']);
        $this->assertSame(1, $json['summary']['recognised']);
        $this->assertSame(2, $json['summary']['unrecognised']);
        $this->assertSame(1, $json['summary']['no_branch']);

        $unrecognised = collect($json['labels'])->firstWhere('branch_code', null);
        $this->assertSame(2, $unrecognised['students']);
        $this->assertSame('mech', $unrecognised['suggestion']['branch_code']);
    }

    public function test_a_mapping_is_the_colleges_own_and_is_validated(): void
    {
        $a = $this->college();
        $b = $this->college();
        $inA = $this->student(['college_id' => $a->id, 'branch' => 'Mech-A']);
        $inB = $this->student(['college_id' => $b->id, 'branch' => 'Mech-A']);
        $tpoA = $this->tpo($a);

        $this->actingAs($tpoA)->postJson('/api/tpo/branches/map', ['key' => $inA->branch_key, 'branch_code' => 'mech'])
            ->assertOk()->assertJsonPath('students_updated', 1);

        $this->assertSame('mech', $inA->fresh()->branch_code);
        $this->assertNull($inB->fresh()->branch_code, 'college A must not change how college B is read');

        // a label nobody in this college uses, and a branch that does not exist
        $this->actingAs($tpoA)->postJson('/api/tpo/branches/map', ['key' => 'zzz unknown', 'branch_code' => 'mech'])->assertNotFound();
        $this->actingAs($tpoA)->postJson('/api/tpo/branches/map', ['key' => $inA->branch_key, 'branch_code' => 'nope'])->assertStatus(422);

        // undo
        $this->actingAs($tpoA)->postJson('/api/tpo/branches/unmap', ['key' => $inA->branch_key])->assertOk();
        $this->assertNull($inA->fresh()->branch_code);
    }

    public function test_only_a_tpo_reaches_the_mapping(): void
    {
        $this->actingAs($this->student())->getJson('/api/tpo/branches')->assertForbidden();
    }

    // ─────────────────────────────── vault + reports ───────────────────────────────

    public function test_branch_trend_groups_the_many_spellings_of_one_branch(): void
    {
        $college = $this->college();
        $a = $this->student(['college_id' => $college->id, 'branch' => 'Mechanical']);
        $b = $this->student(['college_id' => $college->id, 'branch' => 'MECH']);
        $c = $this->student(['college_id' => $college->id, 'branch' => 'Mechanical Engg']);

        $service = app(\App\Services\PlacementReportService::class);
        $method = new \ReflectionMethod($service, 'branchTrend');
        $method->setAccessible(true);

        $drive = new \App\Models\PlacementDrive(['drive_date' => now()]);
        $apps = collect([$a, $b, $c])->map(function (User $u) use ($drive) {
            $app = new \App\Models\DriveApplication(['stage' => \App\Models\DriveApplication::STAGE_OFFER_ACCEPTED]);
            $app->setRelation('user', $u);
            $app->setRelation('placementDrive', $drive);

            return $app;
        });

        $trend = $method->invoke($service, $apps);

        $this->assertCount(1, $trend, 'three spellings → one row');
        $this->assertSame('Mechanical Engineering', $trend[0]['branch']);
        $this->assertSame('mech', $trend[0]['branch_code']);
        $this->assertSame(3, $trend[0]['applications']);
    }

    // ─────────────────────────────── Excel import ───────────────────────────────

    private function xlsx(array $rows): UploadedFile
    {
        $book = new Spreadsheet;
        $book->getActiveSheet()->fromArray($rows, null, 'A1');
        $path = tempnam(sys_get_temp_dir(), 'roster').'.xlsx';
        (new Xlsx($book))->save($path);

        return new UploadedFile($path, 'roster.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);
    }

    public function test_an_excel_roster_is_converted_to_the_csv_the_job_reads(): void
    {
        $csv = StudentImportSheets::toCsv($this->xlsx([
            StudentImportSheets::HEADER,
            ['Asha Rao', 'asha@x.edu', '21EC007', 'ECE', 'A', 8.4, 0, '', ''],
            [null, null, null, null, null, null, null, null, null],
            ['Ravi K', 'ravi@x.edu', '21ME011', 'Mechanical', 'B', 7.1, 1, '', ''],
        ]));

        $lines = array_values(array_filter(explode("\n", trim($csv))));
        $this->assertCount(3, $lines, 'blank row dropped');
        $this->assertStringStartsWith('name,email,roll_number,branch', $lines[0]);
        $this->assertStringContainsString('"Asha Rao",asha@x.edu,21EC007,ECE,A,8.4', $lines[1]);
    }

    public function test_uploading_an_xlsx_stores_a_csv_and_queues_the_import(): void
    {
        Storage::fake('local');
        Queue::fake();
        $college = $this->college();
        $this->subscribe($college);

        $this->actingAs($this->tpo($college))
            ->postJson('/api/tpo/students/import', ['file' => $this->xlsx([StudentImportSheets::HEADER, ['Asha Rao', 'asha@x.edu', '21EC007', 'ECE', 'A', 8.4, 0, '', '']])])
            ->assertCreated();

        $import = StudentImport::firstOrFail();
        $this->assertStringContainsString('Asha Rao', Storage::disk('local')->get("student-imports/{$import->id}.csv"));
        Queue::assertPushed(\App\Jobs\ProcessStudentImportJob::class);
    }

    public function test_an_unreadable_workbook_is_refused_up_front(): void
    {
        Storage::fake('local');
        Queue::fake();
        $college = $this->college();
        $this->subscribe($college);

        $path = tempnam(sys_get_temp_dir(), 'bad').'.xlsx';
        file_put_contents($path, 'this is not a workbook');

        $this->actingAs($this->tpo($college))
            ->postJson('/api/tpo/students/import', ['file' => new UploadedFile($path, 'bad.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true)])
            ->assertStatus(422);

        $this->assertSame(0, StudentImport::count());
    }

    public function test_the_excel_template_has_a_branches_sheet(): void
    {
        $response = $this->actingAs($this->tpo($this->college()))->get('/api/tpo/students/import-template?format=xlsx')->assertOk();

        $path = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
        file_put_contents($path, $response->getContent());
        $book = IOFactory::load($path);

        $this->assertSame(['Students', 'Branches'], $book->getSheetNames());
        $names = array_column($book->getSheetByName('Branches')->toArray(), 0);
        $this->assertContains('Mechanical Engineering', $names);
        $this->assertContains('Electronics & Communication Engineering', $names);
    }

    /** An active subscription so the import is allowed (same shape AdminCollegeSubscriptionTest builds). */
    private function subscribe(College $college): void
    {
        $plan = Plan::firstOrCreate(['code' => 'branch-test-standard'], [
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

        Subscription::create([
            'subscriber_type' => College::class,
            'subscriber_id' => $college->id,
            'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE,
            'started_at' => now()->subMonth(),
            'current_period_end' => now()->addMonths(11),
            'is_trial' => false,
            'auto_renew' => false,
        ]);
    }
}
