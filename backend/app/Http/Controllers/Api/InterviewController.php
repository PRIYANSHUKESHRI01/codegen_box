<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ScoreInterviewSessionJob;
use App\Services\Interviews\StudyFeedbackService;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Services\Integrity\IntegrityService;
use App\Services\PlanGate;
use App\Services\Speech\AudioTranscriptionService;
use App\Services\Speech\InterviewSpeech;
use App\Services\StudentReportService;
use App\Services\Voice\VoiceVerificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Student-facing interview browsing and the voice-taking flow. Only ever
 * exposes `Interview::STATUS_PUBLISHED` interviews the caller passes
 * isVisibleToUser() for (see that method — company_hiring is invite-only,
 * everything else is college-scoped). The candidate never scores anything
 * themselves — the instant a session completes, ScoreInterviewSessionJob is
 * dispatched to score it via Gemini (see answer() below and result()), and
 * a human can always additionally review/override via TpoInterviewController/
 * CompanyInterviewController/AdminInterviewController.
 */
class InterviewController extends Controller
{
    /** Flat prep-countdown allowance added per question when estimating an interview's total time on interviewSummary() — mirrors the frontend's own PREP_SECONDS constant. */
    private const PREP_SECONDS_PER_QUESTION = 10;

    public static function isMobilePhoneUserAgent(string $ua): bool
    {
        if ($ua === '' || preg_match('/\b(iPad|Tablet|PlayBook|Silk)\b/i', $ua)) {
            return false;
        }

        return preg_match('/\b(iPhone|iPod|Windows Phone|BlackBerry|BB10|Opera Mini|IEMobile|Mobile Safari)\b/i', $ua) === 1
            || (preg_match('/Android/i', $ua) === 1 && preg_match('/Mobile/i', $ua) === 1);
    }

    public static function desktopRequiredResponse()
    {
        return response()->json([
            'message' => 'Mock AI Interviews and Vault AI Interviews must be attempted on a laptop, desktop, or iPad/tablet. Mobile phones are not supported for proctored interviews.',
            'code' => 'desktop_required',
        ], 403);
    }

    public function index(Request $request)
    {
        // Track rounds are discovered via InterviewTrackController::index()
        // and taken through the dedicated pipeline page instead — excluded
        // here so they never show up redundantly as flat interviews (a
        // round is still reachable directly by slug via show()/start()/
        // answer()/complete() below, unchanged).
        $interviews = Interview::where('status', Interview::STATUS_PUBLISHED)
            ->where('interview_type', '!=', Interview::INTERVIEW_TYPE_COLLEGE_ASSESSMENT)
            ->whereNull('interview_track_id')
            ->with(['company:id,name,logo', 'colleges:id'])
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn (Interview $interview) => $interview->isVisibleToUser($request->user())
                && empty($interview->practice_config['qualification_id'])
                && ($interview->practice_config['source'] ?? null) !== 'curated_set')
            // "For your branch" first (newest first within each group — the sort is stable): an ECE student sees the ECE
            // interviews before the general ones; a CSE or unknown-branch student sees the list exactly as before.
            ->sortByDesc(fn (Interview $interview) => (int) $interview->isForBranchOf($request->user()))
            ->values();

        $interviews->load('interviewQuestions.questionBank:id,expected_duration_seconds');

        $sessionsByInterviewId = InterviewSession::where('user_id', $request->user()->id)
            ->whereIn('interview_id', $interviews->pluck('id'))
            ->get()
            ->keyBy('interview_id');

