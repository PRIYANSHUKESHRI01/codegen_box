<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Problem;
use App\Models\Submission;
use App\Services\JudgeService;
use App\Services\ProblemCodeGenerator\ProblemType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * The real unlock for "add 2000 questions without hand-writing PHP": a
 * problem is created from a structured function signature + test cases,
 * not per-language hand-authored code (see App\Services\ProblemCodeGenerator).
 * A polished authoring *frontend* is deliberately not part of this —
 * problems can be added via this API (script, Postman, a future thin form)
 * without ever touching generator code, which is the actual unblock.
 */
class AdminProblemController extends Controller
{
    public function __construct(private readonly JudgeService $judge) {}

    /**
     * The Problem Bank tab's real catalog listing. Deliberately reports live
     * submission/acceptance numbers computed from the real `submissions`
     * table (via withCount) rather than the `total_submissions`/
     * `acceptance_rate` columns on Problem itself — those are static
     * LeetCode-flavor seed values nothing in this codebase ever
     * recalculates (e.g. "Two Sum: 284,190 submissions" while the whole
     * platform has only ever recorded a few dozen real ones), so surfacing
     * them here as if they were real activity would be exactly the kind of
     * fabricated number this dashboard is being rebuilt to stop showing.
     */
    public function index(Request $request)
    {
        $query = Problem::query();

        if ($search = $request->query('search')) {
            $query->where('title', 'like', "%{$search}%");
        }

        if ($difficulty = $request->query('difficulty')) {
            $query->where('difficulty', $difficulty);
        }

        $problems = $query
            ->withCount([
                'submissions',
                'submissions as accepted_submissions_count' => fn ($q) => $q->where('status', Submission::STATUS_ACCEPTED),
            ])
            ->orderByDesc('created_at')
            ->paginate(50);

        $problems->getCollection()->transform(fn (Problem $p) => [
            'id' => $p->id,
            'slug' => $p->slug,
            'title' => $p->title,
            'difficulty' => $p->difficulty,
            'tags' => $p->tags,
            'created_at' => $p->created_at,
            'submissions_count' => $p->submissions_count,
            'accepted_submissions_count' => $p->accepted_submissions_count,
            'acceptance_rate' => $p->submissions_count > 0
                ? round(($p->accepted_submissions_count / $p->submissions_count) * 100, 1)
                : null,
        ]);

        return response()->json([
            'problems' => $problems,
            'counts' => [
                'total' => Problem::count(),
                'easy' => Problem::where('difficulty', Problem::DIFFICULTY_EASY)->count(),
                'medium' => Problem::where('difficulty', Problem::DIFFICULTY_MEDIUM)->count(),
                'hard' => Problem::where('difficulty', Problem::DIFFICULTY_HARD)->count(),
            ],
        ]);
    }

    /**
     * Every problem is verified before it's saved: the submitted reference
     * solution is run through the exact same JudgeService pipeline students
     * use, against every test case being created. If it doesn't pass all
     * of them, nothing is persisted — the same quality gate LeetCode itself
     * runs before publishing a problem, and the only thing that makes "add
     * 2000 real questions" safe without a human manually re-verifying each
     * one by hand.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'difficulty' => ['required', Rule::in(Problem::DIFFICULTIES)],
            'tags' => ['nullable', 'array'],
            'tags.*' => ['string'],
            'description' => ['required', 'string'],
            'constraints' => ['nullable', 'array'],
            'constraints.*' => ['string'],
            'hints' => ['nullable', 'array'],
            'hints.*' => ['string'],
            'function_name' => ['required', 'string', 'regex:/^[a-zA-Z_][a-zA-Z0-9_]*$/'],
            'params' => ['required', 'array', 'min:1'],
            'params.*.name' => ['required', 'string', 'regex:/^[a-zA-Z_][a-zA-Z0-9_]*$/'],
            'params.*.type' => ['required', Rule::in(ProblemType::ALL)],
            'return_type' => ['required', Rule::in(ProblemType::ALL)],
            'comparison_mode' => ['nullable', Rule::in(Problem::COMPARISON_MODES)],
            'comparison_epsilon' => ['nullable', 'numeric'],
            'test_cases' => ['required', 'array', 'min:1'],
            'test_cases.*.inputs' => ['required', 'array'],
            'test_cases.*.expected_output' => ['required'],
            'test_cases.*.is_sample' => ['nullable', 'boolean'],
            'test_cases.*.explanation' => ['nullable', 'string'],
            'reference_solution' => ['required', 'array'],
            'reference_solution.language' => ['required', Rule::in(['javascript', 'python', 'java', 'cpp'])],
            'reference_solution.code' => ['required', 'string'],
        ]);

        $slug = $this->uniqueSlug($validated['title']);

        DB::beginTransaction();

        $problem = Problem::create([
            'slug' => $slug,
            'title' => $validated['title'],
            'difficulty' => $validated['difficulty'],
            'tags' => $validated['tags'] ?? [],
            'description' => $validated['description'],
            'function_name' => $validated['function_name'],
            'params' => $validated['params'],
            'return_type' => $validated['return_type'],
            'comparison_mode' => $validated['comparison_mode'] ?? Problem::COMPARISON_EXACT,
            'comparison_epsilon' => $validated['comparison_epsilon'] ?? null,
            'constraints' => $validated['constraints'] ?? [],
            'hints' => $validated['hints'] ?? [],
            'display_order' => (int) (Problem::max('display_order') ?? 0) + 1,
        ]);

        foreach ($validated['test_cases'] as $index => $testCase) {
            $problem->testCases()->create([
                'inputs' => $testCase['inputs'],
                'expected_output' => $testCase['expected_output'],
                'explanation' => $testCase['explanation'] ?? null,
                'is_sample' => $testCase['is_sample'] ?? false,
                'display_order' => $index,
            ]);
        }

        $outcome = $this->judge->judge(
            $problem->fresh(),
            $validated['reference_solution']['language'],
            $validated['reference_solution']['code'],
            $problem->testCases()->get()
        );

        if ($outcome['submissionStatus'] !== Submission::STATUS_ACCEPTED) {
            DB::rollBack();

            return response()->json([
                'message' => 'The reference solution did not pass every test case — the problem was not saved.',
                'verification' => $outcome['body'],
            ], 422);
        }

        DB::commit();

        ActivityLog::record($request->user(), 'Created problem', 'Problem', $problem->title, ['slug' => $problem->slug]);

        return response()->json([
            'problem' => $problem->fresh('testCases'),
            'verification' => $outcome['body'],
        ], 201);
    }

    private function uniqueSlug(string $title): string
    {
        $base = Str::slug($title);
        $slug = $base;
        $suffix = 1;

        while (Problem::where('slug', $slug)->exists()) {
            $slug = $base.'-'.(++$suffix);
        }

        return $slug;
    }
}
