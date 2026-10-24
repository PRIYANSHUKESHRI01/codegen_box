<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Branch;
use App\Models\BranchAlias;
use App\Models\Discipline;
use App\Models\User;
use App\Services\BranchAssignmentService;
use App\Support\BranchCatalog;
use App\Support\BranchNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Superadmin → Branches: the catalogue behind every branch picker and every
 * "is this student eligible" decision. Adding a spelling here fixes every
 * student, in every college, whose imported label is that spelling — in one
 * query per distinct label (BranchAssignmentService::reresolve).
 */
class SuperAdminBranchController extends Controller
{
    public function __construct(
        private readonly BranchCatalog $catalog,
        private readonly BranchAssignmentService $assignments,
    ) {}

    public function index(): JsonResponse
    {
        $students = User::query()->where('role', User::ROLE_USER);

        $byBranch = (clone $students)->whereNotNull('branch_code')->selectRaw('branch_code, count(*) as n')->groupBy('branch_code')->pluck('n', 'branch_code');
        $byDiscipline = (clone $students)->whereNotNull('discipline')->selectRaw('discipline, count(*) as n')->groupBy('discipline')->pluck('n', 'discipline');

        $unrecognised = (clone $students)
            ->whereNotNull('branch_key')
            ->whereNull('branch_code')
            ->where('branch_source', 'college')
            ->selectRaw('branch_key, min(branch) as sample, count(*) as students, count(distinct college_id) as colleges')
            ->groupBy('branch_key')
            ->orderByDesc('students')
            ->limit(50)
            ->get();

        return response()->json([
            'disciplines' => Discipline::query()->orderBy('sort')->get()->map(fn (Discipline $d) => [
                'code' => $d->code, 'name' => $d->name, 'short' => $d->short, 'is_live' => $d->is_live,
                'department_code' => $d->department_code,
                'students' => (int) ($byDiscipline[$d->code] ?? 0),
            ]),
            'branches' => Branch::query()->orderBy('sort')->orderBy('id')->get()->map(fn (Branch $b) => [
                'code' => $b->code, 'discipline_code' => $b->discipline_code, 'name' => $b->name, 'short' => $b->short,
                'is_active' => $b->is_active, 'capabilities' => (object) ($b->capabilities ?? []), 'students' => (int) ($byBranch[$b->code] ?? 0),
            ]),
            'aliases' => BranchAlias::query()->where('college_id', BranchAlias::GLOBAL_SCOPE)->orderBy('branch_code')->orderBy('alias_key')->get()
                ->map(fn (BranchAlias $a) => ['id' => $a->id, 'branch_code' => $a->branch_code, 'label' => $a->label ?? $a->alias_key, 'key' => $a->alias_key]),
            'unrecognised' => $unrecognised,
            'unresolved_students' => (clone $students)->whereNotNull('branch_key')->whereNull('branch_code')->count(),
        ]);
    }

