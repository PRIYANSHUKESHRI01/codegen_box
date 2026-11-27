<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CollegeAssessment;
use App\Models\CollegeAssessmentAssignment;
use App\Models\ContestParticipant;
use App\Services\CollegeAssessmentService;
use App\Services\LaunchpadProgramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Student-facing College Assessments mapped by SuperAdmin.
 */
class StudentCollegeAssessmentController extends Controller
{
    public function __construct(private readonly CollegeAssessmentService $service) {}

    public function index(Request $request): JsonResponse
    {
        $assignments = CollegeAssessmentAssignment::query()
            ->where('user_id', $request->user()->id)
            ->whereHas('assessment', fn ($q) => $q->where('status', '!=', CollegeAssessment::STATUS_DRAFT))
            ->with([
                'assessment.softSkillAssessment:id,slug,title,duration_minutes,pass_percentage',
                'assessment.contest:id,slug,title,start_at,end_at',
                'assessment.interview:id,slug,title',
            ])
            ->latest('id')
            ->get();

        $payload = $assignments->map(function (CollegeAssessmentAssignment $assignment) {
            $synced = $this->service->syncAssignment($assignment);
            return $this->presentAssignment($synced);
        })->values();

        return response()->json(['assessments' => $payload]);
    }

    public function show(Request $request, CollegeAssessment $collegeAssessment): JsonResponse
    {
        abort_if($collegeAssessment->status === CollegeAssessment::STATUS_DRAFT, 404);

        $assignment = CollegeAssessmentAssignment::query()
            ->where('college_assessment_id', $collegeAssessment->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $collegeAssessment->load([
            'softSkillAssessment:id,slug,title,duration_minutes,pass_percentage',
            'contest:id,slug,title,start_at,end_at',
            'interview:id,slug,title',
        ]);

        $synced = $this->service->syncAssignment($assignment);

        return response()->json(['assessment' => $this->presentAssignment($synced)]);
    }

    public function startSoftSkill(Request $request, CollegeAssessment $collegeAssessment): JsonResponse
    {
        $assignment = $this->requireOpenAssignment($request, $collegeAssessment);
        abort_unless($collegeAssessment->include_soft_skills && $collegeAssessment->softSkillAssessment, 404);

        return response()->json([
            'soft_skill_slug' => $collegeAssessment->softSkillAssessment->slug,
        ]);
    }

    public function startCoding(Request $request, CollegeAssessment $collegeAssessment): JsonResponse
    {
        $assignment = $this->requireOpenAssignment($request, $collegeAssessment);
        abort_unless($collegeAssessment->include_coding && $collegeAssessment->contest, 404);

        $locks = $this->service->moduleLocks($collegeAssessment, $assignment);
        if ($locks['coding']) {
            return response()->json(['message' => 'Complete the Soft Skills round first to unlock Coding Test.'], 423);
        }

        $contest = $collegeAssessment->contest;
        $participant = ContestParticipant::firstOrCreate(
            ['contest_id' => $contest->id, 'user_id' => $request->user()->id],
            ['registered_at' => now()]
        );

        if ($assignment->contest_participant_id !== $participant->id) {
            $assignment->update(['contest_participant_id' => $participant->id]);
        }

        return response()->json([
            'contest_slug' => $contest->slug,
        ]);
    }

    public function startInterview(Request $request, CollegeAssessment $collegeAssessment): JsonResponse
    {
        $assignment = $this->requireOpenAssignment($request, $collegeAssessment);
        abort_unless($collegeAssessment->include_interview && $collegeAssessment->interview, 404);

        $locks = $this->service->moduleLocks($collegeAssessment, $assignment);
        if ($locks['interview']) {
            return response()->json(['message' => 'Complete the previous assessment stage(s) first to unlock the AI Interview.'], 423);
        }

        return response()->json([
            'interview_slug' => $collegeAssessment->interview->slug,
        ]);
    }

    private function requireOpenAssignment(Request $request, CollegeAssessment $assessment): CollegeAssessmentAssignment
    {
        abort_if($assessment->status === CollegeAssessment::STATUS_DRAFT, 404);

        $assignment = CollegeAssessmentAssignment::query()
            ->where('college_assessment_id', $assessment->id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $synced = $this->service->syncAssignment($assignment);

        if ($assessment->isClosed()) {
            abort(410, 'This assessment window has closed.');
        }

        if ($assessment->starts_at !== null && now()->lt($assessment->starts_at)) {
            abort(423, 'This assessment has not started yet.');
        }

        $campaignLock = app(LaunchpadProgramService::class)->campaignLockReasonForAssessment($assessment, $request->user());
        if ($campaignLock !== null) {
            abort(423, $campaignLock);
        }

        return $synced;
    }

    /** @return array<string, mixed> */
    private function presentAssignment(CollegeAssessmentAssignment $a): array
    {
        $assessment = $a->assessment;
        $locks = $this->service->moduleLocks($assessment, $a);
        $campaignLockReason = app(LaunchpadProgramService::class)->campaignLockReasonForAssessment($assessment, $a->user);

        $modulesTotal = (int) $assessment->include_soft_skills + (int) $assessment->include_coding + (int) $assessment->include_interview;
        $modulesCompleted = (int) ($assessment->include_soft_skills && $a->soft_skill_score_percent !== null)
            + (int) ($assessment->include_coding && $a->coding_score_percent !== null)
            + (int) ($assessment->include_interview && $a->interview_session_id !== null && $a->interviewSession?->status === 'completed');

        return [
            'id' => $assessment->id,
            'slug' => $assessment->slug,
            'title' => $assessment->title,
            'description' => $assessment->description,
            'status' => $assessment->status,
            'is_open' => $assessment->isOpenForTaking(),
            'starts_at' => $assessment->starts_at?->toIso8601String(),
            'ends_at' => $assessment->ends_at?->toIso8601String(),
            'enforce_sequence' => $assessment->enforce_sequence,
            'campaign_locked' => $campaignLockReason !== null,
            'campaign_lock_reason' => $campaignLockReason,
            'passing_score_percent' => $assessment->passing_score_percent,
            'assignment_status' => $a->status,
            'overall_score_percent' => $a->overall_score_percent,
            'modules_total' => $modulesTotal,
            'modules_completed' => $modulesCompleted,
            'started_at' => $a->started_at?->toIso8601String(),
            'completed_at' => $a->completed_at?->toIso8601String(),
            'modules' => [
                'soft_skills' => $assessment->include_soft_skills && $assessment->softSkillAssessment ? [
                    'enabled' => true,
                    'weight' => $assessment->soft_skill_weight,
                    'slug' => $assessment->softSkillAssessment->slug,
                    'title' => $assessment->softSkillAssessment->title,
                    'duration_minutes' => $assessment->softSkillAssessment->duration_minutes,
                    'pass_percentage' => $assessment->softSkillAssessment->pass_percentage,
                    'locked' => $locks['soft_skills'],
                    'score_percent' => $a->soft_skill_score_percent,
                    'completed' => $a->soft_skill_score_percent !== null,
                    'in_progress' => $a->soft_skill_session_id !== null && $a->soft_skill_score_percent === null,
                ] : ['enabled' => false],
                'coding' => $assessment->include_coding && $assessment->contest ? [
                    'enabled' => true,
                    'weight' => $assessment->coding_weight,
                    'slug' => $assessment->contest->slug,
                    'title' => $assessment->contest->title,
                    'locked' => $locks['coding'],
                    'points' => $a->coding_points,
                    'max_points' => $a->coding_max_points,
                    'score_percent' => $a->coding_score_percent,
                    'completed' => $a->coding_score_percent !== null,
                    'in_progress' => $a->contest_participant_id !== null && $a->coding_score_percent === null,
                ] : ['enabled' => false],
                'interview' => $assessment->include_interview && $assessment->interview ? [
                    'enabled' => true,
                    'weight' => $assessment->interview_weight,
                    'slug' => $assessment->interview->slug,
                    'title' => $assessment->interview->title,
                    'locked' => $locks['interview'],
                    'score_percent' => $a->interview_score_percent,
                    'completed' => $a->interview_session_id !== null && $a->interviewSession?->status === 'completed',
                    'scoring_pending' => $a->interview_session_id !== null && $a->interviewSession?->status === 'completed' && $a->interview_score_percent === null,
                    'in_progress' => $a->interview_session_id !== null && $a->interviewSession?->status === 'in_progress',
                ] : ['enabled' => false],
            ],
        ];
    }
}
