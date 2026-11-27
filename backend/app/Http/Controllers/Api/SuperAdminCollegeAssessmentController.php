<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CollegeAssessment;
use App\Models\CollegeAssessmentAssignment;
use App\Services\CollegeAssessmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * SuperAdmin console for creating multi-pillar College Assessments
 * (Soft Skills + Coding Test + AI Interview) targeted college-wise,
 * branch/department-wise, and student-wise, with live results and CSV export.
 */
class SuperAdminCollegeAssessmentController extends Controller
{
    public function __construct(private readonly CollegeAssessmentService $service) {}

    public function index(): JsonResponse
    {
        $assessments = CollegeAssessment::query()
            ->with([
                'softSkillAssessment:id,slug,title,status,duration_minutes,pass_percentage',
                'contest:id,slug,title,status,start_at,end_at',
                'interview:id,slug,title,status',
            ])
            ->withCount([
                'assignments as assigned_count',
                'assignments as in_progress_count' => fn ($q) => $q->where('status', CollegeAssessmentAssignment::STATUS_IN_PROGRESS),
                'assignments as completed_count' => fn ($q) => $q->where('status', CollegeAssessmentAssignment::STATUS_COMPLETED),
            ])
            ->withAvg('assignments as avg_overall_score', 'overall_score_percent')
            ->latest('id')
            ->get()
            ->map(fn (CollegeAssessment $a) => [
                'id' => $a->id,
                'slug' => $a->slug,
                'title' => $a->title,
                'description' => $a->description,
                'status' => $a->status,
                'starts_at' => $a->starts_at?->toIso8601String(),
                'ends_at' => $a->ends_at?->toIso8601String(),
                'published_at' => $a->published_at?->toIso8601String(),
                'enforce_sequence' => $a->enforce_sequence,
                'passing_score_percent' => $a->passing_score_percent,
                'target_scope' => $a->target_scope,
                'include_soft_skills' => $a->include_soft_skills,
                'soft_skill_weight' => $a->soft_skill_weight,
                'soft_skill_assessment' => $a->softSkillAssessment,
                'include_coding' => $a->include_coding,
                'coding_weight' => $a->coding_weight,
                'contest' => $a->contest,
                'include_interview' => $a->include_interview,
                'interview_weight' => $a->interview_weight,
                'interview' => $a->interview,
                'assigned_count' => (int) $a->assigned_count,
                'in_progress_count' => (int) $a->in_progress_count,
                'completed_count' => (int) $a->completed_count,
                'avg_overall_score' => $a->avg_overall_score !== null ? round((float) $a->avg_overall_score, 2) : null,
                'created_at' => $a->created_at?->toIso8601String(),
            ]);

        return response()->json(['assessments' => $assessments]);
    }

    public function builderOptions(): JsonResponse
    {
        return response()->json($this->service->builderOptions());
    }

