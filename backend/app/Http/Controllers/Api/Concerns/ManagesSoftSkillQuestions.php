<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillAssessmentQuestion;
use App\Models\SoftSkillQuestion;
use App\Models\SoftSkillResponse;
use App\Services\SoftSkillQuestionSetService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
    /**
     * Narrows the assessments table to the tests THIS caller owns — the one tenancy rule behind the question-set
     * library's "already used" markers (see SoftSkillQuestionSetService). A TPO's is their college's tests, a hiring
     * partner's their company's, Mellow Ops' the platform's own hand-built ones.
     *
     * @param  Builder<SoftSkillAssessment>  $tests
     */
    abstract protected function scopeOwnTests(Request $request, Builder $tests): mixed;

    /**
     * GET …/soft-skill-question-sets — the AptRun library, one page at a time, each set marked with where THIS caller
     * has used it. ?q= searches ("12", "set 12", a word from the title), ?usage=used|unused filters,
     * ?page= and ?per_page= (a number, or "all") page it.
     */
    public function questionSets(Request $request, SoftSkillQuestionSetService $sets)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'usage' => ['nullable', Rule::in(['all', 'used', 'unused'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'regex:/^(all|\d{1,3})$/i'],
        ]);

        return response()->json($sets->catalogue(fn (Builder $tests) => $this->scopeOwnTests($request, $tests), $filters));
    }

    /**
     * POST …/soft-skills/{assessment}/question-sets — builds the test from a library set (the set's questions are
     * copied in; see SoftSkillQuestionSetService::attach()). Several sets may be added to one test, one at a time.
     */
    public function attachQuestionSet(Request $request, SoftSkillAssessment $softSkillAssessment, SoftSkillQuestionSetService $sets)
    {
        $this->authorizeAssessmentOwnership($request, $softSkillAssessment);

        $validated = $request->validate(['question_set_id' => ['required', 'integer', 'exists:soft_skill_assessments,id']]);

        $result = $sets->attach($softSkillAssessment, SoftSkillAssessment::findOrFail($validated['question_set_id']), $request->user());

        return response()->json($result + ['applied_sets' => $softSkillAssessment->appliedSets()->get()], 201);
    }

    /** A test with no questions cannot go live — the screens already disable Publish; this is the server saying it too. */
    protected function assertCanPublish(SoftSkillAssessment $assessment, array $validated): void
    {
        if (($validated['status'] ?? null) === SoftSkillAssessment::STATUS_PUBLISHED && ! $assessment->assessmentQuestions()->exists()) {
            throw ValidationException::withMessages(['status' => ['Add at least one question (or a question set) before publishing.']]);
        }
    }

    /** The extra, optional fields every "new test" form may send: build it from a set and publish it in one step. */
    protected function questionSetCreationRules(): array
    {
        return [
            'question_set_id' => ['nullable', 'integer', Rule::exists('soft_skill_assessments', 'id')->where('is_question_set', true)],
            'publish' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * Creates the draft test and — when a set was chosen — attaches it and, if asked, publishes it, all in one
     * transaction: a refused set (retired, wrong type) leaves no half-built draft behind.
     *
     * @param  array<string, mixed>  $attributes  what to create the test with
     * @param  array<string, mixed>  $validated  the request's validated input (reads question_set_id / publish)
     */
    protected function createAssessment(Request $request, array $attributes, array $validated): SoftSkillAssessment
    {
        $setId = $validated['question_set_id'] ?? null;
        $publish = (bool) ($validated['publish'] ?? false);

        if ($publish && $setId === null) {
            throw ValidationException::withMessages(['publish' => ['Choose a question set to publish with — a test needs questions.']]);
        }

        $assessment = DB::transaction(function () use ($request, $attributes, $setId, $publish) {
            $assessment = SoftSkillAssessment::create($attributes);

            if ($setId !== null) {
                app(SoftSkillQuestionSetService::class)->attach($assessment, SoftSkillAssessment::findOrFail($setId), $request->user());

                if ($publish) {
                    $assessment->update(['status' => SoftSkillAssessment::STATUS_PUBLISHED]);
                }
            }

            return $assessment;
        });

        return $assessment->loadCount(['sessions', 'assessmentQuestions'])->load('appliedSets');
    }

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
