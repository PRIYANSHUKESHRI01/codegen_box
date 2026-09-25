<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewRoleTemplate;
use App\Models\InterviewTrack;
use App\Models\PlacementDrive;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Company-hiring-tenant-only: a company's own "Final Interview" pipeline
 * (track_type = company_hiring), always tied to one job opening — mirrors
 * CompanyInterviewController. ALWAYS invite-only: round 1 is invited via the
 * existing CompanyInterviewController::inviteCandidates(), pointed at round
 * 1's own slug — no separate invite endpoint needed here (see
 * Interview::isVisibleToUser()).
 */
class CompanyInterviewTrackController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'tracks' => $this->ownedTracks($request)->withCount('rounds')->with(['placementDrive:id,title,role_title', 'roleTemplate:id,name'])->latest('created_at')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $companyId = $request->user()->company_id;

        if (! $companyId) {
            return response()->json(['message' => 'Your account is not linked to a company.'], 422);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'placement_drive_id' => ['required', 'integer', 'exists:placement_drives,id'],
            'interview_role_template_id' => ['required', 'integer', 'exists:interview_role_templates,id'],
        ]);

        $drive = PlacementDrive::where('id', $validated['placement_drive_id'])
            ->where('company_id', $companyId)
            ->where('source', PlacementDrive::SOURCE_COMPANY_DIRECT)
            ->firstOrFail();

        $template = InterviewRoleTemplate::findOrFail($validated['interview_role_template_id']);
        abort_unless($template->isUsableBy($request->user()), 403, 'This role template is not available to you.');

        $track = DB::transaction(function () use ($request, $validated, $template, $drive, $companyId) {
            $track = InterviewTrack::create([
                'title' => $validated['title'],
                'slug' => InterviewTrack::uniqueSlug($validated['title']),
                'description' => $validated['description'] ?? null,
                'status' => InterviewTrack::STATUS_DRAFT,
                'track_type' => InterviewTrack::TRACK_TYPE_COMPANY_HIRING,
                'role_title' => $template->name,
                'interview_role_template_id' => $template->id,
                'company_id' => $companyId,
                'owning_company_id' => $companyId,
                'placement_drive_id' => $drive->id,
                'created_by' => $request->user()->id,
            ]);

            $track->createRounds($template->rounds_config);

            return $track;
        });

        return response()->json(['track' => $track->load('rounds')], 201);
    }

    public function update(Request $request, InterviewTrack $interviewTrack)
    {
        $this->authorizeOwnership($request, $interviewTrack);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in(InterviewTrack::STATUSES)],
        ]);

        $interviewTrack->update($validated);

        if (isset($validated['status'])) {
            $interviewTrack->rounds()->update(['status' => $validated['status']]);
        }

        return response()->json(['track' => $interviewTrack->fresh('rounds')]);
    }

    public function destroy(Request $request, InterviewTrack $interviewTrack)
    {
        $this->authorizeOwnership($request, $interviewTrack);

        if ($interviewTrack->rounds()->whereHas('sessions')->exists()) {
            return response()->json([
                'message' => 'This track already has shortlisted/invited candidates and cannot be deleted. Set its status to "cancelled" instead.',
            ], 422);
        }

        $interviewTrack->delete();

        return response()->json(['message' => 'Interview track deleted.']);
    }

    private function ownedTracks(Request $request)
    {
        return InterviewTrack::where('track_type', InterviewTrack::TRACK_TYPE_COMPANY_HIRING)
            ->where('owning_company_id', $request->user()->company_id);
    }

    private function authorizeOwnership(Request $request, InterviewTrack $track): void
    {
        abort_unless(
            $track->isCompanyHiring() && $track->owning_company_id === $request->user()->company_id,
            404
        );
    }
}
