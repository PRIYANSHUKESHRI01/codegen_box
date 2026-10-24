<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ManagesSoftSkillQuestions;
use App\Http\Controllers\Controller;
use App\Models\SoftSkillAssessment;
use App\Services\SoftSkillQuestionSetService;
use App\Support\BranchAudience;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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

    /**
     * `?kind=tests` leaves the AptRun question-set library out (the screen lists the tests people scheduled; the
     * library has its own browser), `?kind=sets` returns only the library. No `kind` = everything, as before.
     */
    public function index(Request $request)
    {
        $kind = $request->query('kind');

        $assessments = SoftSkillAssessment::withCount(['sessions', 'assessmentQuestions', 'usages'])
            ->with(['owningCollege:id,name,short_code', 'owningCompany:id,name,logo', 'appliedSets'])
            ->when($kind === 'tests', fn (Builder $q) => $q->notQuestionSets())
            ->when($kind === 'sets', fn (Builder $q) => $q->questionSets())
            ->when($kind === 'sets', fn (Builder $q) => $q->orderBy('question_set_number'), fn (Builder $q) => $q->latest('created_at'))
            ->get();

        return response()->json(['assessments' => $assessments]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            ...BranchAudience::rules(),
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:240'],
            'pass_percentage' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:20'],
        ] + $this->questionSetCreationRules());

        $assessment = $this->createAssessment($request, [
            'title' => $validated['title'],
            'slug' => SoftSkillAssessment::uniqueSlug($validated['title']),
            'description' => $validated['description'] ?? null,
            'status' => SoftSkillAssessment::STATUS_DRAFT,
            'assessment_type' => SoftSkillAssessment::TYPE_GENERAL,
            'duration_minutes' => $validated['duration_minutes'] ?? 45,
            'pass_percentage' => $validated['pass_percentage'] ?? 60,
            'max_attempts' => $validated['max_attempts'] ?? null,
            'created_by' => $request->user()->id,
            'branch_audience' => BranchAudience::normalize($validated['branch_audience'] ?? null),
        ], $validated);

        return response()->json(['assessment' => $assessment], 201);
    }

    public function update(Request $request, SoftSkillAssessment $softSkillAssessment)
    {
        $this->guardManagedElsewhere($softSkillAssessment);

        $validated = $request->validate([
            ...BranchAudience::rules(),
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in(SoftSkillAssessment::STATUSES)],
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:240'],
            'pass_percentage' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:20'],
            // Lists this (Mellow-written) test in the AptRun question-set library, or takes it out again.
            'is_question_set' => ['sometimes', 'boolean'],
        ]);

        $this->assertCanPublish($softSkillAssessment, $validated);

        if (array_key_exists('is_question_set', $validated)) {
            $validated += $this->libraryChange($softSkillAssessment, (bool) $validated['is_question_set']);
        }

        if (array_key_exists('branch_audience', $validated)) {
            $validated['branch_audience'] = BranchAudience::normalize($validated['branch_audience']);
        }

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

    protected function scopeOwnTests(Request $request, Builder $tests): mixed
    {
        // Mellow's own scheduling history: the general tests it wrote by hand — never the library sets themselves, and
        // never a college's or a hiring partner's tests (those are theirs to know about, not Mellow Ops').
        return $tests->where('assessment_type', SoftSkillAssessment::TYPE_GENERAL)->where('is_question_set', false);
    }

    /**
     * What changes on the row when a test is added to / removed from the library: it gets the next free "Set N" number,
     * and can only be taken out again while no test has been built from it (use "cancelled" to withdraw a used one).
     *
     * @return array<string, mixed>
     */
    private function libraryChange(SoftSkillAssessment $assessment, bool $listed): array
    {
        if ($listed) {
            if ($assessment->assessment_type !== SoftSkillAssessment::TYPE_GENERAL) {
                throw ValidationException::withMessages(['is_question_set' => ['Only Mellow\'s own tests can be added to the question-set library.']]);
            }

            if (! $assessment->assessmentQuestions()->exists()) {
                throw ValidationException::withMessages(['is_question_set' => ['Add questions to this test before listing it as a question set.']]);
            }

            return ['question_set_number' => $assessment->question_set_number ?? app(SoftSkillQuestionSetService::class)->nextSetNumber()];
        }

        if ($assessment->usages()->exists()) {
            throw ValidationException::withMessages(['is_question_set' => ['Tests have already been built from this set, so it cannot leave the library. Cancel it instead to stop it being offered.']]);
        }

        return [];
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
