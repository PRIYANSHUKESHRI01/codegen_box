<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CuratedSetQuestion;
use App\Models\InterviewQuestionBank;
use App\Services\Vault\CuratedQuestionAdmin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

/**
 * Mellow-internal staff (PERM_VAULT) — the Vault AI Interview question bank. Which stacks are open to students, which are
 * still empty and how many students are waiting for each, plus adding, editing, removing and bulk-loading the questions that
 * make a stack open. All rules live in CuratedQuestionAdmin.
 */
class AdminVaultQuestionController extends Controller
{
    public function __construct(private readonly CuratedQuestionAdmin $admin) {}

    /** GET /admin/vault-ai/coverage */
    public function coverage(): JsonResponse
    {
        return response()->json($this->admin->coverage());
    }

    /** GET /admin/vault-ai/stacks/{stack} */
    public function show(string $stack): JsonResponse
    {
        return response()->json(['stack' => $this->admin->stackDetail($stack)]);
    }

    /** POST /admin/vault-ai/sets/{setId}/questions */
    public function store(Request $request, string $setId): JsonResponse
    {
        $question = $this->admin->add($request->user(), $setId, $this->validated($request));

        return response()->json(['question' => $this->present($question), 'stack' => $this->admin->stackDetail($question->stack_key)], 201);
    }

    /** PUT /admin/vault-ai/questions/{question} */
    public function update(Request $request, CuratedSetQuestion $question): JsonResponse
    {
        $this->admin->update($request->user(), $question, $this->validated($request));

        return response()->json(['stack' => $this->admin->stackDetail($question->stack_key)]);
    }

    /** DELETE /admin/vault-ai/questions/{question} */
    public function destroy(Request $request, CuratedSetQuestion $question): JsonResponse
    {
        $stackKey = $question->stack_key;
        $this->admin->delete($request->user(), $question);

        return response()->json(['stack' => $this->admin->stackDetail($stackKey)]);
    }

    /** GET /admin/vault-ai/template */
    public function template(): Response
    {
        return response($this->admin->template(), 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="vault-ai-questions-template.xlsx"',
        ]);
    }

    /** POST /admin/vault-ai/import  (multipart: file) */
    public function import(Request $request): JsonResponse
    {
        $request->validate(['file' => ['required', 'file', 'max:2048', 'extensions:xlsx,csv']]);

        return response()->json($this->admin->import($request->user(), $request->file('file')));
    }

    /** @return array{text: string, category?: ?string, duration_seconds?: ?int, note?: ?string} */
    private function validated(Request $request): array
    {
        return $request->validate([
            'text' => ['required', 'string', 'min:15', 'max:800'],
            'category' => ['nullable', Rule::in(InterviewQuestionBank::CATEGORIES)],
            'duration_seconds' => ['nullable', 'integer', 'between:30,600'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);
    }

    /** @return array<string, mixed> */
    private function present(CuratedSetQuestion $question): array
    {
        return $question->toCatalog() + ['set_id' => $question->set_id];
    }
}
