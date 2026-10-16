<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillResponse;
use App\Models\SoftSkillSession;
use App\Models\User;
use App\Services\SoftSkillGradingService;
use App\Services\SoftSkillQuestionSetService;
use App\Services\StudentReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * Student-facing Soft Skills: browse published+visible assessments, take
 * one, get graded instantly (exact index match against the bank's
 * correct_index — never AI judgement, see the assessments migration's
 * docblock). Unlike the strictly-linear voice interview flow, a student
 * can answer these in any order — answer() autosaves one response at a
 * time by its own id, and submit() is the one moment everything gets
 * graded and finalized.
 */
class SoftSkillController extends Controller
{
    /**
     * GET /soft-skills
     *
     * With no query string: everything visible to the student in one list — the original shape, unchanged.
     *
     * With ?scope= (or any of page / per_page / q / status): the library view the dashboard uses.
     *   scope=sets      the numbered AptRun question sets (paged in SQL — the library keeps growing)
     *   scope=assigned  the tests somebody scheduled for this student: their college's mocks, hiring partners'
     *                   screenings, anything Mellow wrote by hand. Few, and always the ones that matter most.
     *   q               search ("12", "set 12", a word from the title)
     *   status          all | not_attempted | in_progress | completed   — for THIS student
     *   page, per_page  a number (max 100) or "all" (capped)
     * The response always carries `counts`, so the header can say "45 sets · 12 completed" whichever view is open.
     */
    public function index(Request $request, SoftSkillQuestionSetService $sets)
    {
        $user = $request->user();

        if (! $request->hasAny(['scope', 'page', 'per_page', 'q', 'status'])) {
            $assessments = $this->assignedAndLibrary($user);

            return response()->json(['assessments' => $this->summaries($assessments, $user, $sets)]);
        }

        $filters = $request->validate([
            'scope' => ['nullable', Rule::in(['sets', 'assigned'])],
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['all', 'not_attempted', 'in_progress', 'completed'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'regex:/^(all|\d{1,3})$/i'],
        ]);

        $scope = $filters['scope'] ?? 'sets';
        $status = $filters['status'] ?? 'all';
        $search = trim((string) ($filters['q'] ?? ''));
        [$page, $perPage, $showAll] = $sets->paging($filters['page'] ?? 1, $filters['per_page'] ?? SoftSkillQuestionSetService::DEFAULT_PER_PAGE);

        $library = SoftSkillAssessment::questionSets()->where('status', SoftSkillAssessment::STATUS_PUBLISHED);
        $assigned = $this->assigned($user);

        $counts = [
            'sets' => (clone $library)->count(),
            'sets_completed' => (clone $library)->whereHas('sessions', $this->sessionsOf($user, [SoftSkillSession::STATUS_COMPLETED]))->count(),
            'sets_in_progress' => (clone $library)->whereHas('sessions', $this->sessionsOf($user, [SoftSkillSession::STATUS_IN_PROGRESS]))->count(),
            'assigned' => $assigned->count(),
        ];

        if ($scope === 'sets') {
            $query = (clone $library);

            if ($search !== '') {
                $sets->search($query, $search);
            }

            match ($status) {
                'completed' => $query->whereHas('sessions', $this->sessionsOf($user, [SoftSkillSession::STATUS_COMPLETED])),
                'in_progress' => $query->whereHas('sessions', $this->sessionsOf($user, [SoftSkillSession::STATUS_IN_PROGRESS])),
                'not_attempted' => $query->whereDoesntHave('sessions', $this->sessionsOf($user, [SoftSkillSession::STATUS_COMPLETED, SoftSkillSession::STATUS_IN_PROGRESS])),
                default => null,
            };

            $query->orderByRaw('question_set_number is null')->orderBy('question_set_number')->orderBy('id');

            $meta = $sets->meta((clone $query)->count(), $page, $perPage, $showAll);
            $rows = $query->forPage($meta['page'], $perPage)->get();
        } else {
            $rows = $assigned;

            if ($search !== '') {
                $rows = $rows->filter(fn (SoftSkillAssessment $a) => mb_stripos($a->title.' '.$a->description, $search) !== false);
            }

            if ($status !== 'all') {
                $touched = SoftSkillSession::where('user_id', $user->id)
                    ->whereIn('soft_skill_assessment_id', $rows->pluck('id'))
                    ->get()
                    ->groupBy('soft_skill_assessment_id');

                $rows = $rows->filter(function (SoftSkillAssessment $a) use ($touched, $status) {
                    $mine = $touched->get($a->id, collect());
                    $done = $mine->contains('status', SoftSkillSession::STATUS_COMPLETED);
                    $going = $mine->contains('status', SoftSkillSession::STATUS_IN_PROGRESS);

                    return match ($status) {
                        'completed' => $done,
                        'in_progress' => $going,
                        default => ! $done && ! $going,
                    };
                });
            }

            $rows = $rows->sortByDesc('created_at')->values();
            $meta = $sets->meta($rows->count(), $page, $perPage, $showAll);
            $rows = $rows->forPage($meta['page'], $perPage)->values();
        }

        return response()->json([
            'assessments' => $this->summaries($rows, $user, $sets),
            'meta' => $meta,
            'counts' => $counts,
        ]);
    }

