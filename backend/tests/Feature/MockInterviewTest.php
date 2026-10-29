<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\MockInterviewQuestion;
use App\Models\Plan;
use App\Models\User;
use App\Services\Mock\MockInterviewCatalog;
use App\Services\SubscriptionService;
use App\Services\Vault\CuratedCatalog;
use Database\Seeders\PlanSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The Mock AI Interview: practise by domain -> tech stack -> round. Same domains and stacks as the Vault AI Interview, its own
 * questions (empty until staff add them), no qualification - and the student's own "build a practice interview" studio paused.
 */
class MockInterviewTest extends TestCase
{
    use RefreshDatabase;

    private const STACK = 'laravel';

    protected function setUp(): void
    {
        parent::setUp();

        Queue::fake();
        Mail::fake();
        $this->seed(PlanSeeder::class);
    }

    private function student(bool $expert = true): User
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'CSE']);

        if ($expert) {
            app(SubscriptionService::class)->grantIndividualPlan($student, Plan::where('code', Plan::CODE_EXPERT)->firstOrFail(), User::factory()->create(['role' => User::ROLE_SUPERADMIN]), [
                'days' => 365, 'kind' => 'complimentary', 'reason' => 'Test',
            ]);
        }

        return $student->fresh();
    }

    private function staff(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_INTERVIEWS]]);
    }

    /** @return list<MockInterviewQuestion> */
    private function fill(string $stack, int $round, int $count, int $from = 1): array
    {
        $made = [];

        for ($i = $from; $i < $from + $count; $i++) {
            $made[] = MockInterviewQuestion::create([
                'stack_key' => $stack, 'round_number' => $round, 'position' => $i,
                'text' => "Explain how you would approach problem number {$i} in {$stack} round {$round}.",
                'category' => 'technical', 'duration_seconds' => 180,
            ]);
        }

        // The staff tools flush the catalog after every write; a test that writes rows directly has to do the same.
        app(MockInterviewCatalog::class)->flush();

        return $made;
    }

    private function catalog(User $student): array
    {
        Sanctum::actingAs($student);

        return $this->getJson('/api/mock-interviews/catalog')->assertOk()->json();
    }

    private function stackOf(array $catalog, string $key = self::STACK): array
    {
        foreach ($catalog['roles'] as $role) {
            foreach ($role['stacks'] as $stack) {
                if ($stack['key'] === $key) {
                    return $stack;
                }
            }
        }

        $this->fail("Stack {$key} is not in the catalog.");
    }

    private function sit(User $student, Interview $interview, ?float $score): InterviewSession
    {
        return InterviewSession::create([
            'interview_id' => $interview->id, 'user_id' => $student->id, 'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => now()->subMinutes(15), 'completed_at' => now(), 'current_question_order' => 5, 'composite_score_percent' => $score,
        ]);
    }

    // ───────────────────────────── the catalog ─────────────────────────────

    public function test_it_lists_the_vault_interviews_domains_and_stacks_plus_its_own_and_every_stack_starts_coming_soon(): void
    {
        $catalog = $this->catalog($this->student());
        $vault = app(CuratedCatalog::class)->roles();

        // The Vault's domains in the Vault's order, then the domains only the Mock has (Merchant Navy - see MerchantNavyMockTest).
        $own = array_keys((array) config('mock_interviews.extra_roles'));
        $this->assertSame(array_keys($vault), array_values(array_diff(array_column($catalog['roles'], 'key'), $own)));
        $this->assertSame(0, $catalog['stats']['live_stacks']);
        $this->assertSame(0, $catalog['stats']['total_questions']);
        $this->assertGreaterThanOrEqual(40, $catalog['stats']['total_stacks']);

        $stack = $this->stackOf($catalog);
        $this->assertFalse($stack['live']);
        $this->assertCount(3, $stack['rounds']);
        $this->assertSame('mock-laravel-r1', $stack['rounds'][0]['id']);
        $this->assertStringStartsWith('Round 1: ', $stack['rounds'][0]['title']);
    }

    public function test_only_students_can_use_it(): void
    {
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));

        $this->getJson('/api/mock-interviews/catalog')->assertForbidden();
        $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertForbidden();
    }

    public function test_a_round_opens_at_five_questions_and_opens_its_stack_but_not_its_other_rounds(): void
    {
        $this->fill(self::STACK, 1, 4);
        $this->assertFalse($this->stackOf($this->catalog($this->student()))['live'], '4 questions is not enough');

        $this->fill(self::STACK, 1, 1, from: 5);
        $stack = $this->stackOf($this->catalog($this->student()));

        $this->assertTrue($stack['live']);
        $this->assertSame(1, $stack['ready_rounds']);
        $this->assertSame([true, false, false], array_column($stack['rounds'], 'ready'));
        $this->assertSame(5, $stack['rounds'][0]['question_count']);
    }

    public function test_the_mock_bank_and_the_vault_bank_are_independent(): void
    {
        $this->fill(self::STACK, 1, 9);
        $this->fill(self::STACK, 2, 9);
        $this->fill(self::STACK, 3, 9);

        // The Vault interview of the same stack has its own questions and its own openness - untouched.
        $vaultBefore = app(CuratedCatalog::class)->isLive('data_analytics');
        $this->assertSame($vaultBefore, app(CuratedCatalog::class)->isLive('data_analytics'));
        $this->assertFalse(app(CuratedCatalog::class)->isLive('data_analytics'));
        $this->assertTrue($this->stackOf($this->catalog($this->student()))['live']);
    }

    // ───────────────────────────── starting a round ─────────────────────────────

    public function test_a_round_that_is_not_ready_or_not_real_cannot_be_started(): void
    {
        $this->fill(self::STACK, 1, 3);
        Sanctum::actingAs($this->student());

        $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertStatus(409);
        $this->postJson('/api/mock-interviews/rounds/mock-laravel-r2/start')->assertStatus(409);
        $this->postJson('/api/mock-interviews/rounds/mock-cobol-r1/start')->assertNotFound();
        $this->postJson('/api/mock-interviews/rounds/not-a-round/start')->assertNotFound();
        $this->assertSame(0, Interview::count());
    }

    public function test_starting_a_ready_round_makes_a_private_practice_interview_with_its_questions(): void
    {
        $this->fill(self::STACK, 1, 6);
        $student = $this->student();
        Sanctum::actingAs($student);

        $res = $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated();
        $interview = Interview::where('slug', $res->json('interview.slug'))->firstOrFail();

        $this->assertSame(6, $res->json('interview.question_count'));
        $this->assertSame(Interview::INTERVIEW_TYPE_PRACTICE, $interview->interview_type);
        $this->assertTrue($interview->is_mock);
        $this->assertSame($student->id, $interview->created_by);
        $this->assertSame('mock_round', $interview->practice_config['source']);
        $this->assertSame('mock-laravel-r1', $interview->practice_config['mock_round_id']);
        $this->assertArrayNotHasKey('qualification_id', $interview->practice_config, 'a mock is never a qualification');
        $this->assertStringContainsString('Round 1', $interview->title);
    }

    public function test_opening_a_round_again_resumes_the_waiting_interview_instead_of_making_another(): void
    {
        $this->fill(self::STACK, 1, 6);
        $student = $this->student();
        Sanctum::actingAs($student);

        $first = $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->json('interview.slug');
        $second = $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->json('interview.slug');

        $this->assertSame($first, $second);
        $this->assertSame(1, Interview::count());

        // Once it has been sat, the next start is a fresh sitting.
        $this->sit($student, Interview::firstOrFail(), 70);
        $third = $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->json('interview.slug');

        $this->assertNotSame($first, $third);
        $this->assertSame(2, Interview::count());
    }

    public function test_a_long_round_is_sampled_and_a_repeat_sitting_prefers_questions_not_yet_asked(): void
    {
        $this->fill(self::STACK, 1, 14);
        $student = $this->student();
        Sanctum::actingAs($student);

        $first = Interview::where('slug', $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->json('interview.slug'))->firstOrFail();
        $this->assertCount(10, $first->practice_config['mock_question_ids']);
        $this->sit($student, $first, 55);

        $second = Interview::where('slug', $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->json('interview.slug'))->firstOrFail();
        $ids = $second->practice_config['mock_question_ids'];
        $unseen = MockInterviewQuestion::whereNotIn('id', $first->practice_config['mock_question_ids'])->pluck('id')->all();

        $this->assertCount(10, $ids);
        $this->assertCount(4, $unseen);
        $this->assertSame([], array_values(array_diff($unseen, $ids)), 'every question not asked last time is asked this time');
    }

    public function test_what_the_student_has_done_shows_on_the_round(): void
    {
        $this->fill(self::STACK, 1, 6);
        $student = $this->student();
        Sanctum::actingAs($student);

        $slug = $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->json('interview.slug');

        $round = $this->stackOf($this->catalog($student))['rounds'][0];
        $this->assertSame($slug, $round['my']['open_slug']);
        $this->assertSame('ready', $round['my']['open_status']);
        $this->assertSame(0, $round['my']['attempts']);

        $this->sit($student, Interview::firstOrFail(), 72.4);
        $other = Interview::create([
            'title' => 'Earlier sitting', 'slug' => 'earlier-sitting-x1', 'status' => Interview::STATUS_PUBLISHED, 'interview_type' => Interview::INTERVIEW_TYPE_PRACTICE,
            'is_mock' => true, 'created_by' => $student->id, 'audience_scope' => Interview::AUDIENCE_SCOPE_ALL, 'discipline' => 'software',
            'practice_config' => ['source' => 'mock_round', 'mock_round_id' => 'mock-laravel-r1'],
        ]);
        $this->sit($student, $other, 88);

        $round = $this->stackOf($this->catalog($student))['rounds'][0];
        $this->assertSame(2, $round['my']['attempts']);
        $this->assertSame(88, $round['my']['best_score']);
        $this->assertNull($round['my']['open_slug']);
    }

    public function test_the_free_plans_one_try_is_respected_but_resuming_costs_nothing(): void
    {
        $this->fill(self::STACK, 1, 6);
        $free = $this->student(expert: false);
        Sanctum::actingAs($free);

        $first = $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->json('interview.slug');
        // Resuming the same round is free.
        $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertCreated()->assertJsonPath('interview.slug', $first);

        // The trial is used by SITTING one (the existing rule): once used, a NEW sitting is refused with the plan message.
        $interview = Interview::firstOrFail();
        InterviewSession::create(['interview_id' => $interview->id, 'user_id' => $free->id, 'status' => InterviewSession::STATUS_COMPLETED, 'started_at' => now(), 'completed_at' => now(), 'current_question_order' => 5, 'composite_score_percent' => 50]);

        $this->postJson('/api/mock-interviews/rounds/mock-laravel-r1/start')->assertStatus(402);
    }

    // ───────────────────────────── the paused studio ─────────────────────────────

    public function test_the_build_your_own_studio_is_paused_for_students_by_default(): void
    {
        config(['practice_interviews.student_builder_enabled' => false]);
        Sanctum::actingAs($this->student());

        $this->getJson('/api/me/practice-interviews/options')->assertForbidden()->assertJsonPath('code', 'practice_builder_paused');
        $this->postJson('/api/me/practice-interviews', ['role' => 'x', 'kind' => 'technical', 'count' => 5, 'difficulty' => 'mixed'])
            ->assertForbidden()->assertJsonPath('code', 'practice_builder_paused');
        $this->assertSame(0, Interview::count());
    }

    public function test_the_studio_comes_back_with_one_switch(): void
    {
        config(['practice_interviews.student_builder_enabled' => true]);
        Sanctum::actingAs($this->student());

        $this->getJson('/api/me/practice-interviews/options')->assertOk();
    }

    // ───────────────────────────── staff: the question bank ─────────────────────────────

    public function test_only_staff_with_the_interviews_permission_can_manage_the_bank(): void
    {
        foreach ([$this->student(), User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_VAULT]])] as $who) {
            Sanctum::actingAs($who);
            $this->getJson('/api/admin/mock-interview-bank/coverage')->assertForbidden();
        }

        Sanctum::actingAs($this->staff());
        $this->getJson('/api/admin/mock-interview-bank/coverage')->assertOk();

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));
        $this->getJson('/api/admin/mock-interview-bank/coverage')->assertOk();
    }

    public function test_staff_add_edit_and_remove_questions_and_the_round_opens_and_closes_with_them(): void
    {
        Sanctum::actingAs($this->staff());
        $url = '/api/admin/mock-interview-bank/rounds/mock-laravel-r2/questions';

        for ($i = 1; $i <= 5; $i++) {
            $this->postJson($url, ['text' => "How does Laravel's service container resolve dependency number {$i}?", 'category' => 'technical', 'duration_seconds' => 120, 'note' => 'Looks for: binding, autowiring.'])->assertCreated();
        }

        $detail = $this->getJson('/api/admin/mock-interview-bank/stacks/laravel')->assertOk()->json('stack');
        $this->assertTrue($detail['live']);
        $this->assertSame([false, true, false], array_column($detail['rounds'], 'ready'));
        $this->assertSame(120, $detail['rounds'][1]['questions'][0]['duration_seconds']);

        $id = $detail['rounds'][1]['questions'][0]['id'];
        $this->putJson("/api/admin/mock-interview-bank/questions/{$id}", ['text' => 'Describe what the Laravel service container does and why it matters.'])->assertOk();
        $this->assertSame('Describe what the Laravel service container does and why it matters.', MockInterviewQuestion::findOrFail($id)->text);

        $this->deleteJson("/api/admin/mock-interview-bank/questions/{$id}")->assertOk();
        $this->assertFalse($this->getJson('/api/admin/mock-interview-bank/stacks/laravel')->json('stack.live'), 'back to 4 questions: closed again');
        $this->assertDatabaseHas('activity_logs', ['action' => 'Added a Mock AI Interview question']);
    }

    public function test_a_duplicate_a_short_question_and_an_unknown_round_are_refused(): void
    {
        Sanctum::actingAs($this->staff());
        $url = '/api/admin/mock-interview-bank/rounds/mock-laravel-r1/questions';
        $text = 'Explain how middleware works in a Laravel request lifecycle.';

        $this->postJson($url, ['text' => $text])->assertCreated();
        $this->postJson($url, ['text' => '  '.strtoupper($text).' '])->assertStatus(422)->assertJsonValidationErrors('text');
        $this->postJson($url, ['text' => 'Too short?'])->assertStatus(422);
        $this->postJson('/api/admin/mock-interview-bank/rounds/mock-laravel-r9/questions', ['text' => $text])->assertNotFound();
        $this->postJson('/api/admin/mock-interview-bank/rounds/mock-cobol-r1/questions', ['text' => $text])->assertNotFound();
    }

    public function test_a_spreadsheet_import_adds_the_good_rows_reports_the_bad_ones_and_skips_duplicates(): void
    {
        Sanctum::actingAs($this->staff());

        $rows = ['stack,round,question,category,seconds,note'];
        for ($i = 1; $i <= 5; $i++) {
            $rows[] = "laravel,1,\"Tell me how you would structure the number {$i} feature of a Laravel API?\",technical,150,\"Looks for: resources, validation.\"";
        }
        $rows[] = 'laravel,1,"Tell me how you would structure the number 1 feature of a Laravel API?",technical,150,';   // duplicate of row 1
        $rows[] = 'cobol,1,"A question for a stack that does not exist at all here.",technical,150,';
        $rows[] = 'laravel,7,"A question for a round that does not exist at all here.",technical,150,';
        $rows[] = 'laravel,2,"short",technical,150,';
        $rows[] = 'laravel,2,"A perfectly fine question with an unknown category value.",wizardry,150,';

        $file = UploadedFile::fake()->createWithContent('questions.csv', implode("\n", $rows));
        $res = $this->postJson('/api/admin/mock-interview-bank/import', ['file' => $file])->assertOk();

        $this->assertSame(5, $res->json('added'));
        $this->assertSame(1, $res->json('duplicates'));
        $this->assertCount(4, $res->json('errors'));
        $this->assertSame([8, 9, 10, 11], array_column($res->json('errors'), 'row'));
        $this->assertSame(['Laravel (PHP)'], $res->json('opened'));
        $this->assertSame(5, MockInterviewQuestion::where('stack_key', 'laravel')->where('round_number', 1)->count());

        // Uploading the same file again is safe: everything valid is now a duplicate.
        $again = $this->postJson('/api/admin/mock-interview-bank/import', ['file' => UploadedFile::fake()->createWithContent('questions.csv', implode("\n", $rows))])->assertOk();
        $this->assertSame(0, $again->json('added'));
        $this->assertSame(6, $again->json('duplicates'));
    }

    public function test_the_template_is_a_real_workbook_and_the_coverage_counts_each_round(): void
    {
        Sanctum::actingAs($this->staff());
        $this->fill(self::STACK, 1, 5);
        $this->fill(self::STACK, 3, 2);

        $template = $this->get('/api/admin/mock-interview-bank/template');
        $template->assertOk();
        $this->assertStringContainsString('spreadsheetml', $template->headers->get('Content-Type'));
        $this->assertStringStartsWith('PK', $template->getContent(), 'an .xlsx is a zip');

        $coverage = $this->getJson('/api/admin/mock-interview-bank/coverage')->assertOk();
        $coverage->assertJsonPath('stats.live', 1);
        $stack = collect($coverage->json('roles'))->flatMap(fn ($r) => $r['stacks'])->firstWhere('key', self::STACK);
        $this->assertSame([5, 0, 2], $stack['grid']);
        $this->assertSame(1, $stack['ready_rounds']);
        $this->assertSame(7, $stack['questions']);
    }

    public function test_round_ids_round_trip(): void
    {
        $catalog = app(MockInterviewCatalog::class);

        $this->assertSame('mock-laravel-r2', MockInterviewCatalog::roundId('laravel', 2));
        $this->assertSame('laravel', $catalog->round('mock-laravel-r2')['stack']['key']);
        $this->assertSame(2, $catalog->round('mock-laravel-r2')['round']['round_number']);
        $this->assertNull($catalog->round('mock-laravel-r4'), 'only three rounds');
    }
}
