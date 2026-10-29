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

        if ($paused = $this->pausedResponse()) {
            return $paused;
        }

        return response()->json($this->practice->options($request->user()));
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->isStudent(), 403);

        if ($paused = $this->pausedResponse()) {
            return $paused;
        }

        $validated = $request->validate([
            'role' => ['required', 'string', 'max:60'],
            'kind' => ['required', 'string', 'max:20'],
            'count' => ['required', 'integer'],
            'difficulty' => ['required', 'string', 'max:10'],
        ]);

        $interview = $this->practice->create($request->user(), $validated);

        return response()->json(['interview' => ['slug' => $interview->slug, 'title' => $interview->title, 'question_count' => $interview->interviewQuestions()->count()]], 201);
    }

    /**
     * The studio is paused (config practice_interviews.student_builder_enabled): students practise through the Mock AI Interview by domain and
     * stack instead. The server refuses, not just the page, so a stale tab or a direct call cannot build one either.
     */
    private function pausedResponse(): ?JsonResponse
    {
        if (config('practice_interviews.student_builder_enabled')) {
            return null;
        }

        return response()->json([
            'message' => 'Building your own practice interview is paused for now. Practise by domain and tech stack in the Mock AI Interview.',
            'code' => 'practice_builder_paused',
        ], 403);
    }
}
