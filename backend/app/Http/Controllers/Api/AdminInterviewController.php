<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\CompanyRecommendedInterviewQuestion;
use App\Models\DriveCollegeMapping;
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
 * Mellow-internal-staff-only (role: admin_internal, superadmin) — AI
 * Interviews are platform-run and centrally curated, mirroring
 * AdminContestController. Only ever creates/edits `general` and `company`
 * types — `tpo_mock` is exclusively TpoInterviewController's and
 * `company_hiring` is exclusively CompanyInterviewController's (see
 * guardManagedElsewhere() below), even though index() still lists every
 * interview type for Mellow's own platform-wide oversight.
 */
class AdminInterviewController extends Controller
{
    public function index()
    {
        // Track rounds live under Interview Tracks (see AdminInterviewTrackController)
        // rather than the plain "AI Interviews" list — a standalone interview
        // always has interview_track_id null, so this excludes nothing today.
        $interviews = Interview::whereNull('interview_track_id')
            ->withCount('sessions')
            ->with(['company:id,name,logo', 'placementDrive:id,title', 'owningCollege:id,name,short_code'])
            ->latest('created_at')
            ->get();

        return response()->json([
            'interviews' => $interviews->map(fn (Interview $i) => [
                ...$i->toArray(),
                'visibility_summary' => $i->visibilityCollegeSummary(),
                'college_ids' => $i->isCompanyInterview() || ($i->isTalentPool() && $i->audience_scope === Interview::AUDIENCE_SCOPE_COLLEGE)
                    ? $i->colleges()->pluck('colleges.id')
                    : null,
            ]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'interview_type' => ['sometimes', Rule::in([Interview::INTERVIEW_TYPE_GENERAL, Interview::INTERVIEW_TYPE_COMPANY, Interview::INTERVIEW_TYPE_TALENT_POOL])],
            'placement_drive_id' => ['required_if:interview_type,company', 'integer', 'exists:placement_drives,id'],
            'college_ids' => ['sometimes', 'array'],
            'college_ids.*' => ['integer'],
            'is_mock' => ['sometimes', 'boolean'],
            'audience_scope' => ['required_if:interview_type,talent_pool', Rule::in(Interview::AUDIENCE_SCOPES)],
        ]);

        $interviewType = $validated['interview_type'] ?? Interview::INTERVIEW_TYPE_GENERAL;
        $companyId = null;
        $placementDriveId = null;
        $collegeIds = [];
        $audienceScope = null;

        if ($interviewType === Interview::INTERVIEW_TYPE_COMPANY) {
            $drive = PlacementDrive::findOrFail($validated['placement_drive_id']);
            $companyId = $drive->company_id;
            $placementDriveId = $drive->id;
            $collegeIds = $this->validatedLiveCollegeIds($placementDriveId, $validated['college_ids'] ?? []);
        }

        if ($interviewType === Interview::INTERVIEW_TYPE_TALENT_POOL) {
            $audienceScope = $validated['audience_scope'];

            if ($audienceScope === Interview::AUDIENCE_SCOPE_COLLEGE) {
                $collegeIds = College::whereIn('id', $validated['college_ids'] ?? [])->pluck('id')->all();
            }
        }

        $interview = Interview::create([
            'title' => $validated['title'],
            'slug' => Interview::uniqueSlug($validated['title']),
            'description' => $validated['description'] ?? null,
            'status' => Interview::STATUS_DRAFT,
            'interview_type' => $interviewType,
            'is_mock' => $interviewType === Interview::INTERVIEW_TYPE_COMPANY ? ($validated['is_mock'] ?? false) : false,
            'company_id' => $companyId,
            'placement_drive_id' => $placementDriveId,
            'created_by' => $request->user()->id,
            'audience_scope' => $audienceScope,
        ]);

        if ($interviewType === Interview::INTERVIEW_TYPE_COMPANY || ($interviewType === Interview::INTERVIEW_TYPE_TALENT_POOL && $audienceScope === Interview::AUDIENCE_SCOPE_COLLEGE)) {
            $interview->colleges()->sync($collegeIds);
        }

        return response()->json(['interview' => $interview], 201);
    }

    /** Full re-sync of an interview's college targeting — same semantics as AdminContestController::updateColleges(). */
    public function updateColleges(Request $request, Interview $interview)
    {
        abort_unless(
            $interview->isCompanyInterview() || ($interview->isTalentPool() && $interview->audience_scope === Interview::AUDIENCE_SCOPE_COLLEGE),
            422,
            'Only company interviews, and college-scoped Talent Pool interviews, have selectable college visibility.'
        );

        $validated = $request->validate([
            'college_ids' => ['present', 'array'],
            'college_ids.*' => ['integer'],
        ]);

        $collegeIds = $interview->isCompanyInterview()
            ? $this->validatedLiveCollegeIds($interview->placement_drive_id, $validated['college_ids'])
            : College::whereIn('id', $validated['college_ids'])->pluck('id')->all();

        $interview->colleges()->sync($collegeIds);

        return response()->json(['college_ids' => $interview->colleges()->pluck('colleges.id')]);
    }

    private function validatedLiveCollegeIds(int $placementDriveId, array $requestedCollegeIds): array
    {
        $liveCollegeIds = DriveCollegeMapping::where('placement_drive_id', $placementDriveId)
            ->where('status', DriveCollegeMapping::STATUS_APPROVED)
            ->where('is_active', true)
            ->pluck('college_id')
            ->all();

        return array_values(array_intersect($requestedCollegeIds, $liveCollegeIds));
    }

    public function update(Request $request, Interview $interview)
    {
        $this->guardManagedElsewhere($interview);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in(Interview::STATUSES)],
            'is_mock' => ['sometimes', 'boolean'],
        ]);

        // is_mock only ever means something for a `company`-type interview
        // (general has no drive to be "mock" against) — guardManagedElsewhere()
        // above already keeps this method scoped to general/company only.
        if (isset($validated['is_mock']) && $interview->interview_type !== Interview::INTERVIEW_TYPE_COMPANY) {
            unset($validated['is_mock']);
        }

        $interview->update($validated);

        return response()->json(['interview' => $interview->fresh()]);
    }

    /**
     * Only a draft/never-taken interview can be hard-deleted — once a
     * candidate has a session (even just STATUS_INVITED) that's a real
     * record a company/college/candidate may rely on, same "never destroy
     * candidate-facing history" rule destroyQuestion() already enforces.
     * Anything with sessions should be cancelled (status update) instead.
     */
    public function destroy(Interview $interview)
    {
        $this->guardManagedElsewhere($interview);

        if ($interview->sessions()->exists()) {
            return response()->json([
                'message' => 'This interview already has candidate sessions and cannot be deleted. Set its status to "cancelled" instead.',
            ], 422);
        }

        $interview->delete();

        return response()->json(['message' => 'Interview deleted.']);
    }

    public function questions(Interview $interview)
    {
        return response()->json([
            'questions' => $interview->interviewQuestions()
                ->with('questionBank:id,question_text,category,difficulty,expected_duration_seconds')
                ->orderBy('display_order')
                ->get(),
        ]);
    }

    public function storeQuestion(Request $request, Interview $interview)
    {
        $this->guardManagedElsewhere($interview);

        $validated = $request->validate([
            'interview_question_bank_id' => ['required', 'integer', 'exists:interview_question_banks,id'],
            'display_order' => ['nullable', 'integer', 'min:0'],
        ]);

        // A `company` interview's whole point is relevance — every attached
        // question must already be tagged to that company (see
        // AdminInterviewController's own tagging, mirroring
        // AdminCompanyController::storeRecommendedProblem's precedent for
        // problems), never picked from the full bank ad hoc.
        if ($interview->isCompanyInterview()) {
            $isRecommended = CompanyRecommendedInterviewQuestion::where('company_id', $interview->company_id)
                ->where('interview_question_bank_id', $validated['interview_question_bank_id'])
                ->exists();

            if (! $isRecommended) {
                return response()->json([
                    'message' => "This question isn't tagged to {$interview->company->name}. Tag it under that company's Recommended Interview Questions first.",
                ], 422);
            }
        }

        $interviewQuestion = InterviewQuestion::create([
            'interview_id' => $interview->id,
            'interview_question_bank_id' => $validated['interview_question_bank_id'],
            'display_order' => $validated['display_order'] ?? $interview->interviewQuestions()->count(),
        ]);

        return response()->json([
            'interview_question' => $interviewQuestion->load('questionBank:id,question_text,category,difficulty,expected_duration_seconds'),
        ], 201);
    }

    public function destroyQuestion(Interview $interview, InterviewQuestion $interviewQuestion)
    {
        $this->guardManagedElsewhere($interview);

        abort_unless($interviewQuestion->interview_id === $interview->id, 404);

        if (InterviewResponse::where('interview_question_id', $interviewQuestion->id)->exists()) {
            return response()->json(['message' => 'Cannot remove a question that already has candidate responses.'], 422);
        }

        $interviewQuestion->delete();

        return response()->json(['message' => 'Question removed from interview.']);
    }

    /**
     * Who's taken this interview, and where they're at — Ops's own review
     * queue for general/company interviews (there's no other owner to
     * review these, unlike tpo_mock/company_hiring). Mirrors
     * TpoInterviewController::sessions(). Previously unneeded because
     * nothing on a general/company interview was ever reviewed candidate-by-
     * candidate here — a track round changes that (see scoreResponse()
     * below), so this had to be added alongside it.
     */
    public function sessions(Interview $interview)
    {
        $this->guardManagedElsewhere($interview);

        return response()->json([
            'sessions' => $interview->sessions()->with('user:id,name,email', 'proctoringSession')->latest('invited_at')->get(),
        ]);
    }

    /** A candidate's full Q&A transcript for this session plus their proctoring activity — the actual review payload. */
    public function responses(Interview $interview, InterviewSession $interviewSession)
    {
        $this->guardManagedElsewhere($interview);

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

    /** A false-positive override for a locked candidate — mirrors TpoInterviewController::reinstateProctoring(). */
    public function reinstateProctoring(Request $request, Interview $interview, InterviewSession $interviewSession, InterviewProctoringService $proctoring)
    {
        $this->guardManagedElsewhere($interview);

        abort_unless($interviewSession->interview_id === $interview->id, 404);

        $proctoringSession = $interviewSession->proctoringSession;
        abort_unless($proctoringSession?->isLocked(), 422, 'This session is not locked.');

        $proctoring->reinstate($proctoringSession, $request->user());

        return response()->json(['proctoring_session' => $proctoringSession->fresh()]);
    }

    /** Streams a stored answer recording — private `local` disk, never a public URL, authenticated + ownership-checked on every request. */
    public function responseAudio(Interview $interview, InterviewResponse $interviewResponse)
    {
        $this->guardManagedElsewhere($interview);

        abort_unless(
            $interviewResponse->interviewQuestion?->interview_id === $interview->id && $interviewResponse->audio_path,
            404
        );

        return Storage::disk('local')->response($interviewResponse->audio_path);
    }

    /**
     * A reviewer's per-response score (0-100) + free-text notes against the
     * round's category-weighted rubric — only meaningful for a track-round
     * question (see InterviewResponse's scoring-fields migration docblock).
     * A direct single-row write, no service needed (mirrors
     * AdminInterviewQuestionBankController::update()'s "simple write" precedent);
     * the actual pass/fail/advancement math is InterviewTrackAdvancementService's
     * job, run once at finalizeSession() below, not per individual score.
     */
    public function scoreResponse(Request $request, Interview $interview, InterviewResponse $interviewResponse)
    {
        $this->guardManagedElsewhere($interview);

        abort_unless($interviewResponse->interviewQuestion?->interview_id === $interview->id, 404);

        $validated = $request->validate([
            'score' => ['required', 'integer', 'min:0', 'max:100'],
            'review_notes' => ['nullable', 'string'],
        ]);

        // ai_scored: false — a human explicitly setting/overriding a score
        // (whether Gemini had already scored this response or not) means
        // this is now the human's score of record, not the AI's.
        $interviewResponse->update([
            'score' => $validated['score'],
            'review_notes' => $validated['review_notes'] ?? null,
            'scored_by' => $request->user()->id,
            'scored_at' => now(),
            'ai_scored' => false,
        ]);

        return response()->json(['response' => $interviewResponse->fresh()]);
    }

    /**
     * Locks in a session's composite score. For a track round, auto-invites
     * the candidate into the next round if they clear the threshold — see
     * InterviewTrackAdvancementService::finalizeAndAdvance(). For a
     * standalone interview there's no round/threshold to advance past —
     * see finalizeStandaloneScoring() — this is a human explicitly
     * re-finalizing/confirming a session ScoreInterviewSessionJob already
     * scored (or scoring one it failed to).
     */
    public function finalizeSession(Request $request, Interview $interview, InterviewSession $interviewSession, InterviewTrackAdvancementService $service)
    {
        $this->guardManagedElsewhere($interview);

        abort_unless($interviewSession->interview_id === $interview->id, 404);

        $result = $interview->isTrackRound()
            ? $service->finalizeAndAdvance($interviewSession, $request->user())
            : $service->finalizeStandaloneScoring($interviewSession, $request->user());

        return response()->json($result);
    }

    /**
     * A tpo_mock or company_hiring interview belongs entirely to its owning
     * college/company — Mellow Ops can still see it in index() for
     * oversight, but must never edit/curate someone else's interview
     * through this controller. Tighter than AdminContestController's
     * guardNotTpoMock() (which only blocks tpo_mock) since there's no
     * back-compat constraint here.
     */
    private function guardManagedElsewhere(Interview $interview): void
    {
        abort_if(
            $interview->isTpoMock() || $interview->isCompanyHiring(),
            403,
            'This interview is managed by its owning college/company, not Mellow Ops.'
        );
    }
}
