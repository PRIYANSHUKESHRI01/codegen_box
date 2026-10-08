<?php

namespace Tests\Feature;

use App\Models\ListeningAttempt;
use App\Models\ListeningLesson;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\BuildsListeningLessons;
use Tests\TestCase;

/**
 * Listening Lab beyond the original answer-key contract (see
 * ListeningLabAnswerKeyTest, which still applies unchanged): lesson formats,
 * sentence delivery, per-skill results with answer evidence, dictation
 * grading, practice/exam attempts, ownership of generated lessons, and the
 * lesson list.
 */
class ListeningLabTest extends TestCase
{
    use BuildsListeningLessons;
    use RefreshDatabase;

    private function attempt(ListeningLesson $lesson, array $answers, array $extra = [])
    {
        return $this->postJson("/api/learning-centre/listening/lessons/{$lesson->id}/attempts", array_merge(['answers' => $answers], $extra));
    }

    // ---- show -------------------------------------------------------------------------------

    public function test_show_delivers_the_agreed_sentence_split_and_strips_the_key_for_every_format(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->passageLesson();

        $body = $this->getJson("/api/learning-centre/listening/lessons/{$lesson->id}")->assertStatus(200)->json('lesson');

        $this->assertSame('comprehension', $body['format']);
        $this->assertSame(
            [
                ['index' => 0, 'text' => 'The workshop starts at ten in the morning.', 'speaker' => null],
                ['index' => 1, 'text' => 'It is held in the main seminar hall.', 'speaker' => null],
                ['index' => 2, 'text' => 'Bring a printed copy of your resume.', 'speaker' => null],
            ],
            $body['sentences']
        );
        $this->assertSame(['question', 'options'], array_keys($body['questions'][0]), 'no key, skill or evidence before answering');
        $this->assertSame(['detail', 'numbers'], $body['skills'], 'only the lesson-level skill list is shown, never which question trains which');
        $this->assertSame(2, $body['item_count']);
        $this->assertGreaterThanOrEqual(5, $body['estimated_seconds']);
    }

    public function test_a_conversation_exposes_speakers_and_tags_each_sentence_with_who_says_it(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->conversationLesson();

        $body = $this->getJson("/api/learning-centre/listening/lessons/{$lesson->id}")->json('lesson');

        $this->assertSame('conversation', $body['format']);
        $this->assertSame(['A', 'B'], array_column($body['speakers'], 'key'));
        $this->assertSame(['A', 'A', 'B', 'B'], array_column($body['sentences'], 'speaker'));
        $this->assertSame(['question', 'options'], array_keys($body['questions'][0]));
    }

    public function test_a_dictation_has_no_questions_and_its_sentences_are_the_items(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->dictationLesson();

        $body = $this->getJson("/api/learning-centre/listening/lessons/{$lesson->id}")->json('lesson');

        $this->assertSame('dictation', $body['format']);
        $this->assertSame([], $body['questions']);
        $this->assertSame(2, $body['item_count']);
        $this->assertCount(2, $body['sentences']);
    }

    public function test_show_reports_the_students_own_history_for_that_lesson(): void
    {
        $student = $this->listeningStudent();
        Sanctum::actingAs($student);
        $lesson = $this->passageLesson();
        $this->recordAttempt($student, $lesson, 50);
        $this->recordAttempt($student, $lesson, 100);
        $this->recordAttempt($this->listeningStudent(), $lesson, 10); // someone else's — must not leak in

        $history = $this->getJson("/api/learning-centre/listening/lessons/{$lesson->id}")->json('history');

        $this->assertSame(['attempt_count' => 2, 'best_score' => 100, 'last_score' => 100, 'passed' => true], $history);
    }

    // ---- submit: comprehension / conversation ----------------------------------------------

    public function test_submit_reveals_skill_and_evidence_and_a_breakdown_by_skill(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->passageLesson();

        $res = $this->attempt($lesson, [1, 0])->assertStatus(200); // Q1 right (numbers), Q2 wrong (detail)

        $res->assertJsonPath('attempt.score', 50)
            ->assertJsonPath('format', 'comprehension')
            ->assertJsonPath('results.0.skill', 'numbers')
            ->assertJsonPath('results.0.evidence', 0)
            ->assertJsonPath('results.1.is_correct', false)
            ->assertJsonPath('results.1.correct_index', 2)
            ->assertJsonPath('results.1.evidence', 1);

        $this->assertEquals(
            [
                ['skill' => 'detail', 'correct' => 0, 'total' => 1, 'label' => 'Key details'],
                ['skill' => 'numbers', 'correct' => 1, 'total' => 1, 'label' => 'Numbers & times'],
            ],
            $res->json('skill_breakdown'),
            'rows come back in the canonical skill order, with human labels'
        );
    }

