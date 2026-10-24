<?php

namespace App\Support;

use App\Models\Branch;
use App\Models\BranchAlias;
use App\Models\Department;
use App\Models\Discipline;
use App\Models\DisciplinePilot;
use Illuminate\Support\Facades\Cache;

/**
 * The branch catalogue held in memory: departments, disciplines, branches and every spelling
 * we know. Resolving a student's branch, and judging drive eligibility, run once
 * per student per drive inside cohort paths — they must never touch the
 * database per student, so everything here is loaded once (and cached for a few
 * minutes across requests) and then answered from arrays.
 *
 * Registered as a scoped singleton (AppServiceProvider), so a queue worker gets
 * a fresh one per job. Staff edits call flush() so the next request sees them.
 */
final class BranchCatalog
{
    private const CACHE_TTL = 600;

    // v2: the catalogue gained departments + capabilities. A new key, so a cache written by the previous release is never read in the new shape.
    private const GLOBAL_KEY = 'branch-catalog:global:v2';

    private const VERSION_KEY = 'branch-catalog:version';

    /** @var array{departments: array<string, array<string, mixed>>, disciplines: array<string, array<string, mixed>>, branches: array<string, array<string, mixed>>, aliases: array<string, string>, scoped: array<string, array<string, string>>}|null */
    private ?array $global = null;

    /** @var array<int, array<string, string>> college id → "<department>|<alias key>" → branch code */
    private array $college = [];

    private ?int $version = null;

    public static function instance(): self
    {
        return app(self::class);
    }

    /** @return list<array<string, mixed>> */
    public function departments(bool $activeOnly = true): array
    {
        $rows = array_values($this->load()['departments']);

        return $activeOnly ? array_values(array_filter($rows, fn (array $d) => $d['is_active'])) : $rows;
    }

    /** @return array<string, mixed>|null */
    public function department(?string $code): ?array
    {
        return $code === null ? null : ($this->load()['departments'][$code] ?? null);
    }

    /** The department a discipline belongs to ("ece" → "engineering", "mba" → "management"). */
    public function departmentOfDiscipline(?string $disciplineCode): ?string
    {
        return $this->discipline($disciplineCode)['department_code'] ?? null;
    }

    /** The department a branch belongs to (through its discipline). */
    public function departmentOf(?string $branchCode): ?string
    {
        return $this->departmentOfDiscipline($this->disciplineOf($branchCode));
    }

    /** @return list<array<string, mixed>> */
    public function disciplines(?string $department = null): array
    {
        $rows = array_values($this->load()['disciplines']);

        return $department === null ? $rows : array_values(array_filter($rows, fn (array $d) => $d['department_code'] === $department));
    }

    /** @return list<array<string, mixed>> */
    public function branches(bool $activeOnly = true): array
    {
        $rows = array_values($this->load()['branches']);

        return $activeOnly ? array_values(array_filter($rows, fn (array $b) => $b['is_active'])) : $rows;
    }

    /** @return array<string, string> normalised spelling → branch code (the global list) */
    public function aliases(): array
    {
        return $this->load()['aliases'];
    }

    /** @return array<string, mixed>|null */
    public function discipline(?string $code): ?array
    {
        return $code === null ? null : ($this->load()['disciplines'][$code] ?? null);
    }

    /** @return array<string, mixed>|null */
    public function branch(?string $code): ?array
    {
        return $code === null ? null : ($this->load()['branches'][$code] ?? null);
    }

    public function disciplineOf(?string $branchCode): ?string
    {
        return $this->branch($branchCode)['discipline_code'] ?? null;
    }

    public function labelOf(?string $branchCode): ?string
    {
        return $this->branch($branchCode)['name'] ?? null;
    }

    /**
     * The canonical branch code for text a college typed, or null when we don't
     * recognise it. A college's own mapping wins over the global list.
     */
    public function resolve(?string $raw, ?int $collegeId = null, ?string $department = null): ?string
    {
        $key = BranchNormalizer::key($raw);

        return $key === null ? null : $this->resolveKey($key, $collegeId, $department);
    }

