<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\User;
use App\Services\ReadinessScoreService;
use App\Services\StudentCohortService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\CreatesCodingActivityFixtures;
use Tests\TestCase;

/**
 * The Student Cohort roster as a TPO relies on it: every row carries real
 * progress signals (activation, last practice, solved counts, engagement) and
 * the student's language profile; the whole roster is computed in a fixed
 * handful of queries no matter how big the college is; the bulk readiness path
 * agrees exactly with the one-student path; and none of it ever crosses a
 * college (or, for a coordinator, a section) boundary.
 */
class StudentCohortProgressTest extends TestCase
{
    use CreatesCodingActivityFixtures;
    use RefreshDatabase;

    private College $college;

    private User $tpo;

    protected function setUp(): void
    {
        parent::setUp();

        $this->college = College::create(['name' => 'Progress College', 'short_code' => 'PC']);
        $this->tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $this->college->id]);
    }

    private function student(array $attributes = []): User
    {
        return User::factory()->create(array_merge([
            'role' => User::ROLE_USER,
            'college_id' => $this->college->id,
            'must_change_password' => false,
        ], $attributes));
    }

    private function cohort(): array
    {
        Sanctum::actingAs($this->tpo);

        return collect($this->getJson('/api/tpo/students/cohort')->assertOk()->json('students'))->keyBy('id')->all();
    }

    public function test_each_row_says_how_engaged_the_student_is(): void
    {
        $pending = $this->student(['must_change_password' => true]);
        $notStarted = $this->student();
        $active = $this->student();
        $slipping = $this->student();
        $dormant = $this->student();

        $this->practiceSubmission($active, 'python', 'accepted', null, now()->subDays(2));
        $this->practiceSubmission($slipping, 'python', 'accepted', null, now()->subDays(12));
        $this->practiceSubmission($dormant, 'python', 'accepted', null, now()->subDays(40));

        $rows = $this->cohort();

        $this->assertSame('pending_activation', $rows[$pending->id]['activity']['engagement']);
        $this->assertFalse($rows[$pending->id]['activated']);
        $this->assertSame('not_started', $rows[$notStarted->id]['activity']['engagement']);
        $this->assertTrue($rows[$notStarted->id]['activated']);
        $this->assertSame('active', $rows[$active->id]['activity']['engagement']);
        $this->assertSame(2, $rows[$active->id]['activity']['days_since_practice']);
        $this->assertSame('slipping', $rows[$slipping->id]['activity']['engagement']);
        $this->assertSame('dormant', $rows[$dormant->id]['activity']['engagement']);
    }

    public function test_a_contest_attempt_counts_as_recent_practice(): void
    {
        $contestOnly = $this->student();
        $this->contestAttempt($contestOnly, 'cpp', 'wrong_answer', null, now()->subDay());

        $this->assertSame('active', $this->cohort()[$contestOnly->id]['activity']['engagement']);
    }

    public function test_a_row_carries_solved_counts_by_difficulty(): void
    {
        $student = $this->student();
        $this->practiceSubmission($student, 'python', 'accepted', $this->makeProblem('easy'));
        $this->practiceSubmission($student, 'python', 'accepted', $this->makeProblem('easy'));
        $this->practiceSubmission($student, 'python', 'accepted', $this->makeProblem('hard'));
        $this->practiceSubmission($student, 'python', 'wrong_answer', $this->makeProblem('medium')); // not solved

        $this->assertSame(['total' => 3, 'easy' => 2, 'medium' => 0, 'hard' => 1], $this->cohort()[$student->id]['solved']);
    }

    public function test_a_row_carries_the_students_language_profile_and_what_they_said_in_onboarding(): void
    {
        $student = $this->student(['primary_language' => 'java', 'preferred_languages' => ['java'], 'onboarding_completed_at' => now()]);
        $this->practiceHistory($student, 'python', accepted: 7, wrong: 1);
        $this->practiceHistory($student, 'java', accepted: 1, wrong: 7);

        $row = $this->cohort()[$student->id];

        $this->assertTrue($row['onboarded']);
        $this->assertSame('python', $row['coding']['primary_language']);
        $this->assertSame('java', $row['coding']['stated_language']);
        $this->assertTrue($row['coding']['mismatch']);
        $this->assertSame(['java'], $row['coding']['needs_work']);
        $this->assertSame(['python', 'java'], array_column($row['coding']['languages'], 'language'));
        $this->assertSame(88, $row['coding']['languages'][0]['acceptance_rate']);
    }

    public function test_a_student_who_has_not_started_has_no_language_data_rather_than_invented_data(): void
    {
        $student = $this->student();
        $row = $this->cohort()[$student->id];

        $this->assertNull($row['coding']['primary_language']);
        $this->assertNull($row['coding']['stated_language']);
        $this->assertSame([], $row['coding']['languages']);
        $this->assertSame([], $row['coding']['needs_work']);
        $this->assertFalse($row['onboarded']);
        $this->assertNull($row['activity']['last_practice_at']);
        $this->assertNull($row['activity']['days_since_practice']);
    }

    public function test_last_seen_is_reported_when_known(): void
    {
        $seen = $this->student();
        $seen->forceFill(['last_seen_at' => now()->subHours(3)])->save();
        $neverSeen = $this->student();

        $rows = $this->cohort();

        $this->assertNotNull($rows[$seen->id]['activity']['last_seen_at']);
        $this->assertNull($rows[$neverSeen->id]['activity']['last_seen_at']);
    }

    public function test_only_this_colleges_students_appear_and_their_language_data_does_not_leak(): void
    {
        $other = College::create(['name' => 'Other College', 'short_code' => 'OC']);
        $outsider = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $other->id]);
        $this->practiceHistory($outsider, 'rust', accepted: 9);
        $own = $this->student();
        $this->practiceHistory($own, 'python', accepted: 2);

        $rows = $this->cohort();

        $this->assertArrayNotHasKey($outsider->id, $rows);
        $this->assertSame(['python'], array_column($rows[$own->id]['coding']['languages'], 'language'));
    }

    public function test_the_roster_costs_the_same_number_of_queries_for_a_few_students_or_many(): void
    {
        $countQueries = function (): int {
            Sanctum::actingAs($this->tpo);
            $queries = 0;
            DB::listen(function () use (&$queries) {
                $queries++;
            });
            $this->getJson('/api/tpo/students/cohort')->assertOk();

            return $queries;
        };

        foreach (range(1, 3) as $_) {
            $s = $this->student();
            $this->practiceHistory($s, 'python', accepted: 1);
        }
        $few = $countQueries();

        foreach (range(1, 45) as $_) {
            $s = $this->student();
            $this->practiceHistory($s, 'java', accepted: 1, wrong: 1);
        }
        $many = $countQueries();

        $this->assertSame($few, $many, "48 students took {$many} queries, 3 took {$few} — the roster must not query per student");
        $this->assertLessThan(40, $many, 'a whole roster should be a fixed handful of queries');
    }

    public function test_bulk_readiness_matches_scoring_each_student_on_their_own(): void
    {
        $makeInterview = fn () => Interview::create([
            'title' => 'Mock', 'slug' => Interview::uniqueSlug('Mock'), 'status' => Interview::STATUS_PUBLISHED,
            'interview_type' => Interview::INTERVIEW_TYPE_GENERAL, 'is_mock' => true,
        ]);

        $easy = $this->makeProblem('easy', ['arrays', 'strings']);
        $medium = $this->makeProblem('medium', ['graphs']);
        $hard = $this->makeProblem('hard', ['dp', 'arrays']);
        $this->makeProblem('hard', ['trees']); // never solved by anyone — still part of the catalogue

        $blank = $this->student(['cgpa' => null, 'backlogs' => null]);

        $solver = $this->student(['cgpa' => 8.2, 'backlogs' => 0]);
        $this->practiceSubmission($solver, 'python', 'accepted', $easy);
        $this->practiceSubmission($solver, 'python', 'accepted', $medium);
        $this->practiceSubmission($solver, 'java', 'accepted', $hard);
        $this->practiceSubmission($solver, 'python', 'wrong_answer', $this->makeProblem('easy'));

        $consistent = $this->student(['cgpa' => 6.0, 'backlogs' => 2]);
        foreach ([0, 1, 3, 5] as $daysAgo) {          // 4 of the last 7 days with >= 3 solved each
            foreach (range(1, 3) as $_) {
                $this->practiceSubmission($consistent, 'cpp', 'accepted', $this->makeProblem('easy'), now()->subDays($daysAgo));
            }
        }
        foreach (range(1, 2) as $_) {                  // a day with only 2 does not count
            $this->practiceSubmission($consistent, 'cpp', 'accepted', $this->makeProblem('easy'), now()->subDays(2));
        }

        $interviewed = $this->student(['cgpa' => 9.0, 'backlogs' => 1]);
        $interviewed->forceFill(['current_rating' => 1700, 'rated_contests_count' => 3])->save();
        foreach ([60, 70, 80, 90, 100, 20, 10] as $i => $score) {   // only the 5 most recent count
            InterviewSession::create([
                'interview_id' => $makeInterview()->id, 'user_id' => $interviewed->id, 'status' => InterviewSession::STATUS_COMPLETED,
                'started_at' => now()->subDays(20 - $i), 'completed_at' => now()->subDays(20 - $i), 'composite_score_percent' => $score, 'ai_scored_at' => now(),
            ]);
        }

        $ids = [$blank->id, $solver->id, $consistent->id, $interviewed->id];

        // Ground truth: each student scored on their own, the original way.
        $alone = collect($ids)->mapWithKeys(fn (int $id) => [$id => User::find($id)->readinessBreakdown()]);
        $alonePractice = collect($ids)->mapWithKeys(fn (int $id) => [$id => User::find($id)->practiceScore()]);

        // The bulk path, on fresh instances.
        $primed = User::whereIn('id', $ids)->get();
        app(ReadinessScoreService::class)->prime($primed);

        foreach ($primed as $student) {
            $this->assertEquals($alone[$student->id], $student->readinessBreakdown(), "readiness breakdown differs for student {$student->id}");
            $this->assertSame($alonePractice[$student->id], $student->practiceScore(), "practice score differs for student {$student->id}");
        }

        // Sanity: the fixtures really do produce different, non-trivial scores.
        $this->assertGreaterThan(1, count(array_unique($alone->pluck('score')->all())));
    }

    public function test_priming_makes_later_reads_free(): void
    {
        $students = collect(range(1, 6))->map(fn () => $this->student());
        $students->each(fn (User $s) => $this->practiceHistory($s, 'python', accepted: 2));
        $fresh = User::whereIn('id', $students->pluck('id'))->get();

        app(ReadinessScoreService::class)->prime($fresh);

        $queries = 0;
        DB::listen(function () use (&$queries) {
            $queries++;
        });
        $fresh->each(fn (User $s) => [$s->readinessScore(), $s->readinessTier(), $s->practiceScore()]);

        $this->assertSame(0, $queries);
    }

    public function test_the_cohort_row_for_a_single_student_matches_their_row_in_the_full_roster(): void
    {
        $student = $this->student();
        $this->practiceHistory($student, 'go', accepted: 3, wrong: 1);
        $this->student(); // someone else in the roster

        $fromRoster = $this->cohort()[$student->id];
        $service = app(StudentCohortService::class);
        $single = $service->payload(User::find($student->id), $service->activeMappingsFor($this->college->id));

        $this->assertEquals($fromRoster, json_decode(json_encode($single), true));
    }

    public function test_a_coordinator_sees_the_same_progress_signals_for_their_own_section_only(): void
    {
        $coordinator = User::factory()->create(['role' => User::ROLE_SECTION_COORDINATOR, 'college_id' => $this->college->id, 'section' => 'A']);
        $mine = $this->student(['section' => 'A']);
        $theirs = $this->student(['section' => 'B']);
        $this->practiceHistory($mine, 'python', accepted: 3);
        $this->practiceHistory($theirs, 'rust', accepted: 3);

        Sanctum::actingAs($coordinator);
        $rows = collect($this->getJson('/api/coordinator/students')->assertOk()->json('students'))->keyBy('id');

        $this->assertTrue($rows->has($mine->id));
        $this->assertFalse($rows->has($theirs->id));
        $this->assertSame('python', $rows[$mine->id]['coding']['primary_language']);
        $this->assertSame('active', $rows[$mine->id]['activity']['engagement']);
    }

    public function test_the_student_report_includes_the_language_breakdown(): void
    {
        $student = $this->student(['primary_language' => 'java', 'preferred_languages' => ['java']]);
        $this->practiceHistory($student, 'python', accepted: 6, wrong: 1);
        Sanctum::actingAs($this->tpo);

        $report = $this->getJson("/api/tpo/students/{$student->id}/report")->assertOk();

        $report->assertJsonPath('languages.actual_primary_language', 'python')
            ->assertJsonPath('languages.stated.primary_language', 'java')
            ->assertJsonPath('languages.mismatch', true)
            ->assertJsonPath('languages.languages.0.language', 'python')
            ->assertJsonPath('languages.languages.0.attempts', 7)
            ->assertJsonPath('student.activated', true);
    }

    public function test_a_tpo_cannot_read_another_colleges_student_report_languages(): void
    {
        $other = College::create(['name' => 'Elsewhere', 'short_code' => 'EL']);
        $outsider = User::factory()->create(['role' => User::ROLE_USER, 'college_id' => $other->id]);
        $this->practiceHistory($outsider, 'rust', accepted: 3);
        Sanctum::actingAs($this->tpo);

        $this->getJson("/api/tpo/students/{$outsider->id}/report")->assertNotFound();
    }

    public function test_the_placement_reports_carry_the_same_per_student_progress(): void
    {
        $student = $this->student();
        $this->practiceHistory($student, 'python', accepted: 4);
        Sanctum::actingAs($this->tpo);

        $row = collect($this->getJson('/api/tpo/reports/data')->assertOk()->json('students'))->firstWhere('id', $student->id);

        $this->assertSame('python', $row['coding']['primary_language']);
        $this->assertSame(4, $row['solved']['total']);
        $this->assertSame('active', $row['activity']['engagement']);
        $this->assertSame($this->cohort()[$student->id]['readiness_score'], $row['readiness_score']);
    }
}
