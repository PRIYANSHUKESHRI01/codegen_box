<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DriveApplication;
use App\Models\PlacementDrive;
use App\Models\User;
use App\Services\DrivePipelineService;
use App\Support\StudentImportSheets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use ZipArchive;

/**
 * A TPO's real placement pipeline for their own college — every method
 * scoped to $request->user()->college_id, the same isolation rule every
 * other TPO-reachable endpoint enforces.
 */
class TpoDriveApplicationController extends Controller
{
    private const APPLICANT_USER_SELECT = 'user:id,name,email,roll_number,branch,parent_phone,resume_path,cgpa,tenth_percentage,twelfth_percentage,placement_status';

    public function index(Request $request, PlacementDrive $placementDrive)
    {
        $applications = DriveApplication::where('placement_drive_id', $placementDrive->id)
            ->where('college_id', $request->user()->college_id)
            ->with(self::APPLICANT_USER_SELECT)
            ->get();

        return response()->json(['applications' => $applications]);
    }

    public function store(Request $request, PlacementDrive $placementDrive)
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $collegeId = $request->user()->college_id;

        $student = User::where('id', $validated['user_id'])
            ->where('college_id', $collegeId)
            ->where('role', User::ROLE_USER)
            ->firstOrFail();

        $application = DriveApplication::firstOrCreate(
            ['placement_drive_id' => $placementDrive->id, 'user_id' => $student->id],
            [
                'college_id' => $collegeId,
                'stage' => DriveApplication::STAGE_REGISTERED,
                'stage_updated_at' => now(),
                'stage_updated_by' => $request->user()->id,
            ]
        );

        // Same shape as index() — the frontend renders `application.user.*`
        // unconditionally, so every endpoint returning a DriveApplication
        // must eager-load it.
        $application->load(self::APPLICANT_USER_SELECT);

