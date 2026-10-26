<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\DisciplinePilot;
use App\Models\Interview;
use App\Models\InterviewQuestionBank;
use App\Models\InterviewRoleTemplate;
use App\Models\InterviewSession;
use App\Models\User;
use App\Services\Core\CoreAccess;
use App\Services\ReadinessScoreService;
use App\Services\StudentCohortService;
use App\Support\BranchCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * What the non-engineering departments get once they exist: Domain Prep (Management / Commerce / Subject Prep) with a real starter
 * question for every branch, staged behind the same pilot switch as Core Prep; AI practice interviews of their own; a readiness
 * score that does not wait for code they will never write; and a cohort that does not read the whole department as "never started".
 */
class DomainPrepDepartmentsTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    private function student(string $branch, array $attrs = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'branch' => $branch, 'must_change_password' => false] + $attrs);
    }

    private function college(): College
    {
        $n = ++$this->seq;

        return College::create(['name' => "Prep College {$n}", 'short_code' => "PREP{$n}", 'tier' => 'Standard']);
    }

    /** @return list<array{department: string, discipline: string, branch: string}> */
    private function newBranches(): array
    {
        $catalog = app(BranchCatalog::class);
        $out = [];

        foreach ($catalog->departments() as $department) {
            if ($department['code'] === 'engineering') {
                continue;
            }

            foreach ($catalog->disciplines($department['code']) as $discipline) {
                foreach ($catalog->branches() as $branch) {
                    if ($branch['discipline_code'] === $discipline['code']) {
                        $out[] = ['department' => $department['code'], 'discipline' => $discipline['code'], 'branch' => $branch['code']];
                    }
                }
            }
        }

        return $out;
    }

    // ─────────────────────────────── the starter questions ───────────────────────────────

    public function test_every_branch_of_every_new_department_has_a_real_published_question(): void
    {
        $rows = $this->newBranches();
        $this->assertCount(15, $rows, 'five main branches for each of Management, Commerce and Arts');

        foreach ($rows as $row) {
            $subjects = CoreSubject::idsVisibleTo($row['discipline'], $row['branch']);
            $offered = CoreQuestion::query()->where('status', CoreQuestion::STATUS_PUBLISHED)->where('discipline_code', $row['discipline'])->whereIn('subject_id', $subjects)->count();

            $this->assertGreaterThan(0, $offered, "{$row['branch']} ({$row['discipline']}) has no question to practise");
        }
    }

    public function test_every_branch_that_has_domain_prep_has_a_real_question_to_show(): void
    {
        // Every branch of every department that ships its own questions with the migrations: the other engineering branches (Chemical,
        // Biotech, Aerospace, Agri, Mining) and every branch of Management, Commerce and Arts. ECE / EEE / Mech / Civil have 647 questions
        // too, but those are imported from content/core-prep by `core:import`, not shipped by a migration, so a fresh test database has none.
        // CSE and IT-type branches have no Domain Prep at all (their questions are the coding problem bank).
        // ALL branches, offered or not: switching one back on in Superadmin must find its questions waiting.
        $catalog = app(BranchCatalog::class);
        $checked = 0;

        foreach ($catalog->branches(false) as $branch) {
            $discipline = $branch['discipline_code'];
            $hasPrep = \App\Support\DepartmentCapabilities::resolve($catalog->departmentOfDiscipline($discipline), $discipline)['domain_prep'];

            if (! $hasPrep || in_array($discipline, ['ece', 'eee', 'mech', 'civil'], true)) {
                continue;
            }

            $subjects = CoreSubject::idsVisibleTo($branch['discipline_code'], $branch['code']);
            $offered = CoreQuestion::query()->where('status', CoreQuestion::STATUS_PUBLISHED)->where('discipline_code', $branch['discipline_code'])->whereIn('subject_id', $subjects)->count();

            $this->assertGreaterThan(0, $offered, "{$branch['name']} ({$branch['code']}) has no question to show");
            $checked++;
        }

        $this->assertGreaterThanOrEqual(78, $checked, 'every migration-seeded branch is covered (73 + the 5 other engineering branches)');
        $this->assertNotContains('cse', \App\Services\Core\CoreAccess::families(), 'CSE keeps the coding problem bank, as before');
    }

    public function test_the_other_engineering_branches_each_get_their_own_specialisation_and_the_shared_core(): void
    {
        $shared = ['engineering_mathematics', 'engineering_mechanics_materials', 'thermo_fluids_basics', 'engineering_economics_safety'];
        $own = ['chem' => 'chemical_process_engineering', 'biotech' => 'bioprocess_biochemistry', 'aero' => 'aerospace_flight', 'agri' => 'agricultural_soil_water', 'mining' => 'mineral_metallurgy'];

        foreach ($own as $branch => $specialisation) {
            $codes = CoreSubject::whereIn('id', CoreSubject::idsVisibleTo('other', $branch))->pluck('code')->all();

            $this->assertEqualsCanonicalizing([...$shared, $specialisation], $codes, "{$branch} studies the shared core and only its own specialisation");
        }

        $student = $this->student('Chemical Engineering');
        $this->assertSame(['engineering', 'other', 'chem'], [$student->department, $student->discipline, $student->branch_code]);
        $this->assertTrue($student->hasDomainPrepFamily());
    }

    public function test_every_starter_question_is_well_formed(): void
    {
        $disciplines = array_keys(require database_path('data/domain_taxonomy.php'));   // every shipped family, offered or not
        $questions = CoreQuestion::query()->whereIn('discipline_code', $disciplines)->get();

        $this->assertGreaterThanOrEqual(99, $questions->count(), '85 for Management, Commerce and Arts, 14 for the other engineering branches');

        foreach ($questions as $q) {
            $this->assertNotNull($q->subject_id, "question {$q->external_id} has a subject");
            $this->assertSame($q->discipline_code, $q->subject->discipline_code, "question {$q->external_id} sits in a subject of its own discipline");
            $this->assertGreaterThan(20, mb_strlen($q->stem));
            $this->assertNotSame('', trim((string) $q->explanation), "question {$q->external_id} explains its answer");

            if ($q->type === 'numeric') {
                $this->assertNotNull($q->numeric_min);
                $this->assertNotNull($q->numeric_max);
            } else {
                $ids = array_column($q->options, 'id');
                $this->assertGreaterThanOrEqual(4, count($ids));
                $this->assertCount(1, array_intersect($q->correct, $ids), "question {$q->external_id} has its key among its options");
            }
        }
    }

    public function test_a_branch_specialisation_is_offered_only_to_that_branch(): void
    {
        $finance = CoreSubject::idsVisibleTo('mba', 'mba_finance');
        $marketing = CoreSubject::idsVisibleTo('mba', 'mba_marketing');
        $investment = CoreSubject::where('discipline_code', 'mba')->where('code', 'investment_markets')->value('id');
        $brand = CoreSubject::where('discipline_code', 'mba')->where('code', 'consumer_brand')->value('id');
        $shared = CoreSubject::where('discipline_code', 'mba')->where('code', 'marketing_management')->value('id');

        $this->assertContains($investment, $finance);
        $this->assertNotContains($brand, $finance);
        $this->assertContains($brand, $marketing);
        $this->assertNotContains($investment, $marketing);
        $this->assertContains($shared, $finance, 'the shared core is offered to everyone in the discipline');
        $this->assertContains($shared, $marketing);
    }

    // ─────────────────────────────── staged behind the pilot switch ───────────────────────────────

    public function test_domain_prep_is_absent_until_the_college_is_a_pilot_then_appears(): void
    {
        $college = $this->college();
        $student = $this->student('B.Com', ['college_id' => $college->id]);
        $this->assertSame('bcom', $student->discipline);

        Sanctum::actingAs($student);
        $this->getJson('/api/core')->assertOk()->assertJsonPath('available', false);
        $this->assertFalse(app(CoreAccess::class)->available($student));

        DisciplinePilot::create(['discipline_code' => 'bcom', 'college_id' => $college->id]);
        app(BranchCatalog::class)->flush();

        $home = $this->getJson('/api/core')->assertOk()->assertJsonPath('available', true)->assertJsonPath('pilot', true)->json();
        $subjects = array_column($home['subjects'], 'name');
        $this->assertContains('Financial Accounting', $subjects);
        $this->assertNotContains('Banking Law, Operations & Insurance', $subjects, 'a banking-specialisation subject is not shown to a general B.Com student');
    }

    public function test_only_a_student_who_codes_is_asked_whether_to_lead_with_their_branch_or_with_it(): void
    {
        $college = $this->college();
        DisciplinePilot::create(['discipline_code' => 'bcom', 'college_id' => $college->id]);
        DisciplinePilot::create(['discipline_code' => 'ece', 'college_id' => $college->id]);
        app(BranchCatalog::class)->flush();

        $commerce = $this->student('B.Com', ['college_id' => $college->id]);
        $ece = $this->student('ECE', ['college_id' => $college->id]);

        // A Commerce student has no IT track to weigh Commerce Prep against: a blocking dialog with nothing to answer is a bug.
        $this->assertFalse($commerce->branch_pending);
        $this->assertTrue($commerce->core_enabled, 'Commerce Prep itself is on for them');
        $this->assertTrue($ece->branch_pending, 'an ECE student at a pilot college is still asked what to lead with');

        $optedIn = $this->student('B.Com', ['college_id' => $college->id, 'coding_opt_in' => true]);
        $this->assertTrue($optedIn->branch_pending, 'once they choose to code there is a choice to make');
    }

    public function test_the_home_shelf_offers_the_domain_prep_card_only_once_it_exists_for_the_student(): void
    {
        $college = $this->college();
        $student = $this->student('B.Com', ['college_id' => $college->id]);
        Sanctum::actingAs($student);

        $kinds = fn () => array_column($this->getJson('/api/me/practice-shelf')->assertOk()->json('cards'), 'kind');

        $before = $kinds();
        $this->assertNotContains('domain', $before, 'a card that leads to "not open yet" is worse than no card');
        $this->assertNotContains('drills', $before, 'Skill Drills are built around an engineering programme');
        $this->assertContains('interview', $before);

        DisciplinePilot::create(['discipline_code' => 'bcom', 'college_id' => $college->id]);
        app(BranchCatalog::class)->flush();

        $after = $this->getJson('/api/me/practice-shelf')->assertOk()->json('cards');
        $this->assertContains('domain', array_column($after, 'kind'));
        $this->assertSame('Commerce Prep', collect($after)->firstWhere('kind', 'domain')['label']);
    }

    public function test_a_pilot_for_one_discipline_does_not_open_another(): void
    {
        $college = $this->college();
        DisciplinePilot::create(['discipline_code' => 'bcom', 'college_id' => $college->id]);
        app(BranchCatalog::class)->flush();

        $this->assertTrue(app(CoreAccess::class)->available($this->student('B.Com', ['college_id' => $college->id])));
        $this->assertFalse(app(CoreAccess::class)->available($this->student('MBA', ['college_id' => $college->id])));
        $this->assertFalse(app(CoreAccess::class)->available($this->student('English', ['college_id' => $college->id])));
        $this->assertFalse(app(CoreAccess::class)->available($this->student('CSE', ['college_id' => $college->id])), 'CSE has no Domain Prep, as before');
    }

    public function test_the_prep_is_called_what_the_department_calls_it(): void
    {
        $college = $this->college();
        DisciplinePilot::create(['discipline_code' => 'bcom', 'college_id' => $college->id]);
        DisciplinePilot::create(['discipline_code' => 'mba', 'college_id' => $college->id]);
        DisciplinePilot::create(['discipline_code' => 'economics', 'college_id' => $college->id]);
        app(BranchCatalog::class)->flush();

        $label = function (string $branch) use ($college): ?string {
            Sanctum::actingAs($this->student($branch, ['college_id' => $college->id]));
            return $this->getJson('/api/core')->assertOk()->json('department.domain_prep_label');
        };

        $this->assertSame('Commerce Prep', $label('B.Com'));
        $this->assertSame('Management Prep', $label('MBA'));
        $this->assertSame('Subject Prep', $label('Economics'));
    }

    // ─────────────────────────────── practice interviews ───────────────────────────────

    public function test_every_new_discipline_has_interview_roles_a_template_and_starter_questions(): void
    {
        foreach ([...array_unique(array_column($this->newBranches(), 'discipline')), 'other'] as $discipline) {
            $this->assertNotEmpty(config("practice_interviews.groups.{$discipline}.roles"), "{$discipline} has role cards");
            $this->assertGreaterThan(0, InterviewRoleTemplate::where('discipline', $discipline)->count(), "{$discipline} has a role template");
            $this->assertGreaterThanOrEqual(3, InterviewQuestionBank::where('discipline', $discipline)->where('category', 'technical')->count(), "{$discipline} has starter interview questions");
        }

        foreach (InterviewRoleTemplate::whereNotNull('discipline')->whereIn('discipline', [...array_unique(array_column($this->newBranches(), 'discipline')), 'other'])->get() as $template) {
            $this->assertCount(3, $template->rounds_config, "{$template->name} has three rounds");
        }
    }

    public function test_a_commerce_student_is_offered_commerce_interview_roles_and_no_it_roles(): void
    {
        Sanctum::actingAs($this->student('B.Com'));

        $res = $this->getJson('/api/me/practice-interviews/options')->assertOk();

        $this->assertSame(['bcom'], array_column($res->json('groups'), 'key'));
        $this->assertTrue($res->json('groups.0.is_your_branch'));
        $roles = collect($res->json('groups.0.roles'));
        $this->assertContains('bcom_accounts', $roles->pluck('key')->all());
        $this->assertGreaterThan(0, $roles->firstWhere('key', 'bcom_accounts')['questions_available']);
    }

    public function test_a_commerce_student_who_opts_in_to_coding_also_sees_the_it_roles(): void
    {
        Sanctum::actingAs($this->student('B.Com', ['coding_opt_in' => true]));

        $this->assertSame(['bcom', 'software'], array_column($this->getJson('/api/me/practice-interviews/options')->json('groups'), 'key'));
    }

    public function test_an_arts_student_builds_an_interview_from_their_own_fields_questions(): void
    {
        Sanctum::actingAs($this->student('Economics'));

        $res = $this->postJson('/api/me/practice-interviews', ['role' => 'eco_fundamentals', 'kind' => 'technical', 'count' => 5, 'difficulty' => 'mixed'])->assertCreated();

        $interview = Interview::where('slug', $res->json('interview.slug'))->firstOrFail();
        $this->assertSame('economics', $interview->discipline);

        $questions = $interview->interviewQuestions()->with('questionBank')->get()->pluck('questionBank');
        $this->assertGreaterThanOrEqual(3, $questions->count());
        $this->assertSame(['economics'], $questions->pluck('discipline')->unique()->values()->all(), 'no software or other-field question leaks in');
    }

    public function test_another_departments_role_cannot_be_used(): void
    {
        Sanctum::actingAs($this->student('B.Com'));

        $this->postJson('/api/me/practice-interviews', ['role' => 'mba_finance', 'kind' => 'technical', 'count' => 5, 'difficulty' => 'mixed'])
            ->assertStatus(422)->assertJsonValidationErrors('role');
        $this->postJson('/api/me/practice-interviews', ['role' => 'sw_fresher', 'kind' => 'technical', 'count' => 5, 'difficulty' => 'mixed'])
            ->assertStatus(422)->assertJsonValidationErrors('role');
    }

    // ─────────────────────────────── readiness and the cohort ───────────────────────────────

    public function test_a_programme_without_coding_is_scored_by_the_general_profile(): void
    {
        $service = app(ReadinessScoreService::class);

        $commerce = $service->breakdown($this->student('B.Com'));
        $this->assertSame('general', $commerce['profile']);
        $this->assertEqualsCanonicalizing(['interview_performance', 'learning_centre', 'soft_skills', 'participation', 'consistency'], array_column($commerce['components'], 'key'));
        $this->assertSame(100, array_sum(config('readiness.profiles.general')));

        // Engineering is untouched: software for CSE, and a commerce student who opts in to coding is scored like a coder.
        $this->assertSame('software', $service->breakdown($this->student('CSE'))['profile']);
        $this->assertSame('software', $service->breakdown($this->student('B.Com', ['coding_opt_in' => true]))['profile']);
    }

    public function test_a_commerce_student_who_practised_is_not_read_as_never_started(): void
    {
        $college = $this->college();
        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
        $practised = $this->student('B.Com', ['college_id' => $college->id]);
        $idle = $this->student('B.Com', ['college_id' => $college->id]);
        $coder = $this->student('CSE', ['college_id' => $college->id]);

        $interview = Interview::create(['title' => 'Mock', 'slug' => Interview::uniqueSlug('Mock'), 'status' => Interview::STATUS_PUBLISHED, 'interview_type' => Interview::INTERVIEW_TYPE_GENERAL, 'is_mock' => true]);
        InterviewSession::create([
            'interview_id' => $interview->id, 'user_id' => $practised->id, 'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => now()->subDays(2), 'completed_at' => now()->subDays(2), 'composite_score_percent' => 70, 'ai_scored_at' => now(),
        ]);
        InterviewSession::create([
            'interview_id' => $interview->id, 'user_id' => $coder->id, 'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => now()->subDays(2), 'completed_at' => now()->subDays(2), 'composite_score_percent' => 70, 'ai_scored_at' => now(),
        ]);

        Sanctum::actingAs($tpo);
        $rows = collect($this->getJson('/api/tpo/students/cohort')->assertOk()->json('students'))->keyBy('id');

        $this->assertSame('active', $rows[$practised->id]['activity']['engagement'], 'a mock interview is practice for someone who does not code');
        $this->assertSame('not_started', $rows[$idle->id]['activity']['engagement']);
        $this->assertSame('not_started', $rows[$coder->id]['activity']['engagement'], 'for a coder, practice still means code');
    }
}
