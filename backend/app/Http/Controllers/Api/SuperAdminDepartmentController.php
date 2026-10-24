<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Branch;
use App\Models\CollegeDepartment;
use App\Models\CoreQuestion;
use App\Models\CoreSubject;
use App\Models\Department;
use App\Models\Discipline;
use App\Models\User;
use App\Support\BranchCatalog;
use App\Support\DepartmentCapabilities;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Superadmin → Departments: the level above branches. Everything a department IS lives here — its name, the modules its
 * students see (the capability switches), the disciplines inside it, and how well each branch is covered by Domain Prep
 * questions — so adding Pharmacy or Law later is data entry, not a release.
 *
 * Superadmin can see and change everything: moving a discipline between departments carries its students with it.
 */
class SuperAdminDepartmentController extends Controller
{
    /** Lucide icon names the UI knows how to draw; anything else would render as a blank square. */
    public const ICONS = ['cpu', 'briefcase', 'calculator', 'landmark', 'graduation-cap', 'stethoscope', 'pill', 'scale', 'palette', 'flask-conical', 'book-open', 'building-2', 'leaf', 'plane', 'hotel'];

    public const ACCENTS = ['indigo', 'violet', 'emerald', 'rose', 'amber', 'sky', 'teal', 'orange', 'fuchsia', 'cyan'];

    public function __construct(private readonly BranchCatalog $catalog) {}

    public function index(): JsonResponse
    {
        $students = User::query()->where('role', User::ROLE_USER);

        $byDepartment = (clone $students)->whereNotNull('department')->selectRaw('department, count(*) as n')->groupBy('department')->pluck('n', 'department');
        $unclassified = (clone $students)->whereNull('department')->count();
        $byDiscipline = (clone $students)->whereNotNull('discipline')->selectRaw('discipline, count(*) as n')->groupBy('discipline')->pluck('n', 'discipline');
        $byBranch = (clone $students)->whereNotNull('branch_code')->selectRaw('branch_code, count(*) as n')->groupBy('branch_code')->pluck('n', 'branch_code');
        $colleges = CollegeDepartment::query()->selectRaw('department_code, count(*) as n')->groupBy('department_code')->pluck('n', 'department_code');

        $published = CoreQuestion::query()->where('status', CoreQuestion::STATUS_PUBLISHED)->selectRaw('subject_id, count(*) as n')->groupBy('subject_id')->pluck('n', 'subject_id');
        $subjects = CoreSubject::query()->where('is_active', true)->get(['id', 'discipline_code', 'branch_codes']);

        $departments = Department::query()->orderBy('sort')->orderBy('id')->get();
        $disciplines = Discipline::query()->orderBy('sort')->get()->groupBy('department_code');
        $branches = Branch::query()->orderBy('sort')->orderBy('id')->get()->groupBy('discipline_code');

        return response()->json([
            'capability_registry' => collect((array) config('departments.capabilities'))->map(fn (array $spec, string $key) => [
                'key' => $key, 'label' => $spec['label'], 'hint' => $spec['hint'], 'default' => (bool) $spec['default'],
            ])->values(),
            'icons' => self::ICONS,
            'accents' => self::ACCENTS,
            'unclassified_students' => $unclassified,
            'departments' => $departments->map(fn (Department $d) => [
                'code' => $d->code, 'name' => $d->name, 'short' => $d->short, 'description' => $d->description,
                'icon' => $d->icon, 'accent' => $d->accent, 'sort' => $d->sort, 'is_active' => $d->is_active,
                'capabilities' => (object) ($d->capabilities ?? []),
                'resolved_capabilities' => DepartmentCapabilities::resolve($d->code),
                'settings' => (object) ($d->settings ?? []),
                'students' => (int) ($byDepartment[$d->code] ?? 0),
                'colleges' => (int) ($colleges[$d->code] ?? 0),
                'disciplines' => ($disciplines[$d->code] ?? collect())->map(function (Discipline $disc) use ($branches, $byDiscipline, $byBranch, $subjects, $published) {
                    $inDiscipline = $subjects->where('discipline_code', $disc->code);

                    return [
                        'code' => $disc->code, 'name' => $disc->name, 'short' => $disc->short, 'sort' => $disc->sort,
                        'is_live' => $disc->is_live, 'capabilities' => (object) ($disc->capabilities ?? []),
                        'students' => (int) ($byDiscipline[$disc->code] ?? 0),
                        'published_questions' => (int) $inDiscipline->sum(fn (CoreSubject $s) => (int) ($published[$s->id] ?? 0)),
                        'branches' => ($branches[$disc->code] ?? collect())->map(function (Branch $b) use ($byBranch, $inDiscipline, $published) {
                            // What this branch's students are actually offered: the shared subjects plus the ones that list the branch.
                            $visible = $inDiscipline->filter(fn (CoreSubject $s) => empty($s->branch_codes) || in_array($b->code, $s->branch_codes, true));
                            $dedicated = $inDiscipline->filter(fn (CoreSubject $s) => ! empty($s->branch_codes) && in_array($b->code, $s->branch_codes, true));

                            return [
                                'code' => $b->code, 'name' => $b->name, 'short' => $b->short, 'is_active' => $b->is_active,
                                'capabilities' => (object) ($b->capabilities ?? []),
                                'students' => (int) ($byBranch[$b->code] ?? 0),
                                'questions' => (int) $visible->sum(fn (CoreSubject $s) => (int) ($published[$s->id] ?? 0)),
                                'dedicated_questions' => (int) $dedicated->sum(fn (CoreSubject $s) => (int) ($published[$s->id] ?? 0)),
                            ];
                        })->values(),
                    ];
                })->values(),
            ])->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'regex:/^[a-z][a-z0-9_]{1,29}$/', Rule::unique('departments', 'code')],
            'name' => ['required', 'string', 'max:120'],
            'short' => ['required', 'string', 'max:40'],
            'description' => ['nullable', 'string', 'max:255'],
            'icon' => ['nullable', Rule::in(self::ICONS)],
            'accent' => ['nullable', Rule::in(self::ACCENTS)],
            ...$this->capabilityRules(),
        ]);

