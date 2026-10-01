<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ManagesSoftSkillQuestions;
use App\Http\Controllers\Controller;
use App\Models\SoftSkillAssessment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** A college TPO's own private practice soft skills tests, for their own students only — mirrors TpoInterviewController. */
class TpoSoftSkillController extends Controller
{
    use ManagesSoftSkillQuestions;

    public function index(Request $request)
    {
        $assessments = SoftSkillAssessment::where('owning_college_id', $request->user()->college_id)
            ->withCount(['sessions', 'assessmentQuestions'])
            ->latest('created_at')
            ->get();

        return response()->json(['assessments' => $assessments]);
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
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:240'],
            'pass_percentage' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $assessment = SoftSkillAssessment::create([
            'title' => $validated['title'],
            'slug' => SoftSkillAssessment::uniqueSlug($validated['title']),
            'description' => $validated['description'] ?? null,
            'status' => SoftSkillAssessment::STATUS_DRAFT,
            'assessment_type' => SoftSkillAssessment::TYPE_TPO_MOCK,
            'owning_college_id' => $collegeId,
            'duration_minutes' => $validated['duration_minutes'] ?? 45,
            'pass_percentage' => $validated['pass_percentage'] ?? 60,
            // Practice-oriented by nature — unlimited attempts unless the
            // TPO explicitly tightens it via update().
            'max_attempts' => null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['assessment' => $assessment], 201);
    }

    public function update(Request $request, SoftSkillAssessment $softSkillAssessment)
    {
        $this->authorizeOwnership($request, $softSkillAssessment);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in(SoftSkillAssessment::STATUSES)],
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:240'],
            'pass_percentage' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);

        $softSkillAssessment->update($validated);

        return response()->json(['assessment' => $softSkillAssessment->fresh()]);
    }

    public function destroy(Request $request, SoftSkillAssessment $softSkillAssessment)
    {
        $this->authorizeOwnership($request, $softSkillAssessment);

        if ($softSkillAssessment->sessions()->exists()) {
            return response()->json([
                'message' => 'This assessment already has candidate sessions and cannot be deleted. Set its status to "cancelled" instead.',
            ], 422);
        }

        $softSkillAssessment->delete();

        return response()->json(['message' => 'Assessment deleted.']);
    }

    private function authorizeAssessmentOwnership(Request $request, SoftSkillAssessment $softSkillAssessment): void
    {
        $this->authorizeOwnership($request, $softSkillAssessment);
    }

    private function authorizeOwnership(Request $request, SoftSkillAssessment $softSkillAssessment): void
    {
        abort_unless(
            $softSkillAssessment->assessment_type === SoftSkillAssessment::TYPE_TPO_MOCK
                && $softSkillAssessment->owning_college_id === $request->user()->college_id,
            403
        );
    }
}
