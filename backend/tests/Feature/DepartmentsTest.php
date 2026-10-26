<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\CollegeDepartment;
use App\Models\Department;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Services\CollegeDepartmentService;
use App\Support\BranchCatalog;
use App\Support\DepartmentCapabilities;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Departments above branches: the catalogue (Engineering, Management, Commerce, Arts), which modules each one's students get
 * (resolved on the server and enforced on the API, not just hidden in the browser), which departments a college runs, and the
 * TPO / Mellow views that are scoped to one department. Engineering must keep behaving exactly as it did before.
 */
class DepartmentsTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    private function college(array $departments = ['engineering']): College
    {
        $n = ++$this->seq;
        $college = College::create(['name' => "Dept College {$n}", 'short_code' => "DC{$n}", 'tier' => 'Standard']);
        app(CollegeDepartmentService::class)->initialise($college, $departments, User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        return $college;
    }

    private function subscribe(College $college): void
    {
        $plan = Plan::create([
            'code' => 'dept-test-'.uniqid(), 'name' => 'Standard', 'audience' => Plan::AUDIENCE_INSTITUTION, 'list_price' => null,
            'annual_price' => 149000, 'duration_days' => 365, 'is_active' => true, 'sort_order' => 1, 'drive_access' => true, 'max_students' => 500,
        ]);

        Subscription::create([
            'subscriber_type' => College::class, 'subscriber_id' => $college->id, 'plan_id' => $plan->id,
            'status' => Subscription::STATUS_ACTIVE, 'started_at' => now()->subMonth(), 'current_period_end' => now()->addYear(), 'auto_renew' => false,
        ]);
    }

    private function tpo(College $college): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
    }

    private function student(College $college, string $branch, array $attrs = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college->id, 'branch' => $branch, 'must_change_password' => false] + $attrs);
    }

    // ─────────────────────────────── the catalogue ───────────────────────────────

    public function test_the_four_departments_ship_with_their_branches(): void
    {
        $catalog = app(BranchCatalog::class);

        $this->assertSame(['engineering', 'management', 'commerce', 'arts'], array_column($catalog->departments(), 'code'));

        foreach ($catalog->departments() as $department) {
            $disciplines = $catalog->disciplines($department['code']);
            $this->assertNotEmpty($disciplines, "{$department['code']} has disciplines");

            foreach ($disciplines as $discipline) {
                $branches = array_filter($catalog->branches(), fn (array $b) => $b['discipline_code'] === $discipline['code']);
                $this->assertNotEmpty($branches, "{$discipline['code']} has branches");
            }
        }

        $this->assertSame('engineering', $catalog->departmentOf('mech'));
        $this->assertSame('management', $catalog->departmentOf('mba_finance'));
        $this->assertSame('commerce', $catalog->departmentOf('bcom'));
        $this->assertSame('arts', $catalog->departmentOf('english'));
    }

    public function test_each_department_offers_exactly_its_five_main_branches(): void
    {
        $catalog = app(BranchCatalog::class);
        $offered = fn (string $department) => collect($catalog->branches())
            ->filter(fn (array $b) => $catalog->departmentOf($b['code']) === $department)->pluck('code')->sort()->values()->all();
        $sorted = fn (array $codes) => collect($codes)->sort()->values()->all();

        $this->assertSame($sorted(['cse', 'ece', 'eee', 'mech', 'civil']), $offered('engineering'));
        $this->assertSame($sorted(['bba', 'mba', 'mba_marketing', 'mba_finance', 'mba_hr']), $offered('management'));
        $this->assertSame($sorted(['bcom', 'mcom', 'chartered_accountancy', 'company_secretary', 'cma']), $offered('commerce'));
        $this->assertSame($sorted(['english', 'history', 'political_science', 'economics', 'psychology']), $offered('arts'));

        // Families left with no branch on offer are not offered either …
        $families = array_column($catalog->disciplines(), 'code');
        foreach (['other', 'sociology_sw', 'media_comm', 'education', 'geography_env', 'fine_arts', 'other_arts'] as $hidden) {
            $this->assertNotContains($hidden, $families);
        }
        $this->assertNotContains('other', \App\Services\Core\CoreAccess::families());

        // … yet nothing was removed: a student already in a switched-off branch keeps it, and old spellings still resolve to it.
        $this->assertSame('it', $catalog->resolve('Information Technology'));
        $this->assertSame('tourism_travel', $catalog->branch('tourism_travel')['code']);
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'E&TC']);
        $this->assertSame(['engineering', 'ece', 'etc'], [$student->department, $student->discipline, $student->branch_code]);
    }

    public function test_an_ambiguous_label_is_decided_by_the_department_it_is_imported_under(): void
    {
        $catalog = app(BranchCatalog::class);

        $this->assertSame('mba_finance', $catalog->resolve('Finance', null, 'management'));
        $this->assertSame('bcom_accounting', $catalog->resolve('Finance', null, 'commerce'));
        $this->assertSame('mba_hr', $catalog->resolve('HR', null, 'management'));
        // "CA" is Chartered Accountancy in Commerce; it must not be read as anything in Management.
        $this->assertSame('chartered_accountancy', $catalog->resolve('CA', null, 'commerce'));
    }

    public function test_a_student_is_filed_under_the_department_their_branch_belongs_to(): void
    {
        $college = $this->college(['engineering', 'commerce']);

        $mech = $this->student($college, 'Mechanical Engineering');
        $bcom = $this->student($college, 'B.Com (Hons)');

        $this->assertSame('engineering', $mech->department);
        $this->assertSame('commerce', $bcom->department);
        $this->assertSame('bcom', $bcom->discipline);
        $this->assertSame('bcom_hons', $bcom->branch_code);
    }

    // ─────────────────────────────── what each department's students get ───────────────────────────────

    public function test_engineering_keeps_every_module_it_always_had(): void
    {
        $caps = DepartmentCapabilities::resolve('engineering', 'cse', 'cse');

        foreach (['coding_practice', 'contests', 'company_prep', 'project_lab', 'hackathons', 'ai_interviews', 'soft_skills', 'learning_centre'] as $key) {
            $this->assertTrue($caps[$key], "engineering keeps {$key}");
        }

        $this->assertFalse($caps['domain_prep'], 'CSE has no Core Prep, exactly as before');
        // A student with no recorded department is engineering, never stripped of a module.
        $this->assertSame($caps, DepartmentCapabilities::resolve(null, null, null));
    }

    public function test_core_engineering_branches_gain_domain_prep_but_keep_coding(): void
    {
        $caps = DepartmentCapabilities::resolve('engineering', 'ece', 'ece');

        $this->assertTrue($caps['domain_prep']);
        $this->assertTrue($caps['skill_drills']);
        $this->assertTrue($caps['coding_practice']);
    }

    public function test_commerce_management_and_arts_have_no_coding_but_have_domain_prep_and_the_shared_modules(): void
    {
        foreach ([['management', 'mba', 'mba_finance'], ['commerce', 'bcom', 'bcom'], ['arts', 'lang_lit', 'english']] as [$department, $discipline, $branch]) {
            $caps = DepartmentCapabilities::resolve($department, $discipline, $branch);

            foreach (['coding_practice', 'contests', 'company_prep', 'project_lab', 'hackathons', 'skill_drills'] as $off) {
                $this->assertFalse($caps[$off], "{$department} has no {$off}");
            }

            foreach (['domain_prep', 'ai_interviews', 'soft_skills', 'learning_centre'] as $on) {
                $this->assertTrue($caps[$on], "{$department} has {$on}");
            }
        }
    }

    public function test_a_branch_can_switch_a_module_back_on_inside_a_department_that_lacks_it(): void
    {
        $this->assertTrue(DepartmentCapabilities::resolve('commerce', 'bcom', 'bcom_ca')['coding_practice'], 'B.Com (Computer Applications) codes');
        $this->assertTrue(DepartmentCapabilities::resolve('management', 'mba', 'mba_it')['coding_practice']);
        $this->assertFalse(DepartmentCapabilities::resolve('commerce', 'bcom', 'bcom_accounting')['coding_practice']);
    }

    public function test_the_api_refuses_coding_to_a_commerce_student_and_serves_it_to_an_engineer(): void
    {
        $college = $this->college(['engineering', 'commerce']);
        $commerce = $this->student($college, 'B.Com');
        $engineer = $this->student($college, 'Computer Science');

        Sanctum::actingAs($commerce);
        $this->getJson('/api/problems')
            ->assertForbidden()
            ->assertJsonPath('code', 'capability_unavailable')
            ->assertJsonPath('capability', 'coding_practice')
            ->assertJsonPath('can_opt_in', true);
        $this->getJson('/api/contests')->assertForbidden()->assertJsonPath('code', 'capability_unavailable');
        $this->getJson('/api/company-prep')->assertForbidden();

        Sanctum::actingAs($engineer);
        $this->getJson('/api/problems')->assertOk();
        $this->getJson('/api/contests')->assertOk();
    }

    public function test_a_modules_the_department_keeps_stay_available(): void
    {
        $college = $this->college(['commerce']);

        Sanctum::actingAs($this->student($college, 'B.Com'));

        $this->getJson('/api/soft-skills')->assertOk();
        $this->getJson('/api/interviews')->assertOk();
    }

    public function test_the_student_can_opt_in_to_coding_and_the_api_then_allows_it(): void
    {
        $college = $this->college(['commerce']);
        $student = $this->student($college, 'B.Com');

        $this->assertFalse(DepartmentCapabilities::forUser($student)['coding_practice']);

        $student->forceFill(['coding_opt_in' => true])->save();

        Sanctum::actingAs($student->fresh());
        $this->assertTrue(DepartmentCapabilities::forUser($student->fresh())['coding_practice']);
        $this->getJson('/api/problems')->assertOk();
    }

    public function test_the_capabilities_are_sent_with_the_student_and_never_with_staff(): void
    {
        $college = $this->college(['arts']);

        Sanctum::actingAs($this->student($college, 'English'));
        $me = $this->getJson('/api/me')->assertOk()->json('user');
        $this->assertFalse($me['capabilities']['coding_practice']);
        $this->assertTrue($me['capabilities']['domain_prep']);
        $this->assertSame('arts', $me['department']);

        Sanctum::actingAs($this->tpo($college));
        $this->assertNull($this->getJson('/api/me')->assertOk()->json('user.capabilities'));
    }

    // ─────────────────────────────── the departments a college runs ───────────────────────────────

    public function test_a_college_with_no_rows_runs_engineering_only(): void
    {
        $college = College::create(['name' => 'Legacy College', 'short_code' => 'LEG', 'tier' => 'Standard']);

        $this->assertSame(['engineering'], $college->departmentCodes());
    }

    public function test_a_tpo_adds_and_removes_departments_for_their_own_college(): void
    {
        $college = $this->college();
        Sanctum::actingAs($this->tpo($college));

        $this->getJson('/api/tpo/departments')->assertOk()->assertJsonPath('enabled', ['engineering']);

        $this->putJson('/api/tpo/departments', ['departments' => ['engineering', 'commerce']])
            ->assertOk()->assertJsonPath('enabled', ['engineering', 'commerce']);

        $this->putJson('/api/tpo/departments', ['departments' => ['engineering']])->assertOk()->assertJsonPath('enabled', ['engineering']);
        $this->putJson('/api/tpo/departments', ['departments' => []])->assertStatus(422);
        $this->putJson('/api/tpo/departments', ['departments' => ['astrology']])->assertStatus(422)->assertJsonValidationErrors('departments');
    }

    public function test_a_department_that_still_has_students_cannot_be_switched_off_by_the_college(): void
    {
        $college = $this->college(['engineering', 'commerce']);
        $this->student($college, 'B.Com');
        Sanctum::actingAs($this->tpo($college));

        $this->putJson('/api/tpo/departments', ['departments' => ['engineering']])
            ->assertStatus(422)->assertJsonValidationErrors('departments');
        // `force` is Mellow-staff only; a college cannot grant it to itself.
        $this->putJson('/api/tpo/departments', ['departments' => ['engineering'], 'force' => true])->assertStatus(422);

        $this->assertContains('commerce', $college->fresh()->departmentCodes());
    }

    public function test_mellow_staff_can_force_a_department_off_knowingly(): void
    {
        $college = $this->college(['engineering', 'commerce']);
        $this->student($college, 'B.Com');
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $this->putJson("/api/admin/colleges/{$college->id}/departments", ['departments' => ['engineering']])->assertStatus(422);
        $this->putJson("/api/admin/colleges/{$college->id}/departments", ['departments' => ['engineering'], 'force' => true])
            ->assertOk()->assertJsonPath('enabled', ['engineering']);
    }

    public function test_one_tpo_cannot_touch_another_colleges_departments(): void
    {
        $mine = $this->college();
        $other = $this->college(['engineering', 'arts']);
        Sanctum::actingAs($this->tpo($mine));

        // Their endpoints are scoped by the token, and the staff-wide ones are not theirs at all.
        $this->putJson('/api/tpo/departments', ['departments' => ['engineering', 'management']])->assertOk();
        $this->assertSame(['engineering', 'arts'], $other->fresh()->departmentCodes());
        $this->getJson("/api/admin/colleges/{$other->id}/departments")->assertForbidden();
    }

    // ─────────────────────────────── the TPO's roster, one department at a time ───────────────────────────────

    public function test_the_cohort_can_be_narrowed_to_one_department_and_never_crosses_colleges(): void
    {
        $college = $this->college(['engineering', 'commerce', 'arts']);
        $other = $this->college(['commerce']);

        $mech = $this->student($college, 'Mechanical Engineering');
        $unclassified = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college->id, 'branch' => null, 'department' => null]);
        $bcom = $this->student($college, 'B.Com');
        $english = $this->student($college, 'English');
        $foreign = $this->student($other, 'B.Com');

        Sanctum::actingAs($this->tpo($college));

        $ids = fn (?string $department) => collect($this->getJson('/api/tpo/students/cohort'.($department ? "?department={$department}" : ''))->assertOk()->json('students'))->pluck('id')->sort()->values()->all();

        $this->assertEqualsCanonicalizing([$mech->id, $unclassified->id, $bcom->id, $english->id], $ids(null));
        // Engineering includes a student who was never classified: they were an engineer before departments existed.
        $this->assertEqualsCanonicalizing([$mech->id, $unclassified->id], $ids('engineering'));
        $this->assertSame([$bcom->id], $ids('commerce'));
        $this->assertSame([$english->id], $ids('arts'));
        $this->assertSame([], $ids('management'));
        $this->assertNotContains($foreign->id, $ids(null));
    }

    public function test_adding_a_student_needs_a_department_when_the_college_runs_several(): void
    {
        Mail::fake();
        $college = $this->college(['engineering', 'commerce']);
        $this->subscribe($college);
        Sanctum::actingAs($this->tpo($college));

        $this->postJson('/api/tpo/students', ['name' => 'Meera Nair', 'email' => 'meera@dept.test', 'branch' => 'B.Com'])
            ->assertStatus(422)->assertJsonValidationErrors('department');

        $this->postJson('/api/tpo/students', ['name' => 'Meera Nair', 'email' => 'meera@dept.test', 'branch' => 'B.Com', 'department' => 'commerce'])
            ->assertCreated()->assertJsonPath('student.name', 'Meera Nair');

        $student = User::where('email', 'meera@dept.test')->firstOrFail();
        $this->assertSame('commerce', $student->department);
        $this->assertSame('bcom', $student->branch_code);
    }

    public function test_a_college_that_runs_one_department_never_has_to_say_which(): void
    {
        Mail::fake();
        $college = $this->college(['commerce']);
        $this->subscribe($college);
        Sanctum::actingAs($this->tpo($college));

        $this->postJson('/api/tpo/students', ['name' => 'Kabir Shah', 'email' => 'kabir@dept.test', 'branch' => 'Finance'])->assertCreated();

        $student = User::where('email', 'kabir@dept.test')->firstOrFail();
        $this->assertSame('commerce', $student->department);
        $this->assertSame('bcom_accounting', $student->branch_code, '"Finance" in Commerce is Accounting & Finance, not an MBA');
    }

    public function test_a_programme_of_another_department_is_refused_at_the_door(): void
    {
        Mail::fake();
        $college = $this->college(['engineering', 'commerce']);
        $this->subscribe($college);
        Sanctum::actingAs($this->tpo($college));

        $this->postJson('/api/tpo/students', ['name' => 'Isha Rao', 'email' => 'isha@dept.test', 'branch' => 'Mechanical Engineering', 'department' => 'commerce'])
            ->assertStatus(422)->assertJsonValidationErrors('branch');

        $this->assertDatabaseMissing('users', ['email' => 'isha@dept.test']);
    }

    public function test_a_department_the_college_does_not_run_is_refused(): void
    {
        Mail::fake();
        $college = $this->college(['engineering']);
        $this->subscribe($college);
        Sanctum::actingAs($this->tpo($college));

        $this->postJson('/api/tpo/students', ['name' => 'Isha Rao', 'email' => 'isha@dept.test', 'branch' => 'English', 'department' => 'arts'])
            ->assertStatus(422)->assertJsonValidationErrors('department');
    }

    // ─────────────────────────────── Mellow / superadmin ───────────────────────────────

    public function test_superadmin_sees_every_department_with_its_branches_and_counts(): void
    {
        $college = $this->college(['engineering', 'commerce']);
        $this->student($college, 'B.Com');
        $this->student($college, 'B.Com');
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $json = $this->getJson('/api/superadmin/departments')->assertOk()->json();

        $this->assertSame(['engineering', 'management', 'commerce', 'arts'], array_column($json['departments'], 'code'));

        $commerce = collect($json['departments'])->firstWhere('code', 'commerce');
        $this->assertSame(2, $commerce['students']);
        $this->assertSame(1, $commerce['colleges']);
        $this->assertFalse($commerce['resolved_capabilities']['coding_practice']);
        $this->assertNotEmpty($commerce['disciplines']);
    }

    public function test_superadmin_changes_what_a_department_includes_and_students_follow_at_once(): void
    {
        $college = $this->college(['commerce']);
        $student = $this->student($college, 'B.Com');
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $this->assertFalse(DepartmentCapabilities::forUser($student)['project_lab']);

        $this->putJson('/api/superadmin/departments/commerce', ['capabilities' => ['project_lab' => true]])->assertOk();

        $this->assertTrue(DepartmentCapabilities::forUser($student->fresh())['project_lab'], 'the next request already sees it');
    }

    public function test_only_superadmin_manages_departments(): void
    {
        $college = $this->college();

        foreach ([$this->tpo($college), User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL]), $this->student($college, 'Mechanical')] as $who) {
            Sanctum::actingAs($who);
            $this->getJson('/api/superadmin/departments')->assertForbidden();
            $this->putJson('/api/superadmin/departments/commerce', ['capabilities' => ['project_lab' => true]])->assertForbidden();
        }
    }

    public function test_the_superadmin_student_list_filters_by_department(): void
    {
        $college = $this->college(['engineering', 'commerce']);
        $mech = $this->student($college, 'Mechanical Engineering');
        $bcom = $this->student($college, 'B.Com');
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $listed = fn (string $department) => collect($this->getJson("/api/superadmin/users?department={$department}")->assertOk()->json('data'))->pluck('id')->all();

        $this->assertSame([$bcom->id], $listed('commerce'));
        $this->assertContains($mech->id, $listed('engineering'));
        $this->assertNotContains($bcom->id, $listed('engineering'));
    }

    public function test_a_department_with_students_or_colleges_cannot_be_deleted_but_an_empty_custom_one_can(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $this->deleteJson('/api/superadmin/departments/commerce')->assertStatus(422);

        $this->postJson('/api/superadmin/departments', [
            'code' => 'law', 'name' => 'Law & Legal Studies', 'short' => 'Law', 'icon' => 'landmark', 'accent' => 'rose',
        ])->assertCreated();

        $this->assertNotNull(Department::where('code', 'law')->first());
        $this->deleteJson('/api/superadmin/departments/law')->assertOk();
        $this->assertNull(Department::where('code', 'law')->first());
        $this->assertSame(0, CollegeDepartment::where('department_code', 'law')->count());
    }
}
