<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendAccountCredentialsEmail;
use App\Jobs\SendCandidateInviteEmail;
use App\Models\CandidateImport;
use App\Models\DriveApplication;
use App\Models\PlacementDrive;
use App\Services\CandidateImportService;
use App\Services\DrivePipelineService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * A company's candidate pipeline for one of their own job openings.
 * Candidates aren't company-owned the way students are college-owned (the
 * same person can be in many companies' pipelines, or none) — every method
 * here is scoped by the job opening's ownership, never by a "this company's
 * candidates" roster, because no such roster exists.
 */
class CompanyCandidateController extends Controller
{
    public function __construct(private readonly CandidateImportService $service) {}

    public function index(Request $request, PlacementDrive $placementDrive)
    {
        $this->authorizeOwnership($request, $placementDrive);

        $applications = DriveApplication::where('placement_drive_id', $placementDrive->id)
            ->with('user:id,name,email,roll_number,branch,parent_phone,phone')
            ->get();

        return response()->json(['applications' => $applications]);
    }

    public function store(Request $request, PlacementDrive $placementDrive)
    {
        $this->authorizeOwnership($request, $placementDrive);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $result = $this->service->findOrCreateCandidate(
            $validated['name'],
            $validated['email'],
            $validated['phone'] ?? null,
            $placementDrive->company_id
        );
        $candidate = $result['user'];

        $application = DriveApplication::firstOrCreate(
            ['placement_drive_id' => $placementDrive->id, 'user_id' => $candidate->id],
            [
                'college_id' => $candidate->college_id,
                'stage' => DriveApplication::STAGE_REGISTERED,
                'stage_updated_at' => now(),
                'stage_updated_by' => $request->user()->id,
            ]
        );

        if ($result['created']) {
            SendAccountCredentialsEmail::dispatch($candidate->id, $result['plainPassword']);
        } else {
            SendCandidateInviteEmail::dispatch($candidate->id, $placementDrive->company_id, $placementDrive->role_title);
        }

        $application->load('user:id,name,email,roll_number,branch,parent_phone,phone');

        return response()->json(['application' => $application], 201);
    }

    public function updateStage(Request $request, PlacementDrive $placementDrive, DriveApplication $application, DrivePipelineService $service)
    {
        $this->authorizeOwnership($request, $placementDrive);

        abort_unless($application->placement_drive_id === $placementDrive->id, 404);

        $validated = $request->validate([
            'stage' => ['required', Rule::in(DriveApplication::STAGES)],
            'ctc_offered' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        try {
            $application = $service->transition($application, $validated['stage'], $validated, $request->user());
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first(), 'errors' => $e->errors()], 422);
        }

        $application->load('user:id,name,email,roll_number,branch,parent_phone,phone');

        return response()->json(['application' => $application]);
    }

    /** A ready-to-fill CSV — no academic columns, a candidate isn't a student. */
    public function template(): Response
    {
        $csv = "name,email,phone\n"
            ."Jordan Patel,jordan.patel@example.com,+91-9876543210\n";

        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="candidate-import-template.csv"',
        ]);
    }

    public function import(Request $request, PlacementDrive $placementDrive)
    {
        $this->authorizeOwnership($request, $placementDrive);

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:5120'],
        ]);

        $candidateImport = $this->service->import($placementDrive, $request->file('file'), $request->user());

        return response()->json(['import' => $candidateImport], 201);
    }

    public function indexImports(Request $request, PlacementDrive $placementDrive)
    {
        $this->authorizeOwnership($request, $placementDrive);

        return response()->json([
            'imports' => CandidateImport::where('placement_drive_id', $placementDrive->id)->latest()->get(),
        ]);
    }

    public function showImport(Request $request, PlacementDrive $placementDrive, CandidateImport $candidateImport)
    {
        $this->authorizeOwnership($request, $placementDrive);

        abort_unless($candidateImport->placement_drive_id === $placementDrive->id, 404);

        return response()->json(['import' => $candidateImport->fresh()]);
    }

    private function authorizeOwnership(Request $request, PlacementDrive $placementDrive): void
    {
        abort_unless(
            $placementDrive->company_id === $request->user()->company_id
                && $placementDrive->source === PlacementDrive::SOURCE_COMPANY_DIRECT,
            404
        );
    }
}
