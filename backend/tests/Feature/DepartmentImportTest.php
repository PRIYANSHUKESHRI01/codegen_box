<?php

namespace Tests\Feature;

use App\Jobs\ProcessStudentImportJob;
use App\Models\College;
use App\Models\Plan;
use App\Models\StudentImport;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CollegeDepartmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

/**
 * A roster is imported department by department: the file belongs to ONE department, an ambiguous branch is read in that
 * department's terms, a programme of another department is refused row by row, and nobody already in another department is
 * silently moved. The template a TPO downloads is the department's own.
 */
class DepartmentImportTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Queue::fake();
    }

    private function college(array $departments): College
    {
        $n = ++$this->seq;
        $college = College::create(['name' => "Import College {$n}", 'short_code' => "IC{$n}", 'tier' => 'Standard']);
        app(CollegeDepartmentService::class)->initialise($college, $departments, User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $plan = Plan::create([
            'code' => 'imp-'.uniqid(), 'name' => 'Standard', 'audience' => Plan::AUDIENCE_INSTITUTION, 'list_price' => null,
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

    /** Uploads a roster as the college's TPO and runs the queued job to completion. @param list<array<int, string>> $rows */
    private function import(College $college, array $rows, ?string $department): StudentImport
    {
        $csv = "name,email,roll_number,branch,section,cgpa,backlogs,phone,parent_phone\n";
        foreach ($rows as [$name, $email, $branch]) {
            $csv .= "\"{$name}\",{$email},R-".md5($email).",\"{$branch}\",A,8.0,0,,\n";
        }

        Sanctum::actingAs($this->tpo($college));
        $payload = ['file' => UploadedFile::fake()->createWithContent('roster.csv', $csv)] + ($department === null ? [] : ['department' => $department]);

        $id = $this->post('/api/tpo/students/import', $payload, ['Accept' => 'application/json'])->assertCreated()->json('import.id');

        (new ProcessStudentImportJob($id))->handle();

        return StudentImport::findOrFail($id);
    }

    public function test_a_commerce_roster_is_filed_under_commerce_and_read_in_commerce_terms(): void
    {
        $college = $this->college(['engineering', 'commerce']);

        $import = $this->import($college, [
            ['Asha Verma', 'asha@imp.test', 'B.Com (Hons)'],
            ['Dev Menon', 'dev@imp.test', 'Finance'],        // ambiguous: Accounting & Finance in Commerce, MBA Finance elsewhere
            ['Esha Gill', 'esha@imp.test', ''],              // says nothing: still a Commerce student
            ['Farah Khan', 'farah@imp.test', 'CA'],
        ], 'commerce');

        $this->assertSame('commerce', $import->department_code);
        $this->assertSame(4, $import->successful_rows);
        $this->assertSame(0, $import->failed_rows);

        $by = fn (string $email) => User::where('email', $email)->firstOrFail();

        $this->assertSame(['commerce', 'bcom_hons'], [$by('asha@imp.test')->department, $by('asha@imp.test')->branch_code]);
        $this->assertSame('bcom_accounting', $by('dev@imp.test')->branch_code);
        $this->assertSame('commerce', $by('esha@imp.test')->department);
        $this->assertNull($by('esha@imp.test')->branch_code);
        $this->assertSame('chartered_accountancy', $by('farah@imp.test')->branch_code);
    }

    public function test_a_row_that_names_another_departments_programme_is_refused_and_the_rest_still_import(): void
    {
        $college = $this->college(['engineering', 'commerce']);

        $import = $this->import($college, [
            ['Asha Verma', 'asha@imp.test', 'B.Com'],
            ['Ravi Kumar', 'ravi@imp.test', 'Mechanical Engineering'],
        ], 'commerce');

        $this->assertSame(1, $import->successful_rows);
        $this->assertSame(1, $import->failed_rows);
        $this->assertStringContainsString('Engineering', $import->errors[0]['error']);
        $this->assertSame('ravi@imp.test', $import->errors[0]['email']);

        $this->assertDatabaseHas('users', ['email' => 'asha@imp.test', 'department' => 'commerce']);
        $this->assertDatabaseMissing('users', ['email' => 'ravi@imp.test']);
    }

    public function test_a_student_already_in_another_department_is_not_silently_moved(): void
    {
        $college = $this->college(['engineering', 'commerce']);

        $this->import($college, [['Ravi Kumar', 'ravi@imp.test', 'Mechanical Engineering']], 'engineering');
        $import = $this->import($college, [['Ravi Kumar', 'ravi@imp.test', '']], 'commerce');

        $this->assertSame(1, $import->failed_rows);
        $this->assertStringContainsString('already registered', $import->errors[0]['error']);
        $this->assertSame('engineering', User::where('email', 'ravi@imp.test')->value('department'));
    }

    public function test_re_uploading_the_same_roster_in_its_own_department_updates_in_place(): void
    {
        $college = $this->college(['commerce']);

        $this->import($college, [['Asha Verma', 'asha@imp.test', 'B.Com']], 'commerce');
        $again = $this->import($college, [['Asha Verma', 'asha@imp.test', 'B.Com (Hons)']], 'commerce');

        $this->assertSame(1, $again->successful_rows);
        $this->assertSame(1, User::where('email', 'asha@imp.test')->count());
        $this->assertSame('bcom_hons', User::where('email', 'asha@imp.test')->value('branch_code'));
    }

    public function test_a_college_running_several_departments_must_say_which_one_a_file_is_for(): void
    {
        $college = $this->college(['engineering', 'arts']);
        Sanctum::actingAs($this->tpo($college));

        $this->post('/api/tpo/students/import', ['file' => UploadedFile::fake()->createWithContent('roster.csv', "name,email\nA,a@imp.test\n")], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('department');

        $this->post('/api/tpo/students/import', ['department' => 'management', 'file' => UploadedFile::fake()->createWithContent('roster.csv', "name,email\nA,a@imp.test\n")], ['Accept' => 'application/json'])
            ->assertStatus(422)->assertJsonValidationErrors('department');

        $this->assertSame(0, StudentImport::count());
    }

    public function test_a_college_running_one_department_imports_without_naming_it(): void
    {
        $college = $this->college(['arts']);

        $import = $this->import($college, [['Neha Joshi', 'neha@imp.test', 'English']], null);

        $this->assertSame('arts', $import->department_code);
        $this->assertSame('english', User::where('email', 'neha@imp.test')->value('branch_code'));
    }

    public function test_a_plain_engineering_college_imports_exactly_as_before(): void
    {
        $college = $this->college(['engineering']);

        $import = $this->import($college, [
            ['Ravi Kumar', 'ravi@imp.test', 'Mechanical Engineering'],
            ['Sita Rao', 'sita@imp.test', 'CSE'],
        ], null);

        $this->assertSame(2, $import->successful_rows);
        $this->assertSame(['engineering', 'mech'], [User::where('email', 'ravi@imp.test')->value('department'), User::where('email', 'ravi@imp.test')->value('branch_code')]);
        $this->assertSame('engineering', User::where('email', 'sita@imp.test')->value('department'));
    }

    public function test_the_template_is_the_departments_own(): void
    {
        $college = $this->college(['engineering', 'commerce']);
        Sanctum::actingAs($this->tpo($college));

        $names = function (string $query): array {
            $response = $this->get("/api/tpo/students/import-template?format=xlsx{$query}")->assertOk();
            $path = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
            file_put_contents($path, $response->getContent());

            return array_column(IOFactory::load($path)->getSheetByName('Branches')->toArray(), 0);
        };

        $commerce = $names('&department=commerce');
        $this->assertContains('B.Com (General)', $commerce);
        $this->assertNotContains('Mechanical Engineering', $commerce);

        $engineering = $names('');
        $this->assertContains('Mechanical Engineering', $engineering);
        $this->assertNotContains('B.Com (General)', $engineering);
    }
}
