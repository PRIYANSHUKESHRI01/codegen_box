<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DriveApplication;
use App\Models\PlacementDrive;
use App\Models\User;
use App\Services\DrivePipelineService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * A TPO's real placement pipeline for their own college — every method
 * scoped to $request->user()->college_id, the same isolation rule every
 * other TPO-reachable endpoint enforces.
 */
class TpoDriveApplicationController extends Controller
{
    public function index(Request $request, PlacementDrive $placementDrive)
    {
        $applications = DriveApplication::where('placement_drive_id', $placementDrive->id)
            ->where('college_id', $request->user()->college_id)
            ->with('user:id,name,email,roll_number,branch,parent_phone')
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
        $application->load('user:id,name,email,roll_number,branch,parent_phone');

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
        $application->load('user:id,name,email,roll_number,branch,parent_phone');

        return response()->json(['application' => $application]);
    }
}