        $department = Department::create([
            'code' => $validated['code'], 'name' => $validated['name'], 'short' => $validated['short'],
            'description' => $validated['description'] ?? null,
            'icon' => $validated['icon'] ?? 'graduation-cap', 'accent' => $validated['accent'] ?? 'indigo',
            'sort' => (int) Department::max('sort') + 10,
            'capabilities' => $this->cleanCapabilities($validated['capabilities'] ?? []),
            'settings' => $this->cleanSettings($validated['settings'] ?? []),
        ]);

        $this->catalog->flush();
        ActivityLog::record($request->user(), 'Added a department', 'Department', $department->name, ['code' => $department->code]);

        return response()->json(['department' => $department], 201);
    }

    public function update(Request $request, Department $department): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'short' => ['sometimes', 'string', 'max:40'],
            'description' => ['sometimes', 'nullable', 'string', 'max:255'],
            'icon' => ['sometimes', Rule::in(self::ICONS)],
            'accent' => ['sometimes', Rule::in(self::ACCENTS)],
            'sort' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            'is_active' => ['sometimes', 'boolean'],
            ...$this->capabilityRules(),
        ]);

        // The fallback department can never be switched off: a student whose department is unknown is treated as belonging to it.
        if (($validated['is_active'] ?? true) === false && $department->code === config('departments.fallback')) {
            throw ValidationException::withMessages(['is_active' => ['Engineering & Technology is the default department and cannot be deactivated.']]);
        }

        $changes = collect($validated)->except(['capabilities', 'settings'])->all();

        if (array_key_exists('capabilities', $validated)) {
            $changes['capabilities'] = $this->cleanCapabilities($validated['capabilities'] ?? []);
        }

        if (array_key_exists('settings', $validated)) {
            $changes['settings'] = array_merge((array) $department->settings, $this->cleanSettings($validated['settings'] ?? []));
        }

        $department->update($changes);

        $this->catalog->flush();
        ActivityLog::record($request->user(), 'Edited a department', 'Department', $department->name, ['code' => $department->code, 'changes' => array_keys($changes)]);

        return response()->json(['department' => $department->fresh()]);
    }

    public function destroy(Request $request, Department $department): JsonResponse
    {
        abort_if($department->code === config('departments.fallback'), 422, 'The default department cannot be deleted.');

        $blockers = [
            'disciplines' => Discipline::where('department_code', $department->code)->count(),
            'students' => User::where('role', User::ROLE_USER)->where('department', $department->code)->count(),
            'colleges' => CollegeDepartment::where('department_code', $department->code)->count(),
        ];

        if (array_sum($blockers) > 0) {
            throw ValidationException::withMessages(['department' => ["It still has {$blockers['disciplines']} disciplines, {$blockers['students']} students and {$blockers['colleges']} colleges. Move or remove them first, or deactivate the department instead."]]);
        }

        $department->delete();
        $this->catalog->flush();
        ActivityLog::record($request->user(), 'Deleted a department', 'Department', $department->name, ['code' => $department->code]);

        return response()->json(['deleted' => true]);
    }

    // ───────────────────────────── disciplines ─────────────────────────────

    public function storeDiscipline(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'regex:/^[a-z][a-z0-9_]{1,19}$/', Rule::unique('disciplines', 'code')],
            'department_code' => ['required', 'string', Rule::exists('departments', 'code')],
            'name' => ['required', 'string', 'max:100'],
            'short' => ['required', 'string', 'max:30'],
            ...$this->capabilityRules(),
        ]);

        $discipline = Discipline::create([
            'code' => $validated['code'], 'department_code' => $validated['department_code'], 'name' => $validated['name'], 'short' => $validated['short'],
            'sort' => (int) Discipline::max('sort') + 10,
            'capabilities' => $this->cleanCapabilities($validated['capabilities'] ?? []),
        ]);

        $this->catalog->flush();
        ActivityLog::record($request->user(), 'Added a discipline', 'Discipline', $discipline->name, ['code' => $discipline->code, 'department' => $discipline->department_code]);

        return response()->json(['discipline' => $discipline], 201);
    }

    public function updateDiscipline(Request $request, Discipline $discipline): JsonResponse
    {
        $validated = $request->validate([
            'department_code' => ['sometimes', 'string', Rule::exists('departments', 'code')],
            'name' => ['sometimes', 'string', 'max:100'],
            'short' => ['sometimes', 'string', 'max:30'],
            'sort' => ['sometimes', 'integer', 'min:0', 'max:1000'],
            ...$this->capabilityRules(),
        ]);

        $moved = isset($validated['department_code']) && $validated['department_code'] !== $discipline->department_code;
        $changes = collect($validated)->except(['capabilities', 'settings'])->all();

        if (array_key_exists('capabilities', $validated)) {
            $changes['capabilities'] = $this->cleanCapabilities($validated['capabilities'] ?? []);
        }

        DB::transaction(function () use ($discipline, $changes, $moved, $validated) {
            $discipline->update($changes);

            // The students of a moved discipline move with it.
            if ($moved) {
                User::query()->where('role', User::ROLE_USER)->where('discipline', $discipline->code)->update(['department' => $validated['department_code']]);
            }
        });

        $this->catalog->flush();
        ActivityLog::record($request->user(), 'Edited a discipline', 'Discipline', $discipline->name, ['code' => $discipline->code, 'changes' => array_keys($changes), 'moved' => $moved]);

        return response()->json(['discipline' => $discipline->fresh()]);
    }

    // ───────────────────────────── helpers ─────────────────────────────

    /** @return array<string, array<int, mixed>> */
    private function capabilityRules(): array
    {
        return [
            'capabilities' => ['sometimes', 'nullable', 'array'],
            'capabilities.*' => ['nullable', 'boolean'],
            'settings' => ['sometimes', 'nullable', 'array'],
            'settings.domain_prep_label' => ['sometimes', 'nullable', 'string', 'max:40'],
            'settings.domain_prep_blurb' => ['sometimes', 'nullable', 'string', 'max:140'],
        ];
    }

    /**
     * Keep only known capability keys with a definite true/false; null (or "inherit") removes the override, so the layer above decides.
     *
     * @param  array<string, mixed>  $input
     * @return array<string, bool>
     */
    private function cleanCapabilities(array $input): array
    {
        $out = [];

        foreach ($input as $key => $value) {
            if (in_array($key, DepartmentCapabilities::keys(), true) && is_bool($value)) {
                $out[$key] = $value;
            }
        }

        return $out;
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, string>
     */
    private function cleanSettings(array $input): array
    {
        return array_filter(
            array_intersect_key($input, array_flip(['domain_prep_label', 'domain_prep_blurb'])),
            fn ($v) => is_string($v) && trim($v) !== ''
        );
    }
}
