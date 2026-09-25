<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Problem;
use App\Models\ProblemTestCase;
use Illuminate\Support\Facades\Cache;

/**
 * The only unauthenticated data surface in this API — everything else sits
 * behind auth:sanctum. Exists so the public marketing landing page can show
 * real numbers instead of the hardcoded marketing copy it used to ship with
 * (605 fake "1,400+ problems", a fake "42,000+ students placed", etc.).
 * Deliberately narrow: only aggregate counts and a handful of non-sensitive
 * problem fields (never a hidden test case, never anything auth-scoped).
 */
class PublicController extends Controller
{
    /**
     * Real, cached platform-depth numbers for the landing page's Stats
     * section. Cached for 10 minutes — this is hit by every anonymous
     * visitor (and bots), so it's a handful of COUNT queries away from the
     * request path, not on it. Language count reads `config('piston
     * .languages')` directly, so it can never drift out of sync with the
     * real judge again the way the old hardcoded 5-language frontend list
     * (which included Rust — never actually judge-supported) did.
     */
    public function stats()
    {
        return response()->json(
            Cache::remember('public:landing-stats', now()->addMinutes(10), function () {
                $byDifficulty = Problem::query()
                    ->selectRaw('difficulty, count(*) as count')
                    ->groupBy('difficulty')
                    ->pluck('count', 'difficulty');

                return [
                    'problems_total' => Problem::count(),
                    'problems_easy' => (int) ($byDifficulty['easy'] ?? 0),
                    'problems_medium' => (int) ($byDifficulty['medium'] ?? 0),
                    'problems_hard' => (int) ($byDifficulty['hard'] ?? 0),
                    'topics_total' => Problem::query()->pluck('tags')->flatten()->unique()->count(),
                    'test_cases_total' => ProblemTestCase::count(),
                    'languages_total' => count(config('piston.languages', [])),
                ];
            })
        );
    }

    /**
     * A small, real, non-sensitive sample of the problem catalog for the
     * landing page's Problem Explorer and the navbar's search — 3 per
     * difficulty tier so the preview isn't all-easy or all-hard. Never
     * exposes `acceptance_rate`/`total_submissions` — see Problem's own
     * docblock: those are static seed flavor text, not real computed
     * numbers, and showing them here would reintroduce exactly the kind of
     * fake-looking-real stat this endpoint exists to get rid of.
     */
    public function sampleProblems()
    {
        return response()->json([
            'problems' => collect(Problem::DIFFICULTIES)
                ->flatMap(fn (string $difficulty) => Problem::where('difficulty', $difficulty)
                    ->orderBy('id')
                    ->limit(3)
                    ->get(['slug', 'title', 'difficulty', 'tags']))
                ->values(),
        ]);
    }
}
