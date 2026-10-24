<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Company;
use App\Models\CompanyRecommendedProblem;
use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\CoreTest;
use App\Models\CoreTestQuestion;
use App\Models\DriveCollegeMapping;
use App\Models\Discipline;
use App\Models\Interview;
use App\Models\InterviewTrack;
use App\Models\Plan;
use App\Models\PlacementDrive;
use App\Models\SoftSkillAssessment;
use App\Models\Subscription;
use App\Models\User;
use App\Services\Core\CorePracticeService;
use App\Support\BranchCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * "Everyone only sees what relates to them", checked as a MATRIX across the whole product rather than one screen at a time:
 * seven students from four departments against the same set of content aimed at a department, a family, a branch or nobody in
 * particular — through the real student endpoints, list AND direct link. If a new content type is aimed at a department, add it here.
 */
class DepartmentVisibilityMatrixTest extends TestCase
{
    use RefreshDatabase;

    /** What each student is, and which audiences (below) they must be offered. */
    private const STUDENTS = [
        'cse' => ['Computer Science', ['everyone']],
        'ece' => ['ECE', ['everyone', 'ece family']],
        'bcom' => ['B.Com', ['everyone', 'commerce department']],
        'bcom_hons' => ['B.Com (Hons)', ['everyone', 'commerce department']],
        'mba_finance' => ['MBA (Finance)', ['everyone', 'mba family', 'mba finance only']],
        'mba_marketing' => ['MBA (Marketing)', ['everyone', 'mba family']],
        'english' => ['English', ['everyone', 'english only']],
    ];

    /** @return array<string, array<string, list<string>>|null> */
    private function audiences(): array
    {
        return [
            'everyone' => null,
            'commerce department' => ['departments' => ['commerce']],
            'mba family' => ['disciplines' => ['mba']],
            'mba finance only' => ['branches' => ['mba_finance']],
            'ece family' => ['disciplines' => ['ece']],
            'english only' => ['branches' => ['english']],
        ];
    }

    private int $seq = 0;

