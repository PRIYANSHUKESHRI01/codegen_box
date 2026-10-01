<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Problem;
use App\Models\ProblemTestCase;
use App\Models\Submission;
use App\Services\ProblemCodeGenerator\StarterCodeGenerator;
use Illuminate\Http\Request;

/**
 * Read-only problem catalog for the Practice Arena. show() deliberately
 * hand-picks the public fields to return rather than serializing the model
 * directly — `function_name`/`params`/`return_type`/`comparison_mode` and
 * every non-sample ProblemTestCase are judging internals (the hidden test
 * suite Submit actually grades against) and must never reach the client,
 * unlike the old raw-model response which sent the entire hand-written
 * `test_harness` — hidden literal inputs included — to the browser on every
 * page load. `starter_code` is generated fresh from the signature on every
 * call instead of being stored, so it can never drift from it.
 */
class ProblemController extends Controller
{
    public function index(Request $request)
    {
        $problems = Problem::orderBy('display_order')
            ->orderBy('id')
            ->get(['id', 'slug', 'title', 'difficulty', 'tags', 'companies', 'acceptance_rate', 'total_submissions', 'display_order']);

        // Not $problems->each(fn ($p) => $p->solved = ...) — Collection::each()
        // stops iterating the moment a callback returns exactly `false`, and
        // that assignment's value *is* the callback's return value. For the
        // first not-yet-solved problem that's `false`, which silently
        // truncated every later problem's `solved` field until this fix.
        $solvedProblemIds = $this->solvedProblemIds($request);
        foreach ($problems as $p) {
            $p->solved = $solvedProblemIds->contains($p->id);
            // The LeetCode-style "101. Two Sum" display number — stable
            // because display_order itself never changes once assigned
            // (each seed batch only ever appends). Offset by 100 per
            // product decision, not a technical constraint. `display_order`
            // itself is an internal sequencing detail, not a public field.
            $p->serial_number = $p->display_order + 100;
        }
        $problems->makeHidden('display_order');

        return response()->json(['problems' => $problems]);
    }

    /**
     * Route-model-bound by slug (see Problem::getRouteKeyName). `solved` is
     * real and re-attemptable — it only reflects whether an accepted
     * Submission row already exists for this user+problem (any day, not
     * just today's, since practice/[slug] doesn't restrict re-solving) and
     * never blocks Run/Submit either way.
     */
    public function show(Request $request, Problem $problem, StarterCodeGenerator $starterCodeGenerator)
    {
        $solved = Submission::where('user_id', $request->user()->id)
            ->where('problem_id', $problem->id)
            ->where('status', Submission::STATUS_ACCEPTED)
            ->exists();

        return response()->json([
            'problem' => [
                'id' => $problem->id,
                'slug' => $problem->slug,
                'title' => $problem->title,
                'serial_number' => $problem->display_order + 100,
                'difficulty' => $problem->difficulty,
                'tags' => $problem->tags,
                'companies' => $problem->companies,
                'acceptance_rate' => $problem->acceptance_rate,
                'total_submissions' => $problem->total_submissions,
                'solved' => $solved,
                'description' => $problem->description,
                'constraints' => $problem->constraints,
                'hints' => $problem->hints,
                'examples' => $problem->sampleTestCases()->take(3)->get()->map(fn (ProblemTestCase $tc) => [
                    'input' => $tc->prettyInput($problem->params),
                    'output' => json_encode($tc->expected_output),
                    'explanation' => $tc->explanation,
                ]),
                'starter_code' => $starterCodeGenerator->generateAll($problem),
            ],
        ]);
    }

    /** Every problem this user has ever gotten `accepted` on, any day — one cheap query for the whole list rather than N. */
    private function solvedProblemIds(Request $request)
    {
        return Submission::where('user_id', $request->user()->id)
            ->where('status', Submission::STATUS_ACCEPTED)
            ->pluck('problem_id')
            ->unique();
    }
}
