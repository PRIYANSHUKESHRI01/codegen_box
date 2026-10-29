<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InterviewQuestionBank;
use App\Models\MockInterviewQuestion;
use App\Services\Mock\MockQuestionAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal staff (PERM_INTERVIEWS) - the Mock AI Interview question bank: which stacks have questions, and the tools to fill
 * them (one question at a time, or a spreadsheet). All rules live in MockQuestionAdmin.
 */
class AdminMockInterviewQuestionController extends Controller
{
    public function __construct(private readonly MockQuestionAdmin $admin) {}

    /** GET /mock-interview-bank/coverage */
    public function coverage(): JsonResponse
    {
        return response()->json($this->admin->coverage());
    }

    /** GET /mock-interview-bank/stacks/{stack} */
    public function show(string $stack): JsonResponse
    {
        return response()->json(['stack' => $this->admin->stackDetail($stack)]);
    }

    /** POST /mock-interview-bank/rounds/{roundId}/questions */
    public function store(Request $request, string $roundId): JsonResponse
    {
        $question = $this->admin->add($request->user(), $roundId, $this->validated($request));

        return response()->json(['question' => $question->toCatalog(), 'stack' => $this->admin->stackDetail($question->stack_key)], 201);
    }

    /** PUT /mock-interview-bank/questions/{question} */
    public function update(Request $request, MockInterviewQuestion $question): JsonResponse
    {
        $this->admin->update($request->user(), $question, $this->validated($request));

        return response()->json(['stack' => $this->admin->stackDetail($question->stack_key)]);
    }

    /** DELETE /mock-interview-bank/questions/{question} */
    public function destroy(Request $request, MockInterviewQuestion $question): JsonResponse
    {
        $stackKey = $question->stack_key;
        $this->admin->delete($request->user(), $question);

        return response()->json(['stack' => $this->admin->stackDetail($stackKey)]);
    }

    /** GET /mock-interview-bank/template */
    public function template(): Response
    {
        return response($this->admin->template(), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="mock-interview-questions-template.xlsx"',
        ]);
    }

    /** POST /mock-interview-bank/import  (multipart: file) */
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'max:2048', 'extensions:xlsx,csv']]);

        return response()->json($this->admin->import($request->user(), $request->file('file')));
    }

    /** @return array{text: string, category?: ?string, duration_seconds?: ?int, note?: ?string, topic?: ?string, needs_review?: bool} */
    private function validated(Request $request): array
    {
        return $request->validate([
            'text' => ['required', 'string', 'min:15', 'max:800'],
            'category' => ['nullable', Rule::in(InterviewQuestionBank::CATEGORIES)],
            'duration_seconds' => ['nullable', 'integer', 'between:30,600'],
            'note' => ['nullable', 'string', 'max:1000'],
            'topic' => ['nullable', 'string', 'max:100'],
            'needs_review' => ['sometimes', 'boolean'],
        ]);
    }
}