    /** The published tests somebody scheduled for this student (everything visible except the AptRun library sets). */
    private function assigned(User $user): Collection
    {
        return SoftSkillAssessment::notQuestionSets()
            ->where('status', SoftSkillAssessment::STATUS_PUBLISHED)
            ->with('owningCompany:id,name,logo')
            ->get()
            ->filter(fn (SoftSkillAssessment $a) => $a->isVisibleToUser($user))
            ->values();
    }

    /** Everything visible, library included — the original, unpaged list. */
    private function assignedAndLibrary(User $user): Collection
    {
        return SoftSkillAssessment::where('status', SoftSkillAssessment::STATUS_PUBLISHED)
            ->with('owningCompany:id,name,logo')
            ->orderByRaw('question_set_number is null')
            ->orderBy('question_set_number')
            ->orderBy('id')
            ->get()
            ->filter(fn (SoftSkillAssessment $a) => $a->isVisibleToUser($user))
            ->values();
    }

    /** @param  list<string>  $statuses  a whereHas('sessions') constraint: this student's sessions in these states */
    private function sessionsOf(User $user, array $statuses): \Closure
    {
        return fn ($q) => $q->where('user_id', $user->id)->whereIn('status', $statuses);
    }

    public function show(Request $request, SoftSkillAssessment $softSkillAssessment, SoftSkillQuestionSetService $sets)
    {
        abort_unless($softSkillAssessment->isPublished() && $softSkillAssessment->isVisibleToUser($request->user()), 404);

        $completedSessions = SoftSkillSession::where('soft_skill_assessment_id', $softSkillAssessment->id)
            ->where('user_id', $request->user()->id)
            ->where('status', SoftSkillSession::STATUS_COMPLETED)
            ->get();

        $inProgressSession = SoftSkillSession::where('soft_skill_assessment_id', $softSkillAssessment->id)
            ->where('user_id', $request->user()->id)
            ->where('status', SoftSkillSession::STATUS_IN_PROGRESS)
            ->first();

        return response()->json([
            'assessment' => $this->summaries(collect([$softSkillAssessment]), $request->user(), $sets)[0],
            'in_progress_session_id' => $inProgressSession?->id,
            'completed_session_ids' => $completedSessions->pluck('id'),
            // Tells the client whether to put this test behind the camera /
            // fullscreen consent gate (config/proctoring.php's kill switch).
            'proctoring_required' => (bool) config('proctoring.soft_skills_enabled', true),
        ]);
    }

    /**
     * Idempotent — resumes an existing in-progress session rather than
     * starting a fresh one, same "calling it again mid-flow just returns
     * wherever the candidate left off" posture as
     * InterviewController::start().
     */
    public function start(Request $request, SoftSkillAssessment $softSkillAssessment)
    {
        abort_unless($softSkillAssessment->isPublished() && $softSkillAssessment->isVisibleToUser($request->user()), 404);

        $existing = SoftSkillSession::where('soft_skill_assessment_id', $softSkillAssessment->id)
            ->where('user_id', $request->user()->id)
            ->where('status', SoftSkillSession::STATUS_IN_PROGRESS)
            ->first();

        if ($existing) {
            return response()->json($this->sessionPayload($existing));
        }

        $completedCount = SoftSkillSession::where('soft_skill_assessment_id', $softSkillAssessment->id)
            ->where('user_id', $request->user()->id)
            ->where('status', SoftSkillSession::STATUS_COMPLETED)
            ->count();

        abort_if(
            $softSkillAssessment->max_attempts !== null && $completedCount >= $softSkillAssessment->max_attempts,
            403,
            "You've used all {$softSkillAssessment->max_attempts} attempt(s) for this assessment."
        );

        $assessmentQuestions = $softSkillAssessment->assessmentQuestions()->orderBy('display_order')->get();
        abort_if($assessmentQuestions->isEmpty(), 422, 'This assessment has no questions yet.');

        $session = SoftSkillSession::create([
            'soft_skill_assessment_id' => $softSkillAssessment->id,
            'user_id' => $request->user()->id,
            'status' => SoftSkillSession::STATUS_IN_PROGRESS,
            'attempt_number' => $completedCount + 1,
            'started_at' => now(),
        ]);

        // Pre-created (empty) so answer() can updateOrCreate by response id
        // in any order — the student isn't forced through questions linearly.
        foreach ($assessmentQuestions as $assessmentQuestion) {
            SoftSkillResponse::create([
                'soft_skill_session_id' => $session->id,
                'soft_skill_assessment_question_id' => $assessmentQuestion->id,
            ]);
        }

        return response()->json($this->sessionPayload($session));
    }

