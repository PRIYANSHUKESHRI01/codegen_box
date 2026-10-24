<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Interview;
use App\Models\User;
use App\Services\EligibilityService;
use App\Support\BranchAudience;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * "Everyone only sees what relates to them", for the things that are aimed at someone: an audience (a test, interview,
 * contest or soft-skill set may be aimed at a whole department, a family or a branch), a drive's eligibility, and a section
 * coordinator's scope.
 */
class DepartmentAudienceTest extends TestCase
{
    use RefreshDatabase;

    private function student(string $branch, array $attrs = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'branch' => $branch, 'must_change_password' => false] + $attrs);
    }

    // ─────────────────────────────── audiences ───────────────────────────────

    public function test_an_audience_with_no_department_is_byte_identical_to_before_departments_existed(): void
    {
        $this->assertSame(['disciplines' => ['ece'], 'branches' => []], BranchAudience::normalize(['disciplines' => ['ece']]));
        $this->assertSame(['disciplines' => [], 'branches' => ['cse']], BranchAudience::normalize(['branches' => ['cse'], 'departments' => []]));
        $this->assertNull(BranchAudience::normalize(['disciplines' => [], 'branches' => [], 'departments' => []]));
        $this->assertNull(BranchAudience::normalize(null));
    }

    public function test_a_department_is_stored_only_when_it_is_used(): void
    {
        $this->assertSame(
            ['disciplines' => [], 'branches' => [], 'departments' => ['commerce']],
            BranchAudience::normalize(['departments' => ['commerce', 'commerce', '']]),
        );
    }

    public function test_a_whole_department_audience_reaches_every_programme_of_it_and_nobody_else(): void
    {
        $audience = BranchAudience::normalize(['departments' => ['commerce']]);

        $this->assertTrue(BranchAudience::includes($audience, $this->student('B.Com')));
        $this->assertTrue(BranchAudience::includes($audience, $this->student('M.Com')));
        $this->assertTrue(BranchAudience::includes($audience, $this->student('CA')->forceFill(['department' => 'commerce'])));
        $this->assertFalse(BranchAudience::includes($audience, $this->student('Mechanical Engineering')));
        $this->assertFalse(BranchAudience::includes($audience, $this->student('MBA')));
        $this->assertFalse(BranchAudience::includes($audience, $this->student('English')));
    }

    public function test_a_family_or_branch_audience_still_works_and_is_not_widened_to_its_department(): void
    {
        $family = BranchAudience::normalize(['disciplines' => ['bcom']]);
        $this->assertTrue(BranchAudience::includes($family, $this->student('B.Com')));
        $this->assertFalse(BranchAudience::includes($family, $this->student('M.Com')));

        $branch = BranchAudience::normalize(['branches' => ['mba_finance']]);
        $this->assertTrue(BranchAudience::includes($branch, $this->student('MBA (Finance)')));
        $this->assertFalse(BranchAudience::includes($branch, $this->student('MBA (Marketing)')));
    }

    public function test_no_audience_is_everyone(): void
    {
        foreach (['B.Com', 'MBA', 'English', 'Mechanical Engineering'] as $branch) {
            $this->assertTrue(BranchAudience::includes(null, $this->student($branch)));
        }
    }

    public function test_a_student_whose_branch_is_not_matched_yet_is_not_shown_another_departments_test(): void
    {
        // A roster imported under Commerce whose label we do not recognise yet: they are a Commerce student, so an ECE test is not theirs.
        $unplaced = $this->student('Some Local Diploma')->forceFill(['department' => 'commerce', 'discipline' => null, 'branch_code' => null]);

        $this->assertFalse(BranchAudience::includes(BranchAudience::normalize(['disciplines' => ['ece']]), $unplaced));
        $this->assertTrue(BranchAudience::includes(BranchAudience::normalize(['departments' => ['commerce']]), $unplaced));
        $this->assertTrue(BranchAudience::includes(BranchAudience::normalize(['disciplines' => ['bcom']]), $unplaced), 'it reaches into their department, so it may be theirs');

        // Someone with no department at all stays visible to everything: we cannot tell, so we do not hide.
        $nobody = User::factory()->create(['role' => User::ROLE_USER, 'branch' => null, 'department' => null, 'discipline' => null, 'branch_code' => null]);
        $this->assertTrue(BranchAudience::includes(BranchAudience::normalize(['disciplines' => ['ece']]), $nobody));
    }

    public function test_an_audience_is_described_in_words(): void
    {
        $this->assertStringContainsString('Commerce', BranchAudience::label(BranchAudience::normalize(['departments' => ['commerce']])));
    }

    public function test_the_department_must_exist(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $this->postJson('/api/admin/interviews', [
            'title' => 'Commerce screening', 'interview_type' => 'general', 'branch_audience' => ['departments' => ['astrology']],
        ])->assertStatus(422)->assertJsonValidationErrors('branch_audience.departments.0');
    }

    public function test_a_student_is_only_offered_interviews_aimed_at_their_department(): void
    {
        $forCommerce = Interview::create(['title' => 'Commerce Round', 'slug' => Interview::uniqueSlug('Commerce Round'), 'status' => 'published', 'interview_type' => 'general', 'branch_audience' => ['disciplines' => [], 'branches' => [], 'departments' => ['commerce']]]);
        $forEveryone = Interview::create(['title' => 'Open Round', 'slug' => Interview::uniqueSlug('Open Round'), 'status' => 'published', 'interview_type' => 'general']);

        Sanctum::actingAs($this->student('B.Com'));
        $mine = collect($this->getJson('/api/interviews')->assertOk()->json('interviews') ?? $this->getJson('/api/interviews')->json())->pluck('title')->all();
        $this->assertContains('Commerce Round', $mine);
        $this->assertContains('Open Round', $mine);

        Sanctum::actingAs($this->student('English'));
        $theirs = collect($this->getJson('/api/interviews')->assertOk()->json('interviews') ?? $this->getJson('/api/interviews')->json())->pluck('title')->all();
        $this->assertNotContains('Commerce Round', $theirs, 'another department\'s interview is not listed');
        $this->assertContains('Open Round', $theirs);

        $this->assertNotNull($forCommerce->id.$forEveryone->id);
    }

    // ─────────────────────────────── drive eligibility ───────────────────────────────

    private function open(array $branches): array
    {
        return ['min_cgpa' => null, 'max_backlogs' => null, 'eligible_branches' => $branches];
    }

    public function test_a_department_token_makes_a_drive_open_to_the_whole_department(): void
    {
        $drive = $this->open([EligibilityService::DEPARTMENT_PREFIX.'commerce']);

        $this->assertSame('eligible', EligibilityService::evaluate($this->student('B.Com'), $drive)['status']);
        $this->assertSame('eligible', EligibilityService::evaluate($this->student('Chartered Accountancy'), $drive)['status']);
        $this->assertSame('not_eligible', EligibilityService::evaluate($this->student('MBA'), $drive)['status']);
        $this->assertSame('not_eligible', EligibilityService::evaluate($this->student('Mechanical Engineering'), $drive)['status']);
    }

    public function test_a_branch_or_family_token_works_for_the_new_departments_too(): void
    {
        $this->assertSame('eligible', EligibilityService::evaluate($this->student('MBA (Finance)'), $this->open(['mba_finance']))['status']);
        $this->assertSame('not_eligible', EligibilityService::evaluate($this->student('MBA (Marketing)'), $this->open(['mba_finance']))['status']);
        $this->assertSame('eligible', EligibilityService::evaluate($this->student('MBA (Marketing)'), $this->open([EligibilityService::FAMILY_PREFIX.'mba']))['status']);
    }

    public function test_an_engineering_drive_is_unchanged_and_never_reaches_commerce(): void
    {
        $this->assertSame('eligible', EligibilityService::evaluate($this->student('Mechanical Engineering'), $this->open(['mech']))['status']);
        $this->assertSame('not_eligible', EligibilityService::evaluate($this->student('B.Com'), $this->open(['mech']))['status']);
        $this->assertSame('eligible', EligibilityService::evaluate($this->student('B.Com'), $this->open([]))['status'], 'a drive open to everyone is open to everyone');
    }

    public function test_an_unplaced_student_is_ruled_out_only_by_a_drive_that_cannot_be_theirs(): void
    {
        $unplaced = $this->student('Some Local Diploma')->forceFill(['department' => 'commerce', 'discipline' => null, 'branch_code' => null]);

        $this->assertSame('not_eligible', EligibilityService::evaluate($unplaced, $this->open(['mech']))['status']);
        $this->assertNotSame('not_eligible', EligibilityService::evaluate($unplaced, $this->open(['bcom']))['status']);
    }

    // ─────────────────────────────── a coordinator's scope ───────────────────────────────

    public function test_a_section_coordinator_scoped_to_a_department_sees_only_its_students(): void
    {
        $college = College::create(['name' => 'Scope College', 'short_code' => 'SCOPE', 'tier' => 'Standard']);
        $coordinator = User::factory()->create([
            'role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $college->id, 'section' => 'A',
            'coordinator_scope' => ['disciplines' => [], 'branches' => [], 'departments' => ['commerce']],
        ]);
        $bcom = $this->student('B.Com', ['college_id' => $college->id, 'section' => 'A']);
        $mech = $this->student('Mechanical Engineering', ['college_id' => $college->id, 'section' => 'A']);
        $otherSection = $this->student('B.Com', ['college_id' => $college->id, 'section' => 'B']);

        Sanctum::actingAs($coordinator);
        $ids = collect($this->getJson('/api/coordinator/students')->assertOk()->json('students'))->pluck('id')->all();

        $this->assertSame([$bcom->id], $ids, 'their section, their department — nobody else');

        // The query and its in-memory twin must agree about every student, and an out-of-scope id is a 404, never a 403.
        foreach ([$bcom, $mech, $otherSection] as $student) {
            $this->assertSame(in_array($student->id, $ids, true), $coordinator->coordinates($student), $student->branch);
        }
        $this->postJson("/api/coordinator/students/{$mech->id}/toggle-block", ['reason' => 'test'])->assertNotFound();
    }
}