    /**
     * resolve() for text that has already been through BranchNormalizer::key() (e.g. users.branch_key).
     *
     * `$department` is the department the caller is looking at (a roster import for Commerce, a TPO screen scoped to
     * Management). A spelling that is ambiguous across departments ("Finance") is then read the way THAT department means
     * it; without a department only the spellings that mean the same everywhere resolve. A college's own mapping always
     * wins — a TPO chose it deliberately.
     */
    public function resolveKey(string $key, ?int $collegeId = null, ?string $department = null): ?string
    {
        if ($collegeId) {
            $mine = $this->collegeAliases($collegeId);
            // A mapping the TPO made for one department's students ("Finance" for Commerce) beats one made for every department.
            $code = ($department !== null ? ($mine[$department.'|'.$key] ?? null) : null) ?? ($mine['|'.$key] ?? null);

            if ($code !== null && $this->isKnownBranch($code)) {
                return $code;
            }
        }

        $load = $this->load();

        if ($department !== null) {
            $code = $load['scoped'][$department][$key] ?? null;

            if ($code !== null && $this->isKnownBranch($code)) {
                return $code;
            }
        }

        $code = $load['aliases'][$key] ?? null;

        return $code !== null && $this->isKnownBranch($code) ? $code : null;
    }

    /**
     * Same as resolve(), for a token that may already BE a canonical code
     * ("ece") as well as free text ("MECH") — what a drive's stored
     * `eligible_branches` entries are.
     */
    public function canonical(string $token, ?int $collegeId = null): ?string
    {
        $trimmed = trim($token);

        if ($trimmed === '') {
            return null;
        }

        if ($this->isKnownBranch($trimmed)) {
            return $trimmed;
        }

        return $this->resolve($trimmed, $collegeId);
    }

    /**
     * A best guess at which branch an unrecognised label means, for the TPO to confirm — never
     * applied automatically. "Mech A Day" → mech, "E&TC Div B" → etc. Null when nothing is close.
     */
    public function suggest(string $key, ?string $department = null): ?string
    {
        $tokens = explode(' ', $key);
        $best = null;
        $bestScore = 0.0;
        $load = $this->load();

        // Inside a department the department's own spellings are considered too, and a branch of another department never is.
        $candidates = $department === null ? $load['aliases'] : array_merge($load['aliases'], $load['scoped'][$department] ?? []);

        foreach ($candidates as $aliasKey => $code) {
            if (! $this->isKnownBranch($code)) {
                continue;
            }

            if ($department !== null && $this->departmentOf($code) !== $department) {
                continue;
            }

            $aliasTokens = explode(' ', $aliasKey);

            if (strlen($aliasKey) > 2 && array_diff($aliasTokens, $tokens) === []) {
                // Every word of a known spelling appears in the label: "mech" inside "mech a day".
                $score = 0.85 + min(0.1, strlen($aliasKey) / 200);
            } else {
                similar_text($key, $aliasKey, $percent);
                $score = $percent / 100;
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $best = $code;
            }
        }

        return $bestScore >= 0.75 ? $best : null;
    }

    public function isKnownBranch(string $code): bool
    {
        return isset($this->load()['branches'][$code]);
    }

    /**
     * Forget everything (after a staff edit). Bumps a version that is part of every cache key, so
     * the global list AND every college's mappings are dropped at once, in every process.
     */
    public function flush(): void
    {
        Cache::forever(self::VERSION_KEY, $this->version() + 1);
        $this->version = null;
        $this->global = null;
        $this->college = [];
    }

    // ─────────────────────────────── loading ───────────────────────────────

