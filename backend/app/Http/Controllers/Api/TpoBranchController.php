<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BranchAlias;
use App\Models\User;
use App\Services\BranchAssignmentService;
use App\Support\BranchCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * A college's own branch mapping: "what do the branch labels in OUR roster mean?"
 *
 * Colleges write branches their own way ("Mech-A (Day)", "E&TC"). Anything the platform
 * doesn't recognise can't be matched to branch drives or branch dashboards, so the TPO sees
 * every distinct label on file here, with a suggestion, and confirms. A mapping is that
 * college's alone — it never changes how another college's labels are read — and fixes
 * every matching student in one query (BranchAssignmentService::reresolve).
 */
class TpoBranchController extends Controller
{
    public function __construct(
        private readonly BranchCatalog $catalog,
        private readonly BranchAssignmentService $assignments,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $collegeId = $this->collegeId($request);

        // Per department: the same bare label ("Finance") can be a different programme in Commerce and in Management.
        $rows = User::query()
            ->where('role', User::ROLE_USER)
            ->where('college_id', $collegeId)
            ->selectRaw('branch_key, min(branch) as sample, branch_code, branch_source, department, count(*) as students')
            ->groupBy('branch_key', 'branch_code', 'branch_source', 'department')
            ->get();

        $own = BranchAlias::query()->where('college_id', $collegeId)->get(['alias_key', 'department_code'])
            ->map(fn (BranchAlias $a) => ($a->department_code ?? '').'|'.$a->alias_key)->flip();

        $labels = $rows
            ->filter(fn ($r) => $r->branch_key !== null && $r->branch_source === 'college')
            ->map(function ($r) use ($own) {
                $code = $r->branch_code;

                return [
                    'key' => $r->branch_key,
                    'label' => $r->sample,
                    'students' => (int) $r->students,
                    'department' => $r->department,
                    'branch_code' => $code,
                    'branch_name' => $this->catalog->labelOf($code),
                    'discipline' => $this->catalog->disciplineOf($code),
                    'mapped_by_college' => $own->has(($r->department ?? '').'|'.$r->branch_key) || $own->has('|'.$r->branch_key),
                    // A guess is made inside the students' own department, never across departments.
                    'suggestion' => $code === null ? $this->suggestion($r->branch_key, $r->department) : null,
                ];
            })
            ->sortBy([['branch_code', 'asc'], ['students', 'desc']])
            ->values();

        $total = (int) $rows->sum('students');
        $perDiscipline = User::query()
            ->where('role', User::ROLE_USER)->where('college_id', $collegeId)->whereNotNull('discipline')
            ->selectRaw('discipline, count(*) as n')->groupBy('discipline')->pluck('n', 'discipline');
        $perDepartment = User::query()
            ->where('role', User::ROLE_USER)->where('college_id', $collegeId)->whereNotNull('department')
            ->selectRaw('department, count(*) as n')->groupBy('department')->pluck('n', 'department');

        // Students who told us "that's not my branch" — their TPO's cue to check the roster.
        $disputed = User::query()
            ->where('role', User::ROLE_USER)->where('college_id', $collegeId)->whereNotNull('branch_disputed_at')
            ->orderByDesc('branch_disputed_at')->limit(50)
            ->get(['id', 'name', 'roll_number', 'branch', 'branch_code'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'roll_number' => $u->roll_number, 'branch' => $u->branch, 'branch_name' => $this->catalog->labelOf($u->branch_code)]);

        return response()->json([
            'disputed' => $disputed,
            'labels' => $labels,
            'summary' => [
                'students' => $total,
                'recognised' => (int) $rows->whereNotNull('branch_code')->sum('students'),
                'unrecognised' => (int) $rows->whereNull('branch_code')->whereNotNull('branch_key')->sum('students'),
                'no_branch' => (int) $rows->whereNull('branch_key')->sum('students'),
                'self_declared' => (int) $rows->where('branch_source', 'self')->sum('students'),
                'by_discipline' => $perDiscipline,
                'by_department' => $perDepartment,
            ],
            // What the college may map labels to: only the departments it runs.
            'departments' => $request->user()->college?->departmentCodes() ?? [],
        ]);
    }

    /** Map a label to a branch for this college (replaces an earlier mapping of the same label). */
    public function map(Request $request): JsonResponse
    {
        $collegeId = $this->collegeId($request);

        $validated = $request->validate([
            'key' => ['required', 'string', 'max:150'],
            'department' => ['nullable', 'string', 'max:30'],
            'branch_code' => ['required', 'string', Rule::exists('branches', 'code')->where('is_active', true)],
        ]);

        $college = $request->user()->college;
        $target = $this->catalog->departmentOf($validated['branch_code']);

        // A college can only map to programmes of the departments it runs.
        abort_unless($college !== null && $college->runsDepartment($target), 422, 'Your college does not run that programme\'s department.');

        // Mapping the students of one department's label into another department would move them there: say so instead.
        $department = $validated['department'] ?? null;
        abort_if($department !== null && $department !== $target, 422, 'That branch belongs to another department than these students.');

        // The label must really be one of this college's — never create mappings for text nobody here uses.
        $exists = User::query()->where('role', User::ROLE_USER)->where('college_id', $collegeId)->where('branch_key', $validated['key'])
            ->when($department !== null, fn ($q) => $q->where('department', $department))->exists();
        abort_unless($exists, 404, 'No student in your college has that branch label.');

        BranchAlias::updateOrCreate(
            ['college_id' => $collegeId, 'alias_key' => $validated['key'], 'department_code' => $department ?? ''],
            ['branch_code' => $validated['branch_code'], 'created_by' => $request->user()->id, 'label' => $request->input('label')],
        );

        $this->catalog->flush();
        $updated = $this->assignments->reresolve($collegeId, $validated['key']);

        return response()->json(['students_updated' => $updated]);
    }

    /** Undo a college mapping; the label goes back to however the platform reads it. */
    public function unmap(Request $request): JsonResponse
    {
        $collegeId = $this->collegeId($request);
        $validated = $request->validate(['key' => ['required', 'string', 'max:150'], 'department' => ['nullable', 'string', 'max:30']]);
        $key = (string) $validated['key'];
        $department = $validated['department'] ?? null;

        BranchAlias::query()->where('college_id', $collegeId)->where('alias_key', $key)
            ->when($department !== null, fn ($q) => $q->where('department_code', $department))->delete();
        $this->catalog->flush();
        $updated = $this->assignments->reresolve($collegeId, $key);

        return response()->json(['students_updated' => $updated]);
    }

    private function suggestion(string $key, ?string $department = null): ?array
    {
        $code = $this->catalog->suggest($key, $department);

        return $code === null ? null : ['branch_code' => $code, 'branch_name' => $this->catalog->labelOf($code)];
    }

    private function collegeId(Request $request): int
    {
        $collegeId = $request->user()->college_id;
        abort_unless($collegeId, 422, 'Your account is not linked to a college.');

        return (int) $collegeId;
    }
}
