<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CuratedInterviewSetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controller for AptRun Curated Interview Question Sets.
 *
 * Exposes the curated role/stack/difficulty catalog and handles
 * one-click starting of curated AI spoken interviews.
 */
class CuratedInterviewSetController extends Controller
{
    public function __construct(private readonly CuratedInterviewSetService $service) {}

    /**
     * Get the full catalog of engineering roles, tech stacks, and difficulty sets.
     */
    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403, 'Curated interview question sets are available to students.');

        return response()->json($this->service->catalog($request->user()));
    }

    /**
     * Get the detailed configuration and questions of a single set.
     */
    public function show(Request $request, string $setId): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403, 'Curated interview question sets are available to students.');

        $target = $this->service->findSet($setId);
        abort_if($target === null, 404, "Curated question set [{$setId}] not found.");

        return response()->json($target);
    }

    /**
     * Start an AI voice interview from a curated question set.
     */
    public function start(Request $request, string $setId): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403, 'Curated interview question sets are available to students.');

        $interview = $this->service->start($request->user(), $setId);

        return response()->json([
            'interview' => [
                'id' => $interview->id,
                'slug' => $interview->slug,
                'title' => $interview->title,
                'question_count' => $interview->interviewQuestions()->count(),
            ],
        ], 201);
    }
}

