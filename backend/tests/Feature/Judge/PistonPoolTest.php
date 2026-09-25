<?php

namespace Tests\Feature\Judge;

use App\Services\Judge\JudgeUnavailableException;
use App\Services\Judge\PistonPool;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PistonPoolTest extends TestCase
{
    private const OK = ['run' => ['stdout' => "ok\n", 'stderr' => '', 'code' => 0, 'signal' => null], 'compile' => null];

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        config(['piston.breaker_failures' => 2, 'piston.breaker_cooldown_seconds' => 60]);
    }

    private function nodes(string ...$urls): void
    {
        config(['piston.nodes' => array_map(fn (string $u) => ['url' => $u, 'slots' => 8], $urls)]);
    }

    private function requestsTo(string $host): int
    {
        return Http::recorded(fn (Request $r) => str_contains($r->url(), $host))->count();
    }

    public function test_it_runs_a_job_on_the_only_node(): void
    {
        $this->nodes('http://node-a:2000');
        Http::fake(['node-a:2000/*' => Http::response(self::OK)]);

        $result = app(PistonPool::class)->execute(['language' => 'python']);

        $this->assertSame("ok\n", $result['run']['stdout']);
        Http::assertSent(fn (Request $r) => $r->url() === 'http://node-a:2000/api/v2/execute' && $r['language'] === 'python');
    }

    public function test_it_fails_over_to_another_node_on_a_server_error(): void
    {
        $this->nodes('http://node-a:2000', 'http://node-b:2000');
        Http::fake([
            'node-a:2000/*' => Http::response('boom', 500),
            'node-b:2000/*' => Http::response(self::OK),
        ]);

        // Whichever node is sampled first, a healthy answer must come back.
        for ($i = 0; $i < 6; $i++) {
            $this->assertSame("ok\n", app(PistonPool::class)->execute(['language' => 'python'])['run']['stdout']);
        }
    }

    public function test_it_fails_over_when_a_node_refuses_the_connection(): void
    {
        $this->nodes('http://node-a:2000', 'http://node-b:2000');
        Http::fake([
            'node-a:2000/*' => fn () => throw new ConnectionException('connection refused'),
            'node-b:2000/*' => Http::response(self::OK),
        ]);

        for ($i = 0; $i < 6; $i++) {
            $this->assertSame("ok\n", app(PistonPool::class)->execute(['language' => 'python'])['run']['stdout']);
        }
    }

    public function test_the_breaker_takes_a_failing_node_out_of_rotation(): void
    {
        $this->nodes('http://node-a:2000', 'http://node-b:2000');
        Http::fake([
            'node-a:2000/*' => Http::response('boom', 500),
            'node-b:2000/*' => Http::response(self::OK),
        ]);

        $pool = app(PistonPool::class);

        for ($i = 0; $i < 20; $i++) {
            $pool->execute(['language' => 'python']);
        }

        $this->assertTrue($pool->isDown(['url' => 'http://node-a:2000', 'slots' => 8]));
        // Two failures trip it (breaker_failures=2); after that it must never be contacted again.
        $this->assertLessThanOrEqual(2, $this->requestsTo('node-a:2000'));
        $this->assertSame(20, $this->requestsTo('node-b:2000'));
    }

    public function test_it_throws_when_every_node_is_down(): void
    {
        $this->nodes('http://node-a:2000', 'http://node-b:2000');
        Http::fake(['*' => Http::response('boom', 503)]);

        $this->expectException(JudgeUnavailableException::class);

        app(PistonPool::class)->execute(['language' => 'python']);
    }

    public function test_it_throws_when_no_nodes_are_configured(): void
    {
        config(['piston.nodes' => []]);

        $this->expectException(JudgeUnavailableException::class);

        app(PistonPool::class)->execute(['language' => 'python']);
    }

    public function test_it_clamps_a_limit_above_the_nodes_ceiling_instead_of_failing(): void
    {
        $this->nodes('http://node-a:2000');
        Http::fake(['node-a:2000/*' => Http::sequence()
            ->push(['message' => 'run_cpu_time cannot exceed the configured limit of 3000'], 400)
            ->push(self::OK, 200)]);

        $result = app(PistonPool::class)->execute(['language' => 'java', 'run_cpu_time' => 8000]);

        $this->assertSame("ok\n", $result['run']['stdout']);
        $sent = Http::recorded()->map(fn ($pair) => $pair[0]->data());
        $this->assertSame(8000, $sent[0]['run_cpu_time']);
        $this->assertSame(3000, $sent[1]['run_cpu_time'], 'retried once with the limit clamped to the node ceiling');
    }

    public function test_a_rejection_that_is_not_a_ceiling_message_is_not_retried_forever(): void
    {
        $this->nodes('http://node-a:2000');
        Http::fake(['node-a:2000/*' => Http::response(['message' => 'unknown runtime'], 400)]);

        try {
            app(PistonPool::class)->execute(['language' => 'nope']);
            $this->fail('expected an exception');
        } catch (JudgeUnavailableException $e) {
            $this->assertStringContainsString('unknown runtime', $e->getMessage());
        }

        $this->assertSame(1, $this->requestsTo('node-a:2000'));
    }

    public function test_it_prefers_the_less_loaded_node(): void
    {
        $this->nodes('http://node-a:2000', 'http://node-b:2000');
        Http::fake(['*' => Http::response(self::OK)]);

        // Pretend node A already has 8/8 slots busy.
        Cache::put('judge:piston:inflight:'.md5('http://node-a:2000'), 8, 300);

        $pool = app(PistonPool::class);

        for ($i = 0; $i < 40; $i++) {
            $pool->execute(['language' => 'python']);
        }

        // Power-of-two-choices picks A only when both samples are A (~25%); B must dominate.
        $this->assertGreaterThan($this->requestsTo('node-a:2000'), $this->requestsTo('node-b:2000'));
    }

    /**
     * Loads the real config/piston.php under the given env vars. env() reads
     * $_ENV/$_SERVER before getenv(), so all three are set and then restored.
     *
     * @param  array<string, string|null>  $vars
     */
    private function pistonConfigWithEnv(array $vars): array
    {
        $saved = [];

        foreach ($vars as $key => $value) {
            $saved[$key] = [getenv($key), $_ENV[$key] ?? null, $_SERVER[$key] ?? null];
            $value === null ? putenv($key) : putenv("{$key}={$value}");
            $_ENV[$key] = $_SERVER[$key] = $value;

            if ($value === null) {
                unset($_ENV[$key], $_SERVER[$key]);
            }
        }

        try {
            return require config_path('piston.php');
        } finally {
            foreach ($saved as $key => [$getenv, $env, $server]) {
                $getenv === false ? putenv($key) : putenv("{$key}={$getenv}");
                $env === null ? $_ENV[$key] = null : $_ENV[$key] = $env;
                $server === null ? $_SERVER[$key] = null : $_SERVER[$key] = $server;

                if ($env === null) {
                    unset($_ENV[$key]);
                }

                if ($server === null) {
                    unset($_SERVER[$key]);
                }
            }
        }
    }

    public function test_the_real_config_parses_the_pistons_nodes_env_format(): void
    {
        $config = $this->pistonConfigWithEnv(['PISTON_NODES' => 'http://a:2000|4, http://b:2000/ ,http://c:2000|16']);

        $this->assertSame([
            ['url' => 'http://a:2000', 'slots' => 4],
            ['url' => 'http://b:2000', 'slots' => 8],   // no |slots -> default 8, trailing slash trimmed
            ['url' => 'http://c:2000', 'slots' => 16],
        ], $config['nodes']);
    }

    public function test_a_lone_piston_base_url_still_works_as_a_single_node(): void
    {
        $config = $this->pistonConfigWithEnv(['PISTON_NODES' => null, 'PISTON_BASE_URL' => 'http://legacy:2000']);

        $this->assertSame([['url' => 'http://legacy:2000', 'slots' => 8]], $config['nodes']);
    }
}
