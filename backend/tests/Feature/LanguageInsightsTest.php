<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\LanguageInsightsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesCodingActivityFixtures;
use Tests\TestCase;

/**
 * Which language a student actually codes in and where they should improve:
 * the per-language numbers, the proficiency verdicts (and the refusal to give
 * one from a thin sample), the improvement findings, and the stated-vs-actual
 * comparison against what they said in onboarding.
 */
class LanguageInsightsTest extends TestCase
{
    use CreatesCodingActivityFixtures;
    use RefreshDatabase;

    private function student(array $attributes = []): User
    {
        return User::factory()->create(array_merge(['role' => User::ROLE_USER], $attributes));
    }

    private function insights(User $student): array
    {
        return app(LanguageInsightsService::class)->forStudent($student->fresh());
    }

    private function language(array $insights, string $id): array
    {
        return collect($insights['languages'])->firstWhere('language', $id) ?? $this->fail("No {$id} entry in the language breakdown");
    }

    public function test_a_student_with_no_submissions_has_an_empty_picture(): void
    {
        $insights = $this->insights($this->student());

        $this->assertSame([], $insights['languages']);
        $this->assertNull($insights['actual_primary_language']);
        $this->assertSame([], $insights['improve']);
        $this->assertFalse($insights['mismatch']);
        $this->assertSame(0, $insights['totals']['attempts']);
    }

    public function test_it_counts_practice_and_contest_attempts_per_language(): void
    {
        $student = $this->student();
        $this->practiceHistory($student, 'python', accepted: 6, wrong: 1);
        $this->practiceHistory($student, 'java', accepted: 1, wrong: 7);
        $this->contestAttempt($student, 'cpp', 'accepted');
        $this->contestAttempt($student, 'cpp', 'wrong_answer');

        $insights = $this->insights($student);

        $python = $this->language($insights, 'python');
        $this->assertSame(7, $python['attempts']);
        $this->assertSame(6, $python['accepted']);
        $this->assertSame(6, $python['solved']);
        $this->assertSame(86, $python['acceptance_rate']);
        $this->assertSame(LanguageInsightsService::PROFICIENCY_STRONG, $python['proficiency']);

        $java = $this->language($insights, 'java');
        $this->assertSame(8, $java['attempts']);
        $this->assertSame(13, $java['acceptance_rate']);
        $this->assertSame(LanguageInsightsService::PROFICIENCY_NEEDS_WORK, $java['proficiency']);

        // Contest attempts are counted too, but two of them is too few to judge.
        $cpp = $this->language($insights, 'cpp');
        $this->assertSame(2, $cpp['attempts']);
        $this->assertSame(1, $cpp['solved']);
        $this->assertSame(LanguageInsightsService::PROFICIENCY_GETTING_STARTED, $cpp['proficiency']);

        $this->assertSame(17, $insights['totals']['attempts']);
        $this->assertSame(3, $insights['totals']['languages_used']);
    }

    public function test_languages_are_ranked_by_what_was_actually_solved_so_the_first_is_the_real_primary(): void
    {
        $student = $this->student();
        $this->practiceHistory($student, 'java', accepted: 2, wrong: 20); // lots of attempts, little solved
        $this->practiceHistory($student, 'python', accepted: 5);

        $insights = $this->insights($student);

        $this->assertSame('python', $insights['actual_primary_language']);
        $this->assertSame(['python', 'java'], array_column($insights['languages'], 'language'));
    }

    public function test_the_same_problem_solved_in_practice_and_a_contest_counts_once_per_language(): void
    {
        $student = $this->student();
        $problem = $this->makeProblem();
        $this->practiceSubmission($student, 'python', 'accepted', $problem);
        $this->contestAttempt($student, 'python', 'accepted', $problem);

        $python = $this->language($this->insights($student), 'python');

        $this->assertSame(2, $python['attempts']);
        $this->assertSame(2, $python['accepted']);
        $this->assertSame(1, $python['solved'], 'one problem, however many times it was accepted');
    }

    public function test_a_weak_language_with_enough_attempts_is_flagged_with_the_stronger_one_for_comparison(): void
    {
        $student = $this->student();
        $this->practiceHistory($student, 'python', accepted: 8, wrong: 2);
        $this->practiceHistory($student, 'java', accepted: 1, wrong: 7);

        $finding = collect($this->insights($student)['improve'])->firstWhere('language', 'java');

        $this->assertSame(LanguageInsightsService::INSIGHT_LOW_ACCEPTANCE, $finding['kind']);
        $this->assertSame('high', $finding['severity']);
        $this->assertSame('wrong_answer', $finding['dominant_failure']);
        $this->assertSame(['language' => 'python', 'acceptance_rate' => 80], $finding['stronger_language']);
    }

