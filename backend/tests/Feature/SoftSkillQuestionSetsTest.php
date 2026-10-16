<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Company;
use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillAssessmentSet;
use App\Models\SoftSkillQuestion;
use App\Models\SoftSkillSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The AptRun Soft Skills question-set library, from both ends:
 *   students  — browse the numbered sets (paged / show all / search / filter) and the tests scheduled for them;
 *   schedulers (Mellow Ops, a college TPO, a hiring partner) — pick a set when creating a test, publish it, and be
 *   told on the next one which sets they have already used. Usage is private to the owner: the tenancy tests below
 *   are the point of the feature as much as the paging is.
 */
class SoftSkillQuestionSetsTest extends TestCase
{
    use RefreshDatabase;

    private int $questionCounter = 0;

    // ───────────────────────────── fixtures ─────────────────────────────

    /** A published library set with $questions questions (cycling through the four categories). */
    private function set(int $number, int $questions = 4, string $status = SoftSkillAssessment::STATUS_PUBLISHED): SoftSkillAssessment
    {
        $set = SoftSkillAssessment::create([
            'title' => "Soft Skill Assessment - Set {$number}",
            'slug' => "soft-skill-assessment-set-{$number}",
            'description' => "Practice paper number {$number}.",
            'status' => $status,
            'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
            'is_question_set' => true,
            'question_set_number' => $number,
            'duration_minutes' => 45,
            'pass_percentage' => 60,
        ]);

        foreach (range(0, $questions - 1) as $i) {
            $this->attachNewQuestion($set, $i);
        }

        return $set;
    }

    private function attachNewQuestion(SoftSkillAssessment $assessment, int $order): SoftSkillQuestion
    {
        $question = SoftSkillQuestion::create([
            'category' => SoftSkillQuestion::CATEGORIES[$order % 4],
            'question_text' => 'Question '.++$this->questionCounter,
            'options' => ['a', 'b', 'c', 'd'],
            'correct_index' => 0,
        ]);

        SoftSkillAssessmentQuestion::create(['soft_skill_assessment_id' => $assessment->id, 'soft_skill_question_id' => $question->id, 'display_order' => $order]);

        return $question;
    }

    private function college(string $code): College
    {
        return College::create(['name' => "College {$code}", 'short_code' => $code]);
    }