    private function student(string $branch, array $attrs = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'branch' => $branch, 'must_change_password' => false] + $attrs);
    }

    // ─────────────────────────── audience-aimed content, list and direct link ───────────────────────────

    /** @param  callable(string $label, array|null $audience): string  $make  creates one item and returns its slug */
    private function assertMatrix(callable $make, string $listPath, string $listKey, string $detailPath, array $studentAttrs = []): void
    {
        $slugs = [];
        foreach ($this->audiences() as $label => $audience) {
            $slugs[$label] = $make($label, $audience);
        }

        foreach (self::STUDENTS as $key => [$branch, $expected]) {
            Sanctum::actingAs($this->student($branch, $studentAttrs));

            $listed = collect($this->getJson($listPath)->assertOk()->json($listKey))->pluck('title')->intersect(array_keys($slugs))->sort()->values()->all();
            $want = collect($expected)->sort()->values()->all();
            $this->assertSame($want, $listed, "{$key}: what {$listPath} lists");

            foreach ($slugs as $label => $slug) {
                $response = $this->getJson(str_replace('{slug}', $slug, $detailPath));
                in_array($label, $expected, true)
                    ? $response->assertOk()
                    : $response->assertNotFound();
            }
        }
    }

    public function test_interviews_reach_exactly_the_audience_they_were_aimed_at(): void
    {
        $this->assertMatrix(
            fn (string $label, ?array $audience) => Interview::create([
                'title' => $label, 'slug' => Interview::uniqueSlug($label), 'status' => 'published', 'interview_type' => 'general', 'branch_audience' => $audience,
            ])->slug,
            '/api/interviews', 'interviews', '/api/interviews/{slug}',
        );
    }

    public function test_coding_contests_reach_exactly_the_audience_they_were_aimed_at(): void
    {
        // Contests are a coding module: a programme without it has none to see, so every student here has coding switched on
        // (engineering has it; the others opt in) and the AUDIENCE alone decides what each is offered.
        $this->assertMatrix(
            fn (string $label, ?array $audience) => \App\Models\Contest::create([
                'title' => $label, 'slug' => 'c-'.\Illuminate\Support\Str::slug($label).'-'.uniqid(), 'start_at' => now()->subHour(), 'end_at' => now()->addHour(),
                'status' => 'published', 'contest_type' => 'general', 'branch_audience' => $audience,
            ])->slug,
            '/api/contests', 'contests', '/api/contests/{slug}', ['coding_opt_in' => true],
        );
    }

    public function test_a_programme_without_coding_is_offered_no_contest_at_all_whatever_its_audience(): void
    {
        \App\Models\Contest::create(['title' => 'Open contest', 'slug' => 'c-open-'.uniqid(), 'start_at' => now()->subHour(), 'end_at' => now()->addHour(), 'status' => 'published', 'contest_type' => 'general']);

        foreach (['B.Com', 'MBA (Finance)', 'English'] as $branch) {
            Sanctum::actingAs($this->student($branch));
            $this->getJson('/api/contests')->assertForbidden()->assertJsonPath('code', 'capability_unavailable');
        }
    }

    public function test_interview_tracks_reach_exactly_the_audience_they_were_aimed_at(): void
    {
        $this->assertMatrix(
            fn (string $label, ?array $audience) => InterviewTrack::create([
                'title' => $label, 'slug' => InterviewTrack::uniqueSlug($label), 'status' => InterviewTrack::STATUS_PUBLISHED,
                'track_type' => InterviewTrack::TRACK_TYPE_GENERAL, 'role_title' => $label, 'branch_audience' => $audience,
            ])->slug,
            '/api/interview-tracks', 'tracks', '/api/interview-tracks/{slug}',
        );
    }

    public function test_soft_skill_assessments_reach_exactly_the_audience_they_were_aimed_at(): void
    {
        $this->assertMatrix(
            fn (string $label, ?array $audience) => SoftSkillAssessment::create([
                'title' => $label, 'slug' => SoftSkillAssessment::uniqueSlug($label), 'status' => SoftSkillAssessment::STATUS_PUBLISHED,
                'assessment_type' => SoftSkillAssessment::TYPE_GENERAL, 'duration_minutes' => 30, 'pass_percentage' => 60, 'branch_audience' => $audience,
            ])->slug,
            '/api/soft-skills', 'assessments', '/api/soft-skills/{slug}',
        );
    }

    // ─────────────────────────── Domain Prep: practice and timed tests ───────────────────────────

    private function live(string ...$disciplines): void
    {
        Discipline::whereIn('code', $disciplines)->update(['is_live' => true, 'live_at' => now()->subDays(90)]);
        app(BranchCatalog::class)->flush();
    }

    private function subject(string $discipline, string $code): CoreSubject
    {
        return CoreSubject::where('discipline_code', $discipline)->where('code', $code)->firstOrFail();
    }

    private function question(string $discipline, string $subject): CoreQuestion
    {
        $s = $this->subject($discipline, $subject);
        $n = ++$this->seq;

        return CoreQuestion::create([
            'external_id' => "MATRIX-{$n}", 'discipline_code' => $discipline, 'subject_id' => $s->id, 'topic_id' => $s->topics()->first()->id, 'type' => 'mcq_single',
            'stem' => "Matrix question {$n} about {$subject}?", 'options' => [['id' => 'a', 'text' => 'right'], ['id' => 'b', 'text' => 'wrong'], ['id' => 'c', 'text' => 'wrong too'], ['id' => 'd', 'text' => 'wrong again']],
            'correct' => ['a'], 'marks' => 1, 'negative_marks' => 0.25, 'difficulty' => 'medium', 'usage' => 'both', 'status' => 'published', 'explanation' => 'Because a is right.',
        ]);
    }

    private function staff(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_CORE_PREP]]);
    }

    public function test_practice_only_ever_serves_a_question_from_the_students_own_programme(): void
    {
        $this->live('mba', 'bcom', 'lang_lit');

        foreach (['MBA (Finance)', 'MBA (Marketing)', 'B.Com', 'B.Com (Hons)', 'English'] as $branch) {
            $student = $this->student($branch);
            $visible = CoreSubject::idsVisibleTo((string) $student->discipline, $student->branch_code);
            $this->assertNotEmpty($visible, "{$branch} has subjects to practise");

            for ($i = 0; $i < 25; $i++) {
                $q = app(CorePracticeService::class)->next($student, ['mode' => 'new']);

                $this->assertNotNull($q, "{$branch} is served something");
                $this->assertSame($student->discipline, $q->discipline_code, "{$branch}: another family's question");
                $this->assertContains((int) $q->subject_id, $visible, "{$branch}: a subject outside their programme");
            }
        }
    }

    public function test_a_test_never_holds_a_specialisation_that_not_every_student_it_reaches_studies(): void
    {
        $this->live('mba');
        $shared = $this->question('mba', 'marketing_management');           // the shared MBA core
        $finance = $this->question('mba', 'investment_markets');            // MBA Finance only

        Sanctum::actingAs($this->staff());
        $make = fn (string $title, ?array $audience) => $this->postJson('/api/admin/core/tests', ['title' => $title, 'discipline_code' => 'mba', 'duration_minutes' => 30, 'pass_percentage' => 40] + ($audience ? ['branch_audience' => $audience] : []))->assertCreated()->json('test.slug');

        // A paper aimed at the whole MBA family can only hold the shared core …
        $everyone = $make('MBA open paper', null);
        $this->putJson("/api/admin/core/tests/{$everyone}/questions", ['question_ids' => [$shared->id, $finance->id]])->assertStatus(422);
        $this->putJson("/api/admin/core/tests/{$everyone}/questions", ['question_ids' => [$shared->id]])->assertOk();

        // … a paper aimed at MBA Finance alone may hold the specialisation too …
        $onlyFinance = $make('MBA Finance paper', ['branches' => ['mba_finance']]);
        $this->putJson("/api/admin/core/tests/{$onlyFinance}/questions", ['question_ids' => [$shared->id, $finance->id]])->assertOk();

        // … and cannot afterwards be widened to students who do not study it.
        $this->putJson("/api/admin/core/tests/{$onlyFinance}", ['branch_audience' => null])->assertStatus(422)->assertJsonValidationErrors('branch_audience');
        $this->putJson("/api/admin/core/tests/{$onlyFinance}", ['branch_audience' => ['disciplines' => ['mba']]])->assertStatus(422);
        // Another branch's audience does not unlock it either.
        $this->putJson("/api/admin/core/tests/{$onlyFinance}", ['branch_audience' => ['branches' => ['mba_finance', 'mba_marketing']]])->assertStatus(422);
    }

    public function test_core_tests_are_offered_only_to_students_who_study_everything_in_them(): void
    {
        $this->live('mba', 'bcom');
        $shared = $this->question('mba', 'marketing_management');
        $finance = $this->question('mba', 'investment_markets');

        Sanctum::actingAs($this->staff());
        $publish = function (string $title, array $questionIds, ?array $audience) {
            $slug = $this->postJson('/api/admin/core/tests', ['title' => $title, 'discipline_code' => 'mba', 'duration_minutes' => 30, 'pass_percentage' => 40] + ($audience ? ['branch_audience' => $audience] : []))->assertCreated()->json('test.slug');
            $this->putJson("/api/admin/core/tests/{$slug}/questions", ['question_ids' => $questionIds])->assertOk();
            $this->putJson("/api/admin/core/tests/{$slug}", ['status' => 'published'])->assertOk();

            return $slug;
        };

        $open = $publish('Open MBA paper', [$shared->id], null);
        $financeOnly = $publish('Finance MBA paper', [$shared->id, $finance->id], ['branches' => ['mba_finance']]);

        // An older paper (or one whose subject was re-pointed later) that slipped through: aimed at everyone, holding a specialisation.
        $legacy = CoreTest::create(['slug' => 'legacy-mba', 'title' => 'Legacy MBA paper', 'discipline_code' => 'mba', 'status' => 'published', 'test_type' => 'general', 'duration_minutes' => 30]);
        foreach ([$shared, $finance] as $position => $q) {
            CoreTestQuestion::create(['core_test_id' => $legacy->id, 'core_question_id' => $q->id, 'position' => $position + 1]);
        }

        $offered = function (User $student): array {
            Sanctum::actingAs($student);

            return collect($this->getJson('/api/core/tests')->assertOk()->json('tests'))->pluck('slug')->sort()->values()->all();
        };

        $this->assertSame(collect([$open, $financeOnly, 'legacy-mba'])->sort()->values()->all(), $offered($this->student('MBA (Finance)')), 'Finance studies all of it');
        $this->assertSame([$open], $offered($this->student('MBA (Marketing)')), 'Marketing never gets the finance specialisation');

        // Not by link either.
        Sanctum::actingAs($this->student('MBA (Marketing)'));
        $this->postJson("/api/core/tests/{$financeOnly}/start")->assertNotFound();
        $this->postJson('/api/core/tests/legacy-mba/start')->assertNotFound();

        // Another family's students (live too) are offered none of it.
        $this->live('bcom');
        $this->assertSame([], $offered($this->student('B.Com')));
    }

    public function test_a_colleges_copy_of_a_paper_keeps_the_papers_audience(): void
    {
        $this->live('mba');
        $college = College::create(['name' => 'Copy College', 'short_code' => 'CPY', 'tier' => 'Standard']);
        $finance = $this->question('mba', 'investment_markets');

        Sanctum::actingAs($this->staff());
        $slug = $this->postJson('/api/admin/core/tests', ['title' => 'Finance paper', 'discipline_code' => 'mba', 'duration_minutes' => 30, 'pass_percentage' => 40, 'branch_audience' => ['branches' => ['mba_finance']]])->assertCreated()->json('test.slug');
        $this->putJson("/api/admin/core/tests/{$slug}/questions", ['question_ids' => [$finance->id]])->assertOk();
        $this->putJson("/api/admin/core/tests/{$slug}", ['status' => 'published'])->assertOk();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]));
        $copy = $this->postJson("/api/tpo/core-tests/library/{$slug}/copy")->assertSuccessful()->json('test.slug');

        $this->assertSame(['mba_finance'], CoreTest::where('slug', $copy)->firstOrFail()->branch_audience['branches'], 'the copy is still aimed at MBA Finance alone');
    }

    // ─────────────────────────── modules a programme does not have ───────────────────────────

    public function test_skill_drills_and_the_coding_drive_extras_belong_to_programmes_that_code(): void
    {
        $commerce = $this->student('B.Com');
        $cse = $this->student('Computer Science');

        Sanctum::actingAs($commerce);
        $this->getJson('/api/me/drills')->assertForbidden()->assertJsonPath('code', 'capability_unavailable');
        $this->postJson('/api/me/drills/attempts', [])->assertForbidden();

        Sanctum::actingAs($cse);
        $this->getJson('/api/me/drills')->assertOk();

        // …and they can switch coding on for themselves, which brings drills with it.
        $commerce->forceFill(['coding_opt_in' => true])->save();
        Sanctum::actingAs($commerce->fresh());
        $this->getJson('/api/me/drills')->assertOk();
    }

    public function test_a_placement_drive_does_not_send_a_non_coder_to_coding_problems(): void
    {
        $college = College::create(['name' => 'Drive College', 'short_code' => 'DRV', 'tier' => 'Standard']);
        $plan = Plan::create([
            'code' => 'matrix-'.uniqid(), 'name' => 'Standard', 'audience' => Plan::AUDIENCE_INSTITUTION, 'list_price' => null, 'annual_price' => 149000,
            'duration_days' => 365, 'is_active' => true, 'sort_order' => 1, 'drive_access' => true, 'max_students' => 500,
        ]);
        Subscription::create(['subscriber_type' => College::class, 'subscriber_id' => $college->id, 'plan_id' => $plan->id, 'status' => Subscription::STATUS_ACTIVE, 'started_at' => now()->subMonth(), 'current_period_end' => now()->addYear(), 'auto_renew' => false]);

        $company = Company::create(['name' => 'Acme Corp', 'slug' => 'acme-corp', 'is_active' => true]);
        CompanyRecommendedProblem::create(['company_id' => $company->id, 'problem_slug' => 'two-sum', 'topic_tag' => 'arrays', 'priority' => 1]);
        $drive = PlacementDrive::create([
            'company_id' => $company->id, 'title' => 'Acme Campus Drive', 'role_title' => 'Associate', 'drive_date' => now()->addWeek(), 'status' => PlacementDrive::STATUS_PUBLISHED, 'is_open_to_all' => true,
        ]);
        DriveCollegeMapping::create(['placement_drive_id' => $drive->id, 'college_id' => $college->id, 'is_active' => true, 'mapped_at' => now()]);

        Sanctum::actingAs($this->student('Computer Science', ['college_id' => $college->id]));
        $this->assertCount(1, $this->getJson("/api/drives/{$drive->id}")->assertOk()->json('recommended_problems'));

        Sanctum::actingAs($this->student('B.Com', ['college_id' => $college->id]));
        $this->assertSame([], $this->getJson("/api/drives/{$drive->id}")->assertOk()->json('recommended_problems'));
    }

    // ─────────────────────────── every student page, for every department ───────────────────────────

    public function test_every_student_page_loads_for_a_student_of_every_department(): void
    {
        // The same discipline-aware code runs under every page; a student of each department must be able to open each one (a 403 for a
        // module their programme lacks is correct — a 5xx never is). Found by walking the real route table, so a new student page is covered.
        $this->live('mba', 'bcom', 'lang_lit', 'ece');
        $college = College::create(['name' => 'Crawl College', 'short_code' => 'CRL', 'tier' => 'Standard']);

        $uris = collect(\Illuminate\Support\Facades\Route::getRoutes()->getRoutes())
            ->filter(function ($route) {
                if (! in_array('GET', $route->methods(), true) || ! str_starts_with($route->uri(), 'api/') || str_contains($route->uri(), '{')) {
                    return false;
                }

                $middleware = collect($route->gatherMiddleware())->filter(fn ($m) => is_string($m));
                $role = $middleware->first(fn ($m) => str_starts_with($m, 'role:'));

                return $middleware->contains(fn ($m) => str_starts_with($m, 'auth:sanctum'))
                    && ($role === null || in_array(User::ROLE_USER, explode(',', substr($role, 5)), true));
            })
            ->map(fn ($route) => '/'.$route->uri())->unique()->sort()->values();

        $this->assertGreaterThan(40, $uris->count(), 'the crawl found the student routes');

        $broken = [];
        foreach (self::STUDENTS as $key => [$branch]) {
            Sanctum::actingAs($this->student($branch, ['college_id' => $college->id]));

            foreach ($uris as $uri) {
                $status = $this->getJson($uri)->status();

                if ($status >= 500) {
                    $broken[] = "{$key} GET {$uri} -> {$status}";
                }
            }
        }

        $this->assertSame([], $broken, "student pages that crash:
".implode("
", $broken));
    }
}
