<?php

namespace Tests\Feature;

use App\Models\CorePracticeAnswer;
use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\CoreTest;
use App\Models\CoreTestSession;
use App\Models\Discipline;
use App\Models\User;
use App\Models\VaultProfile;
use App\Services\ReadinessScoreService;
use App\Services\Vault\VaultPayloadBuilder;
use App\Support\BranchCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\CreatesReadinessFixtures;
use Tests\TestCase;

/**
 * Readiness v4: weighting profiles. A non-CS student whose branch's Core Prep is live, and who chose to lead with it,
 * is scored on technical standing instead of coding and contest points; everyone else is scored exactly as before
 * (the golden test), and nobody loses ground on go-live day (the grace rule).
 */
class ReadinessProfilesTest extends TestCase
{
    use CreatesReadinessFixtures;
    use RefreshDatabase;

    private int $seq = 0;

    protected function setUp(): void
    {
        parent::setUp();

        // These tests are about HOW a core profile scores. Whether Core Prep counts at all is a switch that ships OFF
        // (see test_core_prep_does_not_count_towards_readiness_by_default below), so turn it on for the mechanics.
        config(['readiness.core.counts_towards_score' => true]);
    }

    private function service(): ReadinessScoreService
    {
        return app(ReadinessScoreService::class);
    }

    /** @return array<string, array> */
    private function components(User $student): array
    {
        return collect($this->service()->breakdown($student)['components'])->keyBy('key')->all();
    }

    private function live(string $discipline = 'ece', ?Carbon $since = null): void
    {
        Discipline::where('code', $discipline)->update(['is_live' => true, 'live_at' => $since ?? now()->subDays(90)]);
        app(BranchCatalog::class)->flush();
    }

    /** A published practice+test question in the discipline, and a published general test containing it. */
    private function bank(string $discipline = 'ece'): array
    {
        $subject = CoreSubject::where('discipline_code', $discipline)->orderBy('id')->firstOrFail();
        $n = ++$this->seq;

        $question = CoreQuestion::create([
            'external_id' => "RP-{$n}", 'discipline_code' => $discipline, 'subject_id' => $subject->id, 'topic_id' => $subject->topics()->first()->id, 'type' => 'mcq_single',
            'stem' => "Question {$n}?", 'options' => [['id' => 'a', 'text' => 'right'], ['id' => 'b', 'text' => 'wrong']],
            'correct' => ['a'], 'marks' => 1, 'negative_marks' => 0.25, 'difficulty' => 'medium', 'usage' => 'both', 'status' => 'published',
        ]);

        $test = CoreTest::create(['slug' => "rp-test-{$n}", 'title' => "Paper {$n}", 'discipline_code' => $discipline, 'status' => 'published', 'test_type' => 'general', 'duration_minutes' => 30]);
        DB::table('core_test_questions')->insert(['core_test_id' => $test->id, 'core_question_id' => $question->id, 'position' => 1, 'created_at' => now(), 'updated_at' => now()]);

        return [$question, $test];
    }

    private function student(string $branch = 'ECE', ?string $track = 'core_first', array $over = []): User
    {
        return $this->readinessStudent(['branch' => $branch, 'track_focus' => $track] + $over);
    }

    private function finishedTest(User $student, CoreTest $test, float $percent, ?Carbon $at = null): CoreTestSession
    {
        $at ??= now()->subDays(2);

        return CoreTestSession::create([
            'core_test_id' => $test->id, 'user_id' => $student->id, 'attempt_number' => CoreTestSession::where('core_test_id', $test->id)->where('user_id', $student->id)->count() + 1, 'status' => 'completed',
            'started_at' => $at->copy()->subMinutes(30), 'deadline_at' => $at, 'completed_at' => $at, 'score' => $percent, 'max_score' => 100, 'score_percent' => $percent,
        ]);
    }

    /** @param  array<int, Carbon>  $days  one correct answer per entry, on that day */
    private function practised(User $student, CoreQuestion $question, array $days): void
    {
        foreach ($days as $day) {
            DB::table('core_practice_answers')->insert([
                'user_id' => $student->id, 'core_question_id' => $question->id, 'subject_id' => $question->subject_id, 'topic_id' => $question->topic_id,
                'is_correct' => true, 'created_at' => $day, 'updated_at' => $day,
            ]);
        }
    }

