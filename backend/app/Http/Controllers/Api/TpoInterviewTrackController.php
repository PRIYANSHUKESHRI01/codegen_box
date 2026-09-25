<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewRoleTemplate;
use App\Models\InterviewTrack;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * College-TPO-only: a TPO's own private "Final Interview" pipeline
 * (track_type = tpo_mock) for their own students only — same pattern as
 * TpoInterviewController's mock interviews. No updateColleges() (a tpo_mock
 * track is visible to its whole owning college automatically, same as a
 * plain tpo_mock interview).
 */
class TpoInterviewTrackController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'tracks' => $this->ownedTracks($request)->withCount('rounds')->with('roleTemplate:id,name')->latest('created_at')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $collegeId = $request->user()->college_id;

        if (! $collegeId) {
            return response()->json(['message' => 'Your account is not linked to a college.'], 422);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'interview_role_template_id' => ['required', 'integer', 'exists:interview_role_templates,id'],
        ]);

        $template = InterviewRoleTemplate::findOrFail($validated['interview_role_template_id']);
        abort_unless($template->isUsableBy($request->user()), 403, 'This role template is not available to you.');

        $track = DB::transaction(function () use ($request, $validated, $template, $collegeId) {
            $track = InterviewTrack::create([
                'title' => $validated['title'],
                'slug' => InterviewTrack::uniqueSlug($validated['title']),
                'description' => $validated['description'] ?? null,
                'status' => InterviewTrack::STATUS_DRAFT,
                'track_type' => InterviewTrack::TRACK_TYPE_TPO_MOCK,
                'role_title' => $template->name,
                'interview_role_template_id' => $template->id,
                'owning_college_id' => $collegeId,
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
                'message' => 'This track already has student sessions and cannot be deleted. Set its status to "cancelled" instead.',
            ], 422);
        }

        $interviewTrack->delete();

        return response()->json(['message' => 'Interview track deleted.']);
    }

    private function ownedTracks(Request $request)
    {
        return InterviewTrack::where('track_type', InterviewTrack::TRACK_TYPE_TPO_MOCK)
            ->where('owning_college_id', $request->user()->college_id);
    }

    private function authorizeOwnership(Request $request, InterviewTrack $track): void
    {
        abort_unless(
            $track->isTpoMock() && $track->owning_college_id === $request->user()->college_id,
            404
        );
    }
}