    public function test_frequent_compile_errors_are_flagged_even_when_acceptance_is_fine(): void
    {
        $student = $this->student();
        // 10 submissions: 5 accepted (50%), 3 compile errors (30%), 2 wrong.
        $this->practiceHistory($student, 'cpp', accepted: 5, wrong: 2, compileErrors: 3);

        $finding = collect($this->insights($student)['improve'])->firstWhere('language', 'cpp');

        $this->assertNotNull($finding);
        $this->assertSame(LanguageInsightsService::INSIGHT_COMPILE_ERRORS, $finding['kind']);
        $this->assertSame(30, $finding['compile_error_share']);
    }

    public function test_frequent_runtime_errors_are_flagged(): void
    {
        $student = $this->student();
        $this->practiceHistory($student, 'go', accepted: 5, wrong: 2, runtimeErrors: 3);

        $finding = collect($this->insights($student)['improve'])->firstWhere('language', 'go');

        $this->assertSame(LanguageInsightsService::INSIGHT_RUNTIME_ERRORS, $finding['kind']);
    }

    public function test_no_verdict_is_given_from_a_thin_sample(): void
    {
        $student = $this->student();
        $this->practiceHistory($student, 'rust', accepted: 0, wrong: 4); // 4 attempts, all failed

        $insights = $this->insights($student);

        $this->assertSame(LanguageInsightsService::PROFICIENCY_GETTING_STARTED, $this->language($insights, 'rust')['proficiency']);
        $this->assertSame([], $insights['improve']);
    }

    public function test_a_healthy_language_raises_no_finding(): void
    {
        $student = $this->student();
        $this->practiceHistory($student, 'python', accepted: 9, wrong: 1);

        $this->assertSame([], $this->insights($student)['improve']);
    }

    public function test_a_stated_main_language_that_is_never_practised_is_called_out_once_there_is_activity(): void
    {
        $student = $this->student(['primary_language' => 'rust', 'preferred_languages' => ['rust']]);
        $this->practiceHistory($student, 'python', accepted: 6);

        $insights = $this->insights($student);
        $finding = collect($insights['improve'])->firstWhere('kind', LanguageInsightsService::INSIGHT_PREFERRED_NOT_PRACTICED);

        $this->assertSame('rust', $finding['language']);
        $this->assertTrue($insights['mismatch']);
        $this->assertSame('rust', $insights['stated']['primary_language']);
        $this->assertSame('python', $insights['actual_primary_language']);
    }

    public function test_no_stated_language_nudge_before_there_is_enough_activity(): void
    {
        $student = $this->student(['primary_language' => 'rust', 'preferred_languages' => ['rust']]);
        $this->practiceHistory($student, 'python', accepted: 2);

        $insights = $this->insights($student);

        $this->assertSame([], $insights['improve']);
        $this->assertFalse($insights['mismatch'], 'two submissions is too early to call it a mismatch');
    }

    public function test_matching_stated_and_actual_languages_are_not_a_mismatch(): void
    {
        $student = $this->student(['primary_language' => 'python', 'preferred_languages' => ['python']]);
        $this->practiceHistory($student, 'python', accepted: 7);

        $this->assertFalse($this->insights($student)['mismatch']);
    }

    public function test_one_students_numbers_never_include_another_students(): void
    {
        $mine = $this->student();
        $theirs = $this->student();
        $this->practiceHistory($mine, 'python', accepted: 2);
        $this->practiceHistory($theirs, 'python', accepted: 9);

        $this->assertSame(2, $this->language($this->insights($mine), 'python')['attempts']);
    }

    public function test_the_student_can_read_their_own_language_insights(): void
    {
        $student = $this->student(['primary_language' => 'python']);
        $this->practiceHistory($student, 'python', accepted: 6, wrong: 2);
        Sanctum::actingAs($student);

        $this->getJson('/api/me/language-insights')
            ->assertOk()
            ->assertJsonPath('actual_primary_language', 'python')
            ->assertJsonPath('languages.0.language', 'python')
            ->assertJsonPath('languages.0.attempts', 8)
            ->assertJsonPath('stated.primary_language', 'python');
    }

    public function test_many_students_are_summarised_in_the_same_queries_as_one(): void
    {
        $few = collect(range(1, 3))->map(fn () => $this->student());
        $many = collect(range(1, 40))->map(fn () => $this->student());
        foreach ($few->concat($many) as $s) {
            $this->practiceHistory($s, 'python', accepted: 1);
        }

        $service = app(LanguageInsightsService::class);

        $count = function (iterable $students) use ($service) {
            $queries = 0;
            DB::listen(function () use (&$queries) {
                $queries++;
            });
            $service->forStudents($students);

            return $queries;
        };

        $this->assertSame($count($few), $count($many), 'the number of queries must not grow with the number of students');
    }
}