    // ───────────────────────────── software students are untouched ─────────────────────────────

    public function test_a_software_students_breakdown_is_exactly_what_v3_gave(): void
    {
        $this->live('ece');
        $this->bank('ece');

        $students = [$this->student('CSE', null), $this->student('IT', null), $this->student('Some Odd Branch', null), $this->readinessStudent(['branch' => null])];

        foreach ($students as $student) {
            $this->scoredInterview($student, 80);
            $this->softSkillResult($student, 70);
        }

        $first = $this->service()->breakdown($students[0]);

        $this->assertSame('software', $first['profile']);
        $this->assertArrayNotHasKey('grace_until', $first);
        $this->assertSame(
            ['interview_performance', 'practice_depth', 'learning_centre', 'soft_skills', 'contests', 'participation', 'consistency'],
            array_column($first['components'], 'key')
        );
        $this->assertSame([20, 15, 15, 10, 15, 10, 15], array_column($first['components'], 'weight_percent'));
        $by = collect($first['components'])->keyBy('key');
        $this->assertSame(8.0, $by['interview_performance']['contribution'], 'one 80% interview is half credit of a 20-point component');
        $this->assertSame(3.5, $by['soft_skills']['contribution']);

        // The same activity scores identically whatever the branch — and Core Prep being live elsewhere changes nothing.
        foreach (array_slice($students, 1) as $other) {
            $this->assertEquals($first, $this->service()->breakdown($other));
        }
    }

    public function test_the_weights_of_every_profile_add_up_to_exactly_one_hundred(): void
    {
        $this->assertSame(100, array_sum(config('readiness.weights')));

        foreach (config('readiness.profiles') as $name => $weights) {
            $this->assertSame(100, array_sum($weights), $name);

            // core / balanced exist to score Core Prep; `general` is the weighting for a programme with no coding and has no such component.
            in_array($name, ['core', 'balanced'], true)
                ? $this->assertArrayHasKey('core_technical', $weights, $name)
                : $this->assertArrayNotHasKey('coding_practice', $weights, $name);
        }
    }

    public function test_nobody_is_moved_onto_a_core_profile_unless_all_the_conditions_hold(): void
    {
        config(['readiness.core.grace_days' => 0]);

        // Core Prep is not live for ECE yet: whatever the student chose, they are scored as always.
        [$question] = $this->bank('ece');
        $notLive = $this->student('ECE', 'core_first');
        $this->assertSame('software', $this->service()->breakdown($notLive)['profile']);

        $this->live('ece');

        $this->assertSame('core', $this->service()->breakdown($this->student('ECE', 'core_first'))['profile']);
        $this->assertSame('balanced', $this->service()->breakdown($this->student('ECE', 'balanced'))['profile']);
        $this->assertSame('software', $this->service()->breakdown($this->student('ECE', 'it_first'))['profile'], 'leading with IT keeps the software weights');
        $this->assertSame('software', $this->service()->breakdown($this->student('ECE', null))['profile'], 'no track chosen yet');
        $this->assertSame('software', $this->service()->breakdown($this->student('CSE', 'core_first'))['profile'], 'a CSE student has no core profile');
        $this->assertSame('software', $this->service()->breakdown($this->student('Mechanical', 'core_first'))['profile'], 'Mechanical is not live');

        // Live, but with nothing published, the family does not exist for the student — and so cannot change their score.
        $question->update(['status' => 'retired']);
        $this->assertSame('software', $this->service()->breakdown($this->student('ECE', 'core_first'))['profile']);
    }

    // ───────────────────────────── Core Prep is out of the score unless switched on ─────────────────────────────

    public function test_core_prep_does_not_count_towards_readiness_by_default(): void
    {
        config(['readiness.core.counts_towards_score' => false, 'readiness.core.grace_days' => 0]);
        $this->live('ece');
        [$question, $test] = $this->bank('ece');

        $student = $this->student('ECE', 'core_first');
        $before = $this->service()->breakdown($student);

        // A great Core record: a 95 % test and a mastered topic.
        $this->finishedTest($student, $test, 95);
        $this->practised($student, $question, array_fill(0, 12, now()->subDay()));
        $student = $student->fresh();
        $after = $this->service()->breakdown($student);

        $this->assertSame('software', $after['profile'], 'a live branch + core-first no longer moves anyone onto a core profile');
        $this->assertNotContains('core_technical', array_column($after['components'], 'key'));
        $this->assertSame($before['score'], $after['score'], 'Core tests and practice change nothing about the score');
        $this->assertSame($before['components'], $after['components']);
    }

