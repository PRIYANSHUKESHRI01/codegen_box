<?php

namespace Tests\Feature\Judge;

use App\Jobs\JudgeSubmissionJob;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\ContestSubmission;
use App\Models\Problem;
use App\Models\Submission;
use App\Models\User;
use App\Services\Judge\JudgeOutcomePersister;
use App\Services\Judge\JudgeRequest;
use App\Services\Judge\JudgeStatusService;
use App\Services\Judge\JudgeUnavailableException;
use Illuminate\Contracts\Queue\Job as QueueJob;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class JudgePipelineTest extends TestCase
{
    use RefreshDatabase;

    private Problem $problem;

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        config([
            'piston.nodes' => [['url' => 'http://piston-test:2000', 'slots' => 8]],
            'judge.limits.max_active_per_user' => 3,
        ]);

        $this->problem = $this->makeProblem();
    }

    // ------------------------------------------------------------------ helpers

    private function makeProblem(): Problem
    {
        $problem = Problem::create([
            'slug' => 'two-sum-t',
            'title' => 'Two Sum',
            'difficulty' => 'easy',
            'tags' => [],
            'description' => 'Find two numbers.',
            'function_name' => 'twoSum',
            'params' => [['name' => 'nums', 'type' => 'integer[]'], ['name' => 'target', 'type' => 'integer']],
            'return_type' => 'integer[]',
            'comparison_mode' => Problem::COMPARISON_EXACT,
            'display_order' => 1,
        ]);

        $problem->testCases()->create(['inputs' => ['nums' => [2, 7], 'target' => 9], 'expected_output' => [0, 1], 'is_sample' => true, 'display_order' => 0]);
        $problem->testCases()->create(['inputs' => ['nums' => [3, 2, 4], 'target' => 6], 'expected_output' => [1, 2], 'is_sample' => false, 'display_order' => 1]);

        return $problem;
    }

    private function student(): User
    {
        return User::factory()->create(['role' => User::ROLE_USER]);
    }

    private function fakePiston(string $stdout = "[0,1]\n[1,2]\n", int $exitCode = 0, string $stderr = ''): void
    {
        Http::fake(['piston-test:2000/*' => Http::response([
            'run' => ['stdout' => $stdout, 'stderr' => $stderr, 'code' => $exitCode, 'signal' => null, 'cpu_time' => 12, 'memory' => 2048000],
            'compile' => null,
        ])]);
    }

    private function send(User $user, string $action, string $code = 'pass', string $language = 'python')
    {
        Sanctum::actingAs($user);

        return $this->postJson("/api/problems/{$this->problem->slug}/{$action}", ['language' => $language, 'code' => $code]);
    }

    private function poll(User $user, string $token)
    {
        Sanctum::actingAs($user);

        return $this->getJson("/api/judge/{$token}");
    }

    /** Runs the single job that Queue::fake() captured, as a worker would. */
    private function runQueuedJob(): void
    {
        $job = Queue::pushed(JudgeSubmissionJob::class)->last();
        app()->call([$job, 'handle']);
    }

    // ------------------------------------------------------- inline (sync queue)

    public function test_run_answers_inline_when_the_queue_is_synchronous(): void
    {
        $this->fakePiston();

        $this->send($this->student(), 'run')
            ->assertOk()
            ->assertJsonPath('state', 'done')
            ->assertJsonPath('result.all_passed', true);

        $this->assertSame(0, Submission::count(), 'Run never writes a row');
        Http::assertSentCount(1);
    }

    /** @return array<string, mixed> Piston's reply for a run that was stopped rather than finished. */
    private function pistonStopped(string $status, string $message, ?string $stderr = ''): array
    {
        return ['run' => ['stdout' => '', 'stderr' => $stderr, 'code' => null, 'signal' => 'SIGKILL', 'status' => $status, 'message' => $message, 'cpu_time' => 3001, 'memory' => 2048000], 'compile' => null];
    }

    public function test_a_run_stopped_by_a_limit_says_which_limit_not_just_sigkill(): void
    {
        Http::fake(['piston-test:2000/*' => Http::sequence()
            ->push($this->pistonStopped('TO', 'Time limit exceeded'))
            ->push($this->pistonStopped('TO', 'Time limit exceeded (wall clock)'))
            ->push($this->pistonStopped('OL', 'stdout length exceeded')),
        ]);

        $cpu = $this->send($this->student(), 'run', 'cpu')->assertOk();
        $cpu->assertJsonPath('result.status', 'Time Limit Exceeded')->assertJsonPath('result.runtime_error', 'Time limit exceeded');

        $this->send($this->student(), 'run', 'wall')->assertJsonPath('result.status', 'Time Limit Exceeded')
            ->assertJsonPath('result.runtime_error', 'Time limit exceeded (wall clock)');

        $this->send($this->student(), 'run', 'output')->assertJsonPath('result.status', 'Output Limit Exceeded');
    }

    public function test_a_compiler_killed_by_a_limit_is_reported_as_such_and_never_cached(): void
    {
        $killedCompile = ['compile' => ['stdout' => '', 'stderr' => '', 'output' => '', 'code' => null, 'signal' => 'SIGKILL', 'status' => 'TO', 'message' => 'Time limit exceeded', 'cpu_time' => 10076],
            'run' => ['stdout' => '', 'stderr' => '', 'code' => null, 'signal' => 'SIGKILL', 'status' => 'TO', 'message' => 'Time limit exceeded', 'cpu_time' => 10076, 'memory' => 2048000]];
        $ok = ['run' => ['stdout' => "[0,1]\n[1,2]\n", 'stderr' => '', 'code' => 0, 'signal' => null, 'cpu_time' => 12, 'memory' => 2048000], 'compile' => null];

        // Same user, same code, two tries: the first is killed under load, the second runs on a quieter node.
        Http::fake(['piston-test:2000/*' => Http::sequence()->push($killedCompile)->push($ok)]);
        $user = $this->student();

        $this->send($user, 'run', 'heavy', 'cpp')->assertOk()
            ->assertJsonPath('result.compile_error', 'Compilation was stopped: Time limit exceeded.');

        // Not served from the run cache: it executed again and this time passed.
        $this->send($user, 'run', 'heavy', 'cpp')->assertOk()->assertJsonPath('result.all_passed', true);
        Http::assertSentCount(2);
    }

    public function test_a_genuine_compile_error_is_still_cached(): void
    {
        $syntaxError = ['compile' => ['stdout' => '', 'stderr' => 'main.cpp:1: error: expected ) before {', 'output' => '', 'code' => 1, 'signal' => null, 'status' => 'RE', 'message' => 'Exited with error status 1', 'cpu_time' => 57],
            'run' => ['stdout' => '', 'stderr' => '', 'code' => 1, 'signal' => null, 'cpu_time' => 57, 'memory' => 2048000]];
        Http::fake(['piston-test:2000/*' => Http::response($syntaxError)]);

        $this->send($this->student(), 'run', 'oops(', 'cpp')->assertJsonPath('result.compile_error', 'main.cpp:1: error: expected ) before {');
        $this->send($this->student(), 'run', 'oops(', 'cpp')->assertJsonPath('cached', true);
        Http::assertSentCount(1);
    }

    public function test_submit_judges_the_full_suite_and_persists_the_verdict(): void
    {
        $this->fakePiston();
        $user = $this->student();

        $this->send($user, 'submit')
            ->assertOk()
            ->assertJsonPath('result.all_passed', true)
            ->assertJsonCount(2, 'result.results');

        $this->assertDatabaseHas('submissions', ['user_id' => $user->id, 'problem_id' => $this->problem->id, 'status' => 'accepted', 'language' => 'python']);
    }

    public function test_a_wrong_answer_is_a_normal_persisted_verdict(): void
    {
        $this->fakePiston("[9,9]\n[1,2]\n");
        $user = $this->student();

        $this->send($user, 'submit')->assertOk()->assertJsonPath('result.all_passed', false);

        $this->assertDatabaseHas('submissions', ['user_id' => $user->id, 'status' => 'wrong_answer']);
    }

    public function test_resubmitting_the_same_day_keeps_one_row_with_the_latest_status(): void
    {
        $user = $this->student();
        $piston = fn (string $stdout) => ['run' => ['stdout' => $stdout, 'stderr' => '', 'code' => 0, 'signal' => null, 'cpu_time' => 12, 'memory' => 2048000], 'compile' => null];

        // (Http::fake() stubs don't override each other — first match wins — so use a sequence.)
        Http::fake(['piston-test:2000/*' => Http::sequence()->push($piston("[9,9]\n[1,2]\n"))->push($piston("[0,1]\n[1,2]\n"))]);

        $this->send($user, 'submit', 'attempt 1');
        $this->send($user, 'submit', 'attempt 2');

        $this->assertSame(1, Submission::where('user_id', $user->id)->count());
        $this->assertSame('accepted', Submission::where('user_id', $user->id)->value('status'));
    }

    // ------------------------------------------------------------------ caching

    public function test_identical_run_code_is_executed_once_across_users(): void
    {
        $this->fakePiston();

        $first = $this->send($this->student(), 'run', 'starter code');
        $second = $this->send($this->student(), 'run', 'starter code');

        $first->assertOk()->assertJsonMissing(['cached' => true]);
        $second->assertOk()->assertJsonPath('cached', true)->assertJsonPath('result.all_passed', true);
        Http::assertSentCount(1);
    }

    public function test_a_transient_failure_verdict_is_never_cached(): void
    {
        $this->fakePiston('', 1, 'Segmentation fault');

        $this->send($this->student(), 'run', 'crashy')->assertOk()->assertJsonPath('result.all_passed', false);
        $this->send($this->student(), 'run', 'crashy')->assertOk();

        Http::assertSentCount(2);
    }

    public function test_editing_the_samples_invalidates_cached_run_results(): void
    {
        $this->fakePiston();
        $this->send($this->student(), 'run', 'same code');

        Cache::forget("judge:testset:{$this->problem->id}");
        $this->problem->testCases()->where('is_sample', true)->update(['updated_at' => now()->addMinute()]);

        $this->send($this->student(), 'run', 'same code')->assertJsonMissing(['cached' => true]);
        Http::assertSentCount(2);
    }

    // ------------------------------------------------------- async (real queue)

    public function test_with_a_real_queue_run_returns_202_and_the_verdict_arrives_via_polling(): void
    {
        Queue::fake();
        $this->fakePiston();
        $user = $this->student();

        $token = $this->send($user, 'run')
            ->assertStatus(202)
            ->assertJsonPath('state', 'queued')
            ->assertJsonStructure(['token', 'position', 'poll_after_ms'])
            ->json('token');

        Queue::assertPushedOn('judge-run', JudgeSubmissionJob::class);
        Http::assertNothingSent(); // the request itself executed nothing

        $this->poll($user, $token)->assertOk()->assertJsonPath('state', 'queued');

        $this->runQueuedJob();

        $this->poll($user, $token)
            ->assertOk()
            ->assertJsonPath('state', 'done')
            ->assertJsonPath('http_status', 200)
            ->assertJsonPath('result.all_passed', true);
    }

    public function test_a_result_can_only_be_read_by_its_owner(): void
    {
        Queue::fake();
        $this->fakePiston();
        $owner = $this->student();

        $token = $this->send($owner, 'run')->json('token');
        $this->runQueuedJob();

        $this->poll($this->student(), $token)->assertNotFound();
        $this->poll($owner, 'does-not-exist')->assertNotFound();
        $this->poll($owner, $token)->assertOk();
    }

    public function test_double_clicking_returns_the_same_job(): void
    {
        Queue::fake();

        $user = $this->student();
        $a = $this->send($user, 'submit', 'same')->assertStatus(202)->json('token');
        $b = $this->send($user, 'submit', 'same')->assertStatus(202)->json('token');

        $this->assertSame($a, $b);
        Queue::assertPushed(JudgeSubmissionJob::class, 1);
    }

    public function test_one_student_cannot_flood_the_queue(): void
    {
        Queue::fake();
        config(['judge.limits.max_active_per_user' => 2]);

        $user = $this->student();
        $this->send($user, 'submit', 'code 1')->assertStatus(202);
        $this->send($user, 'submit', 'code 2')->assertStatus(202);
        $this->send($user, 'submit', 'code 3')->assertStatus(429)->assertHeader('Retry-After');

        Queue::assertPushed(JudgeSubmissionJob::class, 2);

        // Another student is unaffected.
        $this->send($this->student(), 'submit', 'code 1')->assertStatus(202);
    }

    public function test_the_suggested_poll_interval_grows_with_queue_depth_and_is_capped(): void
    {
        Queue::fake();

        $hints = [];
        foreach (range(1, 60) as $i) {
            $hints[] = $this->send($this->student(), 'submit', "code {$i}")->assertStatus(202)->json('poll_after_ms');
        }

        $this->assertSame(412, $hints[0], 'next in line: poll quickly (400ms + 12ms/position)');
        $this->assertGreaterThan($hints[0], $hints[59], 'the deeper in the queue, the longer between polls');
        $this->assertSame($hints, collect($hints)->sort()->values()->all(), 'monotonic in queue position');
        $this->assertLessThanOrEqual(5000, max($hints));
    }

    public function test_finishing_a_job_frees_the_students_slot(): void
    {
        Queue::fake();
        $this->fakePiston();
        config(['judge.limits.max_active_per_user' => 1]);

        $user = $this->student();
        $this->send($user, 'run', 'one')->assertStatus(202);
        $this->send($user, 'run', 'two')->assertStatus(429);

        $this->runQueuedJob();

        $this->send($user, 'run', 'two')->assertStatus(202);
    }

    public function test_a_full_queue_sheds_new_work_with_retry_after(): void
    {
        Queue::fake();
        config(['judge.backpressure.max_depth.submit' => 1]);

        $this->send($this->student(), 'submit', 'first')->assertStatus(202);
        $this->send($this->student(), 'submit', 'second')
            ->assertStatus(503)
            ->assertHeader('Retry-After')
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'capacity'));

        Queue::assertPushed(JudgeSubmissionJob::class, 1);
    }

    // -------------------------------------------------- failure never = verdict

    public function test_an_execution_outage_is_retried_and_never_recorded_as_a_verdict(): void
    {
        Queue::fake();
        Http::fake(['piston-test:2000/*' => Http::response('boom', 500)]);
        $user = $this->student();

        $token = $this->send($user, 'submit')->assertStatus(202)->json('token');
        $job = Queue::pushed(JudgeSubmissionJob::class)->last();

        try {
            app()->call([$job, 'handle']);
            $this->fail('the job must throw so the queue retries it');
        } catch (JudgeUnavailableException $e) {
            // Retries exhausted:
            $job->failed($e);
        }

        $this->assertSame(0, Submission::count(), 'an outage must not become a wrong-answer row');
        $this->poll($user, $token)
            ->assertOk()
            ->assertJsonPath('state', 'error')
            ->assertJsonPath('message', fn ($m) => str_contains($m, 'Nothing was recorded'));

        // ...and the student's slot was released, so they can try again.
        $this->assertSame(0, (int) Cache::get("judge:active:{$user->id}", 0));
    }

    public function test_time_spent_waiting_in_the_queue_never_uses_up_the_retry_window(): void
    {
        // Regression: retryUntil() is fixed into the payload at dispatch, so with a deep queue
        // (1,000 students, real hardware: ~1.5 verdicts/s) every job more than ~4 minutes back
        // was failed before it ever ran — 657 of 1,000 submissions in the first real-Piston burst.
        $this->assertFalse(method_exists(JudgeSubmissionJob::class, 'retryUntil'), 'a dispatch-time deadline counts queue wait');

        Queue::fake();
        Http::fake(['piston-test:2000/*' => Http::response('boom', 500)]);
        $user = $this->student();
        $this->send($user, 'submit')->assertStatus(202);
        $job = Queue::pushed(JudgeSubmissionJob::class)->last();

        // Ten minutes pass while the job waits behind everyone else...
        $this->travel(10)->minutes();

        // ...none of which counts: its first execution meets an outage and is RETRIED, not failed.
        try {
            app()->call([$job, 'handle']);
            $this->fail('a job that has only just started must be retried, however long it queued');
        } catch (JudgeUnavailableException) {
            // expected: the queue re-releases it with backoff
        }

        // Once it has been failing for longer than the window it gives up (and tells the student).
        $this->travel((int) config('judge.job.retry_for_seconds') + 1)->seconds();
        $queueJob = \Mockery::mock(QueueJob::class);
        $queueJob->shouldReceive('fail')->once()->with(\Mockery::type(JudgeUnavailableException::class));
        $job->setJob($queueJob);

        app()->call([$job, 'handle']); // no exception: it failed the job instead of retrying again
    }

    public function test_a_synchronous_outage_is_reported_without_persisting_anything(): void
    {
        Http::fake(['piston-test:2000/*' => Http::response('boom', 500)]);

        $this->send($this->student(), 'submit')->assertStatus(503);

        $this->assertSame(0, Submission::count());
    }

    // -------------------------------------------------------------- validation

    public function test_oversized_code_and_unknown_languages_are_rejected_before_queueing(): void
    {
        Queue::fake();
        config(['judge.limits.max_code_length' => 100]);
        $user = $this->student();

        $this->send($user, 'run', str_repeat('x', 101))->assertStatus(422)->assertJsonValidationErrors('code');
        $this->send($user, 'run', 'ok', 'brainfuck')->assertStatus(422)->assertJsonValidationErrors('language');

        Queue::assertNothingPushed();
    }

    public function test_run_is_rate_limited_per_user(): void
    {
        Queue::fake();
        config(['judge.rate_limits.run_per_minute' => 3, 'judge.limits.max_active_per_user' => 1000]);

        $user = $this->student();
        foreach (range(1, 3) as $i) {
            $this->send($user, 'run', "code {$i}")->assertStatus(202);
        }

        $this->send($user, 'run', 'code 4')->assertStatus(429);
        // Per user, not per IP: everyone else in the same lab/NAT is fine.
        $this->send($this->student(), 'run', 'code 1')->assertStatus(202);
    }

    // ----------------------------------------------------------------- contests

    private function liveContest(User $user, bool $live = true): array
    {
        $contest = Contest::create([
            'title' => 'C', 'slug' => 'c-'.uniqid(), 'start_at' => now()->subHour(),
            'end_at' => $live ? now()->addHour() : now()->subMinute(),
            'is_rated' => false, 'status' => Contest::STATUS_PUBLISHED,
        ]);
        $cp = ContestProblem::create(['contest_id' => $contest->id, 'problem_id' => $this->problem->id, 'points' => 100, 'display_order' => 1]);
        ContestParticipant::create(['contest_id' => $contest->id, 'user_id' => $user->id, 'registered_at' => now()]);

        return [$contest, $cp];
    }

    private function postContest(User $user, Contest $contest, ContestProblem $cp, string $action, string $code = 'pass')
    {
        Sanctum::actingAs($user);

        return $this->postJson("/api/contests/{$contest->getRouteKey()}/problems/{$cp->id}/{$action}", ['language' => 'python', 'code' => $code]);
    }

    public function test_live_contest_work_uses_the_priority_queue_and_finished_contests_do_not(): void
    {
        Queue::fake();
        $user = $this->student();
        [$live, $liveCp] = $this->liveContest($user);
        [$done, $doneCp] = $this->liveContest($user, live: false);

        $this->postContest($user, $live, $liveCp, 'submit', 'a')->assertStatus(202);
        Queue::assertPushedOn('judge-contest', JudgeSubmissionJob::class);

        $this->postContest($user, $done, $doneCp, 'run', 'b')->assertStatus(202);
        Queue::assertPushedOn('judge-run', JudgeSubmissionJob::class); // post-contest practice must not jump the line
    }

    public function test_a_contest_submission_is_recorded_once_even_if_the_job_is_retried(): void
    {
        $user = $this->student();
        [$contest, $cp] = $this->liveContest($user);
        $persister = app(JudgeOutcomePersister::class);

        $request = JudgeRequest::contest('submit', true, $user->id, $this->problem->id, $contest->id, $cp->id, 'python', 'pass');
        $outcome = ['status' => 200, 'submissionStatus' => 'accepted', 'runtimeMs' => 12, 'memoryKb' => 2000];

        $persister->persist($request, $outcome, 'token-1');
        $persister->persist($request, $outcome, 'token-1'); // retried after a worker died post-save

        $this->assertSame(1, ContestSubmission::where('user_id', $user->id)->count());
        $this->assertSame(100, ContestSubmission::where('user_id', $user->id)->value('points_awarded'));
    }

    public function test_contest_time_is_when_the_student_clicked_not_when_a_worker_got_to_it(): void
    {
        $user = $this->student();
        [$contest, $cp] = $this->liveContest($user);

        $clicked = now()->subMinutes(7)->startOfSecond();
        $request = new JudgeRequest('submit', 'contest', $user->id, $this->problem->id, 'python', 'pass', $contest->id, $cp->id, $clicked->toIso8601String());

        app(JudgeOutcomePersister::class)->persist($request, ['status' => 200, 'submissionStatus' => 'wrong_answer', 'runtimeMs' => 1, 'memoryKb' => 1], 'token-2');

        $this->assertTrue(ContestSubmission::where('judge_token', 'token-2')->firstOrFail()->submitted_at->equalTo($clicked));
    }

    // ---------------------------------------------------------------- telemetry

    public function test_status_reports_real_node_health_and_queue_state(): void
    {
        config(['piston.nodes' => [['url' => 'http://up:2000', 'slots' => 8], ['url' => 'http://down:2000', 'slots' => 4]]]);
        Http::fake([
            'up:2000/*' => Http::response([['language' => 'python', 'version' => '3.10.0']]),
            'down:2000/*' => Http::response('nope', 500),
        ]);

        $snapshot = app(JudgeStatusService::class)->snapshot();

        $this->assertSame(['healthy', 'offline'], array_column($snapshot['nodes'], 'status'));
        $this->assertSame(12, $snapshot['totals']['capacity']);
        $this->assertSame(1, $snapshot['totals']['healthy_nodes']);
        $this->assertSame(['contest', 'submit', 'run'], array_keys($snapshot['queues']));
    }

    public function test_the_status_command_fails_when_no_node_is_healthy(): void
    {
        Http::fake(['*' => Http::response('nope', 500)]);

        $this->artisan('judge:status --json')->assertFailed();
    }
}
