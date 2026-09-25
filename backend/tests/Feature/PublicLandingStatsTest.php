<?php

namespace Tests\Feature;

use App\Models\Problem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Covers the only unauthenticated data surface in this API — the public
 * marketing landing page's real-numbers endpoints (PublicController). Every
 * assertion checks the response against real, freshly-seeded rows rather
 * than a fixed expected number, since the whole point of this endpoint is
 * that it can never drift out of sync with the actual catalog again.
 */
class PublicLandingStatsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
    }

    private function problem(string $slug, string $difficulty, array $tags): Problem
    {
        return Problem::create([
            'slug' => $slug,
            'title' => $slug,
            'difficulty' => $difficulty,
            'tags' => $tags,
            'description' => 'A problem.',
            'function_name' => 'solve',
            'params' => [['name' => 'n', 'type' => 'integer']],
            'return_type' => 'integer',
            'comparison_mode' => Problem::COMPARISON_EXACT,
            'display_order' => 1,
        ]);
    }

    public function test_stats_requires_no_authentication_and_reflects_real_counts(): void
    {
        $a = $this->problem('a', Problem::DIFFICULTY_EASY, ['Array']);
        $a->testCases()->create(['inputs' => ['n' => 1], 'expected_output' => 1, 'is_sample' => true, 'display_order' => 0]);

        $b = $this->problem('b', Problem::DIFFICULTY_MEDIUM, ['Array', 'Hash Table']);
        $b->testCases()->create(['inputs' => ['n' => 1], 'expected_output' => 1, 'is_sample' => true, 'display_order' => 0]);
        $b->testCases()->create(['inputs' => ['n' => 2], 'expected_output' => 2, 'is_sample' => false, 'display_order' => 1]);

        $this->problem('c', Problem::DIFFICULTY_HARD, ['Graph']);

        $response = $this->getJson('/api/public/stats');

        $response->assertStatus(200);
        $response->assertJson([
            'problems_total' => 3,
            'problems_easy' => 1,
            'problems_medium' => 1,
            'problems_hard' => 1,
            'topics_total' => 3, // Array, Hash Table, Graph
            'test_cases_total' => 3,
            'languages_total' => 4, // config/piston.php: cpp, java, python, javascript
        ]);
    }

    public function test_sample_problems_requires_no_authentication_and_never_exposes_test_cases(): void
    {
        $this->problem('easy-one', Problem::DIFFICULTY_EASY, ['Array']);
        $this->problem('medium-one', Problem::DIFFICULTY_MEDIUM, ['Graph']);
        $this->problem('hard-one', Problem::DIFFICULTY_HARD, ['DP']);

        $response = $this->getJson('/api/public/problems/sample');

        $response->assertStatus(200);
        $response->assertJsonCount(3, 'problems');
        $response->assertJsonStructure(['problems' => [['slug', 'title', 'difficulty', 'tags']]]);
        $response->assertJsonMissingPath('problems.0.acceptance_rate');
        $response->assertJsonMissingPath('problems.0.description');
    }

    public function test_stats_is_cached_and_does_not_reflect_a_problem_added_within_the_cache_window(): void
    {
        $this->problem('first', Problem::DIFFICULTY_EASY, ['Array']);
        $this->getJson('/api/public/stats')->assertJson(['problems_total' => 1]);

        $this->problem('second', Problem::DIFFICULTY_EASY, ['Array']);
        $this->getJson('/api/public/stats')->assertJson(['problems_total' => 1]);
    }
}
