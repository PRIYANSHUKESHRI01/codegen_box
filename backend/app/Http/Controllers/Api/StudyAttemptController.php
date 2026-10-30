<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StudyAttempt;
use App\Services\Interviews\StudyHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A student's own record of their study sittings (the Merchant Navy sets): the score history of every set, and the full report of any one
 * sitting, which the browser turns into the PDF they download. Never anyone else's: another student's sitting is a 404.
 */
class StudyAttemptController extends Controller
{
    public function __construct(private readonly StudyHistory $history) {}

    /** GET /study-attempts - every exam and set the student has sat, with the score of each sitting. */
    public function index(Request $request): JsonResponse
    {
        return response()->json($this->history->overview($request->user()));
    }

    /** GET /study-attempts/{attempt} - one sitting in full, with where it stands among the student's sittings of that set. */
    public function show(Request $request, StudyAttempt $attempt): JsonResponse
    {
        abort_unless($attempt->user_id === $request->user()->id, 404);

        return response()->json([
            'attempt' => [
                'id' => $attempt->id,
                'exam' => $attempt->exam_name,
                'stack_key' => $attempt->stack_key,
                'set_number' => $attempt->set_number,
                'set_title' => $attempt->set_title,
                'score' => $attempt->score,
                'question_count' => $attempt->question_count,
                'answered_count' => $attempt->answered_count,
                'partial' => $attempt->isPartial(),
                'counts' => ['green' => $attempt->green_count, 'yellow' => $attempt->yellow_count, 'red' => $attempt->red_count],
                'duration_seconds' => $attempt->duration_seconds,
                'completed_at' => $attempt->completed_at?->toIso8601String(),
                'results' => $attempt->results,
            ],
            'student' => ['name' => $request->user()->name],
            'standing' => $this->history->summaryFor($attempt),
        ]);
    }
}
