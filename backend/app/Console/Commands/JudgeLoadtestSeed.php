<?php

namespace App\Console\Commands;

use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\ContestSubmission;
use App\Models\Problem;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Creates N throwaway students (each with a Sanctum token) — and optionally a
 * live contest they're all registered in — and writes the tokens to a JSON
 * file for infra/loadtest/judge-load.mjs. Everything is tagged
 * (loadtest*@example.test, a "loadtest-" contest slug) so --cleanup removes it
 * all. Refuses to run in production: never point a load test at real users.
 */
class JudgeLoadtestSeed extends Command
{
    protected $signature = 'judge:loadtest-seed
        {--users=1000 : Number of students to create}
        {--problem=two-sum : Problem slug the test will solve}
        {--contest : Also create a live contest containing that problem, with everyone registered}
        {--out=loadtest-users.json : Where to write the tokens (relative to storage/app)}
        {--cleanup : Delete everything a previous run created, then exit}
        {--force : Allow running when APP_ENV=production}';

    protected $description = 'Create throwaway students + tokens (and an optional live contest) for the judge load test';

    private const EMAIL_PATTERN = 'loadtest%@example.test';

    public function handle(): int
    {
        if (app()->isProduction() && ! $this->option('force')) {
            $this->error('Refusing to create load-test users in production (use --force if you truly mean it).');

            return self::FAILURE;
        }

        if ($this->option('cleanup')) {
            return $this->cleanup();
        }

        $problem = Problem::where('slug', $this->option('problem'))->first();

        if ($problem === null) {
            $this->error("Problem '{$this->option('problem')}' not found — seed the problem catalog first.");

            return self::FAILURE;
        }

        $count = max(1, (int) $this->option('users'));
        $password = Hash::make(Str::random(32)); // one hash for all: bcrypt per user would take minutes
        $now = now();

        foreach (array_chunk(range(1, $count), 250) as $chunk) {
            User::insertOrIgnore(array_map(fn (int $n) => [
                'name' => "Load Test {$n}",
                'email' => "loadtest{$n}@example.test",
                'handle' => "lt_{$n}",
                'password' => $password,
                'role' => User::ROLE_USER,
                'created_at' => $now,
                'updated_at' => $now,
            ], $chunk));
        }

        $users = User::where('email', 'like', self::EMAIL_PATTERN)->orderBy('id')->limit($count)->get();
        $contest = $this->option('contest') ? $this->makeContest($problem, $users) : null;

        $tokens = $users->map(fn (User $u) => ['id' => $u->id, 'token' => $u->createToken('loadtest')->plainTextToken])->all();

        $path = storage_path('app/'.ltrim((string) $this->option('out'), '/'));
        @mkdir(dirname($path), 0777, true);
        file_put_contents($path, json_encode([
            'problem' => [
                'id' => $problem->id,
                'slug' => $problem->slug,
                // Correct output, one JSON line per test case: what piston-sim.mjs replays.
                'expected_lines' => $problem->testCases()->get()->map(fn ($t) => json_encode($t->expected_output))->all(),
            ],
            'contest' => $contest,
            'users' => $tokens,
        ]));

        $this->info(sprintf('Created %d students%s. Tokens written to %s', count($tokens), $contest ? " + live contest '{$contest['slug']}'" : '', $path));

        return self::SUCCESS;
    }

    /** @param  \Illuminate\Support\Collection<int, User>  $users */
    private function makeContest(Problem $problem, $users): array
    {
        $contest = Contest::create([
            'title' => 'Load Test Contest',
            'slug' => 'loadtest-'.Str::lower(Str::random(6)),
            'description' => 'Throwaway contest created by judge:loadtest-seed.',
            'start_at' => now()->subHour(),
            'end_at' => now()->addHours(3),
            'is_rated' => false,
            'status' => Contest::STATUS_PUBLISHED,
        ]);

        $contestProblem = ContestProblem::create(['contest_id' => $contest->id, 'problem_id' => $problem->id, 'points' => 100, 'display_order' => 1]);

        foreach ($users->chunk(250) as $chunk) {
            ContestParticipant::insertOrIgnore($chunk->map(fn (User $u) => [
                'contest_id' => $contest->id,
                'user_id' => $u->id,
                'registered_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ])->all());
        }

        return ['id' => $contest->id, 'slug' => $contest->slug, 'contest_problem_id' => $contestProblem->id];
    }

    private function cleanup(): int
    {
        DB::transaction(function () {
            $ids = User::where('email', 'like', self::EMAIL_PATTERN)->pluck('id');
            $contestIds = Contest::where('slug', 'like', 'loadtest-%')->pluck('id');

            ContestSubmission::whereIn('contest_id', $contestIds)->delete();
            ContestParticipant::whereIn('contest_id', $contestIds)->delete();
            ContestProblem::whereIn('contest_id', $contestIds)->delete();
            Contest::whereIn('id', $contestIds)->delete();

            Submission::whereIn('user_id', $ids)->delete();
            DB::table('personal_access_tokens')->where('tokenable_type', User::class)->whereIn('tokenable_id', $ids)->delete();
            User::whereIn('id', $ids)->delete();

            $this->info("Removed {$ids->count()} load-test students and {$contestIds->count()} load-test contest(s).");
        });

        return self::SUCCESS;
    }
}
