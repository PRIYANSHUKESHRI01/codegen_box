<?php

namespace App\Services\Mock;

use App\Models\MockInterviewQuestion;
use App\Services\Vault\CuratedCatalog;
use Illuminate\Database\QueryException;

/**
 * The Mock AI Interview catalog as ONE tree: domain (role) -> tech stack -> 3 practice rounds -> questions.
 *
 * The domains, stacks and round themes are the Vault AI Interview's own (CuratedCatalog), so the two sections always list the same
 * things and a new Vault stack appears here by itself. Only the questions are separate: they come from mock_interview_questions,
 * which staff fill from Admin -> Mock interview questions. A fresh install therefore has every stack "coming soon".
 *
 * A round is READY at `mock_interviews.min_questions_per_round` questions and is practisable on its own; a stack is LIVE as soon as
 * any one of its rounds is ready (a mock has no series to fail, so a half-filled stack strands nobody).
 *
 * Domains that exist only here (Merchant Navy: config mock_interviews.extra_roles) are merged in after the Vault's and name their own rounds;
 * the Vault catalogue never sees them.
 *
 * Round ids are `mock-{stack}-r{n}`.
 *
 * Built once per request and kept; call flush() after changing questions.
 */
class MockInterviewCatalog
{
    /** Rounds in an IT stack (the three themes of its Vault interview). */
    public const ROUNDS = 3;

    /** The most rounds (or sets) any stack may have; a round id carries up to three digits. */
    public const MAX_ROUNDS = 99;

    /** @var array<string, array<string, mixed>>|null */
    private ?array $roles = null;

    public function __construct(private readonly CuratedCatalog $vault) {}

    /** @return array<string, array<string, mixed>> role key => role (with `stacks` keyed by stack key, each with `rounds`) */
    public function roles(): array
    {
        return $this->roles ??= $this->build();
    }

    public function flush(): void
    {
        $this->roles = null;
        $this->vault->flush();
    }

    public function minQuestions(): int
    {
        return max(1, (int) config('mock_interviews.min_questions_per_round', 5));
    }

    public static function roundId(string $stackKey, int $round): string
    {
        return "mock-{$stackKey}-r{$round}";
    }

    public function isRoundReady(array $round): bool
    {
        return count($round['questions'] ?? []) >= $this->minQuestions();
    }

    /**
     * @return array{role: array<string, mixed>, stack: array<string, mixed>}|null the stack with its role (the role without its stacks)
     */
    public function stack(string $stackKey): ?array
    {
        foreach ($this->roles() as $roleKey => $role) {
            if (isset($role['stacks'][$stackKey])) {
                $meta = $role;
                unset($meta['stacks']);

                return ['role' => ['key' => (string) $roleKey] + $meta, 'stack' => $role['stacks'][$stackKey]];
            }
        }

        return null;
    }

    /**
     * @return array{role: array<string, mixed>, stack: array<string, mixed>, round: array<string, mixed>}|null
     */
    public function round(string $roundId): ?array
    {
        if (! preg_match('/^mock-([a-z0-9_]+)-r([1-9][0-9]{0,2})$/', $roundId, $m)) {
            return null;
        }

        $found = $this->stack($m[1]);

        if ($found === null) {
            return null;
        }

        foreach ($found['stack']['rounds'] as $round) {
            if ((int) $round['round_number'] === (int) $m[2]) {
                return $found + ['round' => $round];
            }
        }

        return null;
    }

    /** @return array{ready_rounds: int, total_rounds: int, live: bool} */
    public function progress(array $stack): array
    {
        $ready = count(array_filter($stack['rounds'] ?? [], fn (array $r) => $this->isRoundReady($r)));

        return ['ready_rounds' => $ready, 'total_rounds' => count($stack['rounds'] ?? []), 'live' => $ready > 0];
    }

    /** @return array<string, bool> stack key => live */
    public function liveMap(): array
    {
        $map = [];

        foreach ($this->roles() as $role) {
            foreach ($role['stacks'] as $key => $stack) {
                $map[(string) $key] = $this->progress($stack)['live'];
            }
        }

        return $map;
    }

    // ───────────────────────────── assembly ─────────────────────────────

    /** @return array<string, array<string, mixed>> */
    private function build(): array
    {
        $custom = $this->questions();
        $roles = [];

        foreach ($this->vault->roles() as $roleKey => $role) {
            $stacks = [];

            foreach ($role['stacks'] as $stackKey => $stack) {
                $stackKey = (string) $stackKey;
                $rounds = [];

                // The three rounds are the three themes of the stack's first Vault series.
                foreach (array_slice($stack['series'][0]['sets'] ?? [], 0, self::ROUNDS) as $index => $set) {
                    $number = $index + 1;

                    $rounds[] = [
                        'id' => self::roundId($stackKey, $number),
                        'round_number' => $number,
                        'title' => 'Round '.$number.': '.preg_replace('/^Set\s*\d+\s*:\s*/i', '', (string) ($set['title'] ?? "Round {$number}")),
                        'description' => (string) ($set['description'] ?? ''),
                        'duration_minutes' => (int) ($set['duration_minutes'] ?? 15),
                        'tags' => array_values(array_unique(array_merge([$stackKey, (string) $roleKey, 'mock'], $stack['tags'] ?? []))),
                        'questions' => $custom[$stackKey][$number] ?? [],
                    ];
                }

                $stacks[$stackKey] = [
                    'key' => $stackKey,
                    'name' => $stack['name'],
                    'blurb' => $stack['blurb'] ?? '',
                    'icon' => $stack['icon'] ?? 'Code2',
                    'aliases' => $stack['aliases'] ?? [],
                    'tags' => $stack['tags'] ?? [],
                    'rounds' => $rounds,
                ];
            }

            $roles[(string) $roleKey] = [
                'key' => (string) $roleKey,
                'title' => $role['title'],
                'blurb' => $role['blurb'] ?? '',
                'icon' => $role['icon'] ?? 'Server',
                'badge' => $role['badge'] ?? null,
                'color' => $role['color'] ?? 'indigo',
                'stacks' => $stacks,
            ];
        }

        return $roles + $this->extraRoles($custom, $roles);
    }

