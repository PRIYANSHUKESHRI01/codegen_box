<?php

namespace Tests\Feature;

use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\User;
use App\Services\ReadinessScoreService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Covers Readiness Score v2's reweighting — interview performance and
 * contest rating now carry real weight (previously ignored entirely), CGPA
 * can no longer dominate the composite, and the instance-level memoization
 * fix (readinessTier() -> readinessScore() -> practiceScore() used to
 * triple-query per call) actually holds.
 */
class ReadinessScoreServiceTest extends TestCase
{
    use RefreshDatabase;

    private function service(): ReadinessScoreService
    {
        return app(ReadinessScoreService::class);
    }

    public function test_a_student_with_no_interviews_or_rated_contests_scores_zero_on_those_components(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);

        $breakdown = $this->service()->breakdown($student);
        $byKey = collect($breakdown['components'])->keyBy('key');

        $this->assertSame(0, $byKey['interview_performance']['score']);
        $this->assertSame(0, $byKey['contest_rating']['score']);
        $this->assertStringContainsString('mock interview', $breakdown['next_steps'][0]);
    }

    public function test_cgpa_alone_can_no_longer_dominate_the_score(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER, 'cgpa' => 10, 'backlogs' => 0]);

        $breakdown = $this->service()->breakdown($student);

        // Academic standing is capped at 10% weight now — a perfect
        // academic record with nothing else real can't push the composite
        // meaningfully, unlike the old formula where it alone reached 50.
        $this->assertLessThanOrEqual(10, $breakdown['score']);
    }

    public function test_a_scored_interview_session_measurably_moves_the_composite(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);
        $before = $this->service()->breakdown($student);

        $interview = Interview::create([
            'title' => 'Mock Screening',
            'slug' => Interview::uniqueSlug('Mock Screening'),
            'status' => Interview::STATUS_PUBLISHED,
            'interview_type' => Interview::INTERVIEW_TYPE_GENERAL,
            'is_mock' => true,
        ]);

        InterviewSession::create([
            'interview_id' => $interview->id,
            'user_id' => $student->id,
            'status' => InterviewSession::STATUS_COMPLETED,
            'started_at' => now()->subMinutes(20),
            'completed_at' => now(),
            'composite_score_percent' => 90,
            'ai_scored_at' => now(),
        ]);

        $after = $this->service()->breakdown($student->fresh());

        $this->assertGreaterThan($before['score'], $after['score']);
        $this->assertSame(90, collect($after['components'])->keyBy('key')['interview_performance']['score']);
    }

    public function test_repeated_calls_on_the_same_instance_are_memoized_and_never_requery(): void
    {
        $student = User::factory()->create(['role' => User::ROLE_USER]);

        $queries = 0;
        DB::listen(function () use (&$queries) {
            $queries++;
        });

        $student->readinessBreakdown();
        $afterFirstCall = $queries;
        $this->assertGreaterThan(0, $afterFirstCall, 'sanity check: the first call actually hit the database');

        $student->readinessScore();
        $student->readinessTier();
        $student->practiceScore();

        $this->assertSame(
            $afterFirstCall,
            $queries,
            'readinessScore()/readinessTier()/practiceScore() must reuse the already-computed breakdown instead of re-querying'
        );
    }
}