    public function test_core_practice_does_not_make_a_student_active_or_consistent_while_core_is_out_of_the_score(): void
    {
        config(['readiness.core.counts_towards_score' => false]);
        $this->live('ece');
        [$question] = $this->bank('ece');

        $student = $this->student('ECE', 'core_first');
        $this->practised($student, $question, array_map(fn (int $d) => now()->subDays($d), range(1, 9)));

        $components = $this->components($student);

        $this->assertSame(0, $components['participation']['score']);
        $this->assertSame(0, $components['consistency']['score']);
    }

    public function test_the_vault_payload_carries_no_core_strengths_while_core_is_out_of_the_score(): void
    {
        config(['readiness.core.counts_towards_score' => false]);
        $this->live('ece');
        [$question] = $this->bank('ece');

        $student = $this->student('Electronics & Communication', 'core_first');
        $this->practised($student, $question, array_fill(0, 12, now()->subDay()));
        $profile = VaultProfile::create(['user_id' => $student->id]);
        $profile->forceFill(['readiness_score' => 80, 'readiness_tier' => 'Placement Ready', 'readiness_components' => []])->save();

        $this->assertNull(app(VaultPayloadBuilder::class)->build($profile->fresh())['core']);
    }

    // ───────────────────────────── the core profile ─────────────────────────────

    public function test_a_core_first_student_is_scored_on_technical_standing(): void
    {
        config(['readiness.core.grace_days' => 0]);
        $this->live('ece');
        [$question, $test] = $this->bank('ece');

        $student = $this->student('ECE', 'core_first');
        $this->finishedTest($student, $test, 80);
        $this->practised($student, $question, array_fill(0, 5, now()->subDay())); // 5 correct on the one topic: mastered

        $breakdown = $this->service()->breakdown($student);

        $this->assertSame('core', $breakdown['profile']);
        $this->assertSame(
            ['interview_performance', 'core_technical', 'learning_centre', 'soft_skills', 'participation', 'consistency'],
            array_column($breakdown['components'], 'key')
        );
        $this->assertSame(100, array_sum(array_column($breakdown['components'], 'weight_percent')));

        $core = collect($breakdown['components'])->firstWhere('key', 'core_technical');
        // one 80% test earns half credit (40) at 60%, the single topic is mastered (100) at 40%: 64
        $this->assertSame(64, $core['score']);
        $this->assertSame(30, $core['weight_percent']);
        $this->assertStringContainsString('1 of 1 topics mastered', $core['detail']);
        $this->assertStringContainsString('1 recent Core test', $core['detail']);
    }

    public function test_a_balanced_student_keeps_some_coding_and_contest_weight(): void
    {
        config(['readiness.core.grace_days' => 0]);
        $this->live('ece');
        $this->bank('ece');

        $breakdown = $this->service()->breakdown($this->student('ECE', 'balanced'));

        $this->assertSame('balanced', $breakdown['profile']);
        $this->assertSame(
            ['interview_performance', 'core_technical', 'practice_depth', 'learning_centre', 'soft_skills', 'contests', 'participation', 'consistency'],
            array_column($breakdown['components'], 'key')
        );
        $this->assertSame(100, array_sum(array_column($breakdown['components'], 'weight_percent')));
    }

    public function test_a_branch_with_no_published_test_is_not_capped_by_the_missing_test(): void
    {
        config(['readiness.core.grace_days' => 0]);
        $this->live('ece');
        [$question, $test] = $this->bank('ece');
        $test->update(['status' => 'draft']);

        $student = $this->student('ECE', 'core_first');
        $this->practised($student, $question, array_fill(0, 5, now()->subDay()));

        // Coverage alone carries the component: the one topic is mastered, so it is full marks.
        $this->assertSame(100, $this->components($student)['core_technical']['score']);
    }

