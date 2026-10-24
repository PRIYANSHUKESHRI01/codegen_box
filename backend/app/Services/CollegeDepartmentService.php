<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\CollegeDepartment;
use App\Models\Department;
use App\Models\User;
use App\Support\BranchCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Which departments a college runs. The one place that reads and writes `college_departments`, shared by the college's own
 * TPO (self-serve, scoped to their college) and Mellow staff acting on a college's behalf — the same "one implementation,
 * two audiences" shape as StudentImportService.
 *
 * A college always runs at least one department, and a department that still has students cannot be switched off by the
 * college itself (their roster would silently vanish from every screen); Mellow staff can do it knowingly with `force`.
 */
class CollegeDepartmentService
{
    public function __construct(private readonly BranchCatalog $catalog) {}

    /**
     * Every department in the catalogue with whether this college runs it and how many students it has there.
     *
     * @return list<array{code: string, name: string, short: string, description: ?string, icon: string, accent: string, enabled: bool, students: int}>
     */
    public function summary(College $college): array
    {
        $enabled = array_flip($college->departmentCodes());
        $students = User::query()->where('role', User::ROLE_USER)->where('college_id', $college->id)->whereNotNull('department')
            ->selectRaw('department, count(*) as n')->groupBy('department')->pluck('n', 'department');

        return array_map(fn (array $d) => [
            'code' => $d['code'], 'name' => $d['name'], 'short' => $d['short'], 'description' => $d['description'],
            'icon' => $d['icon'], 'accent' => $d['accent'],
            'enabled' => isset($enabled[$d['code']]), 'students' => (int) ($students[$d['code']] ?? 0),
        ], $this->catalog->departments());
    }

    /**
     * The department an add / import is for. A college that runs a single department needs no answer (it is that one); a college
     * that runs several must say which — silently guessing would put a Commerce roster into Engineering.
     *
     * @throws ValidationException when it is missing, unknown, or not one of this college's departments
     */
    public function requested(College $college, mixed $requested, string $field = 'department'): string
    {
        $enabled = $college->departmentCodes();
        $requested = is_string($requested) && trim($requested) !== '' ? trim($requested) : null;

        if ($requested === null) {
            if (count($enabled) === 1) {
                return $enabled[0];
            }

            throw ValidationException::withMessages([$field => ['Choose the department these students belong to.']]);
        }

        if (! in_array($requested, $enabled, true)) {
            $name = $this->catalog->department($requested)['name'] ?? $requested;

            throw ValidationException::withMessages([$field => ["{$college->name} does not run the {$name} department. Enable it first (Settings → Departments)."]]);
        }

        return $requested;
    }

    /**
     * Why a branch label does not belong in this department, or null when it does (or says nothing we recognise — an
     * unrecognised label stays in the department and is mapped later). A label that clearly names a programme of ANOTHER
     * department is refused: "B.Com" in a Management roster is a mistake worth stopping at the door, not a student to file
     * under Management.
     */
    public function labelConflict(College $college, ?string $label, string $department): ?string
    {
        $label = trim((string) $label);

        if ($label === '') {
            return null;
        }

        $code = $this->catalog->resolve($label, $college->id, $department);
        $actual = $code === null ? null : $this->catalog->departmentOf($code);

        if ($actual === null || $actual === $department) {
            return null;
        }

        $branch = $this->catalog->labelOf($code);
        $other = $this->catalog->department($actual)['name'] ?? $actual;
        $this_ = $this->catalog->department($department)['name'] ?? $department;

        return "“{$label}” is {$branch}, a programme of the {$other} department, but this is a {$this_} import. Import it from {$other}, or correct the branch.";
    }

    /**
     * Replace the set of departments a college runs.
     *
     * @param  list<string>  $codes
     * @return list<string> the departments now enabled
     *
     * @throws ValidationException
     */
    public function set(College $college, array $codes, User $actor, bool $force = false): array
    {
        $codes = array_values(array_unique(array_map('strval', $codes)));
        $known = array_column($this->catalog->departments(), 'code');

        if ($codes === [] || array_diff($codes, $known) !== []) {
            throw ValidationException::withMessages(['departments' => ['Choose at least one department from the list.']]);
        }

        $current = $college->departmentCodes();
        $removed = array_values(array_diff($current, $codes));

        if ($removed !== [] && ! $force) {
            $blocking = User::query()->where('role', User::ROLE_USER)->where('college_id', $college->id)->whereIn('department', $removed)
                ->selectRaw('department, count(*) as n')->groupBy('department')->pluck('n', 'department');

            if ($blocking->isNotEmpty()) {
                $names = $blocking->map(fn ($n, $code) => ($this->catalog->department($code)['name'] ?? $code)." ({$n} students)")->values()->implode(', ');

                throw ValidationException::withMessages([
                    'departments' => ["{$names} still have students. Move or remove them before switching the department off."],
                ]);
            }
        }

        DB::transaction(function () use ($college, $codes, $removed, $actor) {
            if ($removed !== []) {
                CollegeDepartment::query()->where('college_id', $college->id)->whereIn('department_code', $removed)->delete();
            }

            foreach ($codes as $code) {
                CollegeDepartment::query()->firstOrCreate(
                    ['college_id' => $college->id, 'department_code' => $code],
                    ['enabled_by' => $actor->id],
                );
            }
        });

        $added = array_values(array_diff($codes, $current));

        if ($added !== [] || $removed !== []) {
            ActivityLog::record($actor, 'Changed the departments a college runs', 'College', $college->name, [
                'added' => $added, 'removed' => $removed, 'forced' => $force && $removed !== [],
            ]);
        }

        return $college->refresh()->departmentCodes();
    }

    /** Make a brand-new college run the given departments (default: the fallback), without the "still has students" checks. */
    public function initialise(College $college, ?array $codes, User $actor): void
    {
        $known = array_column($this->catalog->departments(), 'code');
        $codes = array_values(array_intersect($codes ?: [(string) config('departments.fallback', Department::ENGINEERING)], $known));

        foreach ($codes === [] ? [Department::ENGINEERING] : $codes as $code) {
            CollegeDepartment::query()->firstOrCreate(['college_id' => $college->id, 'department_code' => $code], ['enabled_by' => $actor->id]);
        }
    }
}