        return response()->json([
            'interviews' => $interviews->map(
                fn (Interview $interview) => $this->interviewSummary($interview, $sessionsByInterviewId->get($interview->id))
                    + ['for_your_branch' => $interview->isForBranchOf($request->user())]
            ),
        ]);
    }

    /**
     * The candidate's own interview performance — every interview they've
     * been invited to or taken, with the score index() deliberately never
     * includes (that endpoint is for browsing/starting, not reviewing).
     * Reuses StudentReportService::interviewHistory() unchanged — the exact
     * same computation TpoStudentReportController/CoordinatorStudentReportController/
     * AdminStudentReportController already run against a student who isn't
     * the caller; here the caller looks at themselves.
     */
    public function history(Request $request, StudentReportService $service)
    {
        return response()->json(['interviews' => $service->interviewHistory($request->user())]);
    }

    public function show(Request $request, Interview $interview)
    {
        abort_unless($interview->status === Interview::STATUS_PUBLISHED, 404);
        abort_unless($interview->isVisibleToUser($request->user()), 404);

        $session = InterviewSession::where('interview_id', $interview->id)
            ->where('user_id', $request->user()->id)
            ->first();

        $speech = app(InterviewSpeech::class);

        return response()->json($this->interviewSummary($interview, $session) + [
            // The interviewer's voice, so the briefing page can let a candidate hear it before they start (null: no real voice configured).
            'voice_preview' => $speech->available() && isset($speech->lines()['greeting']) ? ['text' => $speech->lines()['greeting']] : null,
        ]);
    }

    /**
     * Creates or resumes this candidate's session. For general/tpo_mock/
     * company (self-start) this is the only place a session row is ever
     * created; for company_hiring the row already exists (from
     * CompanyInterviewController::inviteCandidates(), status=invited) and
     * this just flips it to in_progress. Idempotent — calling it again
     * mid- or post-interview just returns wherever the candidate left off.
     */
    public function start(Request $request, Interview $interview)
    {
        abort_unless($interview->status === Interview::STATUS_PUBLISHED, 404);
        abort_unless($interview->isVisibleToUser($request->user()), 404);

        $existingSession = InterviewSession::where('interview_id', $interview->id)->where('user_id', $request->user()->id)->first();

        // Placement Drive Gating: If this interview belongs to a placement drive,
        // the student must be registered for that drive to take the interview.
        if ($interview->placement_drive_id !== null && $existingSession === null) {
            $isRegistered = \App\Models\DriveApplication::where('placement_drive_id', $interview->placement_drive_id)
                ->where('user_id', $request->user()->id)
                ->whereNotIn('stage', [\App\Models\DriveApplication::STAGE_REJECTED, \App\Models\DriveApplication::STAGE_WITHDRAWN])
                ->exists();

            if (! $isRegistered) {
                return response()->json([
                    'message' => 'You must register for this placement drive before taking this interview.',
                    'code' => 'drive_registration_required',
                    'drive_id' => $interview->placement_drive_id,
                ], 403);
            }
        }

        // A college mock with a window: a student who has not started cannot start before it opens or after it closes. Someone already
        // part-way through may finish after it closes, and a finished sitting can always be looked at again.
        if ($existingSession === null && $interview->isTpoMock() && ! $interview->acceptsNewSittings()) {
            $upcoming = $interview->scheduleState() === Interview::SCHEDULE_UPCOMING;

            return response()->json([
                'message' => $upcoming
                    ? 'This interview has not opened yet. It opens on '.$interview->opens_at->timezone(config('app.display_timezone', 'Asia/Kolkata'))->format('j M Y, g:i A').' (IST).'
                    : 'This interview has closed. Ask your placement cell if you need another chance.',
                'code' => $upcoming ? 'interview_not_open_yet' : 'interview_closed',
                'opens_at' => $interview->opens_at?->toIso8601String(),
                'closes_at' => $interview->closes_at?->toIso8601String(),
            ], $upcoming ? 423 : 410);
        }

        // A completed session has nothing left to protect — a stray or
        // adversarial lock recorded after finishing (e.g. proctoring/start
        // called again out-of-band) must never block re-viewing the
        // already-finished resume state on a legitimate revisit.
        if ($existingSession?->status !== InterviewSession::STATUS_COMPLETED) {
            if (self::isMobilePhoneUserAgent((string) $request->userAgent())) {
                return self::desktopRequiredResponse();
            }
            app(VoiceVerificationService::class)->assertEligible($request->user());
            $this->assertNotLocked($existingSession);
        }

        // Only a genuinely NEW attempt counts against the daily quota —
        // resuming/revisiting an existing session (in progress or already
        // completed) never re-charges it.
        if ($existingSession === null) {
            $this->assertWithinDailyMockInterviewLimit($request, $interview);
        }

        // current_question_order is explicit here (not left to the DB
        // default) because Model::create() never backfills DB-default
        // columns onto the in-memory instance it returns — without this, a
        // freshly-created session's current_question_order stays null in
        // PHP until the next fetch, and $questions->get(null) below
        // silently resolves to no question at all, making a brand-new
        // session look already complete.
        $session = InterviewSession::firstOrCreate(
            ['interview_id' => $interview->id, 'user_id' => $request->user()->id],
            ['status' => InterviewSession::STATUS_IN_PROGRESS, 'started_at' => now(), 'current_question_order' => 0]
        );

        if ($session->status === InterviewSession::STATUS_INVITED) {
            $session->update(['status' => InterviewSession::STATUS_IN_PROGRESS, 'started_at' => now()]);
        }

        // The candidate's own request makes the current question's voice; get the one after it ready while they answer.
        $this->warmSpeech($interview, $session->current_question_order + 1);

        return response()->json($this->sessionPayload($interview, $session));
    }

    /**
     * Transcribe candidate's spoken audio directly via AI transcriber.
     * Used for real-time fallback when browser-side STT is unavailable or interrupted.
     */
    public function transcribeAudio(Request $request, AudioTranscriptionService $transcriptionService)
    {
        $validated = $request->validate([
            'audio' => ['required', 'file', 'mimes:webm,weba,ogg,oga,wav,mp3,m4a,mp4', 'max:25600'],
            'question_text' => ['nullable', 'string', 'max:1000'],
        ]);

        $file = $request->file('audio');
        $transcript = $transcriptionService->transcribeUploadedFile(
            $file,
            $validated['question_text'] ?? null
        );

        return response()->json([
            'success' => true,
            'transcript' => $transcript,
        ]);
    }

    /**
     * Accepts a multipart answer: `transcript_text` is always required (the
     * text-fallback path when SpeechRecognition is unavailable produces
     * nothing else), `audio` is opportunistic.
     *
     * Production resilience & concurrency safeguards:
     * - Resilient proctoring gate: transient heartbeat drops (>50s) log a warning
     *   instead of aborting, ensuring student answers are never discarded.
     * - Idempotent re-submission & auto-resync: if a student retries an already-answered
     *   question (due to network timeout, double-click, or client lag), the server
     *   updates the answer and returns the true active question (or complete) rather
     *   than throwing a deadlocking 422.
     * - Completion resilience: if session is already complete, returns complete:true
     *   cleanly instead of throwing 422.
     * - Permissive audio validation and decoupled storage: audio container quirks or
     *   storage issues never block saving transcript_text.
     * - Row-level locking to prevent race conditions under high concurrent load (2,000+ users).
     * - Automatic AI transcription fallback: if the student spoke and recorded audio, but
     *   browser speech recognition dropped the text, the server transcribes the audio directly.
     */
    public function answer(Request $request, Interview $interview)
    {
        abort_unless($interview->isVisibleToUser($request->user()), 404);

        $session = InterviewSession::where('interview_id', $interview->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        // If the interview is already complete, return complete immediately rather than aborting with 422
        if ($session->status === InterviewSession::STATUS_COMPLETED) {
            return response()->json([
                'complete' => true,
                'already_completed' => true,
            ]);
        }

        $this->assertNotLocked($session);

        // Proctoring gating: verify live proctoring signal when active.
        // If a transient signal timeout (423) or unattached proctoring session (428) occurs,
        // log an integrity notice but DO NOT abort/discard the student's legitimate spoken answer!
        // Hard locks are already prevented by assertNotLocked() above.
        try {
            app(IntegrityService::class)->gate('interview', $session->proctoringSession, $request->user());
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            \Illuminate\Support\Facades\Log::warning('[InterviewAnswer] Integrity signal check warning', [
                'session_id' => $session->id,
                'status' => $e->getStatusCode(),
                'message' => $e->getMessage(),
            ]);
        }

        $validated = $request->validate([
            'interview_question_id' => ['required', 'integer'],
            'transcript_text' => ['nullable', 'string'],
            'audio' => ['nullable', 'file', 'mimes:webm,weba,ogg,oga,wav,mp3,m4a,mp4', 'max:25600'],
            'audio_duration_seconds' => ['nullable', 'integer', 'min:0'],
            'acoustic_features' => ['nullable', 'string'],
        ]);

        $questionContext = InterviewQuestion::with('questionBank:id,question_text')
            ->where('id', (int) $validated['interview_question_id'])
            ->where('interview_id', $interview->id)
            ->first()?->questionBank?->question_text;

        $rawTranscript = trim((string) ($validated['transcript_text'] ?? ''));

        if ($rawTranscript === '') {
            $rawTranscript = $request->hasFile('audio') ? '(Audio response submitted)' : '(No answer recorded)';
        }

        $audioPath = null;
        if ($request->hasFile('audio')) {
            try {
                $audioPath = $request->file('audio')->store("interviews/{$interview->id}/sessions/{$session->id}", 'local');
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('[InterviewAnswer] Audio storage failed, transcript preserved', [
                    'session_id' => $session->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        // Continuous speaker verification against the user's one-time 5-minute Voice Baseline.
        $voiceWarning = null;
        if ($audioPath !== null) {
            $liveFeatures = null;
            if (! empty($validated['acoustic_features'])) {
                $decodedFeatures = json_decode($validated['acoustic_features'], true);
                if (is_array($decodedFeatures)) {
                    $liveFeatures = $decodedFeatures;
                }
            }

            $voiceCheck = app(VoiceVerificationService::class)->verifyAnswerVoice(
                $request->user(),
                $interview,
                $session,
                null,
                $audioPath,
                (int) ($validated['audio_duration_seconds'] ?? 0),
                $liveFeatures
            );

            if ($voiceCheck['blocked']) {
                return response()->json([
                    'message' => $voiceCheck['reason'],
                    'code' => 'voice_mismatch_blocked',
                    'similarity_score' => $voiceCheck['similarity_score'],
                ], 403);
            }

            if (! empty($voiceCheck['warning'])) {
                $voiceWarning = $voiceCheck['reason'];
            }
        }

        $questions = $interview->interviewQuestions()->orderBy('display_order')->get();
        $submittedQuestionId = (int) $validated['interview_question_id'];
        $submittedQuestionIndex = $questions->search(fn ($q) => $q->id === $submittedQuestionId);

        abort_if($submittedQuestionIndex === false, 422, 'This question does not belong to this interview.');

        $study = $interview->isStudyMode() ? app(StudyFeedbackService::class) : null;
        $feedback = null;

        // Atomic transaction with row locking to ensure thread-safety and prevent race conditions under high concurrent load
        $result = DB::transaction(function () use ($session, $questions, $submittedQuestionId, $submittedQuestionIndex, $rawTranscript, $audioPath, $validated, $study, &$feedback) {
            /** @var InterviewSession $lockedSession */
            $lockedSession = InterviewSession::whereKey($session->id)->lockForUpdate()->first();

            if ($lockedSession->status === InterviewSession::STATUS_COMPLETED) {
                return ['complete' => true];
            }

            $currentOrder = (int) $lockedSession->current_question_order;
            $currentQuestion = $questions->get($currentOrder);

            // Case 1: Client retried an already answered question or server already progressed past it
            if ($submittedQuestionIndex < $currentOrder) {
                $targetQuestion = $questions->get($submittedQuestionIndex);
                if ($targetQuestion) {
                    InterviewResponse::updateOrCreate(
                        ['interview_session_id' => $lockedSession->id, 'interview_question_id' => $targetQuestion->id],
                        array_filter([
                            'transcript_text' => $rawTranscript,
                            'audio_path' => $audioPath,
                            'audio_duration_seconds' => $validated['audio_duration_seconds'] ?? null,
                            'answered_at' => now(),
                        ], fn ($v) => $v !== null)
                    );
                }

                if ($currentQuestion === null || $currentOrder >= $questions->count()) {
                    $lockedSession->update([
                        'status' => InterviewSession::STATUS_COMPLETED,
                        'completed_at' => $lockedSession->completed_at ?? now(),
                    ]);

                    return ['complete' => true, 'resynced' => true];
                }

                return [
                    'complete' => false,
                    'resynced' => true,
                    'next_question' => $currentQuestion,
                    'order' => $currentOrder,
                ];
            }

            // Case 2: Standard answer matching the expected current question
            $targetQuestion = $currentQuestion ?? $questions->get($submittedQuestionIndex);
            if ($targetQuestion === null) {
                $lockedSession->update([
                    'status' => InterviewSession::STATUS_COMPLETED,
                    'completed_at' => now(),
                ]);

                return ['complete' => true];
            }

            $response = InterviewResponse::updateOrCreate(
                ['interview_session_id' => $lockedSession->id, 'interview_question_id' => $targetQuestion->id],
                [
                    'transcript_text' => $rawTranscript,
                    'audio_path' => $audioPath,
                    'audio_duration_seconds' => $validated['audio_duration_seconds'] ?? null,
                    'answered_at' => now(),
                ]
            );

            if ($study !== null) {
                $feedback = $study->record($response, $targetQuestion->questionBank);
            }

            $nextOrder = max($currentOrder + 1, $submittedQuestionIndex + 1);
            $lockedSession->current_question_order = $nextOrder;
            $nextQuestion = $questions->get($nextOrder);

            if ($nextQuestion === null || $nextOrder >= $questions->count()) {
                $lockedSession->status = InterviewSession::STATUS_COMPLETED;
                $lockedSession->completed_at = now();
                $lockedSession->save();

                if ($study !== null) {
                    $study->finalize($lockedSession);
                }

                return ['complete' => true, 'dispatch_scoring' => ($study === null)];
            }

            $lockedSession->save();

            return [
                'complete' => false,
                'next_question' => $nextQuestion,
                'order' => $nextOrder,
            ];
        });

        if ($result['complete'] ?? false) {
            if ($result['dispatch_scoring'] ?? false) {
                ScoreInterviewSessionJob::dispatch($session->id)->afterResponse();
            }

            return response()->json(['complete' => true]
                + ($feedback !== null ? ['feedback' => $feedback] : [])
                + ($voiceWarning !== null ? ['voice_warning' => $voiceWarning] : []));
        }

        $nextQuestion = $result['next_question'];
        $nextOrder = $result['order'];

        // Have the voice for the upcoming question ready in background
        $this->warmSpeech($interview, $nextOrder + 1);

        return response()->json([
            'complete' => false,
            'next_question' => $this->questionPayload($nextQuestion, $nextOrder, $questions->count()),
        ]
            + ($feedback !== null ? ['feedback' => $feedback] : [])
            + ($voiceWarning !== null ? ['voice_warning' => $voiceWarning] : []));
    }

    /**
     * The candidate's own instant result — polled by the completion screen
     * right after they finish. `status` tells the frontend what to render:
     * `"scoring"` (job hasn't finished yet — keep polling), `"scored"`
     * (real result below), or `"needs_human_review"` (Gemini failed —
     * stop polling, show the old "a person will review this" copy).
     * Per-response feedback is only ever returned once scored — never a
     * partial/in-progress score.
     */
    public function result(Request $request, Interview $interview)
    {
        abort_unless($interview->isVisibleToUser($request->user()), 404);

        $session = InterviewSession::where('interview_id', $interview->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        abort_unless($session->status === InterviewSession::STATUS_COMPLETED, 422, 'This interview is not complete yet.');

        $status = match (true) {
            $session->hasScoreAvailable() => 'scored',
            $session->scoringFailed() => 'needs_human_review',
            default => 'scoring',
        };

        $responses = [];
        if ($status === 'scored') {
            $responses = $session->responses()
                ->with('interviewQuestion.questionBank:id,question_text,category,difficulty,notes_for_reviewer,reference_unverified,image')
                ->get()
                ->sortBy(fn (InterviewResponse $r) => $r->interviewQuestion->display_order)
                ->values()
                ->map(fn (InterviewResponse $r) => [
                    // Study mode only: the model answer and how much of it this answer covered (null for every other interview).
                    'study' => $interview->isStudyMode() ? app(StudyFeedbackService::class)->stored($r, $r->interviewQuestion->questionBank) : null,
                    'question_text' => $r->interviewQuestion->questionBank->question_text,
                    'category' => $r->interviewQuestion->questionBank->category,
                    'image' => $r->interviewQuestion->questionBank->image,
                    // The candidate's own answer, in full — previously
                    // omitted here even though InterviewResponse has always
                    // stored it; a student could see their score and AI
                    // feedback but never what they actually said. Reviewers
                    // (Tpo/Admin/CompanyInterviewController::responses())
                    // have always seen this; there's no reason the person who
                    // said it shouldn't.
                    'transcript_text' => $r->transcript_text,
                    'has_audio' => $r->audio_path !== null,
                    'response_id' => $r->id,
                    'score' => $r->score,
                    'feedback' => $r->review_notes,
                ]);
        }

        // A study sitting is kept for good once it is over (and, for one finished before that existed, kept now): the summary shows where this
        // sitting stands among the student's sittings of the set, and offers the report to download.
        $attempt = $status === 'scored' && $interview->isStudyMode() ? app(\App\Services\Interviews\StudyAttemptRecorder::class)->recordQuietly($session) : null;

        return response()->json([
            'attempt' => $attempt !== null ? app(\App\Services\Interviews\StudyHistory::class)->summaryFor($attempt) : null,
            'status' => $status,
            'answers_saved' => true,
            'answers_count' => $session->responses()->whereNotNull('transcript_text')->count(),
            'composite_score_percent' => $status === 'scored' ? $session->composite_score_percent : null,
            'passed' => $status === 'scored' && $interview->isTrackRound()
                ? (float) $session->composite_score_percent >= (float) $interview->qualifying_score_percent
                : null,
            'is_qualification' => $this->isQualificationInterview($interview),
            'reattemptable' => $this->canReattempt($interview, $session),
            'study' => $interview->isStudyMode(),
            'responses' => $responses,
        ]);
    }

    /**
     * Re-triggers AI evaluation on a completed session if scoring previously encountered a transient failure.
     * Candidate answers and voice recordings are permanently preserved.
     */
    public function retryScoring(Request $request, Interview $interview)
    {
        abort_unless($interview->isVisibleToUser($request->user()), 404);

        $session = InterviewSession::where('interview_id', $interview->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        abort_unless($session->status === InterviewSession::STATUS_COMPLETED, 422, 'This interview is not complete yet.');

        if (! $session->hasScoreAvailable()) {
            $session->update(['scoring_failed_at' => null]);
            try {
                ScoreInterviewSessionJob::dispatchSync($session->id);
            } catch (\Throwable $e) {
                // Handled gracefully inside job
            }
            $session->refresh();
        }

        return $this->result($request, $interview);
    }

    /**
     * Streams the candidate's OWN answer recording back to them — mirrors
     * TpoInterviewController::responseAudio() exactly, just scoped to "this
     * response belongs to my own completed session" instead of reviewer
     * ownership of the interview. Private `local` disk, never a public URL.
     */
    public function responseAudio(Request $request, Interview $interview, InterviewResponse $interviewResponse)
    {
        abort_unless(
            $interviewResponse->interviewQuestion?->interview_id === $interview->id
                && $interviewResponse->session?->user_id === $request->user()->id
                && $interviewResponse->audio_path,
            404
        );

        return Storage::disk('local')->response($interviewResponse->audio_path);
    }

    /** Explicit early-exit if the candidate bails mid-interview. Idempotent no-op if already complete. */
    public function complete(Request $request, Interview $interview)
    {
        $session = InterviewSession::where('interview_id', $interview->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        if ($session->status !== InterviewSession::STATUS_COMPLETED) {
            $session->update(['status' => InterviewSession::STATUS_COMPLETED, 'completed_at' => now()]);

            // Bailing out of a study interview: what was answered already has its match, so there is nothing to wait for.
            if ($interview->isStudyMode() && $session->responses()->exists()) {
                app(StudyFeedbackService::class)->finalize($session->fresh());
            }
        }

        return response()->json(['session' => $session->fresh()]);
    }

    /**
     * Resets a completed practice/mock interview session so the student can re-attempt it.
     * Essential when scoring below the target threshold (e.g. < 60%) to improve and retry.
     */
    public function reattempt(Request $request, Interview $interview)
    {
        abort_unless($interview->isVisibleToUser($request->user()), 404);

        $session = InterviewSession::where('interview_id', $interview->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        abort_unless($session->status === InterviewSession::STATUS_COMPLETED, 422, 'Only completed interviews can be re-attempted.');

        app(VoiceVerificationService::class)->assertEligible($request->user());

        // A section the superadmin has switched off (Merchant Navy) cannot be sat again; a sitting already under way is left to finish.
        if (($blockedBy = app(\App\Services\PlatformModules::class)->moduleBlocking($interview)) !== null) {
            throw \App\Services\PlatformModules::unavailable($blockedBy);
        }
        abort_unless($this->canReattempt($interview, $session), 422, $this->isQualificationInterview($interview)
            ? 'A Vault AI Interview qualification set is scored once per attempt and cannot be re-sat.'
            : 'This interview cannot be re-attempted.');

        // Assert plan allowance for taking another mock interview round (a Vault AI Interview set needs no plan, and neither does a study set)
        if (! $this->isQualificationInterview($interview) && ! $interview->isStudyMode()) {
            app(PlanGate::class)->assertMockInterviewAllowed($request->user());
        }

        $audioPaths = $session->responses()->whereNotNull('audio_path')->pluck('audio_path')->all();

        DB::transaction(function () use ($session) {
            // Delete previous answers to give a completely clean re-attempt
            $session->responses()->delete();

            // Clear proctoring session if present
            if ($session->proctoringSession) {
                $session->proctoringSession->violations()->delete();
                $session->proctoringSession->delete();
            }

            $session->update([
                'status' => InterviewSession::STATUS_IN_PROGRESS,
                'started_at' => now(),
                'completed_at' => null,
                'current_question_order' => 0,
                'composite_score_percent' => null,
                'ai_scored_at' => null,
                'reviewed_at' => null,
                'scoring_failed_at' => null,
            ]);
        });

        // The recordings of the answers that were just discarded (the rows are gone, so nothing else can reach them).
        foreach ($audioPaths as $path) {
            Storage::disk('local')->delete($path);
        }

        return response()->json([
            'message' => 'Interview session reset for re-attempt.',
            'slug' => $interview->slug,
            'session' => $this->sessionPayload($interview, $session->fresh()),
        ]);
    }

    private function isQualificationInterview(Interview $interview): bool
    {
        return ! empty($interview->practice_config['qualification_id']);
    }

    /**
     * Whether the student may sit this interview again. Only their own practice/mock interviews qualify — a track round
     * or a company's hiring interview was (or is being) decided on its score, so it can never be reset — and a Vault AI
     * Interview qualification set only when scoring itself failed, which gave the student no score at all.
     */
    private function canReattempt(Interview $interview, InterviewSession $session): bool
    {
        if ($interview->isTrackRound() || $interview->interview_type === Interview::INTERVIEW_TYPE_COMPANY_HIRING) {
            return false;
        }

        if ($this->isQualificationInterview($interview)) {
            return $session->scoringFailed() && ! $session->hasScoreAvailable();
        }

        return $interview->is_mock || $interview->interview_type === Interview::INTERVIEW_TYPE_PRACTICE;
    }

    /**
     * The plan-tier practice gate for mock interviews (a free plan's one-time
     * try, then the daily limit) — only counts a
     * genuine practice attempt: `is_mock` interviews and tpo_mock-type
     * interviews, and NEVER a Final Interview track round (those are a
     * structured, server-gated hiring pipeline a candidate doesn't freely
     * restart, and a real company_hiring interview is never throttled at
     * all — blocking a real recruiter-facing interview over a practice
     * quota would actively harm placement outcomes, the opposite of this
     * platform's purpose).
     */
    private function assertWithinDailyMockInterviewLimit(Request $request, Interview $interview): void
    {
        // A Vault AI Interview set is open to every student who has unlocked it: no plan, no trial, no daily cap.
        // Nor is a study interview (the Merchant Navy sets): it costs nothing to run, so a student may sit as many as they like.
        $isPracticeType = ! $interview->isTrackRound()
            && ! $this->isQualificationInterview($interview)
            && ! $interview->isStudyMode()
            && ($interview->is_mock || $interview->interview_type === Interview::INTERVIEW_TYPE_TPO_MOCK);

        if (! $isPracticeType) {
            return;
        }

        app(PlanGate::class)->assertMockInterviewAllowed($request->user());
    }

    /**
     * The server-side authority that makes a proctoring lock real rather
     * than cosmetic — even a tampered client that stops reporting
     * violations still hits this on its very next start/answer call.
     * Mirrors ContestSubmissionController::assertRegistered()'s identical
     * check for contests.
     */
    private function assertNotLocked(?InterviewSession $session): void
    {
        if ($session?->proctoringSession?->isLocked()) {
            // A Vault AI Interview set was not sent by anyone either, and a set is scored once: it cannot be re-sat.
            if ($session->interview !== null && $this->isQualificationInterview($session->interview)) {
                abort(403, 'This Vault AI Interview set was closed after repeated proctoring violations, so it cannot be sat again. Please contact AptRun support.');
            }

            // A practice interview has no one who invited the student — they built it — so there is no one to reinstate it either.
            $own = $session->interview?->interview_type === Interview::INTERVIEW_TYPE_PRACTICE;

            abort(403, $own
                ? 'This practice round was closed after repeated proctoring violations. Build a new one from Practice interview whenever you like.'
                : 'You have been locked out of this interview due to repeated proctoring violations. Contact whoever invited you to this interview to have it reinstated.');
        }
    }

    /**
     * `estimated_total_seconds` sums each attached question's own
     * expected_duration_seconds (InterviewQuestionBank) plus a flat prep
     * allowance per question (PREP_SECONDS_PER_QUESTION) — a rough total so
     * the pre-interview landing page can set an honest time expectation
     * before the candidate commits, one query alongside question_count
     * rather than a second one.
     */
    private function interviewSummary(Interview $interview, ?InterviewSession $session): array
    {
        $questions = $interview->relationLoaded('interviewQuestions')
            ? $interview->interviewQuestions
            : $interview->interviewQuestions()->with('questionBank:id,expected_duration_seconds')->get();

        return [
            'id' => $interview->id,
            'slug' => $interview->slug,
            'title' => $interview->title,
            'description' => $interview->description,
            'interview_type' => $interview->interview_type,
            'is_mock' => $interview->is_mock,
            'company' => $interview->company ? [
                'id' => $interview->company->id,
                'name' => $interview->company->name,
                'logo' => $interview->company->logo,
            ] : null,
            'question_count' => $questions->count(),
            // The college's window for this mock (all null = no window): when it opens, when it closes, and where that leaves it now.
            'opens_at' => $interview->opens_at?->toIso8601String(),
            'closes_at' => $interview->closes_at?->toIso8601String(),
            'schedule_state' => $interview->isTpoMock() ? $interview->scheduleState() : Interview::SCHEDULE_UNSCHEDULED,
            'study' => $interview->isStudyMode(),
            'estimated_total_seconds' => $questions->count() > 0
                ? (int) $questions->sum(fn (InterviewQuestion $q) => ($q->questionBank->expected_duration_seconds ?? 0) + self::PREP_SECONDS_PER_QUESTION)
                : null,
            'my_session_status' => $session?->status,
            // A Vault AI Interview qualification set is sat in the Vault AI Interview's own pages, not the Mock AI Interview's: these
            // tell the page which one this is and where in the series it sits.
            'is_qualification' => $this->isQualificationInterview($interview),
            'qualification' => $this->isQualificationInterview($interview) ? [
                'stack_key' => $interview->practice_config['stack_key'] ?? null,
                'role_key' => $interview->practice_config['role_key'] ?? null,
                'series_number' => isset($interview->practice_config['series_number']) ? (int) $interview->practice_config['series_number'] : null,
                'set_number' => isset($interview->practice_config['set_number']) ? (int) $interview->practice_config['set_number'] : null,
            ] : null,
        ];
    }

    private function sessionPayload(Interview $interview, InterviewSession $session): array
    {
        $questions = $interview->interviewQuestions()->orderBy('display_order')->get();
        $totalQuestions = $questions->count();
        $currentQuestion = $questions->get($session->current_question_order);

        return [
            'session' => [
                'id' => $session->id,
                'status' => $session->status,
                'current_question_order' => $session->current_question_order,
            ],
            'total_questions' => $totalQuestions,
            'answered_count' => min($session->current_question_order, $totalQuestions),
            'complete' => $currentQuestion === null,
            // Study mode: after each answer the model answer and the match are returned (see answer()).
            'study' => $interview->isStudyMode(),
            'question' => $currentQuestion ? $this->questionPayload($currentQuestion, $session->current_question_order, $totalQuestions) : null,
            // Whether the interviewer has a real voice (the page then asks for the audio of each question), and what it says besides questions.
            'speech' => $this->speechInfo(),
        ];
    }

    private function speechInfo(): array
    {
        $speech = app(InterviewSpeech::class);

        return $speech->available() ? ['enabled' => true, 'lines' => $speech->lines()] : ['enabled' => false, 'lines' => (object) []];
    }

    /** Synthesises the question at `$index` after the response has been sent, so the candidate never waits for it. */
    private function warmSpeech(Interview $interview, int $index): void
    {
        $speech = app(InterviewSpeech::class);

        if (! $speech->available()) {
            return;
        }

        app()->terminating(function () use ($interview, $index, $speech) {
            $speech->warm($interview->interviewQuestions()->orderBy('display_order')->get()->get($index));
        });
    }

    private function questionPayload(InterviewQuestion $interviewQuestion, int $order, int $total): array
    {
        $interviewQuestion->loadMissing('questionBank');

        return [
            'interview_question_id' => $interviewQuestion->id,
            'order' => $order,
            'total' => $total,
            'question_text' => $interviewQuestion->questionBank->question_text,
            'category' => $interviewQuestion->questionBank->category,
            'difficulty' => $interviewQuestion->questionBank->difficulty,
            'expected_duration_seconds' => $interviewQuestion->questionBank->expected_duration_seconds,
            // A picture question (a Rule of the Road card): the room shows this beside the question. Null for every other question.
            'image' => $interviewQuestion->questionBank->image,
        ];
    }
}