    private function tpo(College $college): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]);
    }

    private function companyAdmin(?Company $company = null): User
    {
        $company ??= Company::create(['name' => 'Acme '.uniqid(), 'slug' => 'acme-'.uniqid()]);

        return User::factory()->create(['role' => User::ROLE_ADMIN_COMPANY, 'company_id' => $company->id]);
    }

    private function mellowStaff(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_SOFT_SKILLS]]);
    }

    private function student(?College $college = null): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $college?->id]);
    }

    /** @return array<string, array{0: string, 1: string}> role => [api prefix, who] */
    public static function schedulers(): array
    {
        return ['TPO' => ['/api/tpo', 'tpo'], 'hiring partner' => ['/api/company', 'company'], 'Mellow Ops' => ['/api/admin', 'staff']];
    }

    private function actAs(string $who): User
    {
        $user = match ($who) {
            'tpo' => $this->tpo($this->college('SCH'.uniqid())),
            'company' => $this->companyAdmin(),
            default => $this->mellowStaff(),
        };
        Sanctum::actingAs($user);

        return $user;
    }

    // ───────────────────────────── students: the library page ─────────────────────────────

    public function test_the_original_unpaged_list_still_works_and_now_says_which_assessments_are_sets(): void
    {
        $this->set(1);
        SoftSkillAssessment::create(['title' => 'Mellow test', 'slug' => 'mellow-test', 'status' => 'published', 'assessment_type' => 'general']);
        Sanctum::actingAs($this->student());

        $response = $this->getJson('/api/soft-skills')->assertOk()->assertJsonCount(2, 'assessments');

        $this->assertEqualsCanonicalizing([true, false], array_column($response->json('assessments'), 'is_question_set'));
        $this->assertArrayNotHasKey('meta', $response->json());
    }

    public function test_the_library_is_paged_twenty_to_a_page_in_set_order_and_show_all_returns_everything(): void
    {
        foreach (range(45, 1) as $n) {   // created out of order on purpose
            $this->set($n, 1);
        }
        Sanctum::actingAs($this->student());

        $first = $this->getJson('/api/soft-skills?scope=sets')->assertOk();
        $this->assertSame(['total' => 45, 'page' => 1, 'per_page' => 20, 'last_page' => 3, 'from' => 1, 'to' => 20, 'all' => false], $first->json('meta'));
        $this->assertSame(range(1, 20), array_column($first->json('assessments'), 'set_number'));

        $second = $this->getJson('/api/soft-skills?scope=sets&page=2&per_page=20')->assertOk();
        $this->assertSame(range(21, 40), array_column($second->json('assessments'), 'set_number'));

        $last = $this->getJson('/api/soft-skills?scope=sets&page=3')->assertOk();
        $this->assertSame(range(41, 45), array_column($last->json('assessments'), 'set_number'));
        $this->assertSame(['from' => 41, 'to' => 45], ['from' => $last->json('meta.from'), 'to' => $last->json('meta.to')]);

        $all = $this->getJson('/api/soft-skills?scope=sets&per_page=all')->assertOk();
        $this->assertCount(45, $all->json('assessments'));
        $this->assertTrue($all->json('meta.all'));
        $this->assertSame(1, $all->json('meta.last_page'));

        // A page past the end clamps to the last one rather than returning nothing.
        $this->assertSame(3, $this->getJson('/api/soft-skills?scope=sets&page=99')->json('meta.page'));
        // Junk falls back to sensible defaults or is refused, never an unbounded query.
        $this->getJson('/api/soft-skills?scope=sets&per_page=banana')->assertStatus(422);
        $this->getJson('/api/soft-skills?scope=everything')->assertStatus(422);
        $this->assertSame(100, $this->getJson('/api/soft-skills?scope=sets&per_page=100')->json('meta.per_page'));
    }

    public function test_search_finds_a_set_by_number_or_by_words(): void
    {
        foreach ([1, 12, 21, 112] as $n) {
            $this->set($n, 1);
        }
        Sanctum::actingAs($this->student());

        // "12" is Set 12 by number, and also matches "Set 112" by its title.
        $this->assertEqualsCanonicalizing([12, 112], array_column($this->getJson('/api/soft-skills?scope=sets&q=12')->json('assessments'), 'set_number'));
        $this->assertContains(12, array_column($this->getJson('/api/soft-skills?scope=sets&q=set%2012')->json('assessments'), 'set_number'));
        $this->assertCount(4, $this->getJson('/api/soft-skills?scope=sets&q=practice')->json('assessments'), 'the description matches too');
        $this->assertCount(0, $this->getJson('/api/soft-skills?scope=sets&q=zzz')->json('assessments'));
        $this->assertSame(0, $this->getJson('/api/soft-skills?scope=sets&q=zzz')->json('meta.total'));
        $this->assertCount(0, $this->getJson('/api/soft-skills?scope=sets&q=%25')->json('assessments'), 'a % is a character, not a wildcard');
    }

    public function test_status_filters_and_counts_are_about_this_student_only(): void
    {
        $done = $this->set(1);
        $going = $this->set(2);
        $this->set(3);
        $me = $this->student();
        $other = $this->student();
        $session = fn (User $u, SoftSkillAssessment $a, string $status) => SoftSkillSession::create([
            'soft_skill_assessment_id' => $a->id, 'user_id' => $u->id, 'status' => $status, 'started_at' => now(),
            'completed_at' => $status === 'completed' ? now() : null, 'score_percent' => 80, 'passed' => true,
        ]);
        $session($me, $done, 'completed');
        $session($me, $going, 'in_progress');
        $session($other, $this->set(4), 'completed');   // somebody else's progress must not leak in
        Sanctum::actingAs($me);

        $numbers = fn (string $status) => array_column($this->getJson("/api/soft-skills?scope=sets&status={$status}")->json('assessments'), 'set_number');

        $this->assertSame([1], $numbers('completed'));
        $this->assertSame([2], $numbers('in_progress'));
        $this->assertSame([3, 4], $numbers('not_attempted'));
        $this->assertSame([1, 2, 3, 4], $numbers('all'));

        $counts = $this->getJson('/api/soft-skills?scope=sets')->json('counts');
        $this->assertSame(['sets' => 4, 'sets_completed' => 1, 'sets_in_progress' => 1, 'assigned' => 0], $counts);

        $first = $this->getJson('/api/soft-skills?scope=sets')->json('assessments.0');
        $this->assertSame(80.0, (float) $first['best_score_percent']);
        $this->assertSame(1, $first['attempts_taken']);
        $this->assertTrue($this->getJson('/api/soft-skills?scope=sets')->json('assessments.1.in_progress'));
    }

    public function test_assigned_tests_are_the_ones_scheduled_for_the_student_and_never_the_library(): void
    {
        $mine = $this->college('MINE');
        $theirs = $this->college('THEIRS');
        $this->set(1);
        $make = fn (string $title, College $c) => SoftSkillAssessment::create([
            'title' => $title, 'slug' => SoftSkillAssessment::uniqueSlug($title), 'status' => 'published',
            'assessment_type' => 'tpo_mock', 'owning_college_id' => $c->id,
        ]);
        $make('Campus Round 1', $mine);
        $make('Other College Round', $theirs);
        SoftSkillAssessment::create(['title' => 'Draft one', 'slug' => 'draft-one', 'status' => 'draft', 'assessment_type' => 'tpo_mock', 'owning_college_id' => $mine->id]);
        Sanctum::actingAs($this->student($mine));

        $assigned = $this->getJson('/api/soft-skills?scope=assigned')->assertOk();
        $this->assertSame(['Campus Round 1'], array_column($assigned->json('assessments'), 'title'));
        $this->assertSame(1, $assigned->json('counts.assigned'));
        $this->assertSame(1, $assigned->json('meta.total'));

        $sets = $this->getJson('/api/soft-skills?scope=sets');
        $this->assertSame([1], array_column($sets->json('assessments'), 'set_number'), 'a college test never appears among the AptRun sets');

        $this->assertCount(0, $this->getJson('/api/soft-skills?scope=assigned&q=nothing')->json('assessments'));
        $this->assertCount(1, $this->getJson('/api/soft-skills?scope=assigned&q=round')->json('assessments'));
        $this->assertCount(0, $this->getJson('/api/soft-skills?scope=assigned&status=completed')->json('assessments'));
    }

    public function test_a_set_that_is_not_published_is_not_offered_to_students(): void
    {
        $this->set(1);
        $this->set(2, 3, SoftSkillAssessment::STATUS_DRAFT);
        Sanctum::actingAs($this->student());

        $this->assertSame([1], array_column($this->getJson('/api/soft-skills?scope=sets')->json('assessments'), 'set_number'));
    }

    // ───────────────────────────── schedulers: the library with usage ─────────────────────────────

    #[\PHPUnit\Framework\Attributes\DataProvider('schedulers')]
    public function test_every_scheduler_sees_the_published_library_paged_and_searchable(string $prefix, string $who): void
    {
        foreach (range(1, 25) as $n) {
            $this->set($n, 2);
        }
        $this->set(99, 2, SoftSkillAssessment::STATUS_DRAFT);
        $this->actAs($who);

        $page = $this->getJson("{$prefix}/soft-skill-question-sets")->assertOk();
        $this->assertCount(20, $page->json('sets'));
        $this->assertSame(25, $page->json('meta.total'));
        $this->assertSame(['all' => 25, 'used' => 0, 'unused' => 25], $page->json('counts'));
        $this->assertSame('unused', $page->json('sets.0.usage.state'));
        $this->assertSame('Set 1', $page->json('sets.0.label'));
        $this->assertSame(2, $page->json('sets.0.question_count'));

        $this->assertCount(25, $this->getJson("{$prefix}/soft-skill-question-sets?per_page=all")->json('sets'));
        $this->assertSame([7], array_column($this->getJson("{$prefix}/soft-skill-question-sets?q=set%207")->json('sets'), 'set_number'));
        $this->getJson("{$prefix}/soft-skill-question-sets?usage=nonsense")->assertStatus(422);
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('schedulers')]
    public function test_creating_a_test_from_a_set_publishes_it_and_marks_the_set_used(string $prefix, string $who): void
    {
        $set = $this->set(7, 5);
        $this->set(8, 5);
        $this->actAs($who);

        $created = $this->postJson("{$prefix}/soft-skills", [
            'title' => 'Round 1 aptitude', 'duration_minutes' => 30, 'pass_percentage' => 50,
            'question_set_id' => $set->id, 'publish' => true,
        ])->assertCreated();

        $this->assertSame('published', $created->json('assessment.status'));
        $this->assertSame(5, $created->json('assessment.assessment_questions_count'));
        $this->assertSame('Soft Skill Assessment - Set 7', $created->json('assessment.applied_sets.0.set_title'));
        $this->assertSame(7, $created->json('assessment.applied_sets.0.set_number'));

        // Next time they schedule something, Set 7 says it has been used — and says where.
        $library = $this->getJson("{$prefix}/soft-skill-question-sets")->assertOk();
        $seven = collect($library->json('sets'))->firstWhere('set_number', 7);
        $this->assertSame('published', $seven['usage']['state']);
        $this->assertSame(1, $seven['usage']['count']);
        $this->assertSame('Round 1 aptitude', $seven['usage']['tests'][0]['title']);
        $this->assertSame('published', $seven['usage']['tests'][0]['status']);
        $this->assertNotNull($seven['usage']['tests'][0]['added_at']);
        $this->assertSame('unused', collect($library->json('sets'))->firstWhere('set_number', 8)['usage']['state']);
        $this->assertSame(['all' => 2, 'used' => 1, 'unused' => 1], $library->json('counts'));

        $this->assertSame([7], array_column($this->getJson("{$prefix}/soft-skill-question-sets?usage=used")->json('sets'), 'set_number'));
        $this->assertSame([8], array_column($this->getJson("{$prefix}/soft-skill-question-sets?usage=unused")->json('sets'), 'set_number'));
    }

    public function test_a_test_created_without_publishing_leaves_the_set_marked_as_a_draft_use_and_publishing_it_later_flips_it(): void
    {
        $set = $this->set(3, 4);
        Sanctum::actingAs($this->tpo($this->college('DRF')));

        $slug = $this->postJson('/api/tpo/soft-skills', ['title' => 'Draft test', 'question_set_id' => $set->id])
            ->assertCreated()->assertJsonPath('assessment.status', 'draft')->json('assessment.slug');

        $this->assertSame('draft', $this->getJson('/api/tpo/soft-skill-question-sets')->json('sets.0.usage.state'));

        $this->postJson("/api/tpo/soft-skills/{$slug}", ['status' => 'published'])->assertOk();
        $this->assertSame('published', $this->getJson('/api/tpo/soft-skill-question-sets')->json('sets.0.usage.state'));

        $this->postJson("/api/tpo/soft-skills/{$slug}", ['status' => 'cancelled'])->assertOk();
        $state = $this->getJson('/api/tpo/soft-skill-question-sets');
        $this->assertSame('cancelled', $state->json('sets.0.usage.state'));
        $this->assertSame(1, $state->json('counts.used'), 'a cancelled test still counts as "used before"');
    }

    public function test_usage_is_private_to_the_owner_one_colleges_use_is_invisible_to_everyone_else(): void
    {
        $set = $this->set(5, 3);
        $collegeA = $this->college('AAA');
        $collegeB = $this->college('BBB');
        $tpoA = $this->tpo($collegeA);
        $tpoB = $this->tpo($collegeB);
        $company = $this->companyAdmin();
        $staff = $this->mellowStaff();

        Sanctum::actingAs($tpoA);
        $this->postJson('/api/tpo/soft-skills', ['title' => 'A secret round', 'question_set_id' => $set->id, 'publish' => true])->assertCreated();

        $stateFor = function (User $user, string $prefix) {
            Sanctum::actingAs($user);

            return $this->getJson("{$prefix}/soft-skill-question-sets")->json('sets.0.usage');
        };

        $this->assertSame('published', $stateFor($tpoA, '/api/tpo')['state']);
        foreach ([[$tpoB, '/api/tpo'], [$company, '/api/company'], [$staff, '/api/admin']] as [$user, $prefix]) {
            $usage = $stateFor($user, $prefix);
            $this->assertSame('unused', $usage['state'], "{$prefix} must not learn that college A used Set 5");
            $this->assertSame(0, $usage['count']);
            $this->assertStringNotContainsString('secret', json_encode($usage));
        }

        // …and the other way round: the hiring partner's use is not the college's business either.
        Sanctum::actingAs($company);
        $this->postJson('/api/company/soft-skills', ['title' => 'Partner screening', 'question_set_id' => $set->id, 'publish' => true])->assertCreated();
        $this->assertSame('published', $stateFor($company, '/api/company')['state']);
        $this->assertSame(1, $stateFor($tpoA, '/api/tpo')['count']);
        $this->assertSame('unused', $stateFor($staff, '/api/admin')['state']);
    }

    public function test_mellow_ops_history_is_its_own_hand_built_tests_and_does_not_count_the_set_itself(): void
    {
        $set = $this->set(2, 3);
        Sanctum::actingAs($this->mellowStaff());

        $this->assertSame('unused', $this->getJson('/api/admin/soft-skill-question-sets')->json('sets.0.usage.state'), 'the set being published to students is not "used"');

        $this->postJson('/api/admin/soft-skills', ['title' => 'Mellow drive round', 'question_set_id' => $set->id, 'publish' => true])->assertCreated();
        $this->assertSame('published', $this->getJson('/api/admin/soft-skill-question-sets')->json('sets.0.usage.state'));
    }

    // ───────────────────────────── attaching, refusing, atomicity ─────────────────────────────

    public function test_a_set_can_be_added_to_an_existing_draft_and_more_than_one_set_can_be_combined(): void
    {
        $one = $this->set(1, 3);
        $two = $this->set(2, 2);
        Sanctum::actingAs($this->tpo($this->college('MIX')));
        $slug = $this->postJson('/api/tpo/soft-skills', ['title' => 'Combined'])->assertCreated()->json('assessment.slug');

        $this->postJson("/api/tpo/soft-skills/{$slug}/question-sets", ['question_set_id' => $one->id])
            ->assertCreated()->assertJsonPath('added', 3)->assertJsonPath('skipped', 0)->assertJsonPath('total_questions', 3);
        $this->postJson("/api/tpo/soft-skills/{$slug}/question-sets", ['question_set_id' => $two->id])
            ->assertCreated()->assertJsonPath('total_questions', 5)->assertJsonCount(2, 'applied_sets');

        $orders = SoftSkillAssessment::where('slug', $slug)->first()->assessmentQuestions()->orderBy('display_order')->pluck('display_order')->all();
        $this->assertSame([0, 1, 2, 3, 4], $orders, 'questions keep a clean, gap-free order');

        $this->postJson("/api/tpo/soft-skills/{$slug}/question-sets", ['question_set_id' => $one->id])
            ->assertStatus(422)->assertJsonValidationErrors('question_set_id');
        $this->assertSame(5, SoftSkillAssessment::where('slug', $slug)->first()->assessmentQuestions()->count(), 'a refused add changes nothing');
    }

    public function test_questions_already_in_the_test_are_skipped_not_duplicated(): void
    {
        $set = $this->set(1, 4);
        Sanctum::actingAs($this->tpo($this->college('DUP')));
        $slug = $this->postJson('/api/tpo/soft-skills', ['title' => 'Has one already'])->json('assessment.slug');
        $test = SoftSkillAssessment::where('slug', $slug)->first();
        SoftSkillAssessmentQuestion::create([
            'soft_skill_assessment_id' => $test->id,
            'soft_skill_question_id' => $set->assessmentQuestions()->first()->soft_skill_question_id,
            'display_order' => 0,
        ]);

        $this->postJson("/api/tpo/soft-skills/{$slug}/question-sets", ['question_set_id' => $set->id])
            ->assertCreated()->assertJsonPath('added', 3)->assertJsonPath('skipped', 1)->assertJsonPath('total_questions', 4);
    }

    public function test_the_questions_are_copied_so_changing_the_library_set_later_cannot_change_a_live_test(): void
    {
        $set = $this->set(1, 3);
        Sanctum::actingAs($this->tpo($this->college('CPY')));
        $this->postJson('/api/tpo/soft-skills', ['title' => 'Live', 'question_set_id' => $set->id, 'publish' => true])->assertCreated();

        $set->assessmentQuestions()->first()->delete();
        $set->update(['status' => SoftSkillAssessment::STATUS_CANCELLED]);

        $live = SoftSkillAssessment::where('title', 'Live')->first();
        $this->assertSame(3, $live->assessmentQuestions()->count());
        // The retired set is no longer offered, but the history of its use is still there.
        $this->assertCount(0, $this->getJson('/api/tpo/soft-skill-question-sets')->json('sets'));
        $this->assertSame(1, SoftSkillAssessmentSet::where('question_set_id', $set->id)->count());
    }

    public function test_a_refused_set_leaves_no_half_built_draft_behind(): void
    {
        $retired = $this->set(1, 3, SoftSkillAssessment::STATUS_CANCELLED);
        $notASet = SoftSkillAssessment::create(['title' => 'Plain test', 'slug' => 'plain-test', 'status' => 'published', 'assessment_type' => 'general']);
        Sanctum::actingAs($this->tpo($this->college('ATM')));
        $before = SoftSkillAssessment::count();

        $this->postJson('/api/tpo/soft-skills', ['title' => 'Should not exist', 'question_set_id' => $retired->id, 'publish' => true])
            ->assertStatus(422)->assertJsonValidationErrors('question_set_id');
        $this->postJson('/api/tpo/soft-skills', ['title' => 'Nor this', 'question_set_id' => $notASet->id])
            ->assertStatus(422)->assertJsonValidationErrors('question_set_id');
        $this->postJson('/api/tpo/soft-skills', ['title' => 'Nor this', 'question_set_id' => 99999])->assertStatus(422);

        $this->assertSame($before, SoftSkillAssessment::count());
    }

    public function test_publishing_needs_questions_and_a_set_to_publish_with(): void
    {
        $set = $this->set(1, 2);
        Sanctum::actingAs($this->tpo($this->college('PUB')));

        $this->postJson('/api/tpo/soft-skills', ['title' => 'No set', 'publish' => true])->assertStatus(422)->assertJsonValidationErrors('publish');

        $empty = $this->postJson('/api/tpo/soft-skills', ['title' => 'Empty'])->json('assessment.slug');
        $this->postJson("/api/tpo/soft-skills/{$empty}", ['status' => 'published'])->assertStatus(422)->assertJsonValidationErrors('status');

        $this->postJson("/api/tpo/soft-skills/{$empty}/question-sets", ['question_set_id' => $set->id])->assertCreated();
        $this->postJson("/api/tpo/soft-skills/{$empty}", ['status' => 'published'])->assertOk();
    }

    public function test_a_test_candidates_have_started_or_a_cancelled_one_cannot_take_more_questions(): void
    {
        $one = $this->set(1, 2);
        $two = $this->set(2, 2);
        $three = $this->set(3, 2);
        $college = $this->college('LCK');
        Sanctum::actingAs($this->tpo($college));
        $slug = $this->postJson('/api/tpo/soft-skills', ['title' => 'Taken', 'question_set_id' => $one->id, 'publish' => true])->json('assessment.slug');
        $test = SoftSkillAssessment::where('slug', $slug)->first();
        SoftSkillSession::create(['soft_skill_assessment_id' => $test->id, 'user_id' => $this->student($college)->id, 'status' => 'in_progress', 'started_at' => now()]);

        $this->postJson("/api/tpo/soft-skills/{$slug}/question-sets", ['question_set_id' => $two->id])
            ->assertStatus(422)->assertJsonPath('errors.question_set_id.0', 'Candidates have already taken this test, so its questions can no longer change.');

        $cancelled = $this->postJson('/api/tpo/soft-skills', ['title' => 'Cancelled'])->json('assessment.slug');
        $this->postJson("/api/tpo/soft-skills/{$cancelled}", ['status' => 'cancelled'])->assertOk();
        $this->postJson("/api/tpo/soft-skills/{$cancelled}/question-sets", ['question_set_id' => $three->id])->assertStatus(422);
    }

    public function test_nobody_can_attach_a_set_to_a_test_that_is_not_theirs(): void
    {
        $set = $this->set(1, 2);
        Sanctum::actingAs($this->tpo($this->college('OWN')));
        $slug = $this->postJson('/api/tpo/soft-skills', ['title' => 'Mine'])->json('assessment.slug');

        Sanctum::actingAs($this->tpo($this->college('OTH')));
        $this->postJson("/api/tpo/soft-skills/{$slug}/question-sets", ['question_set_id' => $set->id])->assertForbidden();

        Sanctum::actingAs($this->companyAdmin());
        $this->postJson("/api/company/soft-skills/{$slug}/question-sets", ['question_set_id' => $set->id])->assertForbidden();

        Sanctum::actingAs($this->student());
        $this->getJson('/api/tpo/soft-skill-question-sets')->assertForbidden();
        $this->postJson("/api/tpo/soft-skills/{$slug}/question-sets", ['question_set_id' => $set->id])->assertForbidden();
    }

    // ───────────────────────────── Mellow Ops: curating the library ─────────────────────────────

    public function test_mellow_can_list_a_test_it_wrote_as_the_next_numbered_set_and_students_then_see_it_in_the_library(): void
    {
        $this->set(1, 2);
        $this->set(2, 2);
        $staff = $this->mellowStaff();
        Sanctum::actingAs($staff);
        $slug = $this->postJson('/api/admin/soft-skills', ['title' => 'Hand-written paper'])->json('assessment.slug');

        $this->postJson("/api/admin/soft-skills/{$slug}", ['is_question_set' => true])
            ->assertStatus(422)->assertJsonValidationErrors('is_question_set');   // nothing to list yet

        $bank = SoftSkillQuestion::create(['category' => 'aptitude', 'question_text' => 'Hand-made', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 1]);
        $this->postJson("/api/admin/soft-skills/{$slug}/questions", ['soft_skill_question_id' => $bank->id])->assertCreated();
        $this->postJson("/api/admin/soft-skills/{$slug}", ['is_question_set' => true, 'status' => 'published'])
            ->assertOk()->assertJsonPath('assessment.question_set_number', 3)->assertJsonPath('assessment.is_question_set', true);

        Sanctum::actingAs($this->student());
        $this->assertSame([1, 2, 3], array_column($this->getJson('/api/soft-skills?scope=sets')->json('assessments'), 'set_number'));
    }

    public function test_a_set_that_tests_were_built_from_cannot_leave_the_library_but_can_be_cancelled(): void
    {
        $set = $this->set(1, 2);
        Sanctum::actingAs($this->tpo($this->college('USE')));
        $this->postJson('/api/tpo/soft-skills', ['title' => 'Uses it', 'question_set_id' => $set->id])->assertCreated();

        Sanctum::actingAs($this->mellowStaff());
        $this->postJson("/api/admin/soft-skills/{$set->slug}", ['is_question_set' => false])->assertStatus(422)->assertJsonValidationErrors('is_question_set');
        $this->postJson("/api/admin/soft-skills/{$set->slug}", ['status' => 'cancelled'])->assertOk();
    }

    public function test_the_admin_list_can_leave_the_library_out_or_show_only_it(): void
    {
        $this->set(1, 1);
        $this->set(2, 1);
        Sanctum::actingAs($this->mellowStaff());
        $this->postJson('/api/admin/soft-skills', ['title' => 'A real test'])->assertCreated();

        $this->assertCount(3, $this->getJson('/api/admin/soft-skills')->json('assessments'));
        $this->assertSame(['A real test'], array_column($this->getJson('/api/admin/soft-skills?kind=tests')->json('assessments'), 'title'));
        $this->assertSame([1, 2], array_column($this->getJson('/api/admin/soft-skills?kind=sets')->json('assessments'), 'question_set_number'));
    }

    public function test_the_usage_history_survives_the_set_being_deleted(): void
    {
        $set = $this->set(9, 2);
        Sanctum::actingAs($this->tpo($this->college('DEL')));
        $this->postJson('/api/tpo/soft-skills', ['title' => 'Built from nine', 'question_set_id' => $set->id])->assertCreated();

        $set->delete();

        $row = SoftSkillAssessmentSet::first();
        $this->assertNull($row->question_set_id);
        $this->assertSame('Set 9', $row->label());
        $this->assertSame('Soft Skill Assessment - Set 9', $row->set_title);
    }

    public function test_set_numbers_are_unique(): void
    {
        $this->set(1, 1);

        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);
        $this->set(1, 1);
    }
}
