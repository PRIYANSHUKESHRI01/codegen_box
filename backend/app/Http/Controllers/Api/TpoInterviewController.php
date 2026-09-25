<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Services\InterviewProctoringService;
use App\Services\InterviewTrackAdvancementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * College-TPO-only: a TPO's own private practice ("mock") AI interviews for
 * their own students, entirely separate from Mellow's platform-run
 * interviews — direct mirror of TpoContestController. Every method scoped
 * to `interview_type = tpo_mock AND owning_college_id = caller's college`.
 * Questions may be picked from the entire shared bank (no company-tag
 * restriction) since a mock round is generic interview practice, not tied
 * to one employer. No inviteCandidates() — visible automatically to the
 * whole owning college (see Interview::isVisibleToCollege()), a student
 * self-starts it directly.
 */
class TpoInterviewController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'interviews' => $this->ownedInterviews($request)->whereNull('interview_track_id')->withCount('sessions')->latest('created_at')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $collegeId = $request->user()->college_id;

        if (! $collegeId) {
            return response()->json(['message' => 'Your account is not linked to a college.'], 422);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $interview = Interview::create([
            'title' => $validated['title'],
            'slug' => Interview::uniqueSlug($validated['title']),
            'description' => $validated['description'] ?? null,
            'status' => Interview::STATUS_DRAFT,
            'interview_type' => Interview::INTERVIEW_TYPE_TPO_MOCK,
            'owning_college_id' => $collegeId,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['interview' => $interview], 201);
    }

    public function update(Request $request, Interview $interview)
    {
        $this->authorizeOwnership($request, $interview);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in(Interview::STATUSES)],
        ]);

        $interview->update($validated);

        return response()->json(['interview' => $interview->fresh()]);
    }

    /** Same "no candidate history, no delete" rule as destroyQuestion() — a taken/invited mock interview must be cancelled, not erased. */
    public function destroy(Request $request, Interview $interview)
    {
        $this->authorizeOwnership($request, $interview);

        if ($interview->sessions()->exists()) {
            return response()->json([
                'message' => 'This mock interview already has student sessions and cannot be deleted. Set its status to "cancelled" instead.',
            ], 422);
        }

        $interview->delete();

        return response()->json(['message' => 'Mock interview deleted.']);
    }

    public function questions(Request $request, Interview $interview)
    {
        $this->authorizeOwnership($request, $interview);

        return response()->json([
            'questions' => $interview->interviewQuestions()
                ->with('questionBank:id,question_text,category,difficulty,expected_duration_seconds')
                ->orderBy('display_order')
                ->get(),
        ]);
    }

    public function storeQuestion(Request $request, Interview $interview)
    {
        $this->authorizeOwnership($request, $interview);

        $validated = $request->validate([
            'interview_question_bank_id' => ['required', 'integer', 'exists:interview_question_banks,id'],
            'display_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $interviewQuestion = InterviewQuestion::create([
            'interview_id' => $interview->id,
            'interview_question_bank_id' => $validated['interview_question_bank_id'],
            'display_order' => $validated['display_order'] ?? $interview->interviewQuestions()->count(),
        ]);

        return response()->json([
            'interview_question' => $interviewQuestion->load('questionBank:id,question_text,category,difficulty,expected_duration_seconds'),
        ], 201);
    }

    public function destroyQuestion(Request $request, Interview $interview, InterviewQuestion $interviewQuestion)
    {
        $this->authorizeOwnership($request, $interview);

        abort_unless($interviewQuestion->interview_id === $interview->id, 404);

        if (InterviewResponse::where('interview_question_id', $interviewQuestion->id)->exists()) {
            return response()->json(['message' => 'Cannot remove a question that already has candidate responses.'], 422);
        }

        $interviewQuestion->delete();

        return response()->json(['message' => 'Question removed from interview.']);
    }

    /** Who's taken this mock interview, and where they're at — the TPO's own review queue. `proctoringSession` surfaces the strike count so a flagged candidate is visible from the list, not just after opening them. */
    public function sessions(Request $request, Interview $interview)
    {
        $this->authorizeOwnership($request, $interview);

        return response()->json([
            'sessions' => $interview->sessions()->with('user:id,name,email', 'proctoringSession')->latest('started_at')->get(),
        ]);
    }

    /** A candidate's full Q&A transcript for this session plus their proctoring activity — the actual review payload. */
    public function responses(Request $request, Interview $interview, InterviewSession $interviewSession)
    {
        $this->authorizeOwnership($request, $interview);

        abort_unless($interviewSession->interview_id === $interview->id, 404);

        $responses = $interviewSession->responses()
            ->with('interviewQuestion.questionBank:id,question_text,category,difficulty')
            ->get()
            ->sortBy(fn (InterviewResponse $r) => $r->interviewQuestion->display_order)
            ->values();

        // The round's own qualifying_score_percent is included so the
        // reviewer UI can tell "passed" from merely "reviewed" on a
        // page reload, without re-deriving it from finalize()'s response.
        $interviewSession->load(['proctoringSession.violations', 'interview:id,qualifying_score_percent']);

        return response()->json(['session' => $interviewSession, 'responses' => $responses]);
    }

    /** A false-positive override for a locked candidate — mirrors TpoProctoringController::reinstate(). */
    public function reinstateProctoring(Request $request, Interview $interview, InterviewSession $interviewSession, InterviewProctoringService $proctoring)
    {
        $this->authorizeOwnership($request, $interview);

        abort_unless($interviewSession->interview_id === $interview->id, 404);

        $proctoringSession = $interviewSession->proctoringSession;
        abort_unless($proctoringSession?->isLocked(), 422, 'This session is not locked.');

        $proctoring->reinstate($proctoringSession, $request->user());

        return response()->json(['proctoring_session' => $proctoringSession->fresh()]);
    }

    /** Streams a stored answer recording — private `local` disk, never a public URL, authenticated + ownership-checked on every request. */
    public function responseAudio(Request $request, Interview $interview, InterviewResponse $interviewResponse)
    {
        $this->authorizeOwnership($request, $interview);

        abort_unless(
            $interviewResponse->interviewQuestion?->interview_id === $interview->id && $interviewResponse->audio_path,
            404
        );

        return Storage::disk('local')->response($interviewResponse->audio_path);
    }

    /** A reviewer's per-response score (0-100) + notes — see AdminInterviewController::scoreResponse()'s docblock. */
    public function scoreResponse(Request $request, Interview $interview, InterviewResponse $interviewResponse)
    {
        $this->authorizeOwnership($request, $interview);

        abort_unless($interviewResponse->interviewQuestion?->interview_id === $interview->id, 404);

        $validated = $request->validate([
            'score' => ['required', 'integer', 'min:0', 'max:100'],
            'review_notes' => ['nullable', 'string'],
        ]);

        $interviewResponse->update([
            'score' => $validated['score'],
            'review_notes' => $validated['review_notes'] ?? null,
            'scored_by' => $request->user()->id,
            'scored_at' => now(),
            'ai_scored' => false,
        ]);

        return response()->json(['response' => $interviewResponse->fresh()]);
    }

    /** Locks in a session's composite score and advances the candidate (track round) or just records it (standalone) — see AdminInterviewController::finalizeSession()'s docblock. */
    public function finalizeSession(Request $request, Interview $interview, InterviewSession $interviewSession, InterviewTrackAdvancementService $service)
    {
        $this->authorizeOwnership($request, $interview);

        abort_unless($interviewSession->interview_id === $interview->id, 404);

        $result = $interview->isTrackRound()
            ? $service->finalizeAndAdvance($interviewSession, $request->user())
            : $service->finalizeStandaloneScoring($interviewSession, $request->user());

        return response()->json($result);
    }

    private function ownedInterviews(Request $request)
    {
        return Interview::where('interview_type', Interview::INTERVIEW_TYPE_TPO_MOCK)
            ->where('owning_college_id', $request->user()->college_id);
    }

    private function authorizeOwnership(Request $request, Interview $interview): void
    {
        abort_unless(
            $interview->isTpoMock() && $interview->owning_college_id === $request->user()->college_id,
            404
        );
    }
}