        return response()->json(['application' => $application], 201);
    }

    /**
     * Seeds a `registered` application for every currently-eligible,
     * not-yet-applied student at this college in one action — the genuine
     * spreadsheet replacement, rather than one dropdown click per student.
     */
    public function bulkRegister(Request $request, PlacementDrive $placementDrive, DrivePipelineService $service)
    {
        $registered = $service->registerEligible($placementDrive, $request->user());

        return response()->json(['message' => "Registered {$registered} eligible student(s).", 'registered' => $registered]);
    }

    public function updateStage(Request $request, PlacementDrive $placementDrive, DriveApplication $application, DrivePipelineService $service)
    {
        abort_unless(
            $application->placement_drive_id === $placementDrive->id
                && $application->college_id === $request->user()->college_id,
            404
        );

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

        // transition() returns a fresh() instance with no relations loaded —
        // same shape as index()/store(), since the frontend renders
        // application.user.* unconditionally.
        $application->load(self::APPLICANT_USER_SELECT);

        return response()->json(['application' => $application]);
    }

    /**
     * POST /tpo/drives/{placementDrive}/applications/bulk-stage
     * Advance a checked set of applicants in one step instead of dropdown-clicking 50 rows.
     */
    public function bulkStage(Request $request, PlacementDrive $placementDrive, DrivePipelineService $service)
    {
        $validated = $request->validate([
            'application_ids' => ['required', 'array', 'min:1'],
            'application_ids.*' => ['integer'],
            'stage' => ['required', Rule::in(DriveApplication::STAGES)],
            'ctc_offered' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        try {
            $result = $service->bulkTransition(
                $placementDrive,
                (int) $request->user()->college_id,
                $validated['application_ids'],
                $validated['stage'],
                $validated,
                $request->user()
            );
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first(), 'errors' => $e->errors()], 422);
        }

        $ids = collect($result['updated'])->pluck('id')->all();
        $applications = $ids === []
            ? collect()
            : DriveApplication::whereIn('id', $ids)->with(self::APPLICANT_USER_SELECT)->get();

        return response()->json([
            'message' => count($ids).' applicant(s) moved to '.str_replace('_', ' ', $validated['stage']).'.',
            'applications' => $applications,
            'skipped' => $result['skipped'],
        ]);
    }

    /**
     * POST /tpo/drives/{placementDrive}/applications/import-shortlist
     * Accepts a recruiter CSV/XLSX sheet OR pasted emails/roll numbers and registers + transitions matched students.
     */
    public function importShortlist(Request $request, PlacementDrive $placementDrive, DrivePipelineService $service)
    {
        $validated = $request->validate([
            'stage' => ['required', Rule::in(DriveApplication::STAGES)],
            'ctc_offered' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string', 'max:500'],
            'identifiers' => ['nullable', 'string'],
            'file' => ['nullable', 'file', 'mimes:csv,txt,xlsx,xls', 'max:5120'],
        ]);

        $tokens = [];

        if (! empty($validated['identifiers'])) {
            foreach (preg_split('/[\r\n,;\t]+/', (string) $validated['identifiers']) as $token) {
                $clean = trim($token);
                if ($clean !== '') {
                    $tokens[] = $clean;
                }
            }
        }

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $csvText = StudentImportSheets::isSpreadsheet($file)
                ? StudentImportSheets::toCsv($file)
                : (string) file_get_contents($file->getRealPath());

            $stream = fopen('php://temp', 'r+');
            fwrite($stream, $csvText);
            rewind($stream);

            $header = null;
            $targetCols = null;
            while (($row = fgetcsv($stream)) !== false) {
                $cells = array_map(fn ($v) => trim((string) $v), $row);
                if (count(array_filter($cells, fn ($v) => $v !== '')) === 0) {
                    continue;
                }

                if ($header === null) {
                    $lower = array_map('strtolower', $cells);
                    $cols = [];
                    foreach ($lower as $idx => $colName) {
                        if (in_array($colName, ['email', 'e-mail', 'roll_number', 'roll number', 'rollno', 'roll', 'usn', 'reg_no'], true)) {
                            $cols[] = $idx;
                        }
                    }
                    $header = $lower;
                    if ($cols !== []) {
                        $targetCols = $cols;
                        continue; // skip header row
                    }
                }

                if ($targetCols !== null) {
                    foreach ($targetCols as $idx) {
                        if (! empty($cells[$idx])) {
                            $tokens[] = $cells[$idx];
                        }
                    }
                } else {
                    foreach ($cells as $cell) {
                        if ($cell !== '') {
                            $tokens[] = $cell;
                        }
                    }
                }
            }
            fclose($stream);
        }

        $tokens = array_values(array_unique($tokens));
        if ($tokens === []) {
            return response()->json(['message' => 'Paste at least one email/roll number or upload a CSV/XLSX shortlist.'], 422);
        }

        try {
            $result = $service->importShortlist(
                $placementDrive,
                (int) $request->user()->college_id,
                $tokens,
                $validated['stage'],
                $validated,
                $request->user()
            );
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first(), 'errors' => $e->errors()], 422);
        }

        $ids = collect($result['updated'])->pluck('id')->all();
        $applications = $ids === []
            ? collect()
            : DriveApplication::whereIn('id', $ids)->with(self::APPLICANT_USER_SELECT)->get();

        return response()->json([
            'message' => "Shortlist processed: {$result['registered']} newly registered, {$result['advanced']} advanced, {$result['skipped']} skipped, ".count($result['unmatched']).' unmatched.',
            'applications' => $applications,
            'registered' => $result['registered'],
            'advanced' => $result['advanced'],
            'skipped' => $result['skipped'],
            'unmatched' => $result['unmatched'],
        ]);
    }

    /**
     * POST /tpo/drives/{placementDrive}/applications/{application}/joining-status
     * Track post-offer joining (pending / joined / deferred / reneged).
     */
    public function updateJoiningStatus(Request $request, PlacementDrive $placementDrive, DriveApplication $application, DrivePipelineService $service)
    {
        abort_unless(
            $application->placement_drive_id === $placementDrive->id
                && $application->college_id === $request->user()->college_id,
            404
        );

        $validated = $request->validate([
            'joining_status' => ['required', Rule::in(DriveApplication::JOINING_STATUSES)],
        ]);

        try {
            $application = $service->updateJoiningStatus($application, $validated['joining_status'], $request->user());
        } catch (ValidationException $e) {
            return response()->json(['message' => collect($e->errors())->flatten()->first(), 'errors' => $e->errors()], 422);
        }

        $application->load(self::APPLICANT_USER_SELECT);

        return response()->json(['application' => $application]);
    }

    /**
     * GET /tpo/drives/{placementDrive}/resumes.zip
     * Bundle uploaded PDF resumes for all (or stage-filtered) applicants into a single recruiter ZIP.
     */
    public function exportResumesZip(Request $request, PlacementDrive $placementDrive)
    {
        $collegeId = (int) $request->user()->college_id;
        $stage = $request->query('stage');

        $query = DriveApplication::where('placement_drive_id', $placementDrive->id)
            ->where('college_id', $collegeId)
            ->with('user:id,name,roll_number,branch,resume_path,resume_original_name');

        if (is_string($stage) && $stage !== '' && in_array($stage, DriveApplication::STAGES, true)) {
            $query->where('stage', $stage);
        }

        $applications = $query->get();

        $tempPath = tempnam(sys_get_temp_dir(), 'aptrun_resumes_');
        if ($tempPath === false) {
            abort(500, 'Could not allocate temporary ZIP file.');
        }

        $zip = new ZipArchive;
        if ($zip->open($tempPath, ZipArchive::OVERWRITE) !== true) {
            @unlink($tempPath);
            abort(500, 'Could not create resume ZIP archive.');
        }

        $added = 0;
        $usedNames = [];
        foreach ($applications as $app) {
            $student = $app->user;
            if (! $student || ! $student->resume_path || ! Storage::disk('local')->exists($student->resume_path)) {
                continue;
            }

            $baseName = Str::slug(($student->roll_number ? $student->roll_number.'-' : '').$student->name).'-'.$student->id.'.pdf';
            if (isset($usedNames[$baseName])) {
                $usedNames[$baseName]++;
                $entryName = str_replace('.pdf', "-{$usedNames[$baseName]}.pdf", $baseName);
            } else {
                $usedNames[$baseName] = 1;
                $entryName = $baseName;
            }

            $zip->addFile(Storage::disk('local')->path($student->resume_path), $entryName);
            $added++;
        }

        $zip->close();

        if ($added === 0) {
            @unlink($tempPath);
            return response()->json(['message' => 'No applicants in this filter have uploaded a PDF resume yet.'], 422);
        }

        $downloadName = Str::slug($placementDrive->company?->name.'-'.$placementDrive->title).'-resumes.zip';

        return response()->download($tempPath, $downloadName, ['Content-Type' => 'application/zip'])->deleteFileAfterSend(true);
    }
}
