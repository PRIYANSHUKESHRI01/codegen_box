<?php

namespace App\Support;

use App\Models\User;

/**
 * Which modules a student sees — the ONE place that answers it. Resolved from the catalogue, layer by layer, last wins:
 *
 *     registry default (config/departments.php)  →  department  →  discipline  →  branch  →  student opt-in
 *
 * A student whose department is not known yet is treated as the fallback department (engineering), so nobody loses a module
 * because we have not classified them. Pure and query-free (the catalogue is memoised), so it is safe to run for every user
 * that is serialized and on every request that is gated by it.
 *
 * The result is sent to the client as `capabilities` for what to SHOW, and the same map gates the API (the `capability:` route
 * middleware) — the browser is never the only line of defence.
 */
final class DepartmentCapabilities
{
    /** @return list<string> */
    public static function keys(): array
    {
        return array_keys((array) config('departments.capabilities'));
    }

    /** @return array<string, bool> */
    public static function defaults(): array
    {
        $out = [];

        foreach ((array) config('departments.capabilities') as $key => $spec) {
            $out[$key] = (bool) ($spec['default'] ?? false);
        }

        return $out;
    }

    /**
     * What a (department, discipline, branch) combination can do. Unknown department / discipline / branch layers simply
     * add nothing; an unknown department falls back to the configured one.
     *
     * @return array<string, bool>
     */
    public static function resolve(?string $department, ?string $discipline = null, ?string $branch = null): array
    {
        $catalog = BranchCatalog::instance();
        $caps = self::defaults();

        $department ??= $catalog->departmentOfDiscipline($discipline) ?? (string) config('departments.fallback', 'engineering');

        foreach ([
            $catalog->department($department)['capabilities'] ?? [],
            $catalog->discipline($discipline)['capabilities'] ?? [],
            $catalog->branch($branch)['capabilities'] ?? [],
        ] as $layer) {
            foreach ((array) $layer as $key => $value) {
                if (array_key_exists($key, $caps)) {
                    $caps[$key] = (bool) $value;
                }
            }
        }

        return $caps;
    }

    /** The map for one student, including the coding opt-in. Staff accounts have no department, so they get null from the model; this is for students. */
    public static function forUser(User $user): array
    {
        $attributes = $user->getAttributes();
        $caps = self::resolve($attributes['department'] ?? null, $attributes['discipline'] ?? null, $attributes['branch_code'] ?? null);

        if (! empty($attributes['coding_opt_in'])) {
            foreach ((array) config('departments.student_opt_in', []) as $key) {
                if (array_key_exists($key, $caps)) {
                    $caps[$key] = true;
                }
            }
        }

        return $caps;
    }

    public static function allows(User $user, string $capability): bool
    {
        return self::forUser($user)[$capability] ?? true;
    }

    /**
     * Whether a student's department has switched this capability off — i.e. an opt-in would change something. The Settings
     * toggle is only offered when this is true for `coding_practice`.
     */
    public static function offByDefault(User $user, string $capability): bool
    {
        $attributes = $user->getAttributes();

        return ! (self::resolve($attributes['department'] ?? null, $attributes['discipline'] ?? null, $attributes['branch_code'] ?? null)[$capability] ?? true);
    }

    /** A department's wording for Domain Prep ("Core Prep", "Management Prep" …). */
    public static function domainPrepLabel(?string $department): string
    {
        $catalog = BranchCatalog::instance();
        $department ??= (string) config('departments.fallback', 'engineering');

        return (string) ($catalog->department($department)['settings']['domain_prep_label'] ?? config('departments.defaults.domain_prep_label', 'Domain Prep'));
    }
}
