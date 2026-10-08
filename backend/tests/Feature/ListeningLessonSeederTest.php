<?php

namespace Tests\Feature;

use App\Models\ListeningLesson;
use App\Models\User;
use App\Support\ListeningScript;
use Database\Seeders\ListeningLessonSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Content QA for the Listening Lab library. The seeder already refuses to
 * build a lesson whose answer-evidence quote is missing or ambiguous; this
 * runs the whole library through the checks a student would feel as a bug —
 * a lesson that splits into the wrong sentences, a question that gives the
 * answer away by position, a conversation with an unknown speaker — so a
 * content typo fails CI instead of reaching a learner.
 */
class ListeningLessonSeederTest extends TestCase
{
    use RefreshDatabase;

    /** @return list<array<string,mixed>> */
    private function library(): array
    {
        return (new ListeningLessonSeeder)->lessons();
    }

    public function test_the_library_has_depth_at_every_level_and_format(): void
    {
        $lessons = $this->library();

        $this->assertGreaterThanOrEqual(24, count($lessons));

        foreach (ListeningLesson::DIFFICULTIES as $difficulty) {
            $inLevel = array_filter($lessons, fn ($l) => $l['difficulty'] === $difficulty);
            $this->assertGreaterThanOrEqual(7, count($inLevel), "{$difficulty} needs enough lessons to practise on");
            foreach (ListeningLesson::FORMATS as $format) {
                $this->assertNotEmpty(array_filter($inLevel, fn ($l) => $l['format'] === $format), "{$difficulty} is missing a {$format} lesson");
            }
        }

        $titles = array_column($lessons, 'title');
        $this->assertSame($titles, array_values(array_unique($titles)), 'titles are the idempotency key, so they must be unique');
    }

    public function test_every_lesson_is_well_formed_and_speakable(): void
    {
        foreach ($this->library() as $lesson) {
            $title = $lesson['title'];
            $sentences = ListeningScript::sentences($lesson['passage_text'], $lesson['script']);

            $this->assertGreaterThanOrEqual(3, count($sentences), "{$title}: too short to be a lesson");
            $this->assertLessThanOrEqual(30, count($sentences), "{$title}: too long for one sitting");

            // Abbreviations with full stops would silently corrupt the sentence split the whole lesson relies on.
            $this->assertDoesNotMatchRegularExpression('/\b(?:[A-Za-z]\.){2,}|\b(?:Mr|Mrs|Ms|Dr|Prof|vs|etc)\./u', $lesson['passage_text'], "{$title}: contains a dotted abbreviation");
            $this->assertDoesNotMatchRegularExpression('/https?:|@|<|>/', $lesson['passage_text'], "{$title}: contains markup or a link");

            foreach ($sentences as $s) {
                $this->assertMatchesRegularExpression('/[.!?]["\')]?$/', $s['text'], "{$title}: sentence {$s['index']} does not end like a sentence: {$s['text']}");
            }
        }
    }

    public function test_questions_have_a_valid_key_a_skill_and_a_real_evidence_sentence(): void
    {
        foreach ($this->library() as $lesson) {
            $title = $lesson['title'];
            $sentenceCount = count(ListeningScript::sentences($lesson['passage_text'], $lesson['script']));

            if ($lesson['format'] === ListeningLesson::FORMAT_DICTATION) {
                $this->assertSame([], $lesson['questions'], "{$title}: a dictation's items are its sentences, not questions");

                continue;
            }

            $this->assertGreaterThanOrEqual(4, count($lesson['questions']), "{$title}: needs at least four questions");
            $this->assertLessThanOrEqual(6, count($lesson['questions']), "{$title}: too many questions for one listen");

            foreach ($lesson['questions'] as $n => $q) {
                $label = "{$title} Q".($n + 1);
                $this->assertCount(4, $q['options'], $label);
                $this->assertCount(4, array_unique($q['options']), "{$label}: duplicate options");
                $this->assertContains($q['correct_index'], [0, 1, 2, 3], $label);
                $this->assertContains($q['skill'], ListeningLesson::QUESTION_SKILLS, $label);
                $this->assertGreaterThanOrEqual(0, $q['evidence'], "{$label}: no evidence sentence");
                $this->assertLessThan($sentenceCount, $q['evidence'], "{$label}: evidence points past the end of the script");
                $this->assertNotSame('', trim($q['explanation']), $label);
            }
        }
    }

