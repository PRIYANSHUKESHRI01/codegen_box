<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LaunchpadProgram;
use App\Models\LaunchpadProgramEnrollment;
use App\Services\LaunchpadProgramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * SuperAdmin console for multi-assessment Launchpad campaigns
 * (Mellow Vault Multi-Disciplinary Internship & Launchpad Program 2026):
 *   - Tech Track (21 days, 3 rotated assessments x [Soft Skills + Coding + AI Interview])
 *   - Non-Tech Track (5 days, 3 rotated assessments x [Soft Skills & Aptitude + Role/HR AI Interview])
 * Targets Colleges -> Branches -> Students, rotates Sets 1/2/3 across each college cohort,
 * tracks 60%+ Readiness + Assessment scores, sends reminders, and exports CSV.
 */
class SuperAdminLaunchpadProgramController extends Controller
{
    public function __construct(private readonly LaunchpadProgramService $service) {}

    public function index(): JsonResponse
    {
        $programs = LaunchpadProgram::query()
            ->withCount([
                'enrollments as enrolled_count',
                'enrollments as in_progress_count' => fn ($q) => $q->where('status', LaunchpadProgramEnrollment::STATUS_IN_PROGRESS),
                'enrollments as completed_count' => fn ($q) => $q->where('status', LaunchpadProgramEnrollment::STATUS_COMPLETED),
            ])
            ->latest('id')
            ->get()
            ->map(fn (LaunchpadProgram $p) => [
                'id' => $p->id,
                'slug' => $p->slug,
                'title' => $p->title,
                'subtitle' => $p->subtitle,
                'description' => $p->description,
                'track' => $p->track,
                'status' => $p->status,
                'duration_days' => $p->duration_days,
                'min_readiness_percent' => $p->min_readiness_percent,
                'passing_score_percent' => $p->passing_score_percent,
                'enforce_proctoring' => $p->enforce_proctoring,
                'target_scope' => $p->target_scope,
                'starts_at' => $p->starts_at?->toIso8601String(),
                'ends_at' => $p->ends_at?->toIso8601String(),
                'published_at' => $p->published_at?->toIso8601String(),
                'enrolled_count' => (int) $p->enrolled_count,
                'in_progress_count' => (int) $p->in_progress_count,
                'completed_count' => (int) $p->completed_count,
            ]);

        return response()->json(['programs' => $programs]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'subtitle' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'track' => ['required', Rule::in(LaunchpadProgram::TRACKS)],
            'duration_days' => ['sometimes', 'integer', 'min:1', 'max:90'],
            'min_readiness_percent' => ['sometimes', 'numeric', 'min:1', 'max:100'],
            'passing_score_percent' => ['sometimes', 'numeric', 'min:1', 'max:100'],
            'enforce_proctoring' => ['sometimes', 'boolean'],
            'publish_now' => ['sometimes', 'boolean'],
            'target_scope' => ['sometimes', 'array'],
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

        $program = $this->service->createProgram($request->user(), $validated);

        return response()->json([
            'message' => 'Launchpad 2026 program created with 3 rotated assessment sets.',
            'program' => $program,
        ], 201);
    }

    public function show(Request $request, LaunchpadProgram $launchpadProgram): JsonResponse
    {
        $filters = $request->validate([
            'user_id' => ['sometimes', 'nullable', 'integer'],
            'college_id' => ['sometimes', 'nullable', 'integer'],
            'branch_code' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'nullable', 'string'],
            'qualification' => ['sometimes', 'nullable', 'in:fully_qualified,readiness_ready,below_benchmark'],
            'min_readiness' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'max_readiness' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'min_avg_score' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'max_avg_score' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'sort' => ['sometimes', 'nullable', 'in:avg_desc,avg_asc,readiness_desc,readiness_asc'],
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $dataset = $this->service->resultsDataset($launchpadProgram, $filters);

        return response()->json([
            'program' => $launchpadProgram,
            'summary' => $dataset['summary'],
            'rows' => $dataset['rows'],
        ]);
    }

    public function publish(Request $request, LaunchpadProgram $launchpadProgram): JsonResponse
    {
        $validated = $request->validate([
            'track' => ['sometimes', Rule::in(LaunchpadProgram::TRACKS)],
            'duration_days' => ['sometimes', 'integer', 'min:1', 'max:90'],
            'target_scope' => ['sometimes', 'array'],
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

        $published = $this->service->publish(
            $launchpadProgram,
            $request->user(),
            $validated['track'] ?? null,
            $validated['target_scope'] ?? null,
            isset($validated['duration_days']) ? (int) $validated['duration_days'] : null,
        );

        return response()->json([
            'message' => 'Program published! Students have been notified and their countdown has started.',
            'program' => $published,
        ]);
    }

    public function close(LaunchpadProgram $launchpadProgram): JsonResponse
    {
        $closed = $this->service->close($launchpadProgram);

        return response()->json([
            'message' => 'Program closed.',
            'program' => $closed,
        ]);
    }

    public function unpublish(LaunchpadProgram $launchpadProgram): JsonResponse
    {
        $unpublished = $this->service->unpublish($launchpadProgram);

        return response()->json([
            'message' => 'Program unpublished. Publishing again will restart the full countdown timer.',
            'program' => $unpublished,
        ]);
    }

    public function remind(LaunchpadProgram $launchpadProgram): JsonResponse
    {
        $count = $this->service->sendDeadlineReminders($launchpadProgram, force: true);

        return response()->json([
            'message' => "Deadline reminder sent to {$count} pending student(s).",
            'reminded_count' => $count,
        ]);
    }

    public function syncAssignments(Request $request, LaunchpadProgram $launchpadProgram): JsonResponse
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

        $launchpadProgram->update(['target_scope' => $validated['target_scope']]);
        $count = $this->service->syncEnrollments(
            $launchpadProgram,
            $validated['target_scope'],
            (bool) ($validated['prune_unstarted'] ?? false),
            notifyNew: true
        );

        return response()->json([
            'message' => "Synced {$count} target student(s) with rotated sets.",
            'enrolled_count' => $launchpadProgram->enrollments()->count(),
        ]);
    }

    public function destroy(LaunchpadProgram $launchpadProgram): JsonResponse
    {
        $hasProgress = $launchpadProgram->enrollments()
            ->where('status', '!=', LaunchpadProgramEnrollment::STATUS_ENROLLED)
            ->exists();

        if ($hasProgress) {
            return response()->json([
                'message' => 'Students have already started this program. Close it instead of deleting.',
            ], 422);
        }

        $slotAssessments = $launchpadProgram->slots()->with('assessment')->get();
        $launchpadProgram->delete();
        foreach ($slotAssessments as $slot) {
            $slot->assessment?->delete();
        }

        return response()->json(['message' => 'Launchpad program deleted.']);
    }

    public function exportCsv(Request $request, LaunchpadProgram $launchpadProgram): StreamedResponse
    {
        $filters = $request->validate([
            'user_id' => ['sometimes', 'nullable', 'integer'],
            'college_id' => ['sometimes', 'nullable', 'integer'],
            'branch_code' => ['sometimes', 'nullable', 'string'],
            'status' => ['sometimes', 'nullable', 'string'],
            'qualification' => ['sometimes', 'nullable', 'in:fully_qualified,readiness_ready,below_benchmark'],
            'min_readiness' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'max_readiness' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'min_avg_score' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'max_avg_score' => ['sometimes', 'nullable', 'numeric', 'min:0', 'max:100'],
            'sort' => ['sometimes', 'nullable', 'in:avg_desc,avg_asc,readiness_desc,readiness_asc'],
            'q' => ['sometimes', 'nullable', 'string', 'max:120'],
        ]);

        $dataset = $this->service->resultsDataset($launchpadProgram, $filters);
        $userSuffix = ! empty($filters['user_id']) ? '-student-'.(int) $filters['user_id'] : '';
        $filename = $launchpadProgram->slug.$userSuffix.'-report-'.now()->format('Ymd-His').'.csv';

        $fmtScore = static fn ($val): string => $val !== null ? number_format((float) $val, 2, '.', '') : '';
        $fmtSlotStatus = static fn (array $slot): string => ! empty($slot['blocked_by_proctoring'])
            ? 'blocked_by_proctoring'
            : (string) ($slot['status'] ?? 'assigned');

        return response()->streamDownload(function () use ($launchpadProgram, $dataset, $fmtScore, $fmtSlotStatus) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");

            fputcsv($out, [
                'Program',
                'Track',
                'Student Name',
                'Email',
                'Roll Number',
                'College',
                'Department',
                'Branch',
                'Enrollment Status',
                'Readiness Score (%)',
                'Readiness >= 60%',
                'Assessment 1 Set',
                'Assessment 1 Status',
                'Assessment 1 Soft Skills (%)',
                'Assessment 1 Coding (%)',
                'Assessment 1 AI Interview (%)',
                'Assessment 1 Overall (%)',
                'Assessment 2 Set',
                'Assessment 2 Status',
                'Assessment 2 Soft Skills (%)',
                'Assessment 2 Coding (%)',
                'Assessment 2 AI Interview (%)',
                'Assessment 2 Overall (%)',
                'Assessment 3 Set',
                'Assessment 3 Status',
                'Assessment 3 Soft Skills (%)',
                'Assessment 3 Coding (%)',
                'Assessment 3 AI Interview (%)',
                'Assessment 3 Overall (%)',
                'Assessments Completed',
                'Program Avg Score (%)',
                'Final Qualification',
            ]);

            foreach ($dataset['rows'] as $row) {
                $s = $row['student'];
                $a1 = $row['assessment_1'];
                $a2 = $row['assessment_2'];
                $a3 = $row['assessment_3'];

                fputcsv($out, [
                    $launchpadProgram->title,
                    strtoupper($launchpadProgram->track),
                    $s['name'] ?? '',
                    $s['email'] ?? '',
                    $s['roll_number'] ?? '',
                    $s['college']['name'] ?? '',
                    $s['department'] ?? '',
                    $s['branch'] ?? ($s['branch_code'] ?? ''),
                    $row['status'],
                    number_format((float) $row['readiness_score'], 2, '.', ''),
                    $row['readiness_qualified'] ? 'Yes' : 'No',
                    'Set '.$a1['set'],
                    $fmtSlotStatus($a1),
                    $fmtScore($a1['soft_skill_score_percent'] ?? null),
                    $fmtScore($a1['coding_score_percent'] ?? null),
                    $fmtScore($a1['interview_score_percent'] ?? null),
                    $fmtScore($a1['overall_score_percent'] ?? null),
                    'Set '.$a2['set'],
                    $fmtSlotStatus($a2),
                    $fmtScore($a2['soft_skill_score_percent'] ?? null),
                    $fmtScore($a2['coding_score_percent'] ?? null),
                    $fmtScore($a2['interview_score_percent'] ?? null),
                    $fmtScore($a2['overall_score_percent'] ?? null),
                    'Set '.$a3['set'],
                    $fmtSlotStatus($a3),
                    $fmtScore($a3['soft_skill_score_percent'] ?? null),
                    $fmtScore($a3['coding_score_percent'] ?? null),
                    $fmtScore($a3['interview_score_percent'] ?? null),
                    $fmtScore($a3['overall_score_percent'] ?? null),
                    $row['assessments_completed'].'/3',
                    $fmtScore($row['program_avg_score'] ?? null),
                    $row['fully_qualified'] ? 'Qualified' : 'Pending / Below Benchmark',
                ]);
            }

            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
