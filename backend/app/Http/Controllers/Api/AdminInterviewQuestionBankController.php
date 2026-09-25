<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewQuestionBank;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal-staff-only management of the real, permanent interview
 * question bank (see the creating migration's docblock) — mirrors
 * AdminProblemController's "authoring is a real API, a polished frontend
 * form is secondary" posture, except there's no judge-verification step
 * here (nothing to execute for a spoken-answer question).
 */
class AdminInterviewQuestionBankController extends Controller
{
    public function index(Request $request)
    {
        $query = InterviewQuestionBank::query();

        if ($search = $request->query('search')) {
            $query->where('question_text', 'like', "%{$search}%");
        }

        if ($category = $request->query('category')) {
            $query->where('category', $category);
        }

        if ($difficulty = $request->query('difficulty')) {
            $query->where('difficulty', $difficulty);
        }

        $questions = $query->orderByDesc('created_at')->paginate(50);

        return response()->json([
            'questions' => $questions,
            'counts' => collect(InterviewQuestionBank::CATEGORIES)
                ->mapWithKeys(fn (string $category) => [
                    $category => InterviewQuestionBank::where('category', $category)->count(),
                ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'question_text' => ['required', 'string'],
            'category' => ['required', Rule::in(InterviewQuestionBank::CATEGORIES)],
            'difficulty' => ['required', Rule::in(InterviewQuestionBank::DIFFICULTIES)],
            'expected_duration_seconds' => ['required', 'integer', 'min:30', 'max:1800'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string'],
            'notes_for_reviewer' => ['nullable', 'string'],
        ]);

        $question = InterviewQuestionBank::create([
            ...$validated,
            'tags' => $validated['tags'] ?? [],
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['question' => $question], 201);
    }

    /** No hard destroy() — a question already attached to a published interview must never vanish from history; deactivate instead. */
    public function update(Request $request, InterviewQuestionBank $interviewQuestionBank)
    {
        $validated = $request->validate([
            'question_text' => ['sometimes', 'string'],
            'category' => ['sometimes', Rule::in(InterviewQuestionBank::CATEGORIES)],
            'difficulty' => ['sometimes', Rule::in(InterviewQuestionBank::DIFFICULTIES)],
            'expected_duration_seconds' => ['sometimes', 'integer', 'min:30', 'max:1800'],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string'],
            'notes_for_reviewer' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $interviewQuestionBank->update($validated);

        return response()->json(['question' => $interviewQuestionBank->fresh()]);
    }
}
