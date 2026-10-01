<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillQuestion;
use App\Models\SoftSkillResponse;
use Illuminate\Http\Request;

/**
 * The "attach bank questions to my own assessment" surface, identical
 * across AdminSoftSkillController/TpoSoftSkillController/
 * CompanySoftSkillController — the only thing that differs per role is
 * ownership, which each controller enforces via its own
 * authorizeAssessmentOwnership() before ever calling into this trait.
 * Mirrors AdminInterviewController::storeQuestion()/destroyQuestion(),
 * generalized to a shared trait since it's genuinely identical logic
 * reused 3x, not 3 independent features that happen to look similar.
 */
trait ManagesSoftSkillQuestions
{
    public function questions(Request $request, SoftSkillAssessment $softSkillAssessment)
    {
        $this->authorizeAssessmentOwnership($request, $softSkillAssessment);

        return response()->json([
            'questions' => $softSkillAssessment->assessmentQuestions()
                ->with('question:id,category,difficulty,question_text,options,correct_index')
                ->orderBy('display_order')
                ->get(),
        ]);
    }

    public function storeQuestion(Request $request, SoftSkillAssessment $softSkillAssessment)
    {
        $this->authorizeAssessmentOwnership($request, $softSkillAssessment);

        $validated = $request->validate([
            'soft_skill_question_id' => ['required', 'integer', 'exists:soft_skill_questions,id'],
            'display_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $assessmentQuestion = SoftSkillAssessmentQuestion::create([
            'soft_skill_assessment_id' => $softSkillAssessment->id,
            'soft_skill_question_id' => $validated['soft_skill_question_id'],
            'display_order' => $validated['display_order'] ?? $softSkillAssessment->assessmentQuestions()->count(),
        ]);

        return response()->json([
            'assessment_question' => $assessmentQuestion->load('question:id,category,difficulty,question_text,options,correct_index'),
        ], 201);
    }

    public function destroyQuestion(Request $request, SoftSkillAssessment $softSkillAssessment, SoftSkillAssessmentQuestion $assessmentQuestion)
    {
        $this->authorizeAssessmentOwnership($request, $softSkillAssessment);

        abort_unless($assessmentQuestion->soft_skill_assessment_id === $softSkillAssessment->id, 404);

        if (SoftSkillResponse::where('soft_skill_assessment_question_id', $assessmentQuestion->id)->whereNotNull('selected_index')->exists()) {
            return response()->json(['message' => 'Cannot remove a question that a candidate has already answered.'], 422);
        }

        $assessmentQuestion->delete();

        return response()->json(['message' => 'Question removed from the assessment.']);
    }

    /**
     * The one-click "build me a test" action: given e.g.
     * {"aptitude": 20, "reasoning": 15, "english": 15}, randomly attaches
     * that many ACTIVE bank rows per category (never already-attached
     * ones). Reports honestly per category if the bank came up short
     * rather than silently under-filling — never fabricates a full count
     * it didn't actually reach.
     */
    public function autoFillQuestions(Request $request, SoftSkillAssessment $softSkillAssessment)
    {
        $this->authorizeAssessmentOwnership($request, $softSkillAssessment);

        $validated = $request->validate([
            'composition' => ['required', 'array', 'min:1'],
            'composition.*' => ['required', 'integer', 'min:0', 'max:100'],
        ]);

        $alreadyAttachedIds = $softSkillAssessment->assessmentQuestions()->pluck('soft_skill_question_id');
        $nextOrder = $softSkillAssessment->assessmentQuestions()->count();
        $shortfalls = [];
        $attachedCount = 0;

        foreach ($validated['composition'] as $category => $requestedCount) {
            if ($requestedCount <= 0 || ! in_array($category, SoftSkillQuestion::CATEGORIES, true)) {
                continue;
            }

            $picked = SoftSkillQuestion::where('category', $category)
                ->where('is_active', true)
                ->whereNotIn('id', $alreadyAttachedIds)
                ->inRandomOrder()
                ->limit($requestedCount)
                ->get();

            foreach ($picked as $question) {
                SoftSkillAssessmentQuestion::create([
                    'soft_skill_assessment_id' => $softSkillAssessment->id,
                    'soft_skill_question_id' => $question->id,
                    'display_order' => $nextOrder++,
                ]);
                $alreadyAttachedIds->push($question->id);
                $attachedCount++;
            }

            if ($picked->count() < $requestedCount) {
                $shortfalls[$category] = ['requested' => $requestedCount, 'attached' => $picked->count()];
            }
        }

        return response()->json([
            'attached_count' => $attachedCount,
            'shortfalls' => $shortfalls,
            'total_questions' => $softSkillAssessment->assessmentQuestions()->count(),
        ], 201);
    }
}
