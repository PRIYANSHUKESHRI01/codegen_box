<?php

namespace Tests\Feature;

use App\Models\College;
use App\Models\CorePracticeAnswer;
use App\Models\CoreQuestion;
use App\Models\CoreQuestionReport;
use App\Models\CoreSubject;
use App\Models\CoreTest;
use App\Models\CoreTestSession;
use App\Models\Discipline;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use App\Support\BranchCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * P4 of the multi-branch work: Core Prep for students — availability, practice (feedback, usage pools, modes,
 * plan limits), mastery, timed proctored tests (server clock, grading, negative marking, review), tenancy and the
 * regrade after a key fix.
 */
class CorePrepStudentTest extends TestCase
{
    use RefreshDatabase;

    private int $seq = 0;

    private function college(): College
    {
        $n = ++$this->seq;

        return College::create(['name' => "Core College {$n}", 'short_code' => "CC{$n}", 'tier' => 'Standard']);
    }

    private function student(string $branch = 'ECE', array $over = []): User
    {
        return User::factory()->create(['role' => User::ROLE_USER, 'branch' => $branch] + $over);
    }

    private function live(string $discipline = 'ece'): void
    {
        Discipline::where('code', $discipline)->update(['is_live' => true, 'live_at' => now()]);
        app(BranchCatalog::class)->flush();
    }

    private function subject(string $discipline = 'ece', string $code = 'analog_circuits'): CoreSubject
    {
        return CoreSubject::where('discipline_code', $discipline)->where('code', $code)->firstOrFail();
    }

    /** A published MCQ whose key is option "a". */
    private function question(array $over = [], string $discipline = 'ece', string $subject = 'analog_circuits'): CoreQuestion
    {
        $s = $this->subject($discipline, $subject);
        $n = ++$this->seq;

        return CoreQuestion::create(array_merge([
            'external_id' => "Q-{$n}", 'discipline_code' => $discipline, 'subject_id' => $s->id, 'topic_id' => $s->topics()->first()->id, 'type' => 'mcq_single',
            'stem' => "Question {$n}?", 'options' => [['id' => 'a', 'text' => 'right'], ['id' => 'b', 'text' => 'wrong 1'], ['id' => 'c', 'text' => 'wrong 2'], ['id' => 'd', 'text' => 'wrong 3']],
            'correct' => ['a'], 'marks' => 1, 'negative_marks' => 0.25, 'difficulty' => 'medium', 'usage' => 'both', 'status' => 'published',
            'explanation' => 'Because a is right.',
        ], $over));
    }

    private function seedBank(int $n = 6, string $discipline = 'ece', string $subject = 'analog_circuits'): void
    {
        for ($i = 0; $i < $n; $i++) {
            $this->question(['difficulty' => ['easy', 'medium', 'hard'][$i % 3]], $discipline, $subject);
        }
    }

    private function staff(): User
    {
        return User::factory()->create(['role' => User::ROLE_ADMIN_INTERNAL, 'permissions' => [User::PERM_CORE_PREP]]);
    }

    private function coderPlan(int $practice = 2, int $tries = 1): Plan
    {
        return Plan::create([
            'code' => 'coder', 'name' => 'Coder', 'audience' => Plan::AUDIENCE_INDIVIDUAL, 'list_price' => 0, 'annual_price' => null, 'duration_days' => null,
            'is_active' => true, 'sort_order' => 1, 'max_core_practice_per_day' => $practice, 'core_tests_access' => false, 'feature_trial_uses' => $tries,
        ]);
    }

    /** A published general test with the given questions, built by staff through the API. */
    private function publishedTest(array $questionIds, array $over = []): CoreTest
    {
        Sanctum::actingAs($this->staff());
        $slug = $this->postJson('/api/admin/core/tests', $over + ['title' => 'ECE Paper '.++$this->seq, 'discipline_code' => 'ece', 'duration_minutes' => 30, 'pass_percentage' => 40])
            ->assertCreated()->json('test.slug');
        $this->putJson("/api/admin/core/tests/{$slug}/questions", ['question_ids' => $questionIds])->assertOk();
        $this->putJson("/api/admin/core/tests/{$slug}", ['status' => 'published'])->assertOk();

        return CoreTest::where('slug', $slug)->firstOrFail();
    }

    // ───────────────────────────── availability ─────────────────────────────

    public function test_core_prep_does_not_exist_until_the_branch_is_live_and_has_content(): void
    {
        $ece = $this->student('ECE');
        Sanctum::actingAs($ece);

        $this->getJson('/api/core')->assertOk()->assertJsonPath('available', false)->assertJsonPath('live', false);
        $this->postJson('/api/core/practice/next')->assertNotFound();

        $this->live('ece');
        $this->getJson('/api/core')->assertJsonPath('available', false)->assertJsonPath('live', true);   // live but nothing published yet

        $this->seedBank(3);
        $this->getJson('/api/core')->assertOk()->assertJsonPath('available', true)->assertJsonPath('discipline.code', 'ece');
    }