    public function test_the_correct_answer_is_not_always_in_the_same_position(): void
    {
        $positions = array_fill(0, 4, 0);
        $total = 0;

        foreach ($this->library() as $lesson) {
            foreach ($lesson['questions'] as $q) {
                $positions[$q['correct_index']]++;
                $total++;
            }
        }

        foreach ($positions as $slot => $count) {
            $this->assertGreaterThan(0.12 * $total, $count, "the answer is almost never option ".($slot + 1).' — students would learn to skip it');
            $this->assertLessThan(0.40 * $total, $count, "the answer is too often option ".($slot + 1));
        }
    }

    public function test_every_skill_is_trained_by_the_library(): void
    {
        $seen = [];
        foreach ($this->library() as $lesson) {
            foreach ($lesson['questions'] as $q) {
                $seen[$q['skill']] = true;
            }
        }

        foreach (ListeningLesson::QUESTION_SKILLS as $skill) {
            $this->assertArrayHasKey($skill, $seen, "no lesson trains {$skill}");
        }
    }

    public function test_conversations_have_declared_speakers_and_actually_alternate(): void
    {
        foreach (array_filter($this->library(), fn ($l) => $l['format'] === ListeningLesson::FORMAT_CONVERSATION) as $lesson) {
            $keys = array_column($lesson['speakers'], 'key');
            $this->assertGreaterThanOrEqual(2, count($keys), $lesson['title']);
            $this->assertLessThanOrEqual(3, count($keys), $lesson['title']);

            $spoken = array_unique(array_column($lesson['script'], 'speaker'));
            $this->assertEqualsCanonicalizing($keys, $spoken, "{$lesson['title']}: a declared speaker never talks, or someone talks undeclared");
            $this->assertSame(ListeningScript::flatten($lesson['script']), $lesson['passage_text'], "{$lesson['title']}: passage_text must be the full transcript");

            foreach ($lesson['speakers'] as $speaker) {
                $this->assertContains($speaker['gender'], ['female', 'male'], "{$lesson['title']}: speaker {$speaker['key']} needs a voice gender hint");
            }
        }
    }

    public function test_seeding_is_idempotent_and_never_touches_a_students_own_lessons(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);
        $mine = ListeningLesson::create([
            'user_id' => $student->id, 'title' => 'Campus Orientation Day', 'passage_text' => 'My own lesson. It has two sentences.',
            'category' => 'Mine', 'difficulty' => ListeningLesson::DIFFICULTY_BEGINNER, 'format' => ListeningLesson::FORMAT_COMPREHENSION,
            'source' => ListeningLesson::SOURCE_AI, 'questions' => [], 'is_active' => true,
        ]);

        $this->seed(ListeningLessonSeeder::class);
        $countAfterFirst = ListeningLesson::whereNull('user_id')->count();
        $this->seed(ListeningLessonSeeder::class);

        $this->assertSame($countAfterFirst, ListeningLesson::whereNull('user_id')->count(), 're-seeding must not duplicate the library');
        $this->assertGreaterThanOrEqual(24, $countAfterFirst);

        // Same title as a library lesson, but it is the student's — it must survive untouched.
        $mine->refresh();
        $this->assertSame($student->id, $mine->user_id);
        $this->assertSame('My own lesson. It has two sentences.', $mine->passage_text);
    }

    public function test_seeding_keeps_a_lessons_id_so_existing_attempts_survive_an_edit(): void
    {
        $this->seed(ListeningLessonSeeder::class);
        $id = ListeningLesson::where('title', 'Campus Orientation Day')->value('id');

        $this->seed(ListeningLessonSeeder::class);

        $this->assertSame($id, ListeningLesson::where('title', 'Campus Orientation Day')->value('id'));
    }
}
