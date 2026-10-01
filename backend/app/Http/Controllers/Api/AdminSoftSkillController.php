<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ManagesSoftSkillQuestions;
use App\Http\Controllers\Controller;
use App\Models\SoftSkillAssessment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only (role: admin_internal, superadmin) — Soft
 * Skills tests are platform-run and centrally curated, mirroring
 * AdminInterviewController. Only ever creates/edits `general`-type
 * assessments — `tpo_mock`/`company` belong entirely to their owning
 * college/company (see guardManagedElsewhere()), even though index() still
 * lists every type for Mellow's own platform-wide oversight.
 */
class AdminSoftSkillController extends Controller
{
    use ManagesSoftSkillQuestions;

    public function index()
    {
        $assessments = SoftSkillAssessment::withCount(['sessions', 'assessmentQuestions'])
            ->with(['owningCollege:id,name,short_code', 'owningCompany:id,name,logo'])
            ->latest('created_at')
            ->get();

        return response()->json(['assessments' => $assessments]);
    }

    public function store(Request $request)
    {
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
            'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
            'duration_minutes' => $validated['duration_minutes'] ?? 45,
            'pass_percentage' => $validated['pass_percentage'] ?? 60,
            'max_attempts' => $validated['max_attempts'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['assessment' => $assessment], 201);
    }

    public function update(Request $request, SoftSkillAssessment $softSkillAssessment)
    {
        $this->guardManagedElsewhere($softSkillAssessment);

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

    /** Only a draft/never-taken assessment can be hard-deleted — anything with real candidate sessions should be cancelled instead. */
    public function destroy(SoftSkillAssessment $softSkillAssessment)
    {
        $this->guardManagedElsewhere($softSkillAssessment);

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
        $this->guardManagedElsewhere($softSkillAssessment);
    }

    /** A tpo_mock or company assessment belongs entirely to its owning college/company — Mellow Ops can see it in index() for oversight but never edit/curate it here. */
    private function guardManagedElsewhere(SoftSkillAssessment $softSkillAssessment): void
    {
        abort_if(
            $softSkillAssessment->assessment_type !== SoftSkillAssessment::TYPE_GENERAL,
            403,
            'This assessment is managed by its owning college/company, not Mellow Ops.'
        );
    }
}
