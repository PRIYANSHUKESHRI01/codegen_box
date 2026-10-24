<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ManagesCoreTests;
use App\Http\Controllers\Controller;
use App\Models\CoreQuestion;
use App\Models\CoreTest;
use App\Services\Core\CoreAccess;
use App\Services\Core\CoreTestBuilder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Mellow Ops → Core Prep → Tests: the platform's own (`general`) Core tests, offered to every student of a
 * branch family. Mellow staff can pick questions by hand from the bank as well as draw them from a blueprint.
 */
class AdminCoreTestController extends Controller
{
    use ManagesCoreTests;

    protected function scopeOwnTests(Builder $query, Request $request): Builder
    {
        return $query->where('test_type', CoreTest::TYPE_GENERAL);
    }

    protected function ownerType(): string
    {
        return CoreTest::TYPE_GENERAL;
    }

    protected function ownerCollegeId(Request $request): ?int
    {
        return null;
    }

    /** The test's questions in order, with their keys — staff see the whole paper. */
    public function questions(Request $request, CoreTest $coreTest): JsonResponse
    {
        $this->authorizeOwn($request, $coreTest);

        return response()->json(['questions' => $coreTest->questions()->with('subject:id,name')->get()->map(fn (CoreQuestion $q) => [
            'id' => $q->id, 'external_id' => $q->external_id, 'stem' => mb_substr($q->stem, 0, 220), 'type' => $q->type, 'difficulty' => $q->difficulty,
            'marks' => $q->marks, 'status' => $q->status, 'subject' => $q->subject?->name, 'position' => $q->pivot->position,
        ])]);
    }

    /** Replaces the test's questions with this ordered list. */
    public function setQuestions(Request $request, CoreTest $coreTest): JsonResponse
    {
        $this->authorizeOwn($request, $coreTest);

        $validated = $request->validate(['question_ids' => ['present', 'array', 'max:300'], 'question_ids.*' => ['integer']]);
        app(CoreTestBuilder::class)->setQuestions($coreTest, $validated['question_ids']);

        return response()->json(['test' => $this->present($coreTest->loadCount(['testQuestions', 'sessions']), withQuestions: true)]);
    }

    /** Published questions that can go into a test, for the hand-picker. */
    public function candidates(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'discipline_code' => ['required', Rule::in(CoreAccess::families())],
            'subject_id' => ['nullable', 'integer'],
            'difficulty' => ['nullable', Rule::in(CoreQuestion::DIFFICULTIES)],
            'q' => ['nullable', 'string', 'max:120'],
        ]);

        $questions = CoreQuestion::query()->forTests()->where('discipline_code', $validated['discipline_code'])
            ->when($validated['subject_id'] ?? null, fn ($q, $v) => $q->where('subject_id', $v))
            ->when($validated['difficulty'] ?? null, fn ($q, $v) => $q->where('difficulty', $v))
            ->when($validated['q'] ?? null, fn ($q, $v) => $q->where(fn ($w) => $w->where('stem', 'like', '%'.str_replace(['%', '_'], ['\\%', '\\_'], $v).'%')->orWhere('external_id', 'like', '%'.$v.'%')))
            ->with('subject:id,name')->orderBy('subject_id')->orderBy('id')->limit(100)->get();

        return response()->json(['questions' => $questions->map(fn (CoreQuestion $q) => [
            'id' => $q->id, 'external_id' => $q->external_id, 'stem' => mb_substr($q->stem, 0, 220), 'type' => $q->type, 'difficulty' => $q->difficulty, 'marks' => $q->marks, 'subject' => $q->subject?->name,
        ])]);
    }
}