    /** Autosaves one answer at a time — fired on every option selection, not batched to a final submit. */
    public function answer(Request $request, SoftSkillSession $softSkillSession)
    {
        abort_unless($softSkillSession->user_id === $request->user()->id, 404);
        $this->assertNotLocked($softSkillSession);
        abort_if($softSkillSession->status === SoftSkillSession::STATUS_COMPLETED, 422, 'This assessment has already been submitted.');

        $validated = $request->validate([
            'response_id' => ['required', 'integer'],
            'selected_index' => ['required', 'integer', 'min:0', 'max:3'],
        ]);

        $response = SoftSkillResponse::where('id', $validated['response_id'])
            ->where('soft_skill_session_id', $softSkillSession->id)
            ->firstOrFail();

        $response->update([
            'selected_index' => $validated['selected_index'],
            'answered_at' => now(),
        ]);

        return response()->json(['saved' => true]);
    }

    /** The one moment everything gets graded — exact selected_index === correct_index match, never trusted or precomputed from the client. */
    public function submit(Request $request, SoftSkillSession $softSkillSession, SoftSkillGradingService $grader)
    {
        abort_unless($softSkillSession->user_id === $request->user()->id, 404);
        $this->assertNotLocked($softSkillSession);
        abort_if($softSkillSession->status === SoftSkillSession::STATUS_COMPLETED, 422, 'This assessment has already been submitted.');

        // Grading itself lives in SoftSkillGradingService so a proctoring
        // lock (SoftSkillProctoringService) scores an attempt identically.
        $graded = $grader->finalize($softSkillSession);

        return response()->json(['session' => $this->resultPayload($graded)]);
    }

    /** Reviewing a completed attempt — reached both right after submit() and from the Reports history card. */
    public function viewSession(Request $request, SoftSkillSession $softSkillSession)
    {
        abort_unless($softSkillSession->user_id === $request->user()->id, 404);
        abort_unless($softSkillSession->status === SoftSkillSession::STATUS_COMPLETED, 422, 'This attempt is not complete yet.');

        return response()->json(['session' => $this->resultPayload($softSkillSession)]);
    }

    public function history(Request $request, StudentReportService $service)
    {
        return response()->json(['soft_skills' => $service->softSkillHistory($request->user())]);
    }

    /**
     * The server-side authority that makes a proctoring lock real rather than
     * cosmetic — even a tampered client that stops reporting violations still
     * hits this on its very next answer/submit call. Mirrors
     * InterviewController::assertNotLocked() and
     * ContestSubmissionController::assertRegistered().
     */
    private function assertNotLocked(SoftSkillSession $session): void
    {
        if ($session->proctoringSession?->isLocked()) {
            abort(403, 'This attempt was ended because of repeated proctoring violations. Your saved answers were submitted.');
        }
    }

