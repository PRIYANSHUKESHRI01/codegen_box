<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SoftSkillAssessment;
use App\Models\SoftSkillResponse;
use App\Models\SoftSkillSession;
use App\Services\StudentReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

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
    public function index(Request $request)
    {
        $assessments = SoftSkillAssessment::where('status', SoftSkillAssessment::STATUS_PUBLISHED)
            ->with('owningCompany:id,name,logo')
            ->get()
            ->filter(fn (SoftSkillAssessment $a) => $a->isVisibleToUser($request->user()))
            ->values();

        $completedByAssessment = SoftSkillSession::where('user_id', $request->user()->id)
            ->whereIn('soft_skill_assessment_id', $assessments->pluck('id'))
            ->where('status', SoftSkillSession::STATUS_COMPLETED)
            ->get()
            ->groupBy('soft_skill_assessment_id');

        return response()->json([
            'assessments' => $assessments->map(
                fn (SoftSkillAssessment $a) => $this->assessmentSummary($a, $completedByAssessment->get($a->id, collect()))
            ),
        ]);
    }

    public function show(Request $request, SoftSkillAssessment $softSkillAssessment)
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
            'assessment' => $this->assessmentSummary($softSkillAssessment, $completedSessions),
            'in_progress_session_id' => $inProgressSession?->id,
            'completed_session_ids' => $completedSessions->pluck('id'),
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
    public function submit(Request $request, SoftSkillSession $softSkillSession)
    {
        abort_unless($softSkillSession->user_id === $request->user()->id, 404);
        abort_if($softSkillSession->status === SoftSkillSession::STATUS_COMPLETED, 422, 'This assessment has already been submitted.');

        $softSkillSession->loadMissing('assessment');
        $responses = $softSkillSession->responses()->with('assessmentQuestion.question')->get();

        $categoryTally = [];
        $correctCount = 0;

        foreach ($responses as $response) {
            $question = $response->assessmentQuestion->question;
            $isCorrect = $response->selected_index !== null && (int) $response->selected_index === (int) $question->correct_index;
            $response->update(['is_correct' => $isCorrect]);

            $categoryTally[$question->category] ??= ['correct' => 0, 'total' => 0];
            $categoryTally[$question->category]['total']++;
            if ($isCorrect) {
                $categoryTally[$question->category]['correct']++;
                $correctCount++;
            }
        }

        $totalQuestions = $responses->count();
        $scorePercent = $totalQuestions > 0 ? round(($correctCount / $totalQuestions) * 100, 2) : 0;

        $softSkillSession->update([
            'status' => SoftSkillSession::STATUS_COMPLETED,
            'completed_at' => now(),
            'score_percent' => $scorePercent,
            'passed' => $scorePercent >= $softSkillSession->assessment->pass_percentage,
            'category_breakdown' => $categoryTally,
        ]);

        return response()->json(['session' => $this->resultPayload($softSkillSession->fresh())]);
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

    private function assessmentSummary(SoftSkillAssessment $assessment, Collection $completedSessions): array
    {
        $compositionByCategory = $assessment->assessmentQuestions()
            ->join('soft_skill_questions', 'soft_skill_questions.id', '=', 'soft_skill_assessment_questions.soft_skill_question_id')
            ->selectRaw('soft_skill_questions.category as category, count(*) as cnt')
            ->groupBy('soft_skill_questions.category')
            ->pluck('cnt', 'category');

        return [
            'id' => $assessment->id,
            'slug' => $assessment->slug,
            'title' => $assessment->title,
            'description' => $assessment->description,
            'assessment_type' => $assessment->assessment_type,
            'duration_minutes' => $assessment->duration_minutes,
            'pass_percentage' => $assessment->pass_percentage,
            'max_attempts' => $assessment->max_attempts,
            'question_count' => (int) $compositionByCategory->sum(),
            'category_composition' => $compositionByCategory,
            'company' => $assessment->relationLoaded('owningCompany') && $assessment->owningCompany
                ? ['id' => $assessment->owningCompany->id, 'name' => $assessment->owningCompany->name, 'logo' => $assessment->owningCompany->logo]
                : null,
            'attempts_taken' => $completedSessions->count(),
            'best_score_percent' => $completedSessions->max('score_percent'),
            'can_attempt' => $assessment->max_attempts === null || $completedSessions->count() < $assessment->max_attempts,
        ];
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
        $session->loadMissing('assessment');

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
