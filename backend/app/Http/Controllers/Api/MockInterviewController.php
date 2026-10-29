<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Mock\MockInterviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The student's Mock AI Interview: practise by domain -> tech stack -> round. See MockInterviewService for the rules.
 */
class MockInterviewController extends Controller
{
    public function __construct(private readonly MockInterviewService $mock) {}

    /** GET /mock-interviews/catalog */
    public function catalog(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403, 'The Mock AI Interview is available to students.');

        return response()->json($this->mock->catalog($request->user()));
    }

    /** POST /mock-interviews/rounds/{roundId}/start */
    public function start(Request $request, string $roundId): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403, 'The Mock AI Interview is available to students.');

        $interview = $this->mock->start($request->user(), $roundId);

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
