<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendInterviewShortlistEmail;
use App\Models\DriveApplication;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Models\PlacementDrive;
use App\Services\InterviewProctoringService;
use App\Services\InterviewTrackAdvancementService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * A company hiring tenant's own AI interviews — near-verbatim mirror of
 * CompanyContestController (see that class's docblock for the shared
 * reasoning). Every method scoped to `interview_type = company_hiring AND
 * owning_company_id = caller's company`. Always tied to exactly one job
 * opening (`placement_drive_id` required on create), and — unlike a
 * company_hiring contest — ALWAYS invite-only (see
 * Interview::isVisibleToUser()): there is no "open to all"/college-approved
 * self-register path, since shortlisting who gets interviewed is a
 * deliberate recruiter decision.
 *
 * The upstream flow this plugs into (unchanged, not touched by this
 * controller): the recruiter runs a `company_hiring` Contest, reviews
 * CompanyContestController::results(), pulls qualifiers into the
 * DriveApplication pipeline via importResults() — THEN creates/publishes an
 * interview here and calls inviteCandidates() with that same shortlist,
 * which is what actually notifies them and puts the interview on their
 * dashboard.
 */
class CompanyInterviewController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'interviews' => $this->ownedInterviews($request)->whereNull('interview_track_id')->withCount('sessions')->with('placementDrive:id,title,role_title')->latest('created_at')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $companyId = $request->user()->company_id;

        if (! $companyId) {
            return response()->json(['message' => 'Your account is not linked to a company.'], 422);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'placement_drive_id' => ['required', 'integer', 'exists:placement_drives,id'],
            'is_mock' => ['sometimes', 'boolean'],
        ]);

        $drive = PlacementDrive::where('id', $validated['placement_drive_id'])
            ->where('company_id', $companyId)
            ->where('source', PlacementDrive::SOURCE_COMPANY_DIRECT)
            ->firstOrFail();

        $interview = Interview::create([
            'title' => $validated['title'],
            'slug' => Interview::uniqueSlug($validated['title']),
            'description' => $validated['description'] ?? null,
            'status' => Interview::STATUS_DRAFT,
            'interview_type' => Interview::INTERVIEW_TYPE_COMPANY_HIRING,
            'is_mock' => $validated['is_mock'] ?? false,
            'company_id' => $companyId,
            'owning_company_id' => $companyId,
            'placement_drive_id' => $drive->id,
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
            'is_mock' => ['sometimes', 'boolean'],
        ]);

        $interview->update($validated);

        return response()->json(['interview' => $interview->fresh()]);
    }

    /** Same "no candidate history, no delete" rule as destroyQuestion() — once anyone is shortlisted (a session exists) this must be cancelled, not erased. */
    public function destroy(Request $request, Interview $interview)
    {
        $this->authorizeOwnership($request, $interview);

        if ($interview->sessions()->exists()) {
            return response()->json([
                'message' => 'This interview already has shortlisted/invited candidates and cannot be deleted. Set its status to "cancelled" instead.',
            ], 422);
        }

        $interview->delete();

        return response()->json(['message' => 'Interview deleted.']);
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

    /**
     * The ONLY way a candidate becomes able to see/take this interview —
     * see Interview::isVisibleToUser(). Each invited user must already be
     * in this interview's job opening's pipeline (a DriveApplication row),
     * same rule ContestParticipant invite uses — you can't be shortlisted
     * for an interview without already being a candidate. Dispatching the
     * "you've been shortlisted" email is gated on wasRecentlyCreated so
     * re-running invite with an overlapping selection never re-spams an
     * already-invited candidate.
     */
    public function inviteCandidates(Request $request, Interview $interview)
    {
        $this->authorizeOwnership($request, $interview);

        $validated = $request->validate([
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer'],
        ]);

        $eligibleUserIds = DriveApplication::where('placement_drive_id', $interview->placement_drive_id)
            ->whereIn('user_id', $validated['user_ids'])
            ->pluck('user_id')
            ->all();

        $invited = 0;
        foreach ($eligibleUserIds as $userId) {
            $session = InterviewSession::firstOrCreate(
                ['interview_id' => $interview->id, 'user_id' => $userId],
                ['status' => InterviewSession::STATUS_INVITED, 'invited_at' => now(), 'invited_by' => $request->user()->id, 'current_question_order' => 0]
            );

            if ($session->wasRecentlyCreated) {
                SendInterviewShortlistEmail::dispatch($userId, $interview->owning_company_id, $interview->id);
                $invited++;
            }
        }

        $skipped = count($validated['user_ids']) - $invited;

        return response()->json([
            'message' => "Shortlisted and notified {$invited} candidate(s)."
                .($skipped > 0 ? " {$skipped} skipped — not in this opening's pipeline, or already invited." : ''),
            'invited' => $invited,
        ]);
    }

    /** Who's shortlisted for this interview, plus their session status — the recruiter's tracking view. `proctoringSession` surfaces the strike count so a flagged candidate is visible from the list, not just after opening them. */
    public function invited(Request $request, Interview $interview)
    {
        $this->authorizeOwnership($request, $interview);

        return response()->json([
            'sessions' => $interview->sessions()->with('user:id,name,email', 'proctoringSession')->latest('invited_at')->get(),
        ]);
    }

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

    /** Streams a stored answer recording — private `local` disk, authenticated + ownership-checked on every request, never a public URL. */
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
        return Interview::where('interview_type', Interview::INTERVIEW_TYPE_COMPANY_HIRING)
            ->where('owning_company_id', $request->user()->company_id);
    }

    private function authorizeOwnership(Request $request, Interview $interview): void
    {
        abort_unless(
            $interview->isCompanyHiring() && $interview->owning_company_id === $request->user()->company_id,
            404
        );
    }
}