    public function test_cse_students_and_students_of_other_families_never_see_it(): void
    {
        $this->live('ece');
        $this->seedBank(3);

        Sanctum::actingAs($this->student('CSE'));
        $this->getJson('/api/core')->assertJsonPath('available', false);
        $this->postJson('/api/core/practice/next')->assertNotFound();

        Sanctum::actingAs($this->student('Mechanical'));      // mech is not live
        $this->getJson('/api/core')->assertJsonPath('available', false);

        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO]));
        $this->getJson('/api/core')->assertForbidden();
    }

    public function test_the_subscription_payload_tells_the_sidebar(): void
    {
        $this->live('ece');
        $this->seedBank(2);
        Sanctum::actingAs($this->student('ECE'));

        $this->getJson('/api/me/subscription')->assertOk()
            ->assertJsonPath('entitlements.core_prep.available', true)
            ->assertJsonPath('entitlements.core_tests_access', true)
            ->assertJsonPath('entitlements.max_core_practice_per_day', null);

        Sanctum::actingAs($this->student('CSE'));
        $this->getJson('/api/me/subscription')->assertJsonPath('entitlements.core_prep.available', false);
    }

    // ───────────────────────────── practice ─────────────────────────────

    public function test_practice_serves_a_question_without_its_key_and_returns_the_key_after_answering(): void
    {
        $this->live('ece');
        $this->seedBank(4);
        Sanctum::actingAs($s = $this->student('ECE'));

        $q = $this->postJson('/api/core/practice/next')->assertOk()->json('question');
        $this->assertArrayNotHasKey('correct', $q);
        $this->assertArrayNotHasKey('explanation', $q);
        $this->assertCount(4, $q['options']);
        $this->assertArrayNotHasKey('correct', $q['options'][0]);

        $this->postJson("/api/core/practice/{$q['id']}/answer", ['selected' => ['a']])->assertOk()
            ->assertJsonPath('correct', true)->assertJsonPath('key.correct', ['a'])->assertJsonPath('explanation', 'Because a is right.');

        $this->assertDatabaseHas('core_practice_answers', ['user_id' => $s->id, 'core_question_id' => $q['id'], 'is_correct' => true]);
        $this->assertSame(1, CoreQuestion::find($q['id'])->attempts_count, 'the key locks as soon as anyone answers');
        $this->assertTrue(CoreQuestion::find($q['id'])->isKeyLocked());
    }

    public function test_wrong_multi_and_numeric_answers_are_judged_correctly(): void
    {
        $this->live('ece');
        Sanctum::actingAs($this->student('ECE'));

        $single = $this->question();
        $multi = $this->question(['type' => 'mcq_multi', 'correct' => ['a', 'c'], 'negative_marks' => 0]);
        $num = $this->question(['type' => 'numeric', 'options' => null, 'correct' => null, 'numeric_min' => 3.14, 'numeric_max' => 3.15, 'numeric_unit' => 'V']);

        $this->postJson("/api/core/practice/{$single->id}/answer", ['selected' => ['b']])->assertJsonPath('correct', false);
        $this->postJson("/api/core/practice/{$multi->id}/answer", ['selected' => ['c', 'a']])->assertJsonPath('correct', true);
        $this->postJson("/api/core/practice/{$multi->id}/answer", ['selected' => ['a']])->assertJsonPath('correct', false);    // no partial credit
        $this->postJson("/api/core/practice/{$num->id}/answer", ['numeric_value' => 3.141])->assertJsonPath('correct', true)->assertJsonPath('key.min', 3.14);
        $this->postJson("/api/core/practice/{$num->id}/answer", ['numeric_value' => 3.2])->assertJsonPath('correct', false);
        $this->postJson("/api/core/practice/{$single->id}/answer", [])->assertStatus(422);
        $this->postJson("/api/core/practice/{$single->id}/answer", ['selected' => ['zzz']])->assertStatus(422);   // not one of the options
    }

    public function test_a_test_only_question_is_never_served_or_accepted_in_practice(): void
    {
        $this->live('ece');
        Sanctum::actingAs($this->student('ECE'));
        $testOnly = $this->question(['usage' => 'test']);
        $draft = $this->question(['status' => 'draft']);
        $this->question();   // one practice question so the module exists

        foreach (range(1, 10) as $i) {
            $served = $this->postJson('/api/core/practice/next')->json('question.id');
            $this->assertNotContains($served, [$testOnly->id, $draft->id]);
        }

        $this->postJson("/api/core/practice/{$testOnly->id}/answer", ['selected' => ['a']])->assertNotFound();
        $this->postJson("/api/core/practice/{$draft->id}/answer", ['selected' => ['a']])->assertNotFound();
    }

    public function test_a_question_from_another_branch_family_is_refused(): void
    {
        $this->live('ece');
        $this->live('mech');
        $this->seedBank(2);
        $mech = $this->question([], 'mech', 'thermodynamics');
        Sanctum::actingAs($this->student('ECE'));

        $this->postJson("/api/core/practice/{$mech->id}/answer", ['selected' => ['a']])->assertNotFound();
    }

    public function test_practice_modes_serve_new_then_wrong_then_weak_questions(): void
    {
        $this->live('ece');
        Sanctum::actingAs($s = $this->student('ECE'));
        $a = $this->question();
        $b = $this->question();
        $c = $this->question();

        // answer a (right) and b (wrong): "new" must now only offer c
        $this->postJson("/api/core/practice/{$a->id}/answer", ['selected' => ['a']]);
        $this->postJson("/api/core/practice/{$b->id}/answer", ['selected' => ['b']]);
        foreach (range(1, 6) as $i) {
            $this->assertSame($c->id, $this->postJson('/api/core/practice/next', ['mode' => 'new'])->json('question.id'));
        }

        // "review" offers the one they last got wrong
        $this->assertSame($b->id, $this->postJson('/api/core/practice/next', ['mode' => 'review'])->json('question.id'));
        $this->postJson("/api/core/practice/{$b->id}/answer", ['selected' => ['a']]);        // now right
        $this->assertNull($this->postJson('/api/core/practice/next', ['mode' => 'review'])->json('question'));

        // once everything has been seen, "new" falls back to the least recently seen instead of running dry
        $this->postJson("/api/core/practice/{$c->id}/answer", ['selected' => ['a']]);
        $this->assertNotNull($this->postJson('/api/core/practice/next', ['mode' => 'new'])->json('question.id'));
        $this->assertSame(4, CorePracticeAnswer::where('user_id', $s->id)->count());
    }

    public function test_filters_narrow_what_practice_serves(): void
    {
        $this->live('ece');
        Sanctum::actingAs($this->student('ECE'));
        $hard = $this->question(['difficulty' => 'hard']);
        $this->question(['difficulty' => 'easy']);
        $other = $this->question([], 'ece', 'digital_circuits');

        foreach (range(1, 6) as $i) {
            $this->assertSame($hard->id, $this->postJson('/api/core/practice/next', ['difficulty' => 'hard'])->json('question.id'));
            $this->assertSame($other->id, $this->postJson('/api/core/practice/next', ['subject_id' => $other->subject_id])->json('question.id'));
        }
    }

    public function test_the_free_plan_caps_practice_per_day(): void
    {
        $this->live('ece');
        $this->seedBank(5);
        $this->coderPlan(practice: 2);
        $s = $this->student('ECE');
        Sanctum::actingAs($s);

        foreach ([1, 2] as $i) {
            $q = $this->postJson('/api/core/practice/next')->json('question.id');
            $this->postJson("/api/core/practice/{$q}/answer", ['selected' => ['a']])->assertOk()->assertJsonPath('practice_limit', 2)->assertJsonPath('practice_used_today', $i);
        }

        $q = $this->postJson('/api/core/practice/next')->json('question.id');
        $this->postJson("/api/core/practice/{$q}/answer", ['selected' => ['a']])->assertStatus(402)->assertJsonPath('feature', 'core_practice');

        $this->travel(1)->days();
        $this->postJson("/api/core/practice/{$q}/answer", ['selected' => ['a']])->assertOk();
    }

    // ───────────────────────────── home & mastery ─────────────────────────────

    public function test_the_home_reports_accuracy_mastery_and_weak_topics(): void
    {
        $this->live('ece');
        Sanctum::actingAs($s = $this->student('ECE'));
        $subject = $this->subject();
        $weakTopic = $subject->topics()->first();
        $strongTopic = $subject->topics()->skip(1)->first();

        // 3 wrong in the weak topic; 5 right in the strong one (enough to count as mastered)
        foreach (range(1, 3) as $i) {
            $q = $this->question(['topic_id' => $weakTopic->id]);
            $this->postJson("/api/core/practice/{$q->id}/answer", ['selected' => ['b']]);
        }
        foreach (range(1, 5) as $i) {
            $q = $this->question(['topic_id' => $strongTopic->id]);
            $this->postJson("/api/core/practice/{$q->id}/answer", ['selected' => ['a']]);
        }

        $home = $this->getJson('/api/core')->assertOk()->json();

        $this->assertSame(8, $home['summary']['answered']);
        $this->assertSame(63, $home['summary']['accuracy']);          // 5 / 8
        $this->assertSame(1, $home['summary']['topics_mastered']);
        $analog = collect($home['subjects'])->firstWhere('code', 'analog_circuits');
        $this->assertSame(8, $analog['attempts']);
        $this->assertSame($weakTopic->id, $home['weakest_topics'][0]['topic_id']);
        $this->assertSame(0, $home['weakest_topics'][0]['accuracy']);
        $this->assertSame(1, $this->getJson('/api/me/core-stats')->json('summary.topics_mastered'));
    }

    // ───────────────────────────── reporting ─────────────────────────────

    public function test_a_student_can_report_a_question_they_have_seen_once(): void
    {
        $this->live('ece');
        $q = $this->question();
        Sanctum::actingAs($s = $this->student('ECE'));

        $this->postJson("/api/core/questions/{$q->id}/report", ['reason' => 'wrong_answer'])->assertNotFound();   // not seen yet

        $this->postJson("/api/core/practice/{$q->id}/answer", ['selected' => ['a']]);
        $this->postJson("/api/core/questions/{$q->id}/report", ['reason' => 'wrong_answer', 'note' => 'I get B'])->assertCreated();
        $this->postJson("/api/core/questions/{$q->id}/report", ['reason' => 'typo', 'note' => 'also a typo'])->assertCreated();

        $this->assertSame(1, CoreQuestionReport::where('user_id', $s->id)->count(), 'sending it again updates the open report');
        $this->assertSame('typo', CoreQuestionReport::first()->reason);
        $this->postJson("/api/core/questions/{$q->id}/report", ['reason' => 'nonsense'])->assertStatus(422);
    }

    // ───────────────────────────── timed tests ─────────────────────────────

    public function test_a_student_sits_a_test_and_gets_graded_with_negative_marking(): void
    {
        $this->live('ece');
        $q1 = $this->question(['marks' => 2, 'negative_marks' => 0.66]);
        $q2 = $this->question(['marks' => 1, 'negative_marks' => 0.33]);
        $q3 = $this->question(['marks' => 1, 'negative_marks' => 0.33]);
        $multi = $this->question(['type' => 'mcq_multi', 'correct' => ['a', 'b'], 'marks' => 2, 'negative_marks' => 0]);
        $num = $this->question(['type' => 'numeric', 'options' => null, 'correct' => null, 'numeric_min' => 10, 'numeric_max' => 10, 'marks' => 1, 'negative_marks' => 0]);
        $test = $this->publishedTest([$q1->id, $q2->id, $q3->id, $multi->id, $num->id]);

        Sanctum::actingAs($s = $this->student('ECE'));
        $this->getJson('/api/core/tests')->assertOk()->assertJsonPath('tests.0.slug', $test->slug)->assertJsonPath('tests.0.question_count', 5)->assertJsonPath('tests.0.total_marks', 7);

        $session = $this->postJson("/api/core/tests/{$test->slug}/start")->assertCreated()->json('session');
        $this->consent($session['id']);
        $this->assertCount(5, $session['questions']);
        $this->assertSame(7, (int) $session['test']['total_marks']);
        foreach ($session['questions'] as $question) {
            $this->assertArrayNotHasKey('correct', $question);
            $this->assertArrayNotHasKey('explanation', $question);
        }

        $base = "/api/core/sessions/{$session['id']}";
        $this->putJson("{$base}/answers/{$q1->id}", ['selected' => ['a']])->assertOk()->assertJsonPath('answered', true);       // +2
        $this->putJson("{$base}/answers/{$q2->id}", ['selected' => ['b']])->assertOk();                                       // -0.33
        // q3 left unanswered → skipped, no penalty
        $this->putJson("{$base}/answers/{$multi->id}", ['selected' => ['a']])->assertOk();                                    // wrong (partial) → 0, no negative
        $this->putJson("{$base}/answers/{$num->id}", ['numeric_value' => 10])->assertOk();                                    // +1

        $done = $this->postJson("{$base}/submit")->assertOk()->assertJsonPath('session.status', 'completed');
        $result = $this->getJson("{$base}/result")->assertOk()->json('result');

        $this->assertEquals(2.67, $result['score']);                    // 2 − 0.33 + 0 + 1
        $this->assertEquals(7, $result['max_score']);
        $this->assertEquals(38.14, $result['score_percent']);            // 2.67 / 7
        $this->assertFalse($result['passed']);                           // below the 40% bar
        $this->assertSame([2, 2, 1], [$result['correct_count'], $result['wrong_count'], $result['skipped_count']]);
        $this->assertSame('Analog Circuits', $result['subject_breakdown'][0]['subject']);

        // the review reveals keys and explanations only now
        $first = collect($result['review'])->firstWhere('question_id', $q1->id);
        $this->assertSame(['a'], $first['correct']);
        $this->assertSame('Because a is right.', $first['explanation']);
        $this->assertEquals(2.0, $first['marks_awarded']);
        $this->assertNotNull(CoreTestSession::first()->completed_at);
        $this->assertSame(1, CoreQuestion::find($q1->id)->attempts_count);
        $this->assertSame(0, CoreQuestion::find($q3->id)->attempts_count, 'a skipped question was never answered');
    }

    public function test_the_result_is_not_available_while_the_attempt_is_running(): void
    {
        $this->live('ece');
        $test = $this->publishedTest([$this->question()->id]);
        Sanctum::actingAs($this->student('ECE'));
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->assertCreated()->json('session.id');

        $this->getJson("/api/core/sessions/{$id}/result")->assertStatus(409);
    }

    public function test_starting_again_resumes_the_same_attempt(): void
    {
        $this->live('ece');
        $test = $this->publishedTest([$this->question()->id]);
        Sanctum::actingAs($this->student('ECE'));

        $first = $this->postJson("/api/core/tests/{$test->slug}/start")->assertCreated()->json('session.id');
        $second = $this->postJson("/api/core/tests/{$test->slug}/start")->assertCreated()->json('session.id');

        $this->assertSame($first, $second);
        $this->assertSame(1, CoreTestSession::count());
    }

    public function test_options_are_shuffled_per_attempt_and_a_students_answer_survives_a_reload(): void
    {
        $this->live('ece');
        $q = $this->question();
        $test = $this->publishedTest([$q->id]);

        $orders = [];
        foreach (range(1, 8) as $i) {
            Sanctum::actingAs($this->student('ECE'));
            $orders[] = collect($this->postJson("/api/core/tests/{$test->slug}/start")->json('session.questions.0.options'))->pluck('id')->implode('');
        }
        $this->assertGreaterThan(1, count(array_unique($orders)), 'neighbours in a lab must not all see the same order');

        Sanctum::actingAs($s = $this->student('ECE'));
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->json('session.id');
        $this->consent($id);
        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['c'], 'marked_for_review' => true, 'time_spent' => 12])->assertOk();

        $reloaded = $this->getJson("/api/core/sessions/{$id}")->assertOk()->json('session.questions.0');
        $this->assertSame(['c'], $reloaded['selected']);
        $this->assertTrue($reloaded['marked_for_review']);
    }

    public function test_the_clock_is_enforced_on_the_server(): void
    {
        $this->live('ece');
        $q = $this->question();
        $test = $this->publishedTest([$q->id], ['duration_minutes' => 10]);
        Sanctum::actingAs($this->student('ECE'));
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->json('session.id');
        $this->consent($id);

        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['a']])->assertOk();

        $this->travel(11)->minutes();     // past the deadline and the grace
        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['b']])->assertStatus(409);

        // …and what was saved in time was graded
        $this->assertSame(100.0, CoreTestSession::first()->score_percent);
        $this->getJson("/api/core/sessions/{$id}")->assertOk()->assertJsonPath('session.status', 'completed');
    }

    public function test_the_sweeper_grades_abandoned_attempts(): void
    {
        $this->live('ece');
        $q = $this->question();
        $test = $this->publishedTest([$q->id], ['duration_minutes' => 10]);
        Sanctum::actingAs($this->student('ECE'));
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->json('session.id');
        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['a']]);

        $this->travel(5)->minutes();
        $this->artisan('core:finalize-expired')->expectsOutputToContain('Finalised 0')->assertSuccessful();

        $this->travel(10)->minutes();
        $this->artisan('core:finalize-expired')->expectsOutputToContain('Finalised 1')->assertSuccessful();
        $this->assertSame('completed', CoreTestSession::first()->status);
    }

    public function test_attempts_windows_and_ownership_are_respected(): void
    {
        $this->live('ece');
        $test = $this->publishedTest([$this->question()->id], ['max_attempts' => 1]);
        Sanctum::actingAs($s = $this->student('ECE'));

        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->json('session.id');
        $this->postJson("/api/core/sessions/{$id}/submit")->assertOk();
        $this->postJson("/api/core/tests/{$test->slug}/start")->assertStatus(422);                  // used its only attempt

        // someone else's attempt is a 404, not a 403
        Sanctum::actingAs($this->student('ECE'));
        $this->getJson("/api/core/sessions/{$id}")->assertNotFound();
        $this->getJson("/api/core/sessions/{$id}/result")->assertNotFound();

        // a window that has not opened yet
        $future = $this->publishedTest([$this->question()->id], ['available_from' => now()->addDay()->toIso8601String()]);
        Sanctum::actingAs($s);
        $this->postJson("/api/core/tests/{$future->slug}/start")->assertStatus(422);
    }

    // ───────────────────────────── plans ─────────────────────────────

    public function test_the_free_plan_gets_one_test_try_and_a_paid_plan_gets_all(): void
    {
        $this->live('ece');
        $q = $this->question();
        $test = $this->publishedTest([$q->id]);
        $this->coderPlan(practice: 5, tries: 1);

        Sanctum::actingAs($free = $this->student('ECE'));
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->assertCreated()->json('session.id');
        $this->postJson("/api/core/sessions/{$id}/submit")->assertOk();
        $this->postJson("/api/core/tests/{$test->slug}/start")->assertStatus(402)->assertJsonPath('code', 'trial_used')->assertJsonPath('feature', 'core_tests');

        // a plan with core_tests_access has no such limit
        $paid = Plan::create(['code' => 'expert-t', 'name' => 'Expert', 'audience' => Plan::AUDIENCE_INDIVIDUAL, 'list_price' => 100, 'duration_days' => 365, 'is_active' => true, 'sort_order' => 2, 'core_tests_access' => true]);
        $other = $this->student('ECE');
        Subscription::create(['subscriber_type' => User::class, 'subscriber_id' => $other->id, 'plan_id' => $paid->id, 'status' => Subscription::STATUS_ACTIVE, 'started_at' => now(), 'current_period_end' => now()->addYear(), 'is_trial' => false, 'auto_renew' => false]);
        Sanctum::actingAs($other);
        foreach ([1, 2, 3] as $i) {
            $sid = $this->postJson("/api/core/tests/{$test->slug}/start")->assertCreated()->json('session.id');
            $this->postJson("/api/core/sessions/{$sid}/submit")->assertOk();
        }
    }

    public function test_superadmin_can_edit_the_core_limits_and_an_older_editor_keeps_working(): void
    {
        $plan = $this->coderPlan();
        $plan->update(['max_mock_interviews_per_day' => 1]);
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_SUPERADMIN]));

        $old = [
            'max_practice_problems_per_day' => 1, 'max_mock_interviews_per_day' => 1, 'max_learning_centre_ai_attempts_per_day' => null, 'feature_trial_uses' => 1,
            'drive_access' => false, 'hackathon_access' => false, 'vault_access' => false, 'project_lab_access' => false, 'max_workspace_hours_per_month' => null, 'max_active_projects' => null,
        ];

        // an editor that predates the core limits does not send them — they stay as they were
        $this->putJson('/api/superadmin/plans/coder/entitlements', $old)->assertOk();
        $this->assertSame(2, $plan->fresh()->max_core_practice_per_day);
        $this->assertFalse($plan->fresh()->core_tests_access);

        $this->putJson('/api/superadmin/plans/coder/entitlements', $old + ['max_core_practice_per_day' => 25, 'core_tests_access' => true])->assertOk();
        $this->assertSame(25, $plan->fresh()->max_core_practice_per_day);
        $this->assertTrue($plan->fresh()->core_tests_access);
    }

    // ───────────────────────────── proctoring ─────────────────────────────

    /** The consent screen: camera + fullscreen granted. A proctored test saves no answer before this. */
    private function consent(int|string $sessionId): void
    {
        $this->postJson("/api/core/sessions/{$sessionId}/proctoring/start", ['device_info' => ['ua' => 'test']])->assertOk();
    }

    public function test_a_proctored_test_saves_nothing_until_the_student_has_consented(): void
    {
        $this->live('ece');
        $q = $this->question();
        $test = $this->publishedTest([$q->id]);
        Sanctum::actingAs($this->student('ECE'));
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->json('session.id');

        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['a']])->assertStatus(428)->assertJsonPath('code', 'proctoring_required');

        $this->consent($id);
        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['a']])->assertOk();
    }

    public function test_a_core_test_answer_needs_a_live_integrity_signal_when_the_layer_is_on(): void
    {
        config(['integrity.enabled' => true]);
        $this->live('ece');
        $q = $this->question();
        $test = $this->publishedTest([$q->id]);
        Sanctum::actingAs($this->student('ECE'));
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->json('session.id');

        // The old consent endpoint alone is no longer enough …
        config(['integrity.enabled' => false]);
        $this->consent($id);
        config(['integrity.enabled' => true]);
        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['a']])->assertStatus(428)->assertJsonPath('code', 'integrity_required');

        // … the integrity channel is: start returns the policy, then answers flow while the signal is fresh.
        $res = $this->postJson("/api/core/sessions/{$id}/proctoring/start", ['integrity' => ['instance' => 'instance-core-0001', 'fp' => str_repeat('c', 32)]])->assertOk();
        $this->assertSame('strict', $res->json('integrity.policy.profile'));
        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['a']])->assertOk();

        \App\Models\IntegritySession::where('surface', 'core_test')->update(['last_beat_at' => now()->subMinutes(3)]);
        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['b']])->assertStatus(423)->assertJsonPath('code', 'integrity_signal_lost');
    }

    public function test_with_proctoring_switched_off_a_test_needs_no_consent(): void
    {
        config(['proctoring.core_tests_enabled' => false]);
        $this->live('ece');
        $q = $this->question();
        $test = $this->publishedTest([$q->id]);
        Sanctum::actingAs($this->student('ECE'));
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->json('session.id');

        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['a']])->assertOk();
    }

    public function test_strikes_lock_and_end_the_attempt_and_it_never_counts_as_a_pass(): void
    {
        $this->live('ece');
        $q = $this->question();
        $test = $this->publishedTest([$q->id]);
        Sanctum::actingAs($this->student('ECE'));
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->json('session.id');

        $this->postJson("/api/core/sessions/{$id}/proctoring/start", ['device_info' => ['ua' => 'test']])->assertOk()->assertJsonPath('session.violation_count', 0);
        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['a']])->assertOk();

        // resuming is idempotent — a refresh cannot erase strikes
        $this->postJson("/api/core/sessions/{$id}/proctoring/violations", ['type' => 'tab_switch'])->assertOk()->assertJsonPath('session.violation_count', 1);
        $this->postJson("/api/core/sessions/{$id}/proctoring/start")->assertOk()->assertJsonPath('session.violation_count', 1);

        $this->postJson("/api/core/sessions/{$id}/proctoring/violations", ['type' => 'fullscreen_exit'])->assertOk();
        $last = $this->postJson("/api/core/sessions/{$id}/proctoring/violations", ['type' => 'tab_switch'])->assertOk()->assertJsonPath('locked', true);
        $this->assertSame('locked', $last->json('session.status'));

        $session = CoreTestSession::first();
        $this->assertSame('completed', $session->status);
        $this->assertTrue($session->terminated_by_proctoring);
        $this->assertFalse($session->passed, 'a 100% attempt ended for cheating is never a pass');
        $this->assertEquals(100.0, $session->score_percent);

        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['b']])->assertStatus(409);
        $this->postJson("/api/core/sessions/{$id}/proctoring/start")->assertStatus(422);
    }

    public function test_the_proctoring_clock_restarts_once_on_first_consent(): void
    {
        $this->live('ece');
        $test = $this->publishedTest([$this->question()->id], ['duration_minutes' => 20]);
        Sanctum::actingAs($this->student('ECE'));
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->json('session.id');

        $this->travel(3)->minutes();     // seconds spent granting camera permission
        $this->postJson("/api/core/sessions/{$id}/proctoring/start")->assertOk();

        $this->assertEqualsWithDelta(20 * 60, now()->diffInSeconds(CoreTestSession::first()->deadline_at, false), 5);
    }

    // ───────────────────────────── tenancy & audience ─────────────────────────────

    public function test_a_colleges_mock_test_is_visible_only_to_its_own_students(): void
    {
        $this->live('ece');
        $mine = $this->college();
        $theirs = $this->college();
        $this->seedBank(6);

        $tpo = User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $mine->id]);
        Sanctum::actingAs($tpo);
        $slug = $this->postJson('/api/tpo/core-tests', ['title' => 'Our mock', 'discipline_code' => 'ece', 'duration_minutes' => 30])->assertCreated()->json('test.slug');
        $this->postJson("/api/tpo/core-tests/{$slug}/blueprint", ['rows' => [['subject_id' => $this->subject()->id, 'count' => 4]]])->assertOk()->assertJsonPath('test.question_count', 4);
        $this->putJson("/api/tpo/core-tests/{$slug}", ['status' => 'published'])->assertOk();

        Sanctum::actingAs($this->student('ECE', ['college_id' => $mine->id]));
        $this->assertSame([$slug], collect($this->getJson('/api/core/tests')->json('tests'))->pluck('slug')->all());

        Sanctum::actingAs($this->student('ECE', ['college_id' => $theirs->id]));
        $this->assertSame([], $this->getJson('/api/core/tests')->json('tests'));
        $this->postJson("/api/core/tests/{$slug}/start")->assertNotFound();

        // and another college's TPO cannot even see it
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $theirs->id]));
        $this->getJson("/api/tpo/core-tests/{$slug}")->assertNotFound();
        $this->putJson("/api/tpo/core-tests/{$slug}", ['title' => 'hijacked'])->assertNotFound();
        $this->assertSame([], $this->getJson('/api/tpo/core-tests')->json('tests'));
    }

    public function test_a_test_is_offered_only_to_its_branch_family_and_audience(): void
    {
        $this->live('ece');
        $this->live('mech');
        $test = $this->publishedTest([$this->question()->id], ['branch_audience' => ['branches' => ['etc']]]);    // E&TC only, inside the ECE family

        Sanctum::actingAs($this->student('E&TC'));
        $this->assertCount(1, $this->getJson('/api/core/tests')->json('tests'));

        Sanctum::actingAs($this->student('ECE'));     // ece branch, not etc
        $this->assertCount(0, $this->getJson('/api/core/tests')->json('tests'));

        Sanctum::actingAs($this->student('Mechanical'));     // live, but nothing published for mech yet → Core Prep does not exist for them
        $this->getJson('/api/core/tests')->assertNotFound();
        $this->postJson("/api/core/tests/{$test->slug}/start")->assertNotFound();

        $this->question([], 'mech', 'thermodynamics');         // once mech has content, the ECE test is still not theirs
        $this->assertCount(0, $this->getJson('/api/core/tests')->json('tests'));
        $this->postJson("/api/core/tests/{$test->slug}/start")->assertNotFound();
    }

    public function test_a_college_can_copy_one_of_mellows_papers(): void
    {
        $this->live('ece');
        $paper = $this->publishedTest([$this->question()->id, $this->question()->id], ['title' => 'Mellow ECE Paper 1']);
        $college = $this->college();
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]));

        $this->getJson('/api/tpo/core-tests/library')->assertOk()->assertJsonPath('papers.0.title', 'Mellow ECE Paper 1');
        $copy = $this->postJson("/api/tpo/core-tests/library/{$paper->slug}/copy")->assertCreated()->assertJsonPath('test.question_count', 2)->assertJsonPath('test.status', 'draft');

        $this->assertSame('tpo_mock', CoreTest::where('slug', $copy->json('test.slug'))->first()->test_type);
        $this->assertSame($college->id, CoreTest::where('slug', $copy->json('test.slug'))->first()->owning_college_id);
    }

    // ───────────────────────────── builder rules ─────────────────────────────

    public function test_a_blueprint_that_cannot_be_filled_says_by_how_much(): void
    {
        $this->seedBank(3);
        Sanctum::actingAs($this->staff());
        $slug = $this->postJson('/api/admin/core/tests', ['title' => 'T', 'discipline_code' => 'ece'])->json('test.slug');

        $this->postJson("/api/admin/core/tests/{$slug}/blueprint", ['rows' => [['subject_id' => $this->subject()->id, 'count' => 10]]])
            ->assertStatus(422)->assertJsonValidationErrors('blueprint.0');
        $this->assertSame(0, CoreTest::where('slug', $slug)->first()->testQuestions()->count(), 'nothing is half-added');
    }

    public function test_the_pool_endpoints_count_published_test_questions_per_subject_and_difficulty_for_staff_and_tpo(): void
    {
        $this->seedBank(6);                                                       // 2 easy, 2 medium, 2 hard in Analog Circuits
        $this->question(['usage' => 'practice']);                                 // practice-only: not usable in a test
        $this->question(['status' => 'draft']);                                   // not published
        $college = $this->college();

        $expected = ['easy' => 2, 'medium' => 2, 'hard' => 2, 'total' => 6];

        Sanctum::actingAs($this->staff());
        $row = collect($this->getJson('/api/admin/core/tests/pool?discipline=ece')->assertOk()->json('subjects'))->firstWhere('name', 'Analog Circuits');
        $this->assertSame($expected, array_intersect_key($row, $expected));

        // A TPO sees the same counts (never the questions themselves).
        Sanctum::actingAs(User::factory()->create(['role' => User::ROLE_ADMIN_TPO, 'college_id' => $college->id]));
        $row = collect($this->getJson('/api/tpo/core-tests/pool?discipline=ece')->assertOk()->json('subjects'))->firstWhere('name', 'Analog Circuits');
        $this->assertSame($expected, array_intersect_key($row, $expected));

        $this->getJson('/api/tpo/core-tests/pool?discipline=cse')->assertStatus(422);
    }

    public function test_a_test_needs_questions_to_publish_and_freezes_once_started(): void
    {
        $this->live('ece');
        $q = $this->question();
        Sanctum::actingAs($this->staff());
        $slug = $this->postJson('/api/admin/core/tests', ['title' => 'T', 'discipline_code' => 'ece'])->json('test.slug');

        $this->putJson("/api/admin/core/tests/{$slug}", ['status' => 'published'])->assertStatus(422)->assertJsonValidationErrors('status');
        $this->putJson("/api/admin/core/tests/{$slug}/questions", ['question_ids' => [$q->id]])->assertOk();
        $this->putJson("/api/admin/core/tests/{$slug}", ['status' => 'published'])->assertOk();

        Sanctum::actingAs($this->student('ECE'));
        $this->postJson("/api/core/tests/{$slug}/start")->assertCreated();

        Sanctum::actingAs($this->staff());
        $other = $this->question();
        $this->putJson("/api/admin/core/tests/{$slug}/questions", ['question_ids' => [$q->id, $other->id]])->assertStatus(422);
        $this->putJson("/api/admin/core/tests/{$slug}", ['duration_minutes' => 99])->assertStatus(422);
        $this->putJson("/api/admin/core/tests/{$slug}", ['title' => 'Renamed'])->assertOk();            // wording is still fine
        $this->deleteJson("/api/admin/core/tests/{$slug}")->assertStatus(422);
    }

    public function test_only_published_test_questions_can_be_added(): void
    {
        $draft = $this->question(['status' => 'draft']);
        $practiceOnly = $this->question(['usage' => 'practice']);
        $mech = $this->question([], 'mech', 'thermodynamics');
        Sanctum::actingAs($this->staff());
        $slug = $this->postJson('/api/admin/core/tests', ['title' => 'T', 'discipline_code' => 'ece'])->json('test.slug');

        foreach ([$draft, $practiceOnly, $mech] as $bad) {
            $this->putJson("/api/admin/core/tests/{$slug}/questions", ['question_ids' => [$bad->id]])->assertStatus(422)->assertJsonValidationErrors('question_ids');
        }
    }

    // ───────────────────────────── regrade ─────────────────────────────

    public function test_fixing_a_key_regrades_practice_and_finished_attempts(): void
    {
        $this->live('ece');
        $q = $this->question(['marks' => 1, 'negative_marks' => 0]);
        $filler = $this->question();
        $test = $this->publishedTest([$q->id, $filler->id], ['pass_percentage' => 40]);

        Sanctum::actingAs($s = $this->student('ECE'));
        $this->postJson("/api/core/practice/{$q->id}/answer", ['selected' => ['b']])->assertJsonPath('correct', false);
        $id = $this->postJson("/api/core/tests/{$test->slug}/start")->json('session.id');
        $this->consent($id);
        $this->putJson("/api/core/sessions/{$id}/answers/{$q->id}", ['selected' => ['b']]);
        $this->postJson("/api/core/sessions/{$id}/submit")->assertOk();
        $this->assertEquals(0, CoreTestSession::first()->score_percent);
        $this->assertFalse(CoreTestSession::first()->passed);

        // staff realise B was the right answer
        Sanctum::actingAs($this->staff());
        $this->postJson("/api/admin/core/questions/{$q->id}/fix-key", ['correct' => ['b'], 'reason' => 'The textbook solution gives option B.'])->assertOk();

        $this->assertTrue(CorePracticeAnswer::first()->is_correct);
        $session = CoreTestSession::first();
        $this->assertEquals(50.0, $session->score_percent);        // 1 of 2 marks
        $this->assertTrue($session->passed);
        $this->assertSame(1, $session->correct_count);
    }
}