    public function students(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'college_ids' => ['sometimes', 'array'],
            'college_ids.*' => ['integer'],
            'department_codes' => ['sometimes', 'array'],
            'department_codes.*' => ['string'],
            'branch_codes' => ['sometimes', 'array'],
            'branch_codes.*' => ['string'],
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
            'limit' => ['sometimes', 'integer', 'min:1', 'max:1000'],
        ]);

        return response()->json($this->service->studentsForTarget($filters));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePayload($request);
        $assessment = $this->service->save($request->user(), $validated);

        return response()->json([
            'message' => 'College assessment created successfully.',
            'assessment' => $assessment,
        ], 201);
    }

    public function show(Request $request, CollegeAssessment $collegeAssessment): JsonResponse
    {
        $filters = $request->validate([
            'college_id' => ['sometimes', 'nullable', 'integer'],
            'department' => ['sometimes', 'nullable', 'string'],
            'branch_code' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'nullable', 'string'],
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $assignments = $this->service->filteredAssignments($collegeAssessment, $filters);

        $scored = $assignments->filter(fn ($a) => $a->overall_score_percent !== null);
        $passed = $scored->filter(fn ($a) => $a->overall_score_percent >= $collegeAssessment->passing_score_percent);

        $collegeAssessment->load([
            'softSkillAssessment:id,slug,title,status,duration_minutes,pass_percentage',
            'contest:id,slug,title,status,start_at,end_at',
            'interview:id,slug,title,status',
        ]);

        return response()->json([
            'assessment' => $collegeAssessment,
            'summary' => [
                'assigned' => $assignments->count(),
                'in_progress' => $assignments->where('status', CollegeAssessmentAssignment::STATUS_IN_PROGRESS)->count(),
                'completed' => $assignments->where('status', CollegeAssessmentAssignment::STATUS_COMPLETED)->count(),
                'avg_overall_score' => $scored->isNotEmpty() ? round((float) $scored->avg('overall_score_percent'), 2) : null,
                'pass_count' => $passed->count(),
            ],
            'assignments' => $assignments->map(fn (CollegeAssessmentAssignment $a) => [
                'id' => $a->id,
                'user_id' => $a->user_id,
                'status' => $a->status,
                'soft_skill_score_percent' => $a->soft_skill_score_percent,
                'coding_points' => $a->coding_points,
                'coding_max_points' => $a->coding_max_points,
                'coding_score_percent' => $a->coding_score_percent,
                'interview_score_percent' => $a->interview_score_percent,
                'overall_score_percent' => $a->overall_score_percent,
                'passed' => $a->overall_score_percent !== null ? $a->overall_score_percent >= $collegeAssessment->passing_score_percent : null,
                'started_at' => $a->started_at?->toIso8601String(),
                'completed_at' => $a->completed_at?->toIso8601String(),
                'student' => [
                    'id' => $a->user?->id,
                    'name' => $a->user?->name,
                    'email' => $a->user?->email,
                    'roll_number' => $a->user?->roll_number,
                    'department' => $a->user?->department,
                    'branch' => $a->user?->branch,
                    'branch_code' => $a->user?->branch_code,
                    'graduation_year' => $a->user?->graduation_year,
                    'college' => $a->user?->college ? [
                        'id' => $a->user->college->id,
                        'name' => $a->user->college->name,
                        'short_code' => $a->user->college->short_code,
                    ] : null,
                ],
            ])->values(),
        ]);
    }

    public function update(Request $request, CollegeAssessment $collegeAssessment): JsonResponse
    {
        $validated = $this->validatePayload($request);
        $updated = $this->service->save($request->user(), $validated, $collegeAssessment);

        return response()->json([
            'message' => 'College assessment updated.',
            'assessment' => $updated,
        ]);
    }

    public function publish(CollegeAssessment $collegeAssessment): JsonResponse
    {
        $published = $this->service->publish($collegeAssessment);

        return response()->json([
            'message' => 'Assessment published and mapped to all selected students.',
            'assessment' => $published,
        ]);
    }

    public function close(CollegeAssessment $collegeAssessment): JsonResponse
    {
        $closed = $this->service->close($collegeAssessment);

        return response()->json([
            'message' => 'Assessment closed.',
            'assessment' => $closed,
        ]);
    }

    public function unpublish(CollegeAssessment $collegeAssessment): JsonResponse
    {
        $unpublished = $this->service->unpublish($collegeAssessment);

        return response()->json([
            'message' => 'Assessment unpublished and hidden from students.',
            'assessment' => $unpublished,
        ]);
    }

    public function syncAssignments(Request $request, CollegeAssessment $collegeAssessment): JsonResponse
    {
        $validated = $request->validate([
            'target_scope' => ['required', 'array'],
            'target_scope.college_ids' => ['sometimes', 'array'],
            'target_scope.college_ids.*' => ['integer'],
            'target_scope.department_codes' => ['sometimes', 'array'],
            'target_scope.department_codes.*' => ['string'],
            'target_scope.branch_codes' => ['sometimes', 'array'],
            'target_scope.branch_codes.*' => ['string'],
            'target_scope.student_mode' => ['sometimes', 'in:all_matching,selected'],
            'target_scope.user_ids' => ['sometimes', 'array'],
            'target_scope.user_ids.*' => ['integer'],
            'prune_unstarted' => ['sometimes', 'boolean'],
        ]);

        $scope = $validated['target_scope'];
        $collegeAssessment->update(['target_scope' => $scope]);
        $count = $this->service->syncTargetAssignments($collegeAssessment, $scope, (bool) ($validated['prune_unstarted'] ?? false));

        return response()->json([
            'message' => "Synced {$count} target student(s).",
            'assigned_count' => $collegeAssessment->assignments()->count(),
        ]);
    }

    public function destroy(CollegeAssessment $collegeAssessment): JsonResponse
    {
        $hasProgress = $collegeAssessment->assignments()
            ->where('status', '!=', CollegeAssessmentAssignment::STATUS_ASSIGNED)
            ->exists();

        if ($hasProgress) {
            return response()->json([
                'message' => 'Students have already started this assessment. Close it instead of deleting.',
            ], 422);
        }

        $collegeAssessment->delete();

        return response()->json(['message' => 'Assessment deleted.']);
    }

    public function exportCsv(Request $request, CollegeAssessment $collegeAssessment): StreamedResponse
    {
        $filters = $request->validate([
            'college_id' => ['sometimes', 'nullable', 'integer'],
            'department' => ['sometimes', 'nullable', 'string'],
            'branch_code' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'nullable', 'string'],
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $assignments = $this->service->filteredAssignments($collegeAssessment, $filters);
        $filename = $collegeAssessment->slug.'-results-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($collegeAssessment, $assignments) {
            $out = fopen('php://output', 'w');
            // UTF-8 BOM so Excel opens names/symbols cleanly
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                'Assessment',
                'Student Name',
                'Email',
                'Roll Number',
                'College',
                'Department',
                'Branch',
                'Status',
                'Soft Skill Score (%)',
                'Coding Points',
                'Coding Max Points',
                'Coding Score (%)',
                'AI Interview Score (%)',
                'Overall Score (%)',
                'Result',
                'Started At',
                'Completed At',
            ]);

            foreach ($assignments as $a) {
                $u = $a->user;
                $resultLabel = $a->overall_score_percent === null
                    ? 'Pending'
                    : ($a->overall_score_percent >= $collegeAssessment->passing_score_percent ? 'Pass' : 'Below Benchmark');

                fputcsv($out, [
                    $collegeAssessment->title,
                    $u?->name ?? '',
                    $u?->email ?? '',
                    $u?->roll_number ?? '',
                    $u?->college?->name ?? '',
                    $u?->department ?? '',
                    $u?->branch ?? ($u?->branch_code ?? ''),
                    $a->status,
                    $a->soft_skill_score_percent !== null ? number_format($a->soft_skill_score_percent, 2, '.', '') : '',
                    $a->coding_points !== null ? (string) $a->coding_points : '',
                    $a->coding_max_points !== null ? (string) $a->coding_max_points : '',
                    $a->coding_score_percent !== null ? number_format($a->coding_score_percent, 2, '.', '') : '',
                    $a->interview_score_percent !== null ? number_format($a->interview_score_percent, 2, '.', '') : '',
                    $a->overall_score_percent !== null ? number_format($a->overall_score_percent, 2, '.', '') : '',
                    $resultLabel,
                    $a->started_at?->toIso8601String() ?? '',
                    $a->completed_at?->toIso8601String() ?? '',
                ]);
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'enforce_sequence' => ['sometimes', 'boolean'],
            'passing_score_percent' => ['sometimes', 'numeric', 'min:1', 'max:100'],
            'publish_now' => ['sometimes', 'boolean'],

            'include_soft_skills' => ['sometimes', 'boolean'],
            'soft_skill_weight' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'soft_skill_config' => ['sometimes', 'nullable', 'array'],
            'soft_skill_config.question_set_ids' => ['sometimes', 'array'],
            'soft_skill_config.question_set_ids.*' => ['integer'],
            'soft_skill_config.question_ids' => ['sometimes', 'array'],
            'soft_skill_config.question_ids.*' => ['integer'],
            'soft_skill_config.duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:240'],
            'soft_skill_config.pass_percentage' => ['sometimes', 'integer', 'min:1', 'max:100'],

            'include_coding' => ['sometimes', 'boolean'],
            'coding_weight' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'coding_config' => ['sometimes', 'nullable', 'array'],
            'coding_config.problem_ids' => ['sometimes', 'array'],
            'coding_config.problem_ids.*' => ['integer'],
            'coding_config.problems' => ['sometimes', 'array'],
            'coding_config.problems.*.problem_id' => ['required_with:coding_config.problems', 'integer'],
            'coding_config.problems.*.points' => ['sometimes', 'integer', 'min:10', 'max:1000'],

            'include_interview' => ['sometimes', 'boolean'],
            'interview_weight' => ['sometimes', 'integer', 'min:0', 'max:100'],
            'interview_config' => ['sometimes', 'nullable', 'array'],
            'interview_config.curated_set_ids' => ['sometimes', 'array'],
            'interview_config.curated_set_ids.*' => ['string'],
            'interview_config.mock_round_ids' => ['sometimes', 'array'],
            'interview_config.mock_round_ids.*' => ['string'],
            'interview_config.question_bank_ids' => ['sometimes', 'array'],
            'interview_config.question_bank_ids.*' => ['integer'],
            'interview_config.custom_questions' => ['sometimes', 'array'],
            'interview_config.custom_questions.*.text' => ['required_with:interview_config.custom_questions', 'string', 'max:1000'],
            'interview_config.custom_questions.*.category' => ['sometimes', 'string'],
            'interview_config.custom_questions.*.difficulty' => ['sometimes', 'string'],
            'interview_config.custom_questions.*.duration_seconds' => ['sometimes', 'integer', 'min:30', 'max:600'],

            'target_scope' => ['required', 'array'],
            'target_scope.college_ids' => ['sometimes', 'array'],
            'target_scope.college_ids.*' => ['integer'],
            'target_scope.department_codes' => ['sometimes', 'array'],
            'target_scope.department_codes.*' => ['string'],
            'target_scope.branch_codes' => ['sometimes', 'array'],
            'target_scope.branch_codes.*' => ['string'],
            'target_scope.student_mode' => ['sometimes', 'in:all_matching,selected'],
            'target_scope.user_ids' => ['sometimes', 'array'],
            'target_scope.user_ids.*' => ['integer'],
        ]);
    }
}
