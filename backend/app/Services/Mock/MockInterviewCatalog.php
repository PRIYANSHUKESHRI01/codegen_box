<?php

namespace App\Services\Mock;

use App\Models\MockInterviewQuestion;
use App\Services\Vault\CuratedCatalog;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

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

    private const CACHE_QUESTION_COUNTS = 'mock-catalog:question-counts:v1';

    private const CACHE_TTL = 3600;

    /** @var array<string, array<string, mixed>>|null */
    private ?array $roles = null;

    /** @var array<string, array<string, mixed>>|null */
    private ?array $summary = null;

    public function __construct(private readonly CuratedCatalog $vault) {}

    /** @return array<string, array<string, mixed>> role key => role (with `stacks` keyed by stack key, each with `rounds`) */
    public function roles(): array
    {
        return $this->roles ??= $this->build();
    }

    /**
     * Lightweight role tree containing round question counts (not full question texts/rubrics),
     * kept per-request in memory and backed by a tiny cached GROUP BY count query.
     *
     * @return array<string, array<string, mixed>>
     */
    public function summaryRoles(): array
    {
        if ($this->roles !== null) {
            return $this->roles;
        }

        return $this->summary ??= $this->assembleRoles($this->questionCounts(), countsOnly: true);
    }

    public static function flushCache(): void
    {
        Cache::forget(self::CACHE_QUESTION_COUNTS);
    }

    public function flush(): void
    {
        $this->roles = null;
        $this->summary = null;
        self::flushCache();
        $this->vault->flush();
    }

    public function minQuestions(): int
    {
        return max(1, (int) config('mock_interviews.min_questions_per_round', 5));
    }

    public static function roundId(string $stackKey, int $round, int $set = 1): string
    {
        return $set === 1 ? "mock-{$stackKey}-r{$round}" : "mock-{$stackKey}-s{$set}-r{$round}";
    }

    public function roundQuestionCount(array $round): int
    {
        return isset($round['question_count'])
            ? (int) $round['question_count']
            : count($round['questions'] ?? []);
    }

    public function isRoundReady(array $round): bool
    {
        return $this->roundQuestionCount($round) >= $this->minQuestions();
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
     * @return array{role: array<string, mixed>, stack: array<string, mixed>, round: array<string, mixed>, parent_set?: array<string, mixed>}|null
     */
    public function round(string $roundId): ?array
    {
        $stackKey = null;
        $setNum = 1;
        $roundNum = null;

        if (preg_match('/^mock-([a-z0-9_]+)-s([1-9][0-9]?)-r([1-9][0-9]?)$/', $roundId, $m)) {
            $stackKey = $m[1];
            $setNum = (int) $m[2];
            $roundNum = (int) $m[3];
        } elseif (preg_match('/^mock-([a-z0-9_]+)-r([1-9][0-9]{0,2})$/', $roundId, $m)) {
            $stackKey = $m[1];
            $setNum = 1;
            $roundNum = (int) $m[2];
        } else {
            return null;
        }

        // Lookup role/stack/round shell from summaryRoles (avoids loading all 8,889 questions unless $this->roles is already built).
        $roles = $this->summaryRoles();
        $found = null;
        foreach ($roles as $role) {
            if (isset($role['stacks'][$stackKey])) {
                $meta = $role;
                unset($meta['stacks']);
                $found = ['role' => ['key' => (string) $role['key']] + $meta, 'stack' => $role['stacks'][$stackKey]];
                break;
            }
        }

        if ($found === null) {
            return null;
        }

        $loadQuestions = $this->roles === null;

        if (! empty($found['stack']['parent_sets'])) {
            foreach ($found['stack']['parent_sets'] as $pset) {
                if ((int) $pset['set_number'] === $setNum) {
                    foreach ($pset['rounds'] as $round) {
                        if ((int) $round['round_number'] === $roundNum || $round['id'] === $roundId) {
                            if ($loadQuestions) {
                                $round['questions'] = $this->questionsForRound($stackKey, $setNum, (int) $round['round_number']);
                            }

                            return $found + ['round' => $round, 'parent_set' => $pset];
                        }
                    }
                }
            }
        }

        foreach ($found['stack']['rounds'] as $round) {
            if ($round['id'] === $roundId || ((int) $round['round_number'] === $roundNum && $setNum === 1)) {
                if ($loadQuestions) {
                    $round['questions'] = $this->questionsForRound($stackKey, $setNum, (int) $round['round_number']);
                }

                return $found + ['round' => $round];
            }
        }

        return null;
    }

    /** @return array{ready_rounds: int, total_rounds: int, live: bool} */
    public function progress(array $stack): array
    {
        $rounds = $stack['rounds'] ?? [];
        if (! empty($stack['parent_sets'])) {
            $rounds = [];
            foreach ($stack['parent_sets'] as $pset) {
                foreach ($pset['rounds'] as $r) {
                    $rounds[] = $r;
                }
            }
        }
        $ready = count(array_filter($rounds, fn (array $r) => $this->isRoundReady($r)));

        return ['ready_rounds' => $ready, 'total_rounds' => count($rounds), 'live' => $ready > 0];
    }

    /** @return array<string, bool> stack key => live */
    public function liveMap(): array
    {
        $map = [];

        foreach ($this->summaryRoles() as $role) {
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
        return $this->assembleRoles($this->questions(), countsOnly: false);
    }

    /** @return array<string, array<string, mixed>> */
    private function assembleRoles(array $custom, bool $countsOnly): array
    {
        $roles = [];

        $parentConfig = config('mock_interview_parent_sets');
        $defaultSets = $parentConfig['default_sets'] ?? [];
        $stackOverrides = $parentConfig['stacks'] ?? [];

        foreach ($this->vault->summaryRoles() as $roleKey => $role) {
            $stacks = [];

            foreach ($role['stacks'] as $stackKey => $stack) {
                $stackKey = (string) $stackKey;
                $parentSets = $this->buildParentSets($stackKey, (string) $roleKey, $stack, $custom, $defaultSets, $stackOverrides, $countsOnly);

                $stacks[$stackKey] = [
                    'key' => $stackKey,
                    'name' => $stack['name'],
                    'blurb' => $stack['blurb'] ?? '',
                    'icon' => $stack['icon'] ?? 'Code2',
                    'aliases' => $stack['aliases'] ?? [],
                    'tags' => $stack['tags'] ?? [],
                    'parent_sets' => $parentSets,
                    'rounds' => $parentSets[0]['rounds'] ?? [],
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

        return $roles + $this->extraRoles($custom, $roles, $defaultSets, $stackOverrides, $countsOnly);
    }

    /**
     * Builds the 10 standard Parent Sets (Series 1 to 10) for a tech stack.
     *
     * @return list<array<string, mixed>>
     */
    private function buildParentSets(string $stackKey, string $roleKey, array $stack, array $custom, array $defaultSets, array $stackOverrides, bool $countsOnly = false): array
    {
        $parentSets = [];
        $totalSets = max(10, count($defaultSets));

        for ($s = 1; $s <= $totalSets; $s++) {
            $setMeta = $defaultSets[$s] ?? [
                'title' => "Series {$s}",
                'level' => $s === 1 ? 'Foundational' : ($s <= 3 ? 'Intermediate' : ($s <= 6 ? 'Advanced' : 'Staff-Level FAANG')),
                'blurb' => "Comprehensive interview questions for {$stack['name']}.",
                'rounds' => [],
            ];

            if (isset($stackOverrides[$stackKey][$s])) {
                if (! empty($stackOverrides[$stackKey][$s]['title'])) {
                    $setMeta['title'] = $stackOverrides[$stackKey][$s]['title'];
                }
                if (! empty($stackOverrides[$stackKey][$s]['blurb'])) {
                    $setMeta['blurb'] = $stackOverrides[$stackKey][$s]['blurb'];
                }
            }

            $setRounds = [];

            for ($r = 1; $r <= self::ROUNDS; $r++) {
                $roundMeta = $setMeta['rounds'][$r] ?? [];

                $roundTitle = $roundMeta['title'] ?? "Round {$r}";
                $roundDesc = $roundMeta['description'] ?? "Practice round {$r} for {$stack['name']}.";

                if ($s === 1 && isset($stack['series'][0]['sets'][$r - 1])) {
                    $vaultSet = $stack['series'][0]['sets'][$r - 1];
                    $roundTitle = 'Round '.$r.': '.preg_replace('/^Set\s*\d+\s*:\s*/i', '', (string) ($vaultSet['title'] ?? "Round {$r}"));
                    $roundDesc = (string) ($vaultSet['description'] ?? $roundDesc);
                }

                $roundQuestions = $custom[$stackKey][$s][$r] ?? [];

                $roundId = self::roundId($stackKey, $r, $s);

                $roundPayload = [
                    'id' => $roundId,
                    'parent_set_number' => $s,
                    'round_number' => $r,
                    'title' => $roundTitle,
                    'description' => $roundDesc,
                    'duration_minutes' => (int) ($roundMeta['duration_minutes'] ?? 15),
                    'tags' => array_values(array_unique(array_merge([$stackKey, $roleKey, 'mock', 'set-'.$s], $stack['tags'] ?? []))),
                ];
                if ($countsOnly) {
                    $roundPayload['question_count'] = is_array($roundQuestions) && array_key_exists('count', $roundQuestions) ? (int) $roundQuestions['count'] : count($roundQuestions);
                } else {
                    $roundPayload['questions'] = $roundQuestions;
                }
                $setRounds[] = $roundPayload;
            }

            $parentSets[] = [
                'id' => "set-{$s}",
                'set_number' => $s,
                'title' => $setMeta['title'],
                'level' => $setMeta['level'] ?? 'Foundational',
                'description' => $setMeta['blurb'] ?? "Curated interview practice questions for {$stack['name']}.",
                'rounds' => $setRounds,
            ];
        }

        return $parentSets;
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
    private function extraRoles(array $custom, array $taken, array $defaultSets = [], array $stackOverrides = [], bool $countsOnly = false): array
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

                $parentSets = null;
                $rounds = [];

                if (! isset($stack['sets'])) {
                    $parentSets = $this->buildParentSets($stackKey, $roleKey, $stack, $custom, $defaultSets, $stackOverrides, $countsOnly);
                    $rounds = $parentSets[0]['rounds'] ?? [];
                } else {
                    $sitting = (int) ($stack['questions_per_interview'] ?? config('mock_interviews.questions_per_interview', 10));

                    foreach ($this->extraRounds($stack) as $index => [$title, $description]) {
                        $number = $index + 1;
                        $entry = $custom[$stackKey][1][$number] ?? [];

                        if ($countsOnly) {
                            $cnt = is_array($entry) && array_key_exists('count', $entry) ? (int) $entry['count'] : count($entry);
                            $totalDur = is_array($entry) && array_key_exists('total_duration', $entry) ? (int) $entry['total_duration'] : 0;
                            $durationMinutes = $cnt === 0
                                ? (int) ($stack['duration_minutes'] ?? 15)
                                : max(1, (int) ceil(($totalDur / $cnt) * min($cnt, $sitting) / 60));

                            $rounds[] = [
                                'id' => self::roundId($stackKey, $number),
                                'round_number' => $number,
                                'title' => $title,
                                'description' => $description,
                                'duration_minutes' => $durationMinutes,
                                'tags' => array_values(array_unique(array_merge([$stackKey, $roleKey, 'mock'], $stack['tags'] ?? []))),
                                'question_count' => $cnt,
                            ];
                        } else {
                            $questions = $entry;
                            $rounds[] = [
                                'id' => self::roundId($stackKey, $number),
                                'round_number' => $number,
                                'title' => $title,
                                'description' => $description,
                                'duration_minutes' => $questions === []
                                    ? (int) ($stack['duration_minutes'] ?? 15)
                                    : max(1, (int) ceil(array_sum(array_column($questions, 'duration_seconds')) / count($questions) * min(count($questions), $sitting) / 60)),
                                'tags' => array_values(array_unique(array_merge([$stackKey, $roleKey, 'mock'], $stack['tags'] ?? []))),
                                'questions' => $questions,
                            ];
                        }
                    }
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
                    'parent_sets' => $parentSets,
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

    private function questionCounts(): array
    {
        try {
            return Cache::remember(self::CACHE_QUESTION_COUNTS, self::CACHE_TTL, function () {
                $out = [];
                $rows = DB::table('mock_interview_questions')
                    ->select('stack_key', 'round_number')
                    ->selectRaw('COALESCE(parent_set_number, 1) as set_num, COUNT(*) as cnt, COALESCE(SUM(duration_seconds), 0) as total_duration')
                    ->groupBy('stack_key', 'set_num', 'round_number')
                    ->get();

                foreach ($rows as $row) {
                    $setNum = (int) $row->set_num;
                    $roundNum = (int) $row->round_number;
                    $out[$row->stack_key][$setNum][$roundNum] = [
                        'count' => (int) $row->cnt,
                        'total_duration' => (int) $row->total_duration,
                    ];
                }

                return $out;
            });
        } catch (QueryException $e) {
            report($e);

            return [];
        }
    }

    /** @return list<array<string, mixed>> */
    private function questionsForRound(string $stackKey, int $setNum, int $roundNum): array
    {
        try {
            return MockInterviewQuestion::query()
                ->where('stack_key', $stackKey)
                ->where('round_number', $roundNum)
                ->when(
                    $setNum === 1,
                    fn ($q) => $q->where(fn ($w) => $w->where('parent_set_number', 1)->orWhereNull('parent_set_number')),
                    fn ($q) => $q->where('parent_set_number', $setNum)
                )
                ->orderBy('position')
                ->orderBy('id')
                ->get()
                ->map->toCatalog()
                ->all();
        } catch (QueryException $e) {
            report($e);

            return [];
        }
    }

    /**
     * Staff-written questions by stack, parent_set, and round.
     *
     * @return array<string, mixed>
     */
    private function questions(): array
    {
        try {
            $out = [];

            foreach (MockInterviewQuestion::query()->orderBy('stack_key')->orderBy('parent_set_number')->orderBy('round_number')->orderBy('position')->orderBy('id')->get() as $q) {
                $setNum = (int) ($q->parent_set_number ?? 1);
                $roundNum = (int) $q->round_number;
                $out[$q->stack_key][$setNum][$roundNum][] = $q->toCatalog();
            }

            return $out;
        } catch (QueryException $e) {
            report($e);

            return [];
        }
    }
}
