<?php

namespace App\Services\Vault;

use App\Models\CuratedSetQuestion;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * The Vault AI Interview catalog as ONE tree: role -> stack -> series (3) -> set (3) -> questions. Everything that needs a role,
 * a stack, a set or its questions (the student explorer, the qualification service, the admin question screen) reads it from here.
 *
 * It is assembled from three sources:
 *   1. config/curated_interview_sets.php    the 5 roles / 12 stacks whose questions are written out in full;
 *   2. config/curated_interview_domains.php every other Mellow Vault domain, as empty shells (a role, its stacks, and the
 *                                           three rounds each stack is assessed on), expanded here into 3 series x 3 sets;
 *   3. curated_set_questions                questions staff added later, appended to whichever set they belong to.
 *
 * A set is READY when it has at least `min_questions_per_set` questions. A stack is LIVE — open to students — only when all 9
 * of its sets are ready: a student who fails Series 1 is moved on to Series 2, so a half-written stack would strand them.
 * A stack that is not live is still listed ("Coming soon", with its syllabus) but nothing in it can be started.
 *
 * Built once per request and kept; call flush() after changing questions.
 */
class CuratedCatalog
{
    public const SERIES = 3;

    public const SETS_PER_SERIES = 3;

    private const CACHE_SET_SUMMARY = 'curated-catalog:set-summary:v1';

    private const CATALOG_CACHE_TTL = 3600;

    /** @var array<string, array<string, mixed>>|null */
    private ?array $roles = null;

    /** @var array<string, array<string, mixed>>|null */
    private ?array $summary = null;

    /** @return array<string, array<string, mixed>> role key => role (with `stacks` keyed by stack key) */
    public function roles(): array
    {
        return $this->roles ??= $this->build($this->customQuestions());
    }

    /**
     * Lightweight role tree with set counts & up to 3 preview texts per set (tiny cached query,
     * avoids serializing thousands of full rubric notes when browsing catalogs).
     *
     * @return array<string, array<string, mixed>>
     */
    public function summaryRoles(): array
    {
        if ($this->roles !== null) {
            return $this->roles;
        }

        return $this->summary ??= $this->build($this->customSummary(), countsOnly: true);
    }

    public function flush(): void
    {
        $this->roles = null;
        $this->summary = null;
        self::flushCache();
    }

    public static function flushCache(): void
    {
        Cache::forget(self::CACHE_SET_SUMMARY);
        \App\Services\Mock\MockInterviewCatalog::flushCache();
    }

    public function minQuestions(): int
    {
        return max(1, (int) config('curated_interview_domains.min_questions_per_set', 5));
    }