    public function test_questions_without_skill_tags_still_grade_and_just_skip_the_breakdown(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        // A pre-upgrade lesson: no skill/evidence keys at all.
        $lesson = $this->passageLesson([], [
            ['question' => 'Q?', 'options' => ['a', 'b', 'c', 'd'], 'correct_index' => 0, 'explanation' => 'e'],
        ]);

        $res = $this->attempt($lesson, [0])->assertStatus(200);

        $res->assertJsonPath('attempt.score', 100)->assertJsonPath('results.0.skill', null)->assertJsonPath('results.0.evidence', null);
        $this->assertSame([], $res->json('skill_breakdown'));
    }

    public function test_submit_works_for_a_conversation(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->conversationLesson();

        $this->attempt($lesson, [1])->assertStatus(200)->assertJsonPath('attempt.score', 100)->assertJsonPath('attempt.passed', true)->assertJsonPath('format', 'conversation');
    }

    public function test_attempts_record_the_mode_and_plays_but_never_trust_them_for_scoring(): void
    {
        $student = $this->listeningStudent();
        Sanctum::actingAs($student);
        $lesson = $this->passageLesson();

        $this->attempt($lesson, [0, 0], ['mode' => 'exam', 'plays_used' => 2])->assertStatus(200)->assertJsonPath('attempt.mode', 'exam')->assertJsonPath('attempt.score', 0);

        $this->assertDatabaseHas('listening_attempts', ['user_id' => $student->id, 'mode' => 'exam', 'plays_used' => 2, 'score' => 0]);
    }

    public function test_mode_defaults_to_practice_and_rejects_unknown_values(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->passageLesson();

        $this->attempt($lesson, [1, 2])->assertJsonPath('attempt.mode', 'practice');
        $this->attempt($lesson, [1, 2], ['mode' => 'cheat'])->assertStatus(422);
        $this->attempt($lesson, [1, 2], ['plays_used' => -1])->assertStatus(422);
    }

    public function test_new_best_is_only_flagged_when_a_previous_score_was_actually_beaten(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->passageLesson();

        $first = $this->attempt($lesson, [1, 0])->json('attempt'); // 50
        $this->assertFalse($first['is_new_best'], 'a first attempt has nothing to beat');
        $this->assertNull($first['previous_best']);

        $better = $this->attempt($lesson, [1, 2])->json('attempt'); // 100
        $this->assertTrue($better['is_new_best']);
        $this->assertSame(50, $better['previous_best']);

        $same = $this->attempt($lesson, [1, 2])->json('attempt');
        $this->assertFalse($same['is_new_best'], 'equalling your best is not beating it');

        $worse = $this->attempt($lesson, [0, 0])->json('attempt');
        $this->assertFalse($worse['is_new_best']);
        $this->assertSame(4, $worse['attempt_number']);
    }

    public function test_submit_suggests_what_to_do_next_excluding_the_lesson_just_taken(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $first = $this->passageLesson(['title' => 'First', 'display_order' => 0]);
        $second = $this->passageLesson(['title' => 'Second', 'display_order' => 1]);

        $next = $this->attempt($first, [1, 2])->json('next');

        $this->assertSame($second->id, $next['lesson_id']);
    }

    // ---- submit: dictation ------------------------------------------------------------------

    public function test_a_perfect_dictation_scores_one_hundred(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->dictationLesson();

        $res = $this->attempt($lesson, ['The library opens at nine every morning.', 'Please submit your assignment before Friday.'])->assertStatus(200);

        $res->assertJsonPath('attempt.score', 100)->assertJsonPath('attempt.passed', true)->assertJsonPath('format', 'dictation')
            ->assertJsonPath('results.0.accuracy', 100)->assertJsonPath('results.1.is_correct', true);
        $this->assertEquals([['skill' => 'dictation', 'correct' => 2, 'total' => 2, 'label' => 'Dictation']], $res->json('skill_breakdown'));
    }

    public function test_dictation_ignores_case_and_punctuation_but_not_wrong_words(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->dictationLesson();

        $res = $this->attempt($lesson, [
            'the LIBRARY opens at nine every morning',          // case + missing full stop: still perfect
            'Please submit your homework before Friday.',       // "assignment" -> "homework"
        ])->assertStatus(200);

        $this->assertSame(100, $res->json('results.0.accuracy'));
        $second = $res->json('results.1');
        $this->assertLessThan(100, $second['accuracy']);
        $statuses = array_column($second['words'], 'status', 'word');
        $this->assertSame('ok', $statuses['Please']);
        $this->assertContains($statuses['assignment'], ['wrong', 'missed']);
    }

    public function test_a_blank_dictation_item_scores_zero_and_marks_every_word_missed(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->dictationLesson();

        $res = $this->attempt($lesson, ['The library opens at nine every morning.', ''])->assertStatus(200);

        $res->assertJsonPath('results.1.accuracy', 0)->assertJsonPath('results.1.typed', '')->assertJsonPath('attempt.score', 50)->assertJsonPath('attempt.passed', false);
        $this->assertSame(['missed'], array_values(array_unique(array_column($res->json('results.1.words'), 'status'))));
    }

