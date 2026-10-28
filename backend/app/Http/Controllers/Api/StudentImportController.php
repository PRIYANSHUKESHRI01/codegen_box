<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\Department;
use App\Models\StudentImport;
use App\Services\CollegeDepartmentService;
use App\Services\StudentImportService;
use App\Support\AcademicYear;
use App\Support\BranchCatalog;
use App\Support\StudentImportSheets;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * Bulk student-roster CSV import — one implementation, two audiences:
 * a college's own TPO (self-serve, scoped to their own college), and Mellow
 * staff acting on a college's behalf (for a customer who'd rather send us
 * their spreadsheet than upload it themselves). Both paths funnel through
 * the same StudentImportService so there is exactly one place the actual
 * import logic lives.
 */
class StudentImportController extends Controller
{
    public function __construct(private readonly StudentImportService $service, private readonly CollegeDepartmentService $departments) {}

    // ---- TPO: acts on the caller's own college ----

    public function storeMine(Request $request)
    {
        return $this->storeFor($request, $this->ownCollege($request));
    }

    public function indexMine(Request $request)
    {
        return $this->indexFor($this->ownCollege($request));
    }

    public function showMine(Request $request, StudentImport $studentImport)
    {
        $this->authorizeCollege($studentImport, $this->ownCollege($request));

        return $this->showFor($studentImport);
    }

    // ---- Mellow staff: acts on an explicit college ----

    public function storeForCollege(Request $request, College $college)
    {
        return $this->storeFor($request, $college);
    }

    public function indexForCollege(College $college)
    {
        return $this->indexFor($college);
    }

    public function showForCollege(College $college, StudentImport $studentImport)
    {
        $this->authorizeCollege($studentImport, $college);

        return $this->showFor($studentImport);
    }

    // ---- shared ----

    /**
     * A ready-to-fill CSV so a TPO/staff member never has to guess column
     * names — the only thing standing between "no way to add 1,890
     * students" and a working import.
     */
    public function template(Request $request, BranchCatalog $catalog): Response
    {
        // ?department=commerce: the department's own branch list and example row. Without it, the engineering template this
        // endpoint has always served (a college that runs only one department never needs to ask).
        $requested = $request->query('department');
        $department = is_string($requested) && $catalog->department($requested) !== null ? $requested : null;
        $departmentName = $department === null ? null : $catalog->department($department)['name'];

        $disciplines = collect($catalog->disciplines($department ?? Department::ENGINEERING))->keyBy('code');
        $inDepartment = array_values(array_filter($catalog->branches(), fn (array $b) => isset($disciplines[$b['discipline_code']])));
        $first = $inDepartment[0] ?? null;

        // Engineering keeps the examples it always had; every other department shows a programme of its own.
        $ownSample = $department !== null && $department !== Department::ENGINEERING && $first !== null;
        $suffix = $department ? "-{$department}" : '';

        // ?format=xlsx: an Excel workbook with a Branches sheet and a drop-down on the branch column.
        if ($request->query('format') === 'xlsx') {
            $branches = array_map(fn (array $b) => [
                'name' => $b['name'],
                'discipline' => $disciplines[$b['discipline_code']]['name'] ?? '',
            ], $inDepartment);

            return response(StudentImportSheets::template($branches, $departmentName, $ownSample ? [$first['name'], '24'.strtoupper(substr($first['code'], 0, 3)).'1042'] : null), 200, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => "attachment; filename=\"student-import-template{$suffix}.xlsx\"",
            ]);
        }

        $csv = "name,email,roll_number,branch,section,cgpa,backlogs,phone,parent_phone,year\n"
            .($ownSample
                ? 'Alex Chen,alex.chen@student.example.edu,24'.strtoupper(substr($first['code'], 0, 3)).'1042,"'.$first['name'].'",A,8.4,0,+91-9876543210,+91-9876500000,3rd year'."\n"
                : "Alex Chen,alex.chen@student.example.edu,21CS1042,CSE,A,8.4,0,+91-9876543210,+91-9876500000,3rd year\n");

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"student-import-template{$suffix}.csv\"",
        ]);
    }

    private function ownCollege(Request $request): College
    {
        abort_unless($request->user()->college_id, 422, 'Your account is not linked to a college.');

        return College::findOrFail($request->user()->college_id);
    }

    private function authorizeCollege(StudentImport $studentImport, College $college): void
    {
        abort_unless($studentImport->college_id === $college->id, 404);
    }

    private function storeFor(Request $request, College $college)
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt,xlsx', 'max:5120'],
            'department' => ['nullable', 'string', 'max:30'],
            // The year of study the whole roster is for (1st-4th). Optional: a file may carry a `year` column instead.
            'year' => ['nullable', 'integer', Rule::in(AcademicYear::selectableYears())],
        ]);

        // Which department this roster is for. A college running one department needs no answer; one running several must give it.
        $department = $this->departments->requested($college, $request->input('department'));

        $studentImport = $this->service->import($college, $request->file('file'), $request->user(), $department, $request->filled('year') ? (int) $request->input('year') : null);

        return response()->json(['import' => $studentImport], 201);
    }

    private function indexFor(College $college)
    {
        return response()->json([
            'imports' => StudentImport::where('college_id', $college->id)->latest()->get(),
        ]);
    }

    private function showFor(StudentImport $studentImport)
    {
        return response()->json(['import' => $studentImport->fresh()]);
    }
}