    public function isSetReady(array $set): bool
    {
        $count = $set['question_count'] ?? count($set['questions'] ?? []);

        return $count >= $this->minQuestions();
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
     * How far a stack is from open.
     *
     * @return array{ready_sets: int, total_sets: int, live: bool, missing: list<array{series: int, set: int, have: int, need: int}>}
     */
    public function progress(array $stack): array
    {
        $ready = 0;
        $total = 0;
        $missing = [];

        foreach ($this->allSets($stack) as $set) {
            $total++;

            if ($this->isSetReady($set)) {
                $ready++;
            } else {
                $missing[] = [
                    'series' => (int) ($set['series_number'] ?? 1),
                    'set' => (int) ($set['set_number'] ?? 1),
                    'have' => (int) ($set['question_count'] ?? count($set['questions'] ?? [])),
                    'need' => $this->minQuestions(),
                ];
            }
        }

        return ['ready_sets' => $ready, 'total_sets' => $total, 'live' => $total > 0 && $ready === $total, 'missing' => $missing];
    }

    public function isLive(string $stackKey): bool
    {
        foreach ($this->summaryRoles() as $role) {
            if (isset($role['stacks'][$stackKey])) {
                return $this->progress($role['stacks'][$stackKey])['live'];
            }
        }

        return false;
    }

    /** @return array<string, bool> stack key => live, for every stack (used to see which stacks a change just opened) */
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

    /** @return list<array<string, mixed>> */
    public function allSets(array $stack): array
    {
        $sets = [];

        foreach ($stack['series'] ?? [] as $series) {
            foreach ($series['sets'] ?? [] as $set) {
                $sets[] = $set;
            }
        }

        return $sets;
    }

    // ───────────────────────────── assembly ─────────────────────────────

    /** @return array<string, array<string, mixed>> */
    private function build(array $custom, bool $countsOnly = false): array
    {
        $roles = (array) config('curated_interview_sets.roles', []);
        $domains = (array) config('curated_interview_domains.roles', []);

        foreach ($domains as $roleKey => $definition) {
            $roleKey = (string) $roleKey;

            if (! isset($roles[$roleKey])) {
                $roles[$roleKey] = [
                    'key' => $roleKey,
                    'title' => $definition['title'],
                    'blurb' => $definition['blurb'],
                    'icon' => $definition['icon'] ?? 'Server',
                    'badge' => $definition['badge'] ?? null,
                    'color' => $definition['color'] ?? 'indigo',
                    'stacks' => [],
                ];
            }

            foreach ($definition['stacks'] ?? [] as $stackKey => $stackDefinition) {
                // A hand-written stack of the same key always wins: shells never shadow real questions.
                $roles[$roleKey]['stacks'][$stackKey] ??= $this->expand($roleKey, (string) $stackKey, $stackDefinition);
            }
        }

        $aliases = (array) config('curated_interview_domains.domains', []);

        foreach ($roles as $roleKey => &$role) {
            foreach ($role['stacks'] as $stackKey => &$stack) {
                $stack['key'] = (string) $stackKey;
                $stack['aliases'] = array_values($aliases[$stackKey] ?? []);
                $stack['tags'] = array_values($stack['tags'] ?? []);

                foreach ($stack['series'] as &$series) {
                    foreach ($series['sets'] as &$set) {
                        $builtin = array_map(fn (array $q) => $q + ['source' => 'builtin'], $set['questions'] ?? []);
                        $set['builtin_count'] = count($builtin);

                        if ($countsOnly) {
                            $seenTexts = [];
                            $previews = [];
                            $count = 0;

                            foreach ($builtin as $q) {
                                $textKey = trim($q['text'] ?? '');
                                if ($textKey !== '' && ! isset($seenTexts[$textKey])) {
                                    $seenTexts[$textKey] = true;
                                    $count++;
                                    if (count($previews) < 3) {
                                        $previews[] = $textKey;
                                    }
                                }
                            }

                            foreach ($custom[$set['id']] ?? [] as $textKey) {
                                if ($textKey !== '' && ! isset($seenTexts[$textKey])) {
                                    $seenTexts[$textKey] = true;
                                    $count++;
                                    if (count($previews) < 3) {
                                        $previews[] = $textKey;
                                    }
                                }
                            }

                            $set['question_count'] = $count;
                            $set['preview_questions'] = $previews;
                            unset($set['questions']);
                        } else {
                            $seenTexts = [];
                            $merged = [];
                            foreach (array_merge($builtin, $custom[$set['id']] ?? []) as $q) {
                                $textKey = trim($q['text'] ?? '');
                                if ($textKey !== '' && ! isset($seenTexts[$textKey])) {
                                    $seenTexts[$textKey] = true;
                                    $merged[] = $q;
                                }
                            }
                            $set['questions'] = $merged;
                        }
                    }
                    unset($set);
                }
                unset($series);
            }
            unset($stack);
        }
        unset($role);

        return $roles;
    }

    /** Turns a compact stack definition (3 themes) into the full 3 series x 3 sets the rest of the app expects, with no questions. */
    private function expand(string $roleKey, string $stackKey, array $definition): array
    {
        $name = (string) $definition['name'];
        $tags = array_values($definition['tags'] ?? []);
        $series = [];

        foreach ((array) config('curated_interview_domains.series', []) as $number => $text) {
            $sets = [];

            foreach (array_values($definition['sets'] ?? []) as $index => [$theme, $description]) {
                $setNumber = $index + 1;
                $sets[] = [
                    'id' => "{$roleKey}-{$stackKey}-s{$number}-set{$setNumber}",
                    'series_number' => (int) $number,
                    'set_number' => $setNumber,
                    'title' => "Set {$setNumber}: {$theme}",
                    'duration_minutes' => 15,
                    'description' => $description,
                    'tags' => array_values(array_unique(array_merge([$stackKey, $roleKey, "series_{$number}", "set_{$setNumber}"], $tags))),
                    'questions' => [],
                ];
            }

            $series[] = [
                'id' => "{$roleKey}-{$stackKey}-series-{$number}",
                'series_number' => (int) $number,
                'title' => $text['title'],
                'description' => Str::replace('{stack}', $name, $text['blurb']),
                'sets' => $sets,
            ];
        }

        return [
            'key' => $stackKey,
            'name' => $name,
            'blurb' => (string) $definition['blurb'],
            'icon' => $definition['icon'] ?? 'Code2',
            'tags' => $tags,
            'series' => $series,
        ];
    }

    /**
     * Questions staff added, by set id. A missing table (the migration has not run on this server yet) must not take the
     * whole catalog down with it: it simply has no staff questions.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    /**
     * Compact custom-question text list per set (cached for catalog summary cards without hydrating full rubrics).
     *
     * @return array<string, list<string>>
     */
    private function customSummary(): array
    {
        try {
            return Cache::remember(self::CACHE_SET_SUMMARY, self::CATALOG_CACHE_TTL, function () {
                $out = [];
                foreach (
                    CuratedSetQuestion::query()
                        ->orderBy('set_id')
                        ->orderBy('position')
                        ->orderBy('id')
                        ->get(['set_id', 'text']) as $row
                ) {
                    $out[$row->set_id][] = trim((string) $row->text);
                }

                return $out;
            });
        } catch (QueryException $e) {
            report($e);

            return [];
        }
    }

    /**
     * Questions staff added, by set id. A missing table (the migration has not run on this server yet) must not take the
     * whole catalog down with it: it simply has no staff questions.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    private function customQuestions(): array
    {
        try {
            return CuratedSetQuestion::query()
                ->orderBy('set_id')->orderBy('position')->orderBy('id')
                ->get()
                ->groupBy('set_id')
                ->map(fn ($rows) => $rows->map->toCatalog()->values()->all())
                ->all();
        } catch (QueryException $e) {
            report($e);

            return [];
        }
    }
}
