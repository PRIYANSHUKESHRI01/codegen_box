<?php

namespace Tests\Feature;

use App\Models\ListeningLesson;
use App\Services\ListeningProgressService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsListeningLessons;
use Tests\TestCase;

/**
 * What the Listening Lab says about a student's progress: level progress, the
 * skill profile, the weakest skill, and the single "up next" suggestion. The
 * suggestion is the part a student acts on, so its priorities are pinned.
 */
class ListeningProgressTest extends TestCase
{
    use BuildsListeningLessons;
    use RefreshDatabase;

    private function service(): ListeningProgressService
    {
        return app(ListeningProgressService::class);
    }

    private function skills(int $correct, int $total, string $skill): array
    {
        return [['skill' => $skill, 'correct' => $correct, 'total' => $total]];
    }

    public function test_a_brand_new_student_is_pointed_at_the_first_beginner_lesson(): void
    {
        $student = $this->listeningStudent();
        $first = $this->passageLesson(['title' => 'First', 'display_order' => 0]);
        $this->passageLesson(['title' => 'Second', 'display_order' => 1]);
        $this->passageLesson(['title' => 'Hard', 'difficulty' => 'advanced']);

        $summary = $this->service()->summary($student->id);

        $this->assertSame(3, $summary['lessons_total']);
        $this->assertSame(0, $summary['lessons_passed']);
        $this->assertNull($summary['average_best_score']);
        $this->assertSame('beginner', $summary['current_level']);
        $this->assertSame([], $summary['skills']);
        $this->assertNull($summary['weakest_skill']);
        $this->assertSame($first->id, $summary['recommended']['lesson_id']);
        $this->assertSame('A gentle first lesson to tune your ear.', $summary['recommended']['reason']);
    }

    public function test_passing_every_beginner_lesson_moves_the_student_up_a_level(): void
    {
        $student = $this->listeningStudent();
        $b1 = $this->passageLesson(['title' => 'B1', 'display_order' => 0]);
        $b2 = $this->passageLesson(['title' => 'B2', 'display_order' => 1]);
        $i1 = $this->passageLesson(['title' => 'I1', 'difficulty' => 'intermediate']);
        $this->recordAttempt($student, $b1, 80);

        $afterOne = $this->service()->summary($student->id);
        $this->assertSame('beginner', $afterOne['current_level']);
        $this->assertSame($b2->id, $afterOne['recommended']['lesson_id']);
        $this->assertSame('Next up at Beginner level.', $afterOne['recommended']['reason']);

        $this->recordAttempt($student, $b2, 60); // 60 is a pass
        $afterBoth = $this->service()->summary($student->id);

        $this->assertSame('intermediate', $afterBoth['current_level']);
        $this->assertSame($i1->id, $afterBoth['recommended']['lesson_id']);
        $this->assertSame(['total' => 2, 'passed' => 2], $afterBoth['levels']['beginner']);
        $this->assertSame(['total' => 1, 'passed' => 0], $afterBoth['levels']['intermediate']);
    }

    public function test_a_failed_attempt_does_not_count_as_passed_but_the_best_score_still_shows(): void
    {
        $student = $this->listeningStudent();
        $lesson = $this->passageLesson();
        $this->recordAttempt($student, $lesson, 40);
        $this->recordAttempt($student, $lesson, 55);

        $summary = $this->service()->summary($student->id);

        $this->assertSame(0, $summary['lessons_passed']);
        $this->assertSame(55, $summary['average_best_score']);
        $this->assertSame(2, $summary['attempts_total']);
    }

    public function test_the_skill_profile_adds_up_every_attempt_and_picks_the_weakest_skill(): void
    {
        $student = $this->listeningStudent();
        $lesson = $this->passageLesson();
        $this->recordAttempt($student, $lesson, 50, [['skill' => 'numbers', 'correct' => 1, 'total' => 4], ['skill' => 'detail', 'correct' => 3, 'total' => 4]]);
        $this->recordAttempt($student, $lesson, 70, [['skill' => 'numbers', 'correct' => 1, 'total' => 2], ['skill' => 'detail', 'correct' => 2, 'total' => 2]]);

        $summary = $this->service()->summary($student->id);

        $byskill = array_column($summary['skills'], null, 'skill');
        $this->assertSame(['correct' => 2, 'total' => 6, 'pct' => 33], ['correct' => $byskill['numbers']['correct'], 'total' => $byskill['numbers']['total'], 'pct' => $byskill['numbers']['pct']]);
        $this->assertSame(83, $byskill['detail']['pct']);
        $this->assertSame(['skill' => 'numbers', 'label' => 'Numbers & times', 'pct' => 33], $summary['weakest_skill']);
    }