    /**
     * The rounds of a Mock-only stack, as [title, description] pairs. A stack either lists its rounds (`rounds`: a themed handful, like
     * the IT stacks) or names a number of SETS (`sets`): "Set 1" .. "Set N", all with the stack's `set_description` - a bank too big for
     * three rounds (the Merchant Navy orals) is dealt into sets of about the same size, each a complete sitting.
     *
     * @return list<array{0: string, 1: string}>
     */
    private function extraRounds(array $stack): array
    {
        if (isset($stack['sets'])) {
            $description = (string) ($stack['set_description'] ?? '');

            return array_map(fn (int $n) => ["Set {$n}", $description], range(1, max(1, min(self::MAX_ROUNDS, (int) $stack['sets']))));
        }

        return array_slice(array_values((array) ($stack['rounds'] ?? [])), 0, self::ROUNDS);
    }

    /**
     * The domains that exist only in the Mock AI Interview (config mock_interviews.extra_roles), each stack naming its own rounds.
     * They are merged AFTER the Vault's, so the Vault catalogue never sees them (no qualification, no Mellow Vault hand-off), and a
     * key that already exists in the Vault is skipped rather than shadowing it.
     *
     * @param  array<string, array<int, list<array<string, mixed>>>>  $custom
     * @param  array<string, array<string, mixed>>  $taken  the Vault-derived roles, to avoid a key clash
     * @return array<string, array<string, mixed>>
     */
    private function extraRoles(array $custom, array $taken): array
    {
        $takenStacks = collect($taken)->flatMap(fn ($r) => array_keys($r['stacks']))->all();
        $roles = [];

        foreach ((array) config('mock_interviews.extra_roles', []) as $roleKey => $role) {
            $roleKey = (string) $roleKey;

            if (isset($taken[$roleKey])) {
                continue;
            }

            $stacks = [];

            foreach ((array) ($role['stacks'] ?? []) as $stackKey => $stack) {
                $stackKey = (string) $stackKey;

                if (in_array($stackKey, $takenStacks, true) || isset($stacks[$stackKey])) {
                    continue;
                }

                $rounds = [];

                $sitting = (int) ($stack['questions_per_interview'] ?? config('mock_interviews.questions_per_interview', 10));

                foreach ($this->extraRounds($stack) as $index => [$title, $description]) {
                    $number = $index + 1;
                    $questions = $custom[$stackKey][$number] ?? [];

                    $rounds[] = [
                        'id' => self::roundId($stackKey, $number),
                        'round_number' => $number,
                        'title' => $title,
                        'description' => $description,
                        // What the briefing page will say: the answer times of the questions one sitting asks, not a guess. The configured
                        // number only stands in until a round has questions.
                        'duration_minutes' => $questions === []
                            ? (int) ($stack['duration_minutes'] ?? 15)
                            : max(1, (int) ceil(array_sum(array_column($questions, 'duration_seconds')) / count($questions) * min(count($questions), $sitting) / 60)),
                        'tags' => array_values(array_unique(array_merge([$stackKey, $roleKey, 'mock'], $stack['tags'] ?? []))),
                        'questions' => $questions,
                    ];
                }

                $stacks[$stackKey] = [
                    'key' => $stackKey,
                    'name' => $stack['name'],
                    'blurb' => $stack['blurb'] ?? '',
                    'icon' => $stack['icon'] ?? 'Code2',
                    'aliases' => array_values($stack['aliases'] ?? []),
                    'tags' => array_values($stack['tags'] ?? []),
                    'discipline' => $stack['discipline'] ?? null,
                    'study_mode' => (bool) ($stack['study_mode'] ?? false),
                    'questions_per_interview' => isset($stack['questions_per_interview']) ? (int) $stack['questions_per_interview'] : null,
                    'rounds' => $rounds,
                ];
            }

            $roles[$roleKey] = [
                'key' => $roleKey,
                'title' => $role['title'],
                'blurb' => $role['blurb'] ?? '',
                'icon' => $role['icon'] ?? 'Server',
                'badge' => $role['badge'] ?? null,
                'color' => $role['color'] ?? 'indigo',
                'terms' => $role['terms'] ?? null,
                'stacks' => $stacks,
            ];
        }

        return $roles;
    }

    /**
     * Staff-written questions by stack and round. A missing table (the migration has not run on this server yet) must not take the
     * page down: it simply has no questions yet.
     *
     * @return array<string, array<int, list<array<string, mixed>>>>
     */
    private function questions(): array
    {
        try {
            $out = [];

            foreach (MockInterviewQuestion::query()->orderBy('stack_key')->orderBy('round_number')->orderBy('position')->orderBy('id')->get() as $q) {
                $out[$q->stack_key][$q->round_number][] = $q->toCatalog();
            }

            return $out;
        } catch (QueryException $e) {
            report($e);

            return [];
        }
    }
}