    /** @return array{departments: array<string, array<string, mixed>>, disciplines: array<string, array<string, mixed>>, branches: array<string, array<string, mixed>>, aliases: array<string, string>, scoped: array<string, array<string, string>>} */
    private function load(): array
    {
        return $this->global ??= Cache::remember($this->versioned(self::GLOBAL_KEY), self::CACHE_TTL, function () {
            $pilots = $this->loadPilots();

            $departments = [];
            foreach ($this->loadDepartments() as $d) {
                $departments[$d->code] = [
                    'code' => $d->code, 'name' => $d->name, 'short' => $d->short, 'description' => $d->description,
                    'icon' => $d->icon, 'accent' => $d->accent, 'sort' => $d->sort, 'is_active' => (bool) $d->is_active,
                    'capabilities' => (array) ($d->capabilities ?? []), 'settings' => (array) ($d->settings ?? []),
                ];
            }

            $disciplines = [];
            foreach (Discipline::query()->orderBy('sort')->get() as $d) {
                $disciplines[$d->code] = [
                    'code' => $d->code, 'name' => $d->name, 'short' => $d->short, 'sort' => $d->sort,
                    'department_code' => $d->department_code ?: Department::ENGINEERING,
                    'capabilities' => (array) ($d->capabilities ?? []),
                    'is_live' => (bool) $d->is_live, 'live_at' => $d->live_at?->toIso8601String(),
                    'pilot_college_ids' => $pilots[$d->code] ?? [],
                ];
            }

            $branches = [];
            foreach (Branch::query()->orderBy('sort')->orderBy('id')->get() as $b) {
                $branches[$b->code] = [
                    'code' => $b->code, 'discipline_code' => $b->discipline_code, 'name' => $b->name,
                    'short' => $b->short, 'is_active' => (bool) $b->is_active,
                    'capabilities' => (array) ($b->capabilities ?? []),
                ];
            }

            $aliases = [];
            $scoped = [];
            foreach (BranchAlias::query()->where('college_id', BranchAlias::GLOBAL_SCOPE)->get(['alias_key', 'branch_code', 'department_code']) as $a) {
                if ($a->department_code === '' || $a->department_code === null) {
                    $aliases[$a->alias_key] = $a->branch_code;
                } else {
                    $scoped[$a->department_code][$a->alias_key] = $a->branch_code;
                }
            }

            return ['departments' => $departments, 'disciplines' => $disciplines, 'branches' => $branches, 'aliases' => $aliases, 'scoped' => $scoped];
        });
    }

    /**
     * Departments, read on every cache miss. A database that has not run the departments migration yet degrades to a single
     * implicit engineering department instead of taking the whole catalogue (and every request) down.
     *
     * @return iterable<int, Department>
     */
    private function loadDepartments(): iterable
    {
        try {
            return Department::query()->orderBy('sort')->orderBy('id')->get();
        } catch (\Throwable) {
            return [new Department([
                'code' => Department::ENGINEERING, 'name' => 'Engineering & Technology', 'short' => 'Engineering', 'sort' => 10, 'is_active' => true,
                'icon' => 'cpu', 'accent' => 'indigo', 'capabilities' => [], 'settings' => [],
            ])];
        }
    }

    /**
     * Pilot colleges per branch family. Read on every cache miss of the catalogue, so a database that has not run the
     * pilots migration yet degrades to "no pilots" instead of taking the whole catalogue (and every request) down.
     *
     * @return array<string, list<int>>
     */
    private function loadPilots(): array
    {
        try {
            return DisciplinePilot::query()->get(['discipline_code', 'college_id'])
                ->groupBy('discipline_code')
                ->map(fn ($rows) => $rows->pluck('college_id')->map(fn ($id) => (int) $id)->values()->all())
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * Whether Core Prep is switched on for a student of this family at this college: live for everyone, or this
     * college is a pilot. Query-free (answered from the cached catalogue), so it is safe on hot paths.
     * Says nothing about whether any question exists — that is CoreAccess's second condition.
     */
    public function coreEnabledFor(?string $discipline, ?int $collegeId): bool
    {
        $d = $this->discipline($discipline);

        if ($d === null) {
            return false;
        }

        return (bool) $d['is_live'] || ($collegeId !== null && in_array($collegeId, $d['pilot_college_ids'] ?? [], true));
    }

    /**
     * One college's own mappings, keyed "<department>|<alias key>" ("|" alone = for every department).
     *
     * @return array<string, string>
     */
    private function collegeAliases(int $collegeId): array
    {
        return $this->college[$collegeId] ??= Cache::remember(
            $this->versioned($this->collegeKey($collegeId)),
            self::CACHE_TTL,
            fn () => BranchAlias::query()->where('college_id', $collegeId)->get(['alias_key', 'branch_code', 'department_code'])
                ->mapWithKeys(fn (BranchAlias $a) => [($a->department_code ?? '').'|'.$a->alias_key => $a->branch_code])->all(),
        );
    }

    private function version(): int
    {
        return $this->version ??= (int) Cache::get(self::VERSION_KEY, 1);
    }

    private function versioned(string $key): string
    {
        return $key.':'.$this->version();
    }

    private function collegeKey(int $collegeId): string
    {
        return "branch-catalog:college:{$collegeId}";
    }
}
