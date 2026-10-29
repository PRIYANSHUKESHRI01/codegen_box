<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewSession;
use App\Services\Speech\InterviewSpeech;
use Illuminate\Http\Request;

/**
 * The interviewer's voice, as audio. Two things can be asked for: the question the candidate is on (or one already answered), and one of
 * the fixed lines ("hi, I'm your interviewer"). Never free text - this is not a text-to-speech service anyone can borrow.
 *
 * `503 speech_unavailable` is an ordinary answer, not an error: no voice is configured, or the provider is having a moment. The browser
 * reads the question in its own voice instead and the candidate never sees a failure.
 */
class InterviewSpeechController extends Controller
{
    public function __construct(private readonly InterviewSpeech $speech) {}

    public function question(Request $request, Interview $interview, InterviewQuestion $interviewQuestion)
    {
        abort_unless($interview->status === Interview::STATUS_PUBLISHED, 404);
        abort_unless($interview->isVisibleToUser($request->user()), 404);
        abort_unless($interviewQuestion->interview_id === $interview->id, 404);

        $session = InterviewSession::where('interview_id', $interview->id)->where('user_id', $request->user()->id)->first();
        abort_if($session === null || $session->status === InterviewSession::STATUS_COMPLETED, 404);

        // Only the question the candidate is on, or one they have already answered. Serving a later one would let anyone listen to the
        // whole interview - and prepare their answers - before sitting it.
        $position = $interview->interviewQuestions()->orderBy('display_order')->pluck('id')->search($interviewQuestion->id);
        abort_unless($position !== false && $position <= $session->current_question_order, 404);

        return $this->respond($this->speech->forQuestion($interviewQuestion));
    }

    public function line(Request $request, string $line)
    {
        abort_unless(array_key_exists($line, $this->speech->lines()), 404);

        return $this->respond($this->speech->forLine($line));
    }

    private function respond($file)
    {
        if ($file === null) {
            return response()->json(['code' => 'speech_unavailable', 'message' => 'The interviewer will use your browser\'s voice.'], 503);
        }

        return $file->response();
    }
}