    public function test_dictation_rejects_a_wrong_item_count_or_an_oversized_answer(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->dictationLesson();

        $this->attempt($lesson, ['only one'])->assertStatus(422);
        $this->attempt($lesson, ['ok', str_repeat('x', 401)])->assertStatus(422);
        $this->assertSame(0, ListeningAttempt::count());
    }

    public function test_a_multiple_choice_lesson_still_rejects_text_answers(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->passageLesson();

        $this->attempt($lesson, ['ten', 'hall'])->assertStatus(422);
    }

    // ---- visibility / index -----------------------------------------------------------------

    public function test_another_students_generated_lesson_is_invisible_unstartable_and_unlisted(): void
    {
        $owner = $this->listeningStudent();
        $private = $this->passageLesson(['user_id' => $owner->id, 'source' => 'ai', 'interest' => 'my topic']);
        $this->passageLesson(['title' => 'Library One']);

        Sanctum::actingAs($this->listeningStudent());

        $this->getJson("/api/learning-centre/listening/lessons/{$private->id}")->assertStatus(404);
        $this->attempt($private, [1, 2])->assertStatus(404);
        $index = $this->getJson('/api/learning-centre/listening/lessons')->assertStatus(200);
        $this->assertSame(['Library One'], array_column($index->json('lessons'), 'title'));
        $this->assertSame([], $index->json('my_lessons'));
    }

    public function test_the_owner_sees_their_generated_lessons_separately_newest_first(): void
    {
        $owner = $this->listeningStudent();
        Sanctum::actingAs($owner);
        $this->passageLesson(['title' => 'Library One']);
        $older = $this->passageLesson(['title' => 'Mine Old', 'user_id' => $owner->id, 'source' => 'ai', 'interest' => 'topic a']);
        $newer = $this->passageLesson(['title' => 'Mine New', 'user_id' => $owner->id, 'source' => 'ai', 'interest' => 'topic b']);

        $index = $this->getJson('/api/learning-centre/listening/lessons')->json();

        $this->assertSame(['Library One'], array_column($index['lessons'], 'title'));
        $this->assertSame([$newer->id, $older->id], array_column($index['my_lessons'], 'id'));
        $this->assertTrue($index['my_lessons'][0]['is_mine']);
        $this->assertSame('topic b', $index['my_lessons'][0]['interest']);
    }

    public function test_inactive_lessons_are_hidden_everywhere(): void
    {
        Sanctum::actingAs($this->listeningStudent());
        $lesson = $this->passageLesson(['is_active' => false]);

        $this->getJson("/api/learning-centre/listening/lessons/{$lesson->id}")->assertStatus(404);
        $this->attempt($lesson, [1, 2])->assertStatus(404);
        $this->assertSame([], $this->getJson('/api/learning-centre/listening/lessons')->json('lessons'));
    }

    public function test_the_list_orders_by_level_and_carries_progress_format_and_skills(): void
    {
        $student = $this->listeningStudent();
        Sanctum::actingAs($student);
        $advanced = $this->passageLesson(['title' => 'Adv', 'difficulty' => 'advanced']);
        $beginner = $this->passageLesson(['title' => 'Beg', 'difficulty' => 'beginner']);
        $dictation = $this->dictationLesson(['title' => 'Dict', 'difficulty' => 'intermediate']);
        $this->recordAttempt($student, $beginner, 100);

        $lessons = $this->getJson('/api/learning-centre/listening/lessons')->json('lessons');

        $this->assertSame(['Beg', 'Dict', 'Adv'], array_column($lessons, 'title'));
        $this->assertSame(100, $lessons[0]['best_score']);
        $this->assertTrue($lessons[0]['passed']);
        $this->assertSame(1, $lessons[0]['attempt_count']);
        $this->assertSame(['detail', 'numbers'], $lessons[0]['skills']);
        $this->assertSame('dictation', $lessons[1]['format']);
        $this->assertSame(['dictation'], $lessons[1]['skills']);
        $this->assertSame(2, $lessons[1]['question_count'], 'a dictation counts its sentences');
        $this->assertNull($lessons[2]['best_score']);
        $this->assertFalse($lessons[2]['passed']);
        $this->assertSame($advanced->id, $lessons[2]['id']);
    }

    public function test_listening_requires_a_signed_in_user(): void
    {
        $lesson = $this->passageLesson();

        $this->getJson('/api/learning-centre/listening/lessons')->assertStatus(401);
        $this->getJson("/api/learning-centre/listening/lessons/{$lesson->id}")->assertStatus(401);
        $this->postJson("/api/learning-centre/listening/lessons/{$lesson->id}/attempts", ['answers' => [1, 2]])->assertStatus(401);
        $this->postJson('/api/learning-centre/listening/lessons/generate', ['topic' => 'x y z', 'difficulty' => 'beginner'])->assertStatus(401);
    }
}
