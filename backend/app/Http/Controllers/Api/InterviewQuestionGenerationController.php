<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CompanyRecommendedInterviewQuestion;
use App\Models\InterviewQuestionBank;
use App\Services\GeminiQuestionGeneratorService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use RuntimeException;

/**
 * Shared across every authoring role (Ops/TPO/Company) — mirrors the
 * shared, read-only /interview-question-bank/browse route in spirit
 * (one endpoint, reachable by whichever role is currently creating an
 * interview) but this one WRITES: every question Gemini returns is
 * immediately persisted into the real, permanent InterviewQuestionBank —
 * nothing generated here is ephemeral or thrown away, same trust model as
 * a question Ops types in by hand via AdminInterviewQuestionBankController.
 */
class InterviewQuestionGenerationController extends Controller
{
    public function __construct(private readonly GeminiQuestionGeneratorService $generator) {}

    public function generate(Request $request)
    {
        $validated = $request->validate([
            'role' => ['required', 'string', 'max:150'],
            'difficulty' => ['required', Rule::in(InterviewQuestionBank::DIFFICULTIES)],
            'categories' => ['required', 'array', 'min:1'],
            'categories.*' => [Rule::in(InterviewQuestionBank::CATEGORIES)],
            'count' => ['required', 'integer', 'min:1', 'max:10'],
            'skills' => ['nullable', 'string', 'max:500'],
            // Only meaningful when Ops is generating questions for a
            // `company`-type interview — see the note below on why this
            // needs to also pre-tag the generated rows for that company.
            'company_id' => ['nullable', 'integer', 'exists:companies,id'],
        ]);

        $avoidQuestionTexts = InterviewQuestionBank::whereIn('category', $validated['categories'])
            ->latest('id')
            ->limit(30)
            ->pluck('question_text')
            ->all();

        try {
            $generated = $this->generator->generate(
                $validated['role'],
                $validated['difficulty'],
                $validated['categories'],
                $validated['count'],
                $validated['skills'] ?? null,
                $avoidQuestionTexts,
            );
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $questions = collect($generated)->map(function (array $item) use ($request, $validated) {
            $question = InterviewQuestionBank::create([
                ...$item,
                'is_active' => true,
                'created_by' => $request->user()->id,
            ]);

            // A `company`-type interview can only ever attach bank
            // questions already tagged to that company (see
            // AdminInterviewController::storeQuestion()) — without this,
            // a question Gemini just generated FOR that company's
            // interview could never actually be attached to it. Only
            // relevant when the caller supplied company_id (Ops
            // generating for a `company`-type interview); TPO/company_hiring
            // generation never sends it, since tpo_mock/company_hiring
            // interviews pick from the whole bank with no tag restriction.
            if (! empty($validated['company_id'])) {
                CompanyRecommendedInterviewQuestion::firstOrCreate([
                    'company_id' => $validated['company_id'],
                    'interview_question_bank_id' => $question->id,
                ]);
            }

            return $question;
        });

        return response()->json(['questions' => $questions], 201);
    }
}
