<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\CoreQuestion;
use App\Models\CoreTest;
use App\Services\Core\CoreAccess;
use App\Services\Core\CoreTestBuilder;
use App\Support\BranchAudience;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The test-management actions Mellow Ops and a college's TPO share — the same shape as Soft Skills'
 * ManagesSoftSkillQuestions. Each controller says (in scopeOwnTests) WHICH tests are its own: that one method
 * is the tenancy rule. Mellow's are its `general` tests; a TPO's are its own college's `tpo_mock` tests, so a
 * TPO can neither see nor touch another college's.
 */
trait ManagesCoreTests
{
    /** Restricts a CoreTest query to the tests this caller may manage — THE tenancy rule. */
    abstract protected function scopeOwnTests(Builder $query, Request $request): Builder;

    /** CoreTest::TYPE_* this caller creates. */
    abstract protected function ownerType(): string;

    abstract protected function ownerCollegeId(Request $request): ?int;

    public function index(Request $request): JsonResponse
    {
        $tests = $this->scopeOwnTests(CoreTest::query(), $request)
            ->when($request->query('discipline'), fn ($q, $v) => $q->where('discipline_code', $v))
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->withCount(['testQuestions', 'sessions'])
            ->latest('id')->limit(200)->get();

        return response()->json(['tests' => $tests->map(fn (CoreTest $t) => $this->present($t))]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules(creating: true));

        $test = app(CoreTestBuilder::class)->create($validated, $request->user(), $this->ownerType(), $this->ownerCollegeId($request));

        return response()->json(['test' => $this->present($test->loadCount(['testQuestions', 'sessions']))], 201);
    }

    public function show(Request $request, CoreTest $coreTest): JsonResponse
    {
        $this->authorizeOwn($request, $coreTest);

        return response()->json(['test' => $this->present($coreTest->loadCount(['testQuestions', 'sessions']), withQuestions: true)]);
    }

    public function update(Request $request, CoreTest $coreTest): JsonResponse
    {
        $this->authorizeOwn($request, $coreTest);

        $validated = $request->validate($this->rules(creating: false));
        $test = app(CoreTestBuilder::class)->update($coreTest, $validated);

        return response()->json(['test' => $this->present($test->loadCount(['testQuestions', 'sessions']), withQuestions: true)]);
    }

    /** Appends random published questions per blueprint row ("5 from Analog Circuits, hard"). */
    public function blueprint(Request $request, CoreTest $coreTest): JsonResponse
    {
        $this->authorizeOwn($request, $coreTest);

        $validated = $request->validate([
            'rows' => ['required', 'array', 'min:1', 'max:30'],
            'rows.*.subject_id' => ['required', 'integer', Rule::exists('core_subjects', 'id')->where('discipline_code', $coreTest->discipline_code)],
            'rows.*.count' => ['required', 'integer', 'min:1', 'max:100'],
            'rows.*.difficulty' => ['nullable', Rule::in(['easy', 'medium', 'hard', 'mixed'])],
        ]);

        app(CoreTestBuilder::class)->fillFromBlueprint($coreTest, $validated['rows']);

        return response()->json(['test' => $this->present($coreTest->loadCount(['testQuestions', 'sessions']), withQuestions: true)]);
    }

    public function destroy(Request $request, CoreTest $coreTest): JsonResponse
    {
        $this->authorizeOwn($request, $coreTest);
        app(CoreTestBuilder::class)->delete($coreTest);

        return response()->json(['deleted' => true]);
    }

    /**
     * How many published test questions exist per subject and difficulty — enough to plan a blueprint, without
     * revealing a single question (a TPO uses this; the bank itself stays Mellow's).
     */
    public function pool(Request $request): JsonResponse
    {
        $discipline = (string) $request->query('discipline', '');
        abort_unless(in_array($discipline, CoreAccess::families(), true), 422, 'Choose a branch family.');

        $rows = CoreQuestion::query()->forTests()->where('core_questions.discipline_code', $discipline)
            ->join('core_subjects', 'core_subjects.id', '=', 'core_questions.subject_id')
            ->select('core_questions.subject_id', 'core_subjects.name', 'core_questions.difficulty', DB::raw('count(*) as n'))
            ->groupBy('core_questions.subject_id', 'core_subjects.name', 'core_questions.difficulty')->get();

        return response()->json(['subjects' => $rows->groupBy('subject_id')->map(fn ($g) => [
            'id' => $g->first()->subject_id, 'name' => $g->first()->name,
            'easy' => (int) $g->where('difficulty', 'easy')->sum('n'), 'medium' => (int) $g->where('difficulty', 'medium')->sum('n'),
            'hard' => (int) $g->where('difficulty', 'hard')->sum('n'), 'total' => (int) $g->sum('n'),
        ])->sortBy('name')->values()]);
    }

    // ───────────────────────────────── helpers ─────────────────────────────────

    protected function authorizeOwn(Request $request, CoreTest $test): void
    {
        abort_unless($this->scopeOwnTests(CoreTest::query(), $request)->whereKey($test->id)->exists(), 404);
    }

    /** @return array<string, mixed> */
    protected function rules(bool $creating): array
    {
        $presence = $creating ? 'required' : 'sometimes';

        return [
            'title' => [$presence, 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'discipline_code' => [$presence, 'string', Rule::in(CoreAccess::families())],
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:300'],
            'pass_percentage' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'shuffle_options' => ['sometimes', 'boolean'],
            'shuffle_questions' => ['sometimes', 'boolean'],
            'max_attempts' => ['nullable', 'integer', 'min:1', 'max:10'],
            'available_from' => ['nullable', 'date'],
            'available_until' => ['nullable', 'date', 'after:available_from'],
            'status' => $creating ? ['prohibited'] : ['sometimes', Rule::in(CoreTest::STATUSES)],
        ] + BranchAudience::rules();
    }

    /** @return array<string, mixed> */
    protected function present(CoreTest $t, bool $withQuestions = false): array
    {
        $marks = $t->testQuestions()->join('core_questions', 'core_questions.id', '=', 'core_test_questions.core_question_id')->sum('core_questions.marks');

        $out = [
            'id' => $t->id, 'slug' => $t->slug, 'title' => $t->title, 'description' => $t->description,
            'discipline_code' => $t->discipline_code, 'status' => $t->status, 'test_type' => $t->test_type,
            'duration_minutes' => $t->duration_minutes, 'pass_percentage' => $t->pass_percentage,
            'shuffle_options' => $t->shuffle_options, 'shuffle_questions' => $t->shuffle_questions, 'max_attempts' => $t->max_attempts,
            'available_from' => $t->available_from, 'available_until' => $t->available_until, 'branch_audience' => $t->branch_audience,
            'question_count' => $t->test_questions_count ?? $t->testQuestions()->count(), 'sessions_count' => $t->sessions_count ?? $t->sessions()->count(),
            'total_marks' => round((float) $marks, 2), 'created_at' => $t->created_at,
        ];

        if ($withQuestions) {
            $out['sections'] = $t->testQuestions()->join('core_questions', 'core_questions.id', '=', 'core_test_questions.core_question_id')
                ->select('core_test_questions.section', DB::raw('count(*) as n'), DB::raw('sum(core_questions.marks) as marks'))->groupBy('core_test_questions.section')
                ->get()->map(fn ($r) => ['section' => $r->section, 'questions' => (int) $r->n, 'marks' => round((float) $r->marks, 2)]);
        }

        return $out;
    }
}
