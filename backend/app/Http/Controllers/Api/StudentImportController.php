<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\StudentImport;
use App\Services\StudentImportService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

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
    public function __construct(private readonly StudentImportService $service) {}

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
    public function template(): Response
    {
        $csv = "name,email,roll_number,branch,section,cgpa,backlogs,phone,parent_phone\n"
            ."Alex Chen,alex.chen@student.example.edu,21CS1042,CSE,A,8.4,0,+91-9876543210,+91-9876500000\n";

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="student-import-template.csv"',
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
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $studentImport = $this->service->import($college, $request->file('file'), $request->user());

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
