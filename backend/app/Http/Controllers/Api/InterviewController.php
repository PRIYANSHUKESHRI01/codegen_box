<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ScoreInterviewSessionJob;
use App\Models\Interview;
use App\Models\InterviewQuestion;
use App\Models\InterviewResponse;
use App\Models\InterviewSession;
use App\Services\Integrity\IntegrityService;
use App\Services\PlanGate;
use App\Services\StudentReportService;
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

    public function index(Request $request)
    {
        // Track rounds are discovered via InterviewTrackController::index()
        // and taken through the dedicated pipeline page instead — excluded
        // here so they never show up redundantly as flat interviews (a
        // round is still reachable directly by slug via show()/start()/
        // answer()/complete() below, unchanged).
        $interviews = Interview::where('status', Interview::STATUS_PUBLISHED)
            ->whereNull('interview_track_id')
            ->with('company:id,name,logo')
            ->orderByDesc('created_at')
            ->get()
            ->filter(fn (Interview $interview) => $interview->isVisibleToUser($request->user())
                && empty($interview->practice_config['qualification_id'])
                && ($interview->practice_config['source'] ?? null) !== 'curated_set')
            // "For your branch" first (newest first within each group — the sort is stable): an ECE student sees the ECE
            // interviews before the general ones; a CSE or unknown-branch student sees the list exactly as before.
            ->sortByDesc(fn (Interview $interview) => (int) $interview->isForBranchOf($request->user()))
            ->values();

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

        return response()->json($this->interviewSummary($interview, $session));
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

        // A completed session has nothing left to protect — a stray or
        // adversarial lock recorded after finishing (e.g. proctoring/start
        // called again out-of-band) must never block re-viewing the
        // already-finished resume state on a legitimate revisit.
        if ($existingSession?->status !== InterviewSession::STATUS_COMPLETED) {
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

        return response()->json($this->sessionPayload($interview, $session));
    }

    /**
     * Accepts a multipart answer: `transcript_text` is always required (the
     * text-fallback path when SpeechRecognition is unavailable produces
     * nothing else), `audio` is opportunistic. `interview_question_id` must
     * equal the session's own current expected question — rejects any
     * client-supplied mismatch, closing off answer-out-of-order/replay
     * tampering. updateOrCreate means re-submitting the same question
     * overwrites rather than duplicates.
     */
    public function answer(Request $request, Interview $interview)
    {
        abort_unless($interview->isVisibleToUser($request->user()), 404);

        $session = InterviewSession::where('interview_id', $interview->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        abort_if($session->status === InterviewSession::STATUS_COMPLETED, 422, 'This interview is already complete.');

        $this->assertNotLocked($session);

        // No live proctoring signal, no answers (a script that never opened the page gets nothing saved). See IntegrityService::gate().
        app(IntegrityService::class)->gate('interview', $session->proctoringSession, $request->user());

        $validated = $request->validate([
            'interview_question_id' => ['required', 'integer'],
            'transcript_text' => ['required', 'string', 'min:1'],
            'audio' => ['nullable', 'file', 'mimes:webm,ogg,wav,mp3,m4a', 'max:20480'],
            'audio_duration_seconds' => ['nullable', 'integer', 'min:0'],
        ]);

        $questions = $interview->interviewQuestions()->orderBy('display_order')->get();
        $currentQuestion = $questions->get($session->current_question_order);

        abort_if($currentQuestion === null, 422, 'No more questions on this interview.');
        abort_unless((int) $validated['interview_question_id'] === $currentQuestion->id, 422, 'This answer does not match the current question.');

        $audioPath = null;
        if ($request->hasFile('audio')) {
            $audioPath = $request->file('audio')->store("interviews/{$interview->id}/sessions/{$session->id}", 'local');
        }

        InterviewResponse::updateOrCreate(
            ['interview_session_id' => $session->id, 'interview_question_id' => $currentQuestion->id],
            [
                'transcript_text' => $validated['transcript_text'],
                'audio_path' => $audioPath,
                'audio_duration_seconds' => $validated['audio_duration_seconds'] ?? null,
                'answered_at' => now(),
            ]
        );

        $session->current_question_order += 1;
        $nextQuestion = $questions->get($session->current_question_order);

        if ($nextQuestion === null) {
            $session->status = InterviewSession::STATUS_COMPLETED;
            $session->completed_at = now();
            $session->save();

            // Queued, not inline — keeps this response fast. The candidate
            // sees a brief "scoring..." state on the completion screen
            // while this runs in the background (GET .../result polls it).
            ScoreInterviewSessionJob::dispatch($session->id);

            return response()->json(['complete' => true]);
        }

        $session->save();

        return response()->json([
            'complete' => false,
            'next_question' => $this->questionPayload($nextQuestion, $session->current_question_order, $questions->count()),
        ]);
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
                ->with('interviewQuestion.questionBank:id,question_text,category,difficulty')
                ->get()
                ->sortBy(fn (InterviewResponse $r) => $r->interviewQuestion->display_order)
                ->values()
                ->map(fn (InterviewResponse $r) => [
                    'question_text' => $r->interviewQuestion->questionBank->question_text,
                    'category' => $r->interviewQuestion->questionBank->category,
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

        return response()->json([
            'status' => $status,
            'composite_score_percent' => $status === 'scored' ? $session->composite_score_percent : null,
            'passed' => $status === 'scored' && $interview->isTrackRound()
                ? (float) $session->composite_score_percent >= (float) $interview->qualifying_score_percent
                : null,
            'is_qualification' => $this->isQualificationInterview($interview),
            'reattemptable' => $this->canReattempt($interview, $session),
            'responses' => $responses,
        ]);
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
        abort_unless($this->canReattempt($interview, $session), 422, $this->isQualificationInterview($interview)
            ? 'A Vault AI Interview qualification set is scored once per attempt and cannot be re-sat.'
            : 'This interview cannot be re-attempted.');

        // Assert plan allowance for taking another mock interview round (a Vault AI Interview set needs no plan)
        if (! $this->isQualificationInterview($interview)) {
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
        $isPracticeType = ! $interview->isTrackRound()
            && ! $this->isQualificationInterview($interview)
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
        $questions = $interview->interviewQuestions()->with('questionBank:id,expected_duration_seconds')->get();

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
            'question' => $currentQuestion ? $this->questionPayload($currentQuestion, $session->current_question_order, $totalQuestions) : null,
        ];
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
        ];
    }
}
