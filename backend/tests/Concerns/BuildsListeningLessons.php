<?php

namespace Tests\Concerns;

use App\Models\ListeningAttempt;
use App\Models\ListeningLesson;
use App\Models\User;
use App\Support\ListeningScript;

/** Small, explicit lesson fixtures so each test states exactly the content it relies on. */
trait BuildsListeningLessons
{
    protected function listeningStudent(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    /**
     * @param  list<array<string,mixed>>|null  $questions  defaults to two skill-tagged questions with evidence
     */
    protected function passageLesson(array $overrides = [], ?array $questions = null): ListeningLesson
    {
        $passage = $overrides['passage_text'] ?? 'The workshop starts at ten in the morning. It is held in the main seminar hall. Bring a printed copy of your resume.';

        return ListeningLesson::create(array_merge([
            'title' => 'Workshop Notice '.uniqid(),
            'passage_text' => $passage,
            'category' => 'Career Readiness',
            'difficulty' => ListeningLesson::DIFFICULTY_BEGINNER,
            'format' => ListeningLesson::FORMAT_COMPREHENSION,
            'source' => ListeningLesson::SOURCE_LIBRARY,
            'questions' => $questions ?? [
                ['question' => 'When does the workshop start?', 'options' => ['Nine', 'Ten', 'Eleven', 'Noon'], 'correct_index' => 1, 'skill' => 'numbers', 'evidence' => 0, 'explanation' => 'It starts at ten.'],
                ['question' => 'Where is it held?', 'options' => ['Library', 'Cafeteria', 'Main seminar hall', 'Lab'], 'correct_index' => 2, 'skill' => 'detail', 'evidence' => 1, 'explanation' => 'In the main seminar hall.'],
            ],
            'is_active' => true,
            'display_order' => 0,
        ], $overrides));
    }

    protected function conversationLesson(array $overrides = []): ListeningLesson
    {
        $script = [
            ['speaker' => 'A', 'text' => 'Hello, I would like to book a lab slot. Is two o\'clock free?'],
            ['speaker' => 'B', 'text' => 'Yes, it is free. Please bring your student card.'],
        ];

        return ListeningLesson::create(array_merge([
            'title' => 'Lab Booking '.uniqid(),
            'passage_text' => ListeningScript::flatten($script),
            'category' => 'Campus Life',
            'difficulty' => ListeningLesson::DIFFICULTY_BEGINNER,
            'format' => ListeningLesson::FORMAT_CONVERSATION,
            'source' => ListeningLesson::SOURCE_LIBRARY,
            'speakers' => [['key' => 'A', 'label' => 'Student', 'gender' => 'male'], ['key' => 'B', 'label' => 'Assistant', 'gender' => 'female']],
            'script' => $script,
            'questions' => [
                ['question' => 'What should the student bring?', 'options' => ['A laptop', 'His student card', 'A printout', 'A photo'], 'correct_index' => 1, 'skill' => 'detail', 'evidence' => 3, 'explanation' => 'The assistant asks for the student card.'],
            ],
            'is_active' => true,
            'display_order' => 0,
        ], $overrides));
    }

    /** A dictation of exactly two items. */
    protected function dictationLesson(array $overrides = []): ListeningLesson
    {
        return ListeningLesson::create(array_merge([
            'title' => 'Dictation '.uniqid(),
            'passage_text' => 'The library opens at nine every morning. Please submit your assignment before Friday.',
            'category' => 'Campus Life',
            'difficulty' => ListeningLesson::DIFFICULTY_BEGINNER,
            'format' => ListeningLesson::FORMAT_DICTATION,
            'source' => ListeningLesson::SOURCE_LIBRARY,
            'questions' => [],
            'is_active' => true,
            'display_order' => 0,
        ], $overrides));
    }

    /** @param  list<array{skill:string,correct:int,total:int}>|null  $skills */
    protected function recordAttempt(User $user, ListeningLesson $lesson, int $score, ?array $skills = null, array $overrides = []): ListeningAttempt
    {
        return ListeningAttempt::create(array_merge([
            'user_id' => $user->id,
            'listening_lesson_id' => $lesson->id,
            'attempt_number' => ListeningAttempt::where('user_id', $user->id)->where('listening_lesson_id', $lesson->id)->count() + 1,
            'mode' => ListeningAttempt::MODE_PRACTICE,
            'answers' => [],
            'score' => $score,
            'passed' => $score >= ListeningAttempt::PASS_THRESHOLD,
            'skill_breakdown' => $skills,
        ], $overrides));
    }
}