    public function test_a_college_mock_test_counts_like_a_platform_test(): void
    {
        config(['readiness.core.grace_days' => 0]);
        $this->live('ece');
        [, $test] = $this->bank('ece');
        $mock = CoreTest::create(['slug' => 'mock-1', 'title' => 'College mock', 'discipline_code' => 'ece', 'status' => 'published', 'test_type' => 'tpo_mock', 'duration_minutes' => 30]);

        $student = $this->student('ECE', 'core_first');
        $this->finishedTest($student, $mock, 90, now()->subDays(3));
        $this->finishedTest($student, $test, 90, now()->subDays(2));

        $detail = $this->components($student)['core_technical']['detail'];
        $this->assertStringContainsString('2 recent Core tests', $detail);
    }

    // ───────────────────────────── the grace rule ─────────────────────────────

    public function test_nobody_drops_on_go_live_day_and_the_profile_decides_after_the_grace_period(): void
    {
        config(['readiness.core.grace_days' => 30]);
        $this->live('ece', now()); // switched on right now
        $this->bank('ece');

        // A core-first student who has so far only coded: the software weights are kinder to them than a core profile with no core work.
        $student = $this->student('ECE', 'core_first');
        $this->practiceHistory($student, 'python', 6);
        $this->scoredInterview($student, 90);

        $during = $this->service()->breakdown($student);
        $this->assertSame('software', $during['profile'], 'during the grace period the better of the two scores stands');
        $this->assertArrayHasKey('grace_until', $during);
        $softwareScore = $during['score'];

        // The same student, once the grace period has passed, is scored by their profile alone.
        $this->live('ece', now()->subDays(45));
        $after = $this->service()->breakdown($student);
        $this->assertSame('core', $after['profile']);
        $this->assertArrayNotHasKey('grace_until', $after);
        $this->assertLessThan($softwareScore, $after['score']);
    }

    public function test_the_grace_period_never_lowers_a_score_a_core_student_has_earned(): void
    {
        config(['readiness.core.grace_days' => 30]);
        $this->live('ece', now());
        [$question, $test] = $this->bank('ece');

        $student = $this->student('ECE', 'core_first');
        $this->finishedTest($student, $test, 100);
        $this->finishedTest($student, $test, 100, now()->subDay());
        $this->practised($student, $question, array_fill(0, 5, now()->subDay()));

        $breakdown = $this->service()->breakdown($student);

        $this->assertSame('core', $breakdown['profile'], 'their core work beats the software weights, so the profile stands');
        $this->assertArrayHasKey('grace_until', $breakdown);
    }

    // ───────────────────────────── core activity is activity ─────────────────────────────

    public function test_core_practice_and_tests_count_toward_consistency_and_participation(): void
    {
        config(['readiness.core.grace_days' => 0]);
        $this->live('ece');
        [$question, $test] = $this->bank('ece');

        // "IT first" keeps the software weights, but the work they do in Core Prep is still work.
        $student = $this->student('ECE', 'it_first');
        $this->practised($student, $question, [now()->subDays(1), now()->subDays(3), now()->subDays(5)]);
        $this->finishedTest($student, $test, 70, now()->subDays(8));

        $components = $this->components($student);

        $this->assertSame('software', $this->service()->breakdown($student)['profile']);
        $this->assertStringContainsString('Active on 4 of the last 28 days', $components['consistency']['detail']);
        $this->assertStringContainsString('1 event or project', $components['participation']['detail']);
    }

    // ───────────────────────────── robustness ─────────────────────────────

    public function test_a_student_loaded_with_a_column_list_is_still_scored_by_their_profile(): void
    {
        config(['readiness.core.grace_days' => 0]);
        $this->live('ece');
        $this->bank('ece');
        $full = $this->student('ECE', 'core_first');

        $partial = User::query()->select('id', 'name', 'role', 'current_rating', 'rated_contests_count')->findOrFail($full->id);

        $this->assertSame('core', $this->service()->breakdown($partial)['profile']);
    }

    public function test_a_mis_edited_profile_falls_back_to_the_software_weights_instead_of_failing(): void
    {
        config(['readiness.core.grace_days' => 0, 'readiness.profiles.core.core_technical' => 99]);
        $this->live('ece');
        $this->bank('ece');

        $breakdown = $this->service()->breakdown($this->student('ECE', 'core_first'));

        $this->assertSame('software', $breakdown['profile']);
        $this->assertSame(100, array_sum(array_column($breakdown['components'], 'weight_percent')));
    }

