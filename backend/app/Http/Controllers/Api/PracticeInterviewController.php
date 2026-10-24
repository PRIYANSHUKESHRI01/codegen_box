<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interview;
use App\Services\PracticeInterviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Student-facing "Practice interview" studio: what a student may pick (their branch's roles, the kind of round, the length) and
 * the call that builds the interview. Taking it is the ordinary /interviews/{slug}/… flow — see PracticeInterviewService.
 */
class PracticeInterviewController extends Controller
{
    public function __construct(private readonly PracticeInterviewService $practice) {}

    public function options(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403);

        return response()->json($this->practice->options($request->user()));
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403);

        $validated = $request->validate([
            'role' => ['required', 'string', 'max:60'],
            'kind' => ['required', 'string', 'max:20'],
            'count' => ['required', 'integer'],
            'difficulty' => ['required', 'string', 'max:10'],
        ]);

        $interview = $this->practice->create($request->user(), $validated);

        return response()->json(['interview' => ['slug' => $interview->slug, 'title' => $interview->title, 'question_count' => $interview->interviewQuestions()->count()]], 201);
    }
}
