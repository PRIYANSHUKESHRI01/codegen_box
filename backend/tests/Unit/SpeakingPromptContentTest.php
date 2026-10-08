<?php

namespace Tests\Unit;

use App\Models\SpeakingPrompt;
use App\Services\GeminiSpeakingPassageService;
use Database\Seeders\SpeakingPromptSeeder;
use PHPUnit\Framework\TestCase;
use ReflectionMethod;

/**
 * Guards the authored library: a passage the student cannot read aloud
 * unambiguously (digits, symbols) or that sits in the wrong difficulty band
 * would silently produce confusing scores, so content mistakes fail the build.
 */
class SpeakingPromptContentTest extends TestCase
{
    /** @return list<array{title:string,category:string,difficulty:string,passage_text:string}> */
    private function allPrompts(): array
    {
        $seeder = new SpeakingPromptSeeder;
        $all = [];
        foreach (['prompts', 'jobSeekerPrompts'] as $method) {
            $m = new ReflectionMethod($seeder, $method);
            $m->setAccessible(true);
            array_push($all, ...$m->invoke($seeder));
        }

        return $all;
    }

    public function test_titles_are_unique_because_the_seeder_upserts_by_title(): void
    {
        $titles = array_column($this->allPrompts(), 'title');

        $this->assertSame(count($titles), count(array_unique($titles)));
    }

    public function test_every_passage_can_be_read_aloud_unambiguously(): void
    {
        foreach ($this->allPrompts() as $p) {
            $this->assertDoesNotMatchRegularExpression('/\d/', $p['passage_text'], "{$p['title']} contains digits — spell numbers out");
            $this->assertDoesNotMatchRegularExpression('/https?:|www\.|@|[<>#*_]/', $p['passage_text'], "{$p['title']} contains symbols that cannot be read aloud");
            $this->assertMatchesRegularExpression('/[.!?]$/', $p['passage_text'], "{$p['title']} does not end like a sentence");
        }
    }

    public function test_word_counts_fit_the_difficulty_band(): void
    {
        $bands = [
            SpeakingPrompt::DIFFICULTY_BEGINNER => [55, 75],
            SpeakingPrompt::DIFFICULTY_INTERMEDIATE => [65, 100],
            SpeakingPrompt::DIFFICULTY_ADVANCED => [80, 130],
        ];

        foreach ($this->allPrompts() as $p) {
            [$min, $max] = $bands[$p['difficulty']];
            $words = str_word_count($p['passage_text']);
            $this->assertGreaterThanOrEqual($min, $words, "{$p['title']} is too short for {$p['difficulty']}");
            $this->assertLessThanOrEqual($max, $words, "{$p['title']} is too long for {$p['difficulty']}");
        }
    }

    public function test_every_category_is_one_of_the_four_shared_with_the_passage_generator(): void
    {
        $allowed = array_column(GeminiSpeakingPassageService::PURPOSES, 0);

        foreach ($this->allPrompts() as $p) {
            $this->assertContains(SpeakingPromptSeeder::categoryFor($p['category']), $allowed, "{$p['title']} has an unmapped category '{$p['category']}'");
        }
    }

    public function test_every_level_has_interview_ready_material_for_job_seekers(): void
    {
        $byLevel = [];
        foreach ($this->allPrompts() as $p) {
            if (SpeakingPromptSeeder::categoryFor($p['category']) === 'Interview Ready') {
                $byLevel[$p['difficulty']] = ($byLevel[$p['difficulty']] ?? 0) + 1;
            }
        }

        foreach (SpeakingPrompt::DIFFICULTIES as $level) {
            $this->assertGreaterThanOrEqual(2, $byLevel[$level] ?? 0, "need interview-ready passages at {$level}");
        }
    }
}
