<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ManagesSoftSkillQuestions;
use App\Http\Controllers\Controller;
use App\Models\SoftSkillAssessment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * A hiring partner's own soft skills tests — visible to students at any
 * college the company has an approved, active drive mapping with (see
 * SoftSkillAssessment::isVisibleToUser()). Mirrors CompanyInterviewController's
 * shape; deliberately simpler than that controller's company_hiring flow —
 * no placement_drive_id / invite step required to create one (see the
 * assessments migration's docblock).
 */
class CompanySoftSkillController extends Controller
{
    use ManagesSoftSkillQuestions;

    public function index(Request $request)
    {
        $assessments = SoftSkillAssessment::where('owning_company_id', $request->user()->company_id)
            ->withCount(['sessions', 'assessmentQuestions'])
            ->latest('created_at')
            ->get();

        return response()->json(['assessments' => $assessments]);
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
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:240'],
            'pass_percentage' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:20'],
        ]);

        $assessment = SoftSkillAssessment::create([
            'title' => $validated['title'],
            'slug' => SoftSkillAssessment::uniqueSlug($validated['title']),
            'description' => $validated['description'] ?? null,
            'status' => SoftSkillAssessment::STATUS_DRAFT,
            'assessment_type' => SoftSkillAssessment::TYPE_COMPANY,
            'owning_company_id' => $companyId,
            'duration_minutes' => $validated['duration_minutes'] ?? 45,
            'pass_percentage' => $validated['pass_percentage'] ?? 60,
            // A real hiring test defaults to a single attempt, unlike the
            // practice-oriented general/tpo_mock types — a candidate
            // shouldn't be able to retry until they pass. The company can
            // still loosen this explicitly via update().
            'max_attempts' => $validated['max_attempts'] ?? 1,
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
            $softSkillAssessment->assessment_type === SoftSkillAssessment::TYPE_COMPANY
                && $softSkillAssessment->owning_company_id === $request->user()->company_id,
            403
        );
    }
}
