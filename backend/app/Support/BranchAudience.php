<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Validation\Rule;

/**
 * "Who is this test/contest/interview FOR?" — an audience a TPO or Mellow can put on content.
 *
 * Until now everything a TPO created was shown to the whole college, so an "ECE mock test" was
 * also offered to the CSE students. An audience is `{departments: ['commerce'], disciplines: ['ece'], branches: ['cse_aiml']}`:
 * a student sees the item when their department, branch family or exact branch is listed. No audience (null /
 * empty) means everyone, exactly as before — nothing existing changes until someone sets one.
 *
 * `departments` is stored only when it is used, so every audience written before departments existed is still byte-for-byte
 * what it was (`{disciplines, branches}`).
 *
 * A student whose branch we don't know yet is let through (fail open): hiding a test from someone
 * because we haven't recognised their branch label would be worse than showing them one that isn't
 * for them. A student whose BRANCH is unknown but whose DEPARTMENT is known (a roster imported under Commerce) is matched by
 * department. Visibility only — it never grants access a college boundary would refuse.
 */
final class BranchAudience
{
    /**
     * Validation rules to merge into a store/update request.
     *
     * @param  string  $key  the request field holding the audience (`branch_audience` for content, `branch_scope` for a coordinator)
     */
    public static function rules(string $key = 'branch_audience'): array
    {
        return [
            $key => ['sometimes', 'nullable', 'array'],
            "{$key}.departments" => ['sometimes', 'nullable', 'array', 'max:10'],
            "{$key}.departments.*" => ['string', 'distinct', Rule::exists('departments', 'code')],
            "{$key}.disciplines" => ['sometimes', 'nullable', 'array', 'max:30'],
            "{$key}.disciplines.*" => ['string', 'distinct', Rule::exists('disciplines', 'code')],
            "{$key}.branches" => ['sometimes', 'nullable', 'array', 'max:80'],
            "{$key}.branches.*" => ['string', 'distinct', Rule::exists('branches', 'code')],
        ];
    }

    /**
     * The value to store: null when nothing is selected ("everyone"), otherwise a clean
     * `{disciplines, branches}` pair (plus `departments` when any is listed).
     *
     * @param  array<string, mixed>|null  $input
     * @return array{disciplines: list<string>, branches: list<string>, departments?: list<string>}|null
     */
    public static function normalize(?array $input): ?array
    {
        $departments = array_values(array_unique(array_filter((array) ($input['departments'] ?? []))));
        $disciplines = array_values(array_unique(array_filter((array) ($input['disciplines'] ?? []))));
        $branches = array_values(array_unique(array_filter((array) ($input['branches'] ?? []))));

        if ($departments === [] && $disciplines === [] && $branches === []) {
            return null;
        }

        return ['disciplines' => $disciplines, 'branches' => $branches] + ($departments === [] ? [] : ['departments' => $departments]);
    }

    /**
     * What a set of branches covers, as comparable tokens — `p:<department>` for a listed department, `d:<family>` for a
     * listed family and `b:<branch>` for each branch inside it, plus any branch listed on its own. Null = everyone (nothing to
     * enumerate). Two audiences overlap when their tokens do, which is how "is this coordinator's slice of Section A free?" is
     * answered without comparing lists by hand: a department covers its families, a family covers its branches, a branch covers
     * itself, and two different branches of one family do not collide.
     *
     * @param  array<string, mixed>|null  $audience  already normalised
     * @return array<string, true>|null
     */
    public static function tokens(?array $audience): ?array
    {
        $audience = self::normalize($audience);

        if ($audience === null) {
            return null;
        }

        $catalog = BranchCatalog::instance();
        $tokens = [];
        $families = $audience['disciplines'];

        foreach ($audience['departments'] ?? [] as $department) {
            $tokens["p:{$department}"] = true;
            foreach ($catalog->disciplines($department) as $family) {
                $families[] = $family['code'];
            }
        }

        foreach (array_unique($families) as $family) {
            $tokens["d:{$family}"] = true;
            foreach ($catalog->branches(activeOnly: false) as $branch) {
                if ($branch['discipline_code'] === $family) {
                    $tokens["b:{$branch['code']}"] = true;
                }
            }
        }

        foreach ($audience['branches'] as $code) {
            $tokens["b:{$code}"] = true;
        }

        return $tokens;
    }

    /** Whether two audiences could both include the same student. Null (everyone) overlaps anything non-empty. */
    public static function overlap(?array $a, ?array $b): bool
    {
        $left = self::tokens($a);
        $right = self::tokens($b);

        if ($left === null || $right === null) {
            return true;
        }

        return array_intersect_key($left, $right) !== [];
    }

    /** "All branches", or the short names of what is listed: "Commerce · ECE, EEE · CSE (AI & ML)". */
    public static function label(?array $audience): string
    {
        $audience = self::normalize($audience);

        if ($audience === null) {
            return 'All branches';
        }

        $catalog = BranchCatalog::instance();
        $names = [];

        foreach ($audience['departments'] ?? [] as $department) {
            $names[] = 'All '.($catalog->department($department)['short'] ?? ucfirst($department));
        }

        foreach ($audience['disciplines'] as $family) {
            $names[] = $catalog->discipline($family)['short'] ?? strtoupper($family);
        }

        foreach ($audience['branches'] as $code) {
            $names[] = $catalog->branch($code)['short'] ?? strtoupper($code);
        }

        return implode(', ', $names);
    }

    /** @param  array<string, mixed>|null  $audience */
    public static function includes(?array $audience, User $user): bool
    {
        $departments = $audience['departments'] ?? [];
        $disciplines = $audience['disciplines'] ?? [];
        $branches = $audience['branches'] ?? [];

        if ($departments === [] && $disciplines === [] && $branches === []) {
            return true;
        }

        $department = $user->getAttributes()['department'] ?? null;

        if ($user->discipline === null && $user->branch_code === null) {
            // Nothing is known about the branch. A student with no department either is let through (we cannot tell). One whose
            // department IS known (a roster imported under Commerce) is let through only when the audience reaches into their
            // department at all — an ECE test never lands on an unplaced Commerce student, but it still reaches an Engineering one.
            if ($department === null) {
                return true;
            }

            return in_array($department, self::departmentsReached($departments, $disciplines, $branches), true);
        }

        return ($department !== null && in_array($department, $departments, true))
            || in_array($user->discipline, $disciplines, true)
            || in_array($user->branch_code, $branches, true);
    }

    /**
     * The departments an audience touches: those it lists, plus the department of every family and branch it lists.
     *
     * @param  list<string>  $departments
     * @param  list<string>  $disciplines
     * @param  list<string>  $branches
     * @return list<string>
     */
    private static function departmentsReached(array $departments, array $disciplines, array $branches): array
    {
        $catalog = BranchCatalog::instance();
        $reached = $departments;

        foreach ($disciplines as $family) {
            $reached[] = $catalog->departmentOfDiscipline($family);
        }

        foreach ($branches as $code) {
            $reached[] = $catalog->departmentOf($code);
        }

        return array_values(array_unique(array_filter($reached)));
    }
}
