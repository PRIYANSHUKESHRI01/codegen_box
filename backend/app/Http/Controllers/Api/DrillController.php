<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DrillService;
use App\Models\StudySitting;
use App\Services\PracticeShelfService;
use App\Services\StudySittingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Skill Drills (student): record the answers to browser-generated questions and read back the per-skill picture and the streak.
 * See config/drills.php — that file is the list of skills the API accepts.
 */
class DrillController extends Controller
{
    public function __construct(private readonly DrillService $drills, private readonly StudySittingService $sittings) {}

    public function summary(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403);

        return response()->json($this->drills->summary($request->user()));
    }

    /** "Today's practice" — the cards the home offers (see PracticeShelfService). Lives beside the drills because the drill streak is part of it. */
    public function shelf(Request $request, PracticeShelfService $shelf): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403);

        return response()->json($shelf->forStudent($request->user()));
    }

    public function record(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403);

        $packs = config('drills.packs');
        $validated = $request->validate([
            'sitting_id' => ['nullable', 'integer'],
            'attempts' => ['required', 'array', 'min:1', 'max:'.(int) config('drills.limits.batch')],
            'attempts.*.pack' => ['required', Rule::in(array_keys($packs))],
            'attempts.*.skill' => ['required', 'string', Rule::in(collect($packs)->flatMap(fn ($p) => $p['skills'])->all())],
            'attempts.*.difficulty' => ['required', 'integer', 'between:1,3'],
            'attempts.*.correct' => ['required', 'boolean'],
            'attempts.*.seconds' => ['nullable', 'integer', 'between:0,900'],
        ]);

        // Answers are accepted only into a proctored sitting (camera, fullscreen, strikes). One that ended normally a moment ago still
        // counts: the browser sends answers in the background, so the last batch can land just after the student finished.
        $sitting = $this->sittings->requireUsable($request->user(), $validated['sitting_id'] ?? null, StudySitting::KIND_DRILL, allowCompleted: true);

        // A skill belongs to exactly one pack: refuse a mismatched pair rather than file it under the wrong pack.
        foreach ($validated['attempts'] as $i => $a) {
            abort_unless(in_array($a['skill'], $packs[$a['pack']]['skills'], true), 422, "attempts.{$i}: that skill is not in that pack.");
        }

        return response()->json($this->drills->record($request->user(), $validated['attempts'], $sitting?->id), 201);
    }
}
