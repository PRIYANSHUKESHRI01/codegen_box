<?php

namespace Tests\Feature;

use App\Models\CoreQuestion;
use App\Models\CoreQuestionStat;
use App\Models\CoreSubject;
use App\Models\CoreTest;
use App\Models\CoreTestSession;
use App\Models\User;
use App\Services\Core\CoreItemAnalysisService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Item analysis: from what students answered, flag the questions staff should look at — too easy, too hard, useless at
 * telling strong from weak, or probably keyed wrong — and say which option the strong students keep choosing instead.
 */
class CoreItemAnalysisTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    private CoreTest $test;

    /** @var list<array{user: User, strong: bool}> */
    private array $sittings = [];

    protected function setUp(): void
    {
        parent::setUp();

        // The migrations ship starter Domain Prep questions for the non-engineering departments; this test counts only its own.
        CoreQuestion::query()->delete();

        config(['core_prep.item_analysis.min_attempts' => 10]);
        $this->test = CoreTest::create(['slug' => 'ia-paper', 'title' => 'IA paper', 'discipline_code' => 'ece', 'status' => 'published', 'test_type' => 'general', 'duration_minutes' => 30]);

        // Ten students who each finished the paper: five strong (90%), five weak (30%).
        foreach (range(1, 10) as $i) {
            $strong = $i <= 5;
            $user = User::factory()->create(['role' => User::ROLE_USER, 'branch' => 'ECE']);
            CoreTestSession::create([
                'core_test_id' => $this->test->id, 'user_id' => $user->id, 'attempt_number' => 1, 'status' => 'completed',
                'started_at' => now()->subHour(), 'deadline_at' => now()->subMinutes(30), 'completed_at' => now()->subMinutes(35),
                'score' => $strong ? 90 : 30, 'max_score' => 100, 'score_percent' => $strong ? 90 : 30,
            ]);
            $this->sittings[] = ['user' => $user, 'strong' => $strong];
        }
    }

    private function question(string $key = 'a'): CoreQuestion
    {
        $subject = CoreSubject::where('discipline_code', 'ece')->orderBy('id')->firstOrFail();
        $n = ++$this->seq;

        return CoreQuestion::create([
            'external_id' => "IA-{$n}", 'discipline_code' => 'ece', 'subject_id' => $subject->id, 'topic_id' => $subject->topics()->first()->id, 'type' => 'mcq_single',
            'stem' => "Item {$n}?", 'options' => [['id' => 'a', 'text' => 'A'], ['id' => 'b', 'text' => 'B'], ['id' => 'c', 'text' => 'C']],
            'correct' => [$key], 'marks' => 1, 'negative_marks' => 0, 'difficulty' => 'medium', 'usage' => 'both', 'status' => 'published',
        ]);
    }

    /** @param  callable(bool): string  $choose  the option a (strong?) student picks */
    private function answered(CoreQuestion $question, callable $choose, ?int $limit = null): void
    {
        $key = $question->correct[0];
        $position = 0;

        foreach (array_slice($this->sittings, 0, $limit) as $sitting) {
            $session = CoreTestSession::where('user_id', $sitting['user']->id)->firstOrFail();
            $option = $choose($sitting['strong']);
            DB::table('core_test_responses')->insert([
                'core_test_session_id' => $session->id, 'core_question_id' => $question->id, 'position' => ++$position,
                'selected' => json_encode([$option]), 'is_correct' => $option === $key, 'marks_awarded' => $option === $key ? 1 : 0,
                'created_at' => now(), 'updated_at' => now(),
            ]);
        }
    }

    private function stat(CoreQuestion $q): ?CoreQuestionStat
    {
        return CoreQuestionStat::where('core_question_id', $q->id)->first();
    }

    public function test_a_healthy_question_is_measured_and_not_flagged(): void
    {
        $q = $this->question('a');
        $this->answered($q, fn (bool $strong) => $strong ? 'a' : 'b'); // strong right, weak wrong

        $result = app(CoreItemAnalysisService::class)->run();
        $stat = $this->stat($q);

        $this->assertSame(10, $stat->test_attempts);
        $this->assertSame(0.5, $stat->facility);
        $this->assertSame(1.0, $stat->discrimination, 'right exactly when the student did well overall');
        $this->assertFalse($stat->flagged);
        $this->assertSame(0, $result['flagged']);
    }

    public function test_a_question_the_strong_students_get_wrong_is_flagged_with_the_option_they_prefer(): void
    {
        $q = $this->question('a');
        // The key says A, but the strong students all choose B and the weak ones A: the key is probably wrong.
        $this->answered($q, fn (bool $strong) => $strong ? 'b' : 'a');

        app(CoreItemAnalysisService::class)->run();
        $stat = $this->stat($q);

        $this->assertSame(-1.0, $stat->discrimination);
        $this->assertTrue($stat->flagged);
        $this->assertEqualsCanonicalizing(['negative_discrimination', 'suspected_key'], $stat->flags);
        $this->assertSame('b', $stat->suspect_option);
    }

    public function test_questions_everyone_gets_right_or_wrong_are_called_out(): void
    {
        $easy = $this->question('a');
        $hard = $this->question('a');
        $this->answered($easy, fn () => 'a');
        $this->answered($hard, fn () => 'c');

        app(CoreItemAnalysisService::class)->run();

        $this->assertSame(['too_easy'], $this->stat($easy)->flags);
        $this->assertNull($this->stat($easy)->discrimination, 'nobody to compare against when everyone is right');
        $this->assertSame(['too_hard'], $this->stat($hard)->flags);
    }

    public function test_a_question_that_does_not_separate_strong_from_weak_is_flagged_as_low_discrimination(): void
    {
        $q = $this->question('a');
        // Two of the five strong and two of the five weak students right: no relationship with how well they did overall.
        $right = ['strong' => 0, 'weak' => 0];
        $this->answered($q, function (bool $strong) use (&$right) {
            $group = $strong ? 'strong' : 'weak';

            return ++$right[$group] <= 2 ? 'a' : 'b';
        });

        app(CoreItemAnalysisService::class)->run();

        $this->assertContains('low_discrimination', $this->stat($q)->flags);
        $this->assertNotContains('suspected_key', $this->stat($q)->flags);
    }

    public function test_nothing_is_judged_on_thin_evidence(): void
    {
        $q = $this->question('a');
        $this->answered($q, fn (bool $strong) => $strong ? 'b' : 'a', limit: 6); // 6 answers < the 10 needed

        app(CoreItemAnalysisService::class)->run();

        $this->assertFalse($this->stat($q)->flagged, 'six answers prove nothing');
        $this->assertSame(6, $this->stat($q)->test_attempts);
    }

    public function test_the_analysis_can_be_rerun_and_forgets_questions_with_no_answers_left(): void
    {
        $q = $this->question('a');
        $this->answered($q, fn () => 'a');
        app(CoreItemAnalysisService::class)->run();
        app(CoreItemAnalysisService::class)->run();
        $this->assertSame(1, CoreQuestionStat::count(), 'a re-run updates, never duplicates');

        DB::table('core_test_responses')->delete();
        app(CoreItemAnalysisService::class)->run();
        $this->assertSame(0, CoreQuestionStat::count());
    }

    public function test_staff_can_filter_the_bank_to_flagged_questions_and_see_the_numbers(): void
    {
        $bad = $this->question('a');
        $fine = $this->question('a');
        $this->answered($bad, fn (bool $strong) => $strong ? 'b' : 'a');
        $this->answered($fine, fn (bool $strong) => $strong ? 'a' : 'b');

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_CORE_PREP]]));

        $this->postJson('/api/admin/core/item-analysis/run')->assertOk()->assertJson(['analysed' => 2, 'flagged' => 1]);

        $flagged = $this->getJson('/api/admin/core/questions?flagged=1')->assertOk()->json('data');
        $this->assertSame([$bad->id], array_column($flagged, 'id'));
        $this->assertContains('suspected_key', $flagged[0]['stats']['flags']);
        $this->assertSame('b', $flagged[0]['stats']['suspect_option']);

        $this->assertCount(2, $this->getJson('/api/admin/core/questions')->assertOk()->json('data'));
    }

    public function test_the_command_runs_and_is_scheduled_nightly(): void
    {
        $this->artisan('core:analyse-items')->expectsOutputToContain('Analysed 0 question(s)')->assertSuccessful();

        $scheduled = collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())->contains(fn ($event) => str_contains((string) $event->command, 'core:analyse-items'));
        $this->assertTrue($scheduled);
    }
}