    public function test_scoring_a_roster_equals_scoring_each_student_alone(): void
    {
        config(['readiness.core.grace_days' => 0]);
        $this->live('ece');
        [$question, $test] = $this->bank('ece');

        $roster = [$this->student('CSE', null), $this->student('ECE', 'core_first'), $this->student('ECE', 'balanced'), $this->student('ECE', 'it_first'), $this->student('Mechanical', 'core_first')];
        foreach ($roster as $i => $student) {
            $this->scoredInterview($student, 60 + $i * 5);
        }
        $this->finishedTest($roster[1], $test, 85);
        $this->practised($roster[2], $question, array_fill(0, 5, now()->subDay()));

        $users = User::whereIn('id', collect($roster)->pluck('id'))->get()->keyBy('id');
        $bulk = $this->service()->compute($users->values());

        foreach ($roster as $student) {
            $alone = $this->service()->compute([User::findOrFail($student->id)]);
            $this->assertEquals($alone[$student->id]['breakdown'], $bulk[$student->id]['breakdown'], "student {$student->id}");
        }
    }

    // ───────────────────────────── cost ─────────────────────────────

    /** @return array<int, string> the SQL a callback ran */
    private function sqlOf(callable $work): array
    {
        $sql = [];
        DB::listen(function ($query) use (&$sql) {
            $sql[] = $query->sql;
        });
        $work();

        return $sql;
    }

    private function load(array $students): \Illuminate\Support\Collection
    {
        return User::whereIn('id', collect($students)->pluck('id'))->get();
    }

    public function test_a_roster_with_no_core_student_runs_no_core_query_at_all(): void
    {
        $this->live('ece');
        $this->bank('ece');
        $cse = $this->load([$this->student('CSE', null), $this->student('IT', null), $this->student('CSE', null)]);

        $sql = $this->sqlOf(fn () => $this->service()->compute($cse));

        $this->assertSame([], array_values(array_filter($sql, fn (string $q) => preg_match('/"core_[a-z_]+"/', $q) === 1)), 'an all-CSE college must pay nothing for Core Prep');
    }

    public function test_the_number_of_queries_does_not_grow_with_the_number_of_core_students(): void
    {
        config(['readiness.core.grace_days' => 0]);
        $this->live('ece');
        $this->bank('ece');

        $small = $this->load([$this->student('CSE', null), $this->student('ECE', 'core_first')]);
        $big = $this->load(array_merge([$this->student('CSE', null)], array_map(fn ($i) => $this->student('ECE', $i % 2 ? 'balanced' : 'core_first'), range(1, 12))));

        $a = count($this->sqlOf(fn () => $this->service()->compute($small)));
        $b = count($this->sqlOf(fn () => $this->service()->compute($big)));

        $this->assertSame($a, $b);
    }

    // ───────────────────────────── the Vault ─────────────────────────────

    public function test_the_vault_payload_carries_the_branch_the_profile_and_core_strengths(): void
    {
        config(['readiness.core.grace_days' => 0]);
        $this->live('ece');
        [$question] = $this->bank('ece');

        $student = $this->student('Electronics & Communication', 'core_first');
        $this->practised($student, $question, array_fill(0, 12, now()->subDay()));

        $profile = VaultProfile::create(['user_id' => $student->id]);
        $profile->forceFill(['readiness_score' => 80, 'readiness_tier' => 'Placement Ready', 'readiness_components' => [], 'readiness_profile' => 'core', 'readiness_version' => 4])->save();

        $payload = app(VaultPayloadBuilder::class)->build($profile->fresh());

        $this->assertSame('ece', $payload['discipline']);
        $this->assertSame('ece', $payload['branch_code']);
        $this->assertSame('core', $payload['readiness']['profile']);
        $this->assertSame(100, $payload['core']['subjects'][0]['accuracy_percent']);
        $this->assertSame(4, $payload['readiness']['version']);
    }

    public function test_a_software_students_vault_payload_gains_no_core_content(): void
    {
        $student = $this->student('CSE', null);
        $profile = VaultProfile::create(['user_id' => $student->id]);
        $profile->forceFill(['readiness_score' => 80, 'readiness_tier' => 'Placement Ready', 'readiness_components' => []])->save();

        $payload = app(VaultPayloadBuilder::class)->build($profile->fresh());

        $this->assertNull($payload['core']);
        $this->assertSame('software', $payload['readiness']['profile']);
        $this->assertSame('cse', $payload['discipline']);
    }
}
