<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\DriveCollegeMapping;
use App\Models\InterviewRoleTemplate;
use App\Models\InterviewTrack;
use App\Models\PlacementDrive;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only — the "Final Interview" pipeline container.
 * Pure container CRUD: creating a track snapshots its picked
 * InterviewRoleTemplate's rounds_config into 3 real Interview rows (see
 * InterviewTrack::createRounds()), but everything about a round afterward
 * (questions, sessions, responses, scoring) is handled by the existing
 * AdminInterviewController — a round already IS a plain Interview. Only
 * ever creates/edits `general` and `company` types, mirroring
 * AdminInterviewController's own general/company split.
 */
class AdminInterviewTrackController extends Controller
{
    public function index()
    {
        $tracks = InterviewTrack::withCount('rounds')
            ->with(['company:id,name,logo', 'placementDrive:id,title', 'owningCollege:id,name,short_code', 'roleTemplate:id,name'])
            ->latest('created_at')
            ->get();

        return response()->json([
            'tracks' => $tracks->map(fn (InterviewTrack $t) => [
                ...$t->toArray(),
                'college_ids' => $t->isCompanyTrack() ? $t->colleges()->pluck('colleges.id') : null,
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'track_type' => ['sometimes', Rule::in([InterviewTrack::TRACK_TYPE_GENERAL, InterviewTrack::TRACK_TYPE_COMPANY])],
            'interview_role_template_id' => ['required', 'integer', 'exists:interview_role_templates,id'],
            'placement_drive_id' => ['required_if:track_type,company', 'integer', 'exists:placement_drives,id'],
            'college_ids' => ['sometimes', 'array'],
            'college_ids.*' => ['integer'],
        ]);

        $template = InterviewRoleTemplate::findOrFail($validated['interview_role_template_id']);
        abort_unless($template->isUsableBy($request->user()), 403, 'This role template is not available to you.');

        $trackType = $validated['track_type'] ?? InterviewTrack::TRACK_TYPE_GENERAL;
        $companyId = null;
        $placementDriveId = null;
        $collegeIds = [];

        if ($trackType === InterviewTrack::TRACK_TYPE_COMPANY) {
            $drive = PlacementDrive::findOrFail($validated['placement_drive_id']);
            $companyId = $drive->company_id;
            $placementDriveId = $drive->id;
            $collegeIds = $this->validatedLiveCollegeIds($placementDriveId, $validated['college_ids'] ?? []);
        }

        $track = DB::transaction(function () use ($request, $validated, $template, $trackType, $companyId, $placementDriveId) {
            $track = InterviewTrack::create([
                'title' => $validated['title'],
                'slug' => InterviewTrack::uniqueSlug($validated['title']),
                'description' => $validated['description'] ?? null,
                'status' => InterviewTrack::STATUS_DRAFT,
                'track_type' => $trackType,
                'role_title' => $template->name,
                'interview_role_template_id' => $template->id,
                'company_id' => $companyId,
                'placement_drive_id' => $placementDriveId,
                'created_by' => $request->user()->id,
            ]);

            $track->createRounds($template->rounds_config);

            return $track;
        });

        if ($trackType === InterviewTrack::TRACK_TYPE_COMPANY) {
            $track->colleges()->sync($collegeIds);
        }

        return response()->json(['track' => $track->load('rounds')], 201);
    }

    /** Full re-sync of a track's college targeting — same semantics as AdminInterviewController::updateColleges(). */
    public function updateColleges(Request $request, InterviewTrack $interviewTrack)
    {
        abort_unless($interviewTrack->isCompanyTrack(), 422, 'Only company tracks have selectable college visibility.');

        $validated = $request->validate([
            'college_ids' => ['present', 'array'],
            'college_ids.*' => ['integer'],
        ]);

        $collegeIds = $this->validatedLiveCollegeIds($interviewTrack->placement_drive_id, $validated['college_ids']);

        $interviewTrack->colleges()->sync($collegeIds);

        return response()->json(['college_ids' => $interviewTrack->colleges()->pluck('colleges.id')]);
    }

    private function validatedLiveCollegeIds(int $placementDriveId, array $requestedCollegeIds): array
    {
        $liveCollegeIds = DriveCollegeMapping::where('placement_drive_id', $placementDriveId)
            ->where('status', DriveCollegeMapping::STATUS_APPROVED)
            ->where('is_active', true)
            ->pluck('college_id')
            ->all();

        return array_values(array_intersect($requestedCollegeIds, $liveCollegeIds));
    }

    /** Publishing/cancelling a track cascades that status to all 3 rounds in one action — an individual round's status stays editable via AdminInterviewController::update() for edge cases. */
    public function update(Request $request, InterviewTrack $interviewTrack)
    {
        $this->guardManagedElsewhere($interviewTrack);

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

    /** Same "no candidate history, no delete" rule as Interview::destroy() — any round with sessions must be cancelled instead. */
    public function destroy(InterviewTrack $interviewTrack)
    {
        $this->guardManagedElsewhere($interviewTrack);

        if ($interviewTrack->rounds()->whereHas('sessions')->exists()) {
            return response()->json([
                'message' => 'This track already has candidate sessions and cannot be deleted. Set its status to "cancelled" instead.',
            ], 422);
        }

        $interviewTrack->delete();

        return response()->json(['message' => 'Interview track deleted.']);
    }

    private function guardManagedElsewhere(InterviewTrack $track): void
    {
        abort_if(
            $track->isTpoMock() || $track->isCompanyHiring(),
            403,
            'This track is managed by its owning college/company, not Mellow Ops.'
        );
    }
}