    /**
     * The card payload for each assessment, for THIS student — built from three grouped queries however many
     * assessments are on the page (not two queries each).
     *
     * @param  Collection<int, SoftSkillAssessment>  $assessments
     * @return list<array<string, mixed>>
     */
    private function summaries(Collection $assessments, User $user, SoftSkillQuestionSetService $sets): array
    {
        $ids = $assessments->pluck('id')->all();
        $composition = $sets->compositionFor($ids);
        $mine = $ids === [] ? collect() : SoftSkillSession::where('user_id', $user->id)
            ->whereIn('soft_skill_assessment_id', $ids)
            ->whereIn('status', [SoftSkillSession::STATUS_COMPLETED, SoftSkillSession::STATUS_IN_PROGRESS])
            ->get()
            ->groupBy('soft_skill_assessment_id');

        return $assessments->map(function (SoftSkillAssessment $assessment) use ($composition, $mine) {
            $sessions = $mine->get($assessment->id, collect());
            $completed = $sessions->where('status', SoftSkillSession::STATUS_COMPLETED);
            $byCategory = $composition[$assessment->id] ?? [];

            return [
                'id' => $assessment->id,
                'slug' => $assessment->slug,
                'title' => $assessment->title,
                'description' => $assessment->description,
                'assessment_type' => $assessment->assessment_type,
                'is_question_set' => (bool) $assessment->is_question_set,
                'set_number' => $assessment->question_set_number,
                'duration_minutes' => $assessment->duration_minutes,
                'pass_percentage' => $assessment->pass_percentage,
                'max_attempts' => $assessment->max_attempts,
                'question_count' => array_sum($byCategory),
                'category_composition' => $byCategory === [] ? (object) [] : $byCategory,
                'company' => $assessment->relationLoaded('owningCompany') && $assessment->owningCompany
                    ? ['id' => $assessment->owningCompany->id, 'name' => $assessment->owningCompany->name, 'logo' => $assessment->owningCompany->logo]
                    : null,
                'attempts_taken' => $completed->count(),
                'best_score_percent' => $completed->max('score_percent'),
                'in_progress' => $sessions->contains('status', SoftSkillSession::STATUS_IN_PROGRESS),
                'can_attempt' => $assessment->max_attempts === null || $completed->count() < $assessment->max_attempts,
            ];
        })->values()->all();
    }

    private function sessionPayload(SoftSkillSession $session): array
    {
        $session->loadMissing('assessment');

        $responses = $session->responses()
            ->with('assessmentQuestion.question:id,category,question_text,options')
            ->get()
            ->sortBy(fn (SoftSkillResponse $r) => $r->assessmentQuestion->display_order)
            ->values();

        return [
            'session' => [
                'id' => $session->id,
                'status' => $session->status,
                'attempt_number' => $session->attempt_number,
                'started_at' => $session->started_at,
                'deadline_at' => $session->started_at->copy()->addMinutes($session->assessment->duration_minutes),
            ],
            'assessment' => ['title' => $session->assessment->title, 'pass_percentage' => $session->assessment->pass_percentage],
            'questions' => $responses->map(fn (SoftSkillResponse $r) => [
                'response_id' => $r->id,
                'category' => $r->assessmentQuestion->question->category,
                'question_text' => $r->assessmentQuestion->question->question_text,
                'options' => $r->assessmentQuestion->question->options,
                'selected_index' => $r->selected_index,
            ]),
        ];
    }

    private function resultPayload(SoftSkillSession $session): array
    {
        $session->loadMissing('assessment', 'proctoringSession');

        $responses = $session->responses()
            ->with('assessmentQuestion.question')
            ->get()
            ->sortBy(fn (SoftSkillResponse $r) => $r->assessmentQuestion->display_order)
            ->values();

        return [
            'id' => $session->id,
            'assessment_title' => $session->assessment->title,
            'assessment_slug' => $session->assessment->slug,
            'attempt_number' => $session->attempt_number,
            'score_percent' => (float) $session->score_percent,
            'pass_percentage' => $session->assessment->pass_percentage,
            'passed' => $session->passed,
            'category_breakdown' => $session->category_breakdown,
            'completed_at' => $session->completed_at,
            // null for attempts taken without proctoring (before it existed,
            // or with the kill switch off). `terminated` = the strike limit
            // ended the attempt, so the score reflects only what was saved.
            'proctoring' => $session->proctoringSession
                ? ['violation_count' => $session->proctoringSession->violation_count, 'terminated' => $session->proctoringSession->isLocked()]
                : null,
            'results' => $responses->map(fn (SoftSkillResponse $r) => [
                'category' => $r->assessmentQuestion->question->category,
                'question_text' => $r->assessmentQuestion->question->question_text,
                'options' => $r->assessmentQuestion->question->options,
                'selected_index' => $r->selected_index,
                'correct_index' => $r->assessmentQuestion->question->correct_index,
                'is_correct' => $r->is_correct,
                'explanation' => $r->assessmentQuestion->question->explanation,
            ]),
        ];
    }
}