    public function test_a_skill_with_too_little_evidence_or_already_strong_is_never_called_weakest(): void
    {
        $student = $this->listeningStudent();
        $lesson = $this->passageLesson();
        // numbers: 0/2 is bad but only two questions — not enough to judge. detail: 4/5 = 80% is strong.
        $this->recordAttempt($student, $lesson, 50, [['skill' => 'numbers', 'correct' => 0, 'total' => 2], ['skill' => 'detail', 'correct' => 4, 'total' => 5]]);

        $this->assertNull($this->service()->summary($student->id)['weakest_skill']);
    }

    public function test_the_next_lesson_targets_the_weakest_skill_when_there_is_one(): void
    {
        $student = $this->listeningStudent();
        $done = $this->passageLesson(['title' => 'Done', 'display_order' => 0]);
        $this->passageLesson(['title' => 'Detail only', 'display_order' => 1], [
            ['question' => 'q', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0, 'skill' => 'detail', 'evidence' => 0, 'explanation' => 'e'],
        ]);
        $numbers = $this->passageLesson(['title' => 'Numbers drill', 'display_order' => 2], [
            ['question' => 'q', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0, 'skill' => 'numbers', 'evidence' => 0, 'explanation' => 'e'],
        ]);
        $this->recordAttempt($student, $done, 100, $this->skills(1, 5, 'numbers'));

        $rec = $this->service()->summary($student->id)['recommended'];

        $this->assertSame($numbers->id, $rec['lesson_id'], 'skips the earlier lesson that does not train the weak skill');
        $this->assertSame("Sharpen your Numbers & times — you're at 20% there.", $rec['reason']);
    }

    public function test_when_everything_is_passed_the_suggestion_is_to_beat_the_lowest_best_score(): void
    {
        $student = $this->listeningStudent();
        $strong = $this->passageLesson(['title' => 'Strong']);
        $weak = $this->passageLesson(['title' => 'Weak']);
        $this->recordAttempt($student, $strong, 100);
        $this->recordAttempt($student, $weak, 70);

        $rec = $this->service()->summary($student->id)['recommended'];

        $this->assertSame($weak->id, $rec['lesson_id']);
        $this->assertSame('Beat your best of 70%.', $rec['reason']);
    }

    public function test_a_perfect_run_through_the_whole_library_has_nothing_left_to_suggest(): void
    {
        $student = $this->listeningStudent();
        $this->recordAttempt($student, $this->passageLesson(), 100);

        $this->assertNull($this->service()->summary($student->id)['recommended']);
    }

    public function test_the_lesson_just_finished_is_never_suggested_again(): void
    {
        $student = $this->listeningStudent();
        $only = $this->passageLesson();

        $this->assertNull($this->service()->summary($student->id, $only->id)['recommended']);
    }

    public function test_generated_lessons_never_inflate_library_progress_but_their_skills_count(): void
    {
        $student = $this->listeningStudent();
        $library = $this->passageLesson(['title' => 'Library']);
        $mine = $this->passageLesson(['title' => 'Mine', 'user_id' => $student->id, 'source' => 'ai']);
        $this->recordAttempt($student, $mine, 100, $this->skills(5, 5, 'inference'));

        $summary = $this->service()->summary($student->id);

        $this->assertSame(1, $summary['lessons_total'], 'only library lessons are counted');
        $this->assertSame(0, $summary['lessons_passed']);
        $this->assertSame(['inference'], array_column($summary['skills'], 'skill'), 'but what they practised still shapes their skill profile');
        $this->assertSame(['total' => 1, 'passed' => 0], $this->service()->counts($student->id));
        $this->assertSame($library->id, $summary['recommended']['lesson_id']);
    }