    public function storeBranch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40', 'regex:/^[a-z][a-z0-9_]*$/', Rule::unique('branches', 'code')],
            'discipline_code' => ['required', 'string', Rule::exists('disciplines', 'code')],
            'name' => ['required', 'string', 'max:120'],
            'short' => ['required', 'string', 'max:30'],
            'capabilities' => ['sometimes', 'nullable', 'array'],
            'capabilities.*' => ['nullable', 'boolean'],
        ]);

        $validated['capabilities'] = $this->capabilities($validated['capabilities'] ?? []);
        $branch = Branch::create($validated + ['sort' => (int) Branch::max('sort') + 1]);
        $this->addAlias($branch->code, $branch->name, $request->user());
        $this->addAlias($branch->code, $branch->short, $request->user());

        $this->catalog->flush();
        ActivityLog::record($request->user(), 'Added a branch', 'Branch', $branch->name, ['code' => $branch->code]);

        return response()->json(['branch' => $branch], 201);
    }

    public function updateBranch(Request $request, Branch $branch): JsonResponse
    {
        $validated = $request->validate([
            'discipline_code' => ['sometimes', 'string', Rule::exists('disciplines', 'code')],
            'name' => ['sometimes', 'string', 'max:120'],
            'short' => ['sometimes', 'string', 'max:30'],
            'is_active' => ['sometimes', 'boolean'],
            'capabilities' => ['sometimes', 'nullable', 'array'],
            'capabilities.*' => ['nullable', 'boolean'],
        ]);

        if (array_key_exists('capabilities', $validated)) {
            $validated['capabilities'] = $this->capabilities($validated['capabilities'] ?? []);
        }

        $disciplineChanged = isset($validated['discipline_code']) && $validated['discipline_code'] !== $branch->discipline_code;

        $branch->update($validated);

        // Students already resolved to this branch carry its discipline with them.
        if ($disciplineChanged) {
            User::query()->where('role', User::ROLE_USER)->where('branch_code', $branch->code)->update([
                'discipline' => $branch->discipline_code,
                'department' => $this->catalog->departmentOfDiscipline($branch->discipline_code) ?? DB::raw('department'),
            ]);
        }

        $this->catalog->flush();
        ActivityLog::record($request->user(), 'Edited a branch', 'Branch', $branch->name, ['code' => $branch->code, 'changes' => $validated]);

        return response()->json(['branch' => $branch->fresh()]);
    }

    public function storeAlias(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'label' => ['required', 'string', 'max:150'],
            'branch_code' => ['required', 'string', Rule::exists('branches', 'code')],
        ]);

        $alias = $this->addAlias($validated['branch_code'], $validated['label'], $request->user());
        $updated = $this->assignments->reresolve(null, $alias->alias_key);

        ActivityLog::record($request->user(), 'Added a branch spelling', 'Branch', $validated['label'], [
            'branch_code' => $validated['branch_code'], 'students_updated' => $updated,
        ]);

        return response()->json(['alias' => $alias, 'students_updated' => $updated], 201);
    }

    public function destroyAlias(Request $request, BranchAlias $alias): JsonResponse
    {
        abort_unless($alias->college_id === BranchAlias::GLOBAL_SCOPE, 404);

        $key = $alias->alias_key;
        $alias->delete();
        $updated = $this->assignments->reresolve(null, $key);

        ActivityLog::record($request->user(), 'Removed a branch spelling', 'Branch', $alias->label ?? $key, [
            'branch_code' => $alias->branch_code, 'students_updated' => $updated,
        ]);

        return response()->json(['students_updated' => $updated]);
    }

    /** Runs the resolver over every student again — the same as `php artisan branches:resolve`. */
    public function reresolveAll(Request $request): JsonResponse
    {
        $updated = $this->assignments->reresolve();
        ActivityLog::record($request->user(), 'Re-resolved all student branches', 'Branch', 'All students', ['students_updated' => $updated]);

        return response()->json(['students_updated' => $updated]);
    }

    /**
     * Only known capability keys with a definite true/false survive; anything else means "inherit from the discipline above".
     *
     * @param  array<string, mixed>  $input
     * @return array<string, bool>
     */
    private function capabilities(array $input): array
    {
        return array_filter($input, fn ($value, $key) => in_array($key, \App\Support\DepartmentCapabilities::keys(), true) && is_bool($value), ARRAY_FILTER_USE_BOTH);
    }

    private function addAlias(string $branchCode, string $label, User $actor): BranchAlias
    {
        $key = BranchNormalizer::key($label);

        if ($key === null) {
            throw ValidationException::withMessages(['label' => ['Enter the spelling as colleges write it.']]);
        }

        $existing = BranchAlias::query()->where('college_id', BranchAlias::GLOBAL_SCOPE)->where('alias_key', $key)->first();

        if ($existing && $existing->branch_code !== $branchCode) {
            $other = $this->catalog->labelOf($existing->branch_code) ?? $existing->branch_code;
            throw ValidationException::withMessages(['label' => ["“{$label}” is already a spelling of {$other}. Remove it there first."]]);
        }

        return $existing ?? DB::transaction(fn () => BranchAlias::create([
            'alias_key' => $key, 'branch_code' => $branchCode, 'college_id' => BranchAlias::GLOBAL_SCOPE,
            'label' => $label, 'created_by' => $actor->id,
        ]));
    }
}
