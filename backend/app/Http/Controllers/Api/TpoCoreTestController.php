<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\Concerns\ManagesCoreTests;
use App\Http\Controllers\Controller;
use App\Models\CoreTest;
use App\Services\Core\CoreTestBuilder;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * TPO → Mock Core Tests: a college's own timed technical mock tests for its students. A TPO builds them from
 * a blueprint ("10 from Analog Circuits, 5 hard") or by taking a copy of one of Mellow's published papers —
 * and never sees the question bank itself. A college's tests are visible only to its own students (and a TPO
 * only ever reaches its own: scopeOwnTests is the tenancy rule).
 */
class TpoCoreTestController extends Controller
{
    use ManagesCoreTests;

    protected function scopeOwnTests(Builder $query, Request $request): Builder
    {
        return $query->where('test_type', CoreTest::TYPE_TPO_MOCK)->where('owning_college_id', $request->user()->college_id);
    }

    protected function ownerType(): string
    {
        return CoreTest::TYPE_TPO_MOCK;
    }

    protected function ownerCollegeId(Request $request): ?int
    {
        $collegeId = $request->user()->college_id;
        abort_unless($collegeId, 422, 'Your account is not linked to a college.');

        return (int) $collegeId;
    }

    /** Mellow's published papers a college may copy. Metadata only — no questions. */
    public function library(Request $request): JsonResponse
    {
        $papers = CoreTest::query()->where('test_type', CoreTest::TYPE_GENERAL)->where('status', CoreTest::STATUS_PUBLISHED)
            ->when($request->query('discipline'), fn ($q, $v) => $q->where('discipline_code', $v))
            ->withCount('testQuestions')->latest('id')->limit(100)->get();

        $alreadyCopied = CoreTest::query()->where('owning_college_id', $request->user()->college_id)->pluck('title')->map(fn ($t) => mb_strtolower($t))->all();

        return response()->json(['papers' => $papers->map(fn (CoreTest $p) => $this->present($p) + ['already_copied' => in_array(mb_strtolower($p->title), $alreadyCopied, true)])]);
    }

    public function copy(Request $request, CoreTest $paper): JsonResponse
    {
        $collegeId = $this->ownerCollegeId($request);
        $validated = $request->validate(['title' => ['nullable', 'string', 'max:255']]);

        $test = app(CoreTestBuilder::class)->copyPaper($paper, $request->user(), $collegeId, $validated['title'] ?? null);

        return response()->json(['test' => $this->present($test->loadCount(['testQuestions', 'sessions']), withQuestions: true)], 201);
    }
}