    public function test_another_students_private_lesson_is_never_recommended_even_when_it_fits_perfectly(): void
    {
        $student = $this->listeningStudent();
        $stranger = $this->listeningStudent();
        $done = $this->passageLesson(['title' => 'Done']);
        $library = $this->passageLesson(['title' => 'Library detail drill', 'display_order' => 5], [
            ['question' => 'q', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0, 'skill' => 'detail', 'evidence' => 0, 'explanation' => 'e'],
        ]);
        // The stranger's private lesson is the ONLY one that trains the student's weak skill.
        $private = $this->passageLesson(['title' => 'Stranger numbers lesson', 'user_id' => $stranger->id, 'source' => 'ai'], [
            ['question' => 'q', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0, 'skill' => 'numbers', 'evidence' => 0, 'explanation' => 'e'],
        ]);
        $this->recordAttempt($student, $done, 100, $this->skills(1, 6, 'numbers'));

        $summary = $this->service()->summary($student->id);

        $this->assertSame('numbers', $summary['weakest_skill']['skill']);
        $this->assertNotSame($private->id, $summary['recommended']['lesson_id'], 'a private lesson must not leak into someone else\'s suggestions');
        $this->assertSame($library->id, $summary['recommended']['lesson_id']);
        $this->assertStringNotContainsString('Stranger', json_encode($summary));
    }

    public function test_the_visibility_scope_returns_library_plus_only_the_viewers_own_lessons(): void
    {
        $me = $this->listeningStudent();
        $other = $this->listeningStudent();
        $library = $this->passageLesson(['title' => 'Library']);
        $mine = $this->passageLesson(['title' => 'Mine', 'user_id' => $me->id, 'source' => 'ai']);
        $theirs = $this->passageLesson(['title' => 'Theirs', 'user_id' => $other->id, 'source' => 'ai']);

        $visible = ListeningLesson::visibleTo($me->id)->pluck('id')->all();

        $this->assertEqualsCanonicalizing([$library->id, $mine->id], $visible);
        $this->assertFalse($theirs->isVisibleTo($me->id));
        $this->assertTrue($theirs->isVisibleTo($other->id));
        $this->assertTrue($library->isVisibleTo($me->id));
    }

    public function test_one_students_attempts_never_affect_anothers_progress(): void
    {
        $a = $this->listeningStudent();
        $b = $this->listeningStudent();
        $lesson = $this->passageLesson();
        $this->recordAttempt($a, $lesson, 100, $this->skills(1, 9, 'numbers'));

        $summaryB = $this->service()->summary($b->id);

        $this->assertSame(0, $summaryB['lessons_passed']);
        $this->assertSame([], $summaryB['skills']);
    }

    public function test_the_hub_overview_reports_real_listening_progress(): void
    {
        $student = $this->listeningStudent();
        Sanctum::actingAs($student);
        $a = $this->passageLesson(['title' => 'A']);
        $this->passageLesson(['title' => 'B']);
        $this->recordAttempt($student, $a, 90);

        $overview = $this->getJson('/api/learning-centre/overview')->assertStatus(200)->json();

        $this->assertSame(2, $overview['listening_lessons_total']);
        $this->assertSame(1, $overview['listening_lessons_passed']);
        $this->assertSame(1, $overview['total_sessions']);
    }

    public function test_the_index_endpoint_carries_the_summary_the_page_renders(): void
    {
        $student = $this->listeningStudent();
        Sanctum::actingAs($student);
        $this->passageLesson();

        $summary = $this->getJson('/api/learning-centre/listening/lessons')->assertStatus(200)->json('summary');

        foreach (['lessons_total', 'lessons_passed', 'average_best_score', 'current_level', 'levels', 'skills', 'weakest_skill', 'recommended'] as $key) {
            $this->assertArrayHasKey($key, $summary);
        }
        $this->assertSame(array_keys(['beginner' => 1, 'intermediate' => 1, 'advanced' => 1]), array_keys($summary['levels']));
        $this->assertContains($summary['current_level'], ListeningLesson::DIFFICULTIES);
    }
}
