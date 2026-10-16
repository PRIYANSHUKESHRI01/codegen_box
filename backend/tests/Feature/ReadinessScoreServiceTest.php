<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Contest;
use App\Models\Hackathon;
use App\Models\Interview;
use App\Models\SoftSkillAssessment;
use App\Models\User;
use App\Services\ReadinessScoreService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use LogicException;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * Readiness Score v3 — ONE score, the same rules for every student: what they
 * actually did on AptRun across interviews, practice, the Learning Centre, soft
 * skills, contests, scheduled events and day-to-day consistency. Anything a hiring
 * partner posted never counts.
 */
class ReadinessScoreServiceTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    private function service(): ReadinessScoreService
    {
        return app(ReadinessScoreService::class);
    }

    /** @return array<string, array> the breakdown's components keyed by key */
    private function components(User $student): array
    {
        return collect($this->service()->breakdown($student)['components'])->keyBy('key')->all();
    }

    public function test_a_student_who_has_done_nothing_scores_zero_everywhere(): void
    {
        $breakdown = $this->service()->breakdown($this->readinessStudent());

        $this->assertSame(0, $breakdown['score']);
        $this->assertSame('Needs Training', $breakdown['tier']);
        $this->assertSame(
            ['interview_performance', 'practice_depth', 'learning_centre', 'soft_skills', 'contests', 'participation', 'consistency'],
            array_column($breakdown['components'], 'key')
        );
        $this->assertSame([0], array_unique(array_column($breakdown['components'], 'score')));
        $this->assertNotEmpty($breakdown['next_steps']);
        $this->assertStringContainsString('mock interview', $breakdown['next_steps'][0]);
    }

    public function test_the_weights_add_up_to_exactly_one_hundred(): void
    {
        $this->assertSame(100, array_sum(config('readiness.weights')));
        $this->assertSame(100, array_sum(array_column($this->service()->breakdown($this->readinessStudent())['components'], 'weight_percent')));
    }

    public function test_a_broken_weight_edit_fails_loudly_instead_of_scoring_above_100(): void
    {
        config(['readiness.weights.ai_interview' => 30]);

        $this->expectException(LogicException::class);
        $this->service()->breakdown($this->readinessStudent());
    }

    public function test_college_is_irrelevant_two_students_with_identical_activity_score_identically(): void
    {
        $college = College::create(['name' => 'Apex', 'short_code' => 'APEX1', 'city' => 'X', 'state' => 'Y', 'tier' => 'Academic Enterprise', 'placement_rate' => 80]);
        $withCollege = $this->readinessStudent(['college_id' => $college->id, 'cgpa' => 9.8, 'backlogs' => 0]);
        $independent = $this->readinessStudent(['college_id' => null, 'cgpa' => null, 'backlogs' => null]);

        foreach ([$withCollege, $independent] as $student) {
            $this->scoredInterview($student, 80);
            $this->softSkillResult($student, 70);
        }

        $this->assertSame(
            $this->service()->breakdown($withCollege)['score'],
            $this->service()->breakdown($independent)['score'],
            'a perfect CGPA must not move the score — the college student gets no head start'
        );
    }

    public function test_cgpa_and_backlogs_are_not_part_of_the_score(): void
    {
        $student = $this->readinessStudent(['cgpa' => 10, 'backlogs' => 0]);

        $this->assertSame(0, $this->service()->breakdown($student)['score']);
    }

    // ───────────────────────────── the components ─────────────────────────────

    public function test_one_great_interview_earns_half_credit_and_three_earn_full_credit(): void
    {
        $student = $this->readinessStudent();

        $this->scoredInterview($student, 90, at: now()->subDays(3));
        $this->assertSame(45, $this->components($student)['interview_performance']['score'], 'one attempt at 90% is worth half');

        $this->scoredInterview($student, 90, at: now()->subDays(2));
        $this->assertSame(68, $this->components($student)['interview_performance']['score'], 'two attempts earn three quarters of the credit');

        $this->scoredInterview($student, 90, at: now()->subDay());
        $this->assertSame(90, $this->components($student)['interview_performance']['score'], 'three is a pattern: full credit');
    }

    public function test_only_the_newest_five_interviews_count(): void
    {
        $student = $this->readinessStudent();

        foreach ([10, 10, 100, 100, 100, 100, 100] as $i => $score) { // oldest first
            $this->scoredInterview($student, $score, at: now()->subDays(20 - $i));
        }

        $this->assertSame(100, $this->components($student)['interview_performance']['score']);
    }

    public function test_work_older_than_the_recent_window_stops_counting(): void
    {
        $student = $this->readinessStudent();
        $this->scoredInterview($student, 100, at: now()->subDays(config('readiness.recent_days') + 10));

        $this->assertSame(0, $this->components($student)['interview_performance']['score']);
    }

    public function test_an_unscored_interview_does_not_count(): void
    {
        $student = $this->readinessStudent();
        $session = $this->scoredInterview($student, 90);
        $session->update(['composite_score_percent' => null, 'ai_scored_at' => null]);

        $this->assertSame(0, $this->components($student)['interview_performance']['score']);
    }

    public function test_the_learning_centre_shares_its_points_across_speaking_listening_and_vocabulary(): void
    {
        $student = $this->readinessStudent();

        foreach (range(1, 3) as $i) {
            $this->speakingScore($student, 100, now()->subDays($i));
        }
        $this->assertSame(40, $this->components($student)['learning_centre']['score'], 'speaking alone is 40% of the component');

        foreach (range(1, 3) as $i) {
            $this->listeningScore($student, 100, now()->subDays($i));
            $this->vocabularyScore($student, 100, now()->subDays($i));
        }
        $this->assertSame(100, $this->components($student)['learning_centre']['score']);
        $this->assertSame(15.0, (float) $this->components($student)['learning_centre']['contribution']);
    }

    public function test_the_learning_centre_next_step_names_the_module_with_no_score(): void
    {
        // Strong everywhere, then the listening record removed — the one real gap left.
        $student = $this->strongStudent();
        DB::table('listening_attempts')->where('user_id', $student->id)->delete();

        $steps = implode(' | ', $this->service()->breakdown($student)['next_steps']);

        $this->assertStringContainsString('Listening Lab', $steps);
    }

    public function test_soft_skills_score_from_recent_completed_tests(): void
    {
        $student = $this->readinessStudent();

        $this->softSkillResult($student, 80);
        $this->softSkillResult($student, 80);

        $this->assertSame(80, $this->components($student)['soft_skills']['score']);
    }

    public function test_contests_score_by_the_share_of_points_won(): void
    {
        $student = $this->readinessStudent();
        foreach ([1, 2, 3] as $day) {
            $this->finishedContest([$student->id => 150], Contest::CONTEST_TYPE_DAILY, 300, now()->subDays($day));
        }

        $this->assertSame(50, $this->components($student)['contests']['score']);
    }

    public function test_a_contest_rating_is_a_floor_under_the_contest_component(): void
    {
        $student = $this->readinessStudent();
        $student->forceFill(['current_rating' => 1700, 'rated_contests_count' => 3])->save();

        $this->assertSame(50, $this->components($student->fresh())['contests']['score'], '(1700-1200)/(2200-1200)');
    }

    public function test_a_contest_that_is_not_finalised_does_not_count_for_performance(): void
    {
        $student = $this->readinessStudent();
        $contest = $this->finishedContest([$student->id => 300]);
        $contest->update(['finalized_at' => null]);

        $this->assertSame(0, $this->components($student)['contests']['score']);
    }

    public function test_participation_counts_everything_scheduled_that_the_student_showed_up_for(): void
    {
        $student = $this->readinessStudent();
        $target = config('readiness.participation_target_points'); // 6

        $this->finishedContest([$student->id => 10]);                 // contest        +1
        $this->scoredInterview($student, 50);                         // interview      +1
        $this->softSkillResult($student, 50);                         // soft skill     +1
        $this->hackathonEntry($student, submitted: true);             // hackathon 1 + 3 = +4  → 7 points, capped

        $this->assertSame(100, $this->components($student)['participation']['score']);

        // And a smaller history lands part-way: a contest and a joined (not submitted) hackathon = 2 of 6.
        $lighter = $this->readinessStudent();
        $this->finishedContest([$lighter->id => 10]);
        $this->hackathonEntry($lighter);
        $this->assertSame((int) round(2 / $target * 100), $this->components($lighter)['participation']['score']);
    }

    public function test_a_project_lab_submission_is_worth_real_participation(): void
    {
        $student = $this->readinessStudent();
        $this->submittedProject($student);

        $this->assertSame(50, $this->components($student)['participation']['score'], '3 of 6 points');
    }

    public function test_consistency_is_the_share_of_the_target_number_of_active_days(): void
    {
        $student = $this->readinessStudent();
        $this->activeOnDays($student, 6);

        $this->assertSame(50, $this->components($student)['consistency']['score'], '6 of the 12 days that earn full marks');
    }

    public function test_several_things_on_one_day_are_one_active_day(): void
    {
        $student = $this->readinessStudent();
        $this->practiceSubmission($student, 'python', 'accepted', null, now()->subDay());
        $this->practiceSubmission($student, 'python', 'accepted', null, now()->subDay());
        $this->speakingScore($student, 80, now()->subDay());
        $this->scoredInterview($student, 80, at: now()->subDay());

        $this->assertStringContainsString('Active on 1 of the last 28 days', $this->components($student)['consistency']['detail']);
    }

    public function test_activity_outside_the_consistency_window_does_not_count(): void
    {
        $student = $this->readinessStudent();
        $this->practiceSubmission($student, 'python', 'accepted', null, now()->subDays(config('readiness.consistency_days') + 5));

        $this->assertSame(0, $this->components($student)['consistency']['score']);
    }

    public function test_a_strong_all_round_student_clears_the_vault_line_and_a_one_trick_student_does_not(): void
    {
        $strong = $this->strongStudent();

        // A student who is superb at exactly one thing.
        $specialist = $this->readinessStudent();
        foreach ([100, 100, 100, 100, 100] as $i => $score) {
            $this->scoredInterview($specialist, $score, at: now()->subDays($i + 1));
        }

        $this->assertGreaterThanOrEqual(60, $this->service()->breakdown($strong)['score']);
        $this->assertLessThan(60, $this->service()->breakdown($specialist)['score'], 'breadth is required: a perfect interview record alone is worth only its own 20 points');
        $this->assertTrue($this->service()->breakdown($strong)['vault']['qualifies']);
        $this->assertFalse($this->service()->breakdown($specialist)['vault']['qualifies']);
        $this->assertSame(60, $this->service()->breakdown($specialist)['vault']['threshold']);
    }

    // ───────────────────────────── hiring partners never count ─────────────────────────────

    public function test_a_hiring_partners_interview_never_counts(): void
    {
        $student = $this->readinessStudent();
        foreach (range(1, 3) as $i) {
            $this->scoredInterview($student, 100, Interview::INTERVIEW_TYPE_COMPANY_HIRING, now()->subDays($i));
        }

        $components = $this->components($student);

        $this->assertSame(0, $components['interview_performance']['score']);
        $this->assertSame(0, $components['participation']['score']);
        $this->assertSame(0, $components['consistency']['score']);
    }

    public function test_a_hiring_partners_contest_never_counts(): void
    {
        $student = $this->readinessStudent();
        $this->finishedContest([$student->id => 300], Contest::CONTEST_TYPE_COMPANY_HIRING);

        $components = $this->components($student);

        $this->assertSame(0, $components['contests']['score']);
        $this->assertSame(0, $components['participation']['score']);
        $this->assertSame(0, $components['consistency']['score']);
    }

    public function test_a_hiring_partners_soft_skills_test_never_counts(): void
    {
        $student = $this->readinessStudent();
        $this->softSkillResult($student, 100, SoftSkillAssessment::TYPE_COMPANY);
        $this->softSkillResult($student, 100, SoftSkillAssessment::TYPE_COMPANY);

        $components = $this->components($student);

        $this->assertSame(0, $components['soft_skills']['score']);
        $this->assertSame(0, $components['participation']['score']);
    }

    public function test_a_hiring_partners_hackathon_never_counts(): void
    {
        $student = $this->readinessStudent();
        $this->hackathonEntry($student, Hackathon::HOST_COMPANY, submitted: true);

        $this->assertSame(0, $this->components($student)['participation']['score']);
    }

    public function test_what_a_tpo_scheduled_does_count(): void
    {
        $student = $this->readinessStudent();
        $this->finishedContest([$student->id => 300], Contest::CONTEST_TYPE_TPO_MOCK);
        $this->scoredInterview($student, 100, Interview::INTERVIEW_TYPE_TPO_MOCK);
        $this->softSkillResult($student, 100, SoftSkillAssessment::TYPE_TPO_MOCK);

        $components = $this->components($student);

        $this->assertGreaterThan(0, $components['contests']['score']);
        $this->assertGreaterThan(0, $components['interview_performance']['score']);
        $this->assertGreaterThan(0, $components['soft_skills']['score']);
        $this->assertGreaterThan(0, $components['participation']['score']);
    }

    public function test_a_cancelled_contest_or_unpublished_hackathon_does_not_count(): void
    {
        $student = $this->readinessStudent();
        $this->finishedContest([$student->id => 300])->update(['status' => Contest::STATUS_CANCELLED]);
        $this->hackathonEntry($student, status: Hackathon::STATUS_CANCELLED);

        $components = $this->components($student);

        $this->assertSame(0, $components['contests']['score']);
        $this->assertSame(0, $components['participation']['score']);
    }

    // ───────────────────────────── one code path, cheap in bulk ─────────────────────────────

    public function test_scoring_many_students_matches_scoring_each_alone(): void
    {
        $students = [$this->strongStudent(), $this->readinessStudent(), $this->readinessStudent()];
        $this->scoredInterview($students[2], 70);
        $this->finishedContest([$students[2]->id => 120]);

        $bulk = $this->service()->compute($students);

        foreach ($students as $student) {
            $this->assertEquals($this->service()->breakdown($student), $bulk[$student->id]['breakdown']);
        }
    }

    public function test_a_whole_cohort_costs_a_fixed_number_of_queries(): void
    {
        $count = function (int $students): int {
            $cohort = collect(range(1, $students))->map(fn () => $this->readinessStudent());
            $cohort->each(fn (User $s) => $this->scoredInterview($s, 70));

            $queries = 0;
            DB::listen(function () use (&$queries) {
                $queries++;
            });
            $this->service()->compute($cohort);

            return $queries;
        };

        $few = $count(2);
        $many = $count(30);

        $this->assertSame($few, $many, 'the number of queries must not grow with the number of students');
        $this->assertLessThan(25, $many);
    }

    public function test_repeated_calls_on_the_same_instance_are_memoized_and_never_requery(): void
    {
        $student = $this->readinessStudent();

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

    public function test_every_component_explains_itself(): void
    {
        foreach ($this->service()->breakdown($this->strongStudent())['components'] as $component) {
            $this->assertNotSame('', $component['detail'], "{$component['key']} must say what it is made of");
        }
    }
}
