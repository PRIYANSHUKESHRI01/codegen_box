<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\GeneratedReport;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\User;
use App\Services\Interviews\CollegeInterviewBuilder;
use App\Services\Interviews\CollegeInterviewForm;
use App\Services\Interviews\InterviewAudience;
use App\Services\Interviews\MockInterviewScheduler;
use App\Services\Reports\MockInterviewReportService;
use App\Services\Reports\PdfRenderer;
use App\Services\Reports\ReportArchive;
use App\Support\BranchAudience;
use App\Support\ReportFormat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * The rest of a college TPO's mock AI interview toolbox, next to TpoInterviewController's create / edit / review: who an interview
 * would reach, telling them again, copying an interview, drawing questions from the AptRun library, and the results with their PDF
 * reports. Every method is scoped to `tpo_mock` interviews owned by the caller's college (404 otherwise).
 */
class TpoInterviewReportController extends Controller
{
    public function __construct(
        private readonly InterviewAudience $audience,
        private readonly CollegeInterviewForm $form,
    ) {}

    /**
     * POST /tpo/interviews/audience-preview — "who would this reach?" before anything is saved: the head-count, a few names and the
     * split by section, for the very audience rules the interview will use.
     */
    public function audiencePreview(Request $request): JsonResponse
    {
        $collegeId = $request->user()->college_id;
        abort_unless($collegeId, 422, 'Your account is not linked to a college.');

        $validated = $request->validate([...BranchAudience::rules(), ...CollegeInterviewForm::rules()]);

        $probe = new Interview([
            'owning_college_id' => $collegeId,
            'branch_audience' => BranchAudience::normalize($validated['branch_audience'] ?? null),
            'audience_filter' => $this->form->cleanFilter($validated['audience_filter'] ?? null, $collegeId),
        ]);

        $students = $this->audience->students($probe);
        $bySection = $students
            ->groupBy(fn (User $u) => trim((string) $u->section) !== '' ? trim((string) $u->section) : 'No section')
            ->map(fn ($g, $name) => ['section' => (string) $name, 'count' => $g->count()])
            ->sortBy('section', SORT_NATURAL | SORT_FLAG_CASE)->values();

        return response()->json([
            'count' => $students->count(),
            'blocked' => $students->where('is_blocked', true)->count(),
            'label' => $this->audience->describe($probe),
            'sections' => $bySection,
            'sample' => $students->sortBy('name', SORT_NATURAL | SORT_FLAG_CASE)->take(8)
                ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name, 'roll_number' => $u->roll_number, 'section' => $u->section])->values(),
        ]);
    }

    /** POST /tpo/interviews/{interview}/announce — tell the audience again (bell and e-mail), e.g. after a late change. */
    public function announce(Request $request, Interview $interview, MockInterviewScheduler $scheduler): JsonResponse
    {
        $this->owns($request, $interview);
        abort_unless($interview->isPublished(), 422, 'Publish the interview first: students cannot see a draft.');

        $result = $scheduler->announce($interview, true);

        return response()->json([
            'message' => $result['recipients'] > 0 ? "{$result['recipients']} student(s) are being notified." : 'There is nobody in this audience to notify yet.',
        ] + $result);
    }

    /** POST /tpo/interviews/{interview}/duplicate */
    public function duplicate(Request $request, Interview $interview, CollegeInterviewBuilder $builder): JsonResponse
    {
        $this->owns($request, $interview);

        return response()->json(['interview' => $this->form->present($builder->duplicate($interview, $request->user())->loadCount('sessions'))], 201);
    }

    /** GET /tpo/interviews/library — the AptRun question library a TPO can draw from, by domain and stack. */
    public function library(CollegeInterviewBuilder $builder): JsonResponse
    {
        return response()->json(['domains' => $builder->library(), 'max_questions' => CollegeInterviewBuilder::MAX_QUESTIONS]);
    }

    /** POST /tpo/interviews/{interview}/library-questions {stack_key, rounds?, count} */
    public function addLibraryQuestions(Request $request, Interview $interview, CollegeInterviewBuilder $builder): JsonResponse
    {
        $this->owns($request, $interview);

        $validated = $request->validate([
            'stack_key' => ['required', 'string', 'max:80', 'regex:/^[a-z0-9_]+$/'],
            'rounds' => ['sometimes', 'nullable', 'array', 'max:20'],
            'rounds.*' => ['integer', 'min:1', 'max:99'],
            'count' => ['required', 'integer', 'min:1', 'max:'.CollegeInterviewBuilder::MAX_QUESTIONS],
        ]);

        abort_if($interview->sessions()->exists(), 422, 'Students have already started this interview, so its questions can no longer change. Duplicate it instead.');

        $result = $builder->addFromLibrary($interview, $validated['stack_key'], $validated['rounds'] ?? null, (int) $validated['count'], $request->user());

        abort_if($result['available'] === 0, 422, 'That stack has no questions yet.');

        $message = $result['added'] > 0
            ? "Added {$result['added']} question(s)."
            : ($result['total'] >= CollegeInterviewBuilder::MAX_QUESTIONS ? 'This interview already has the maximum number of questions.' : 'Every question from that selection is already in this interview.');

        return response()->json(['message' => $message] + $result);
    }

    // ───────────────────────────── results & reports ─────────────────────────────

    /** GET /tpo/interviews/{interview}/results — the cohort report as JSON (the results screen). */
    public function results(Request $request, Interview $interview, MockInterviewReportService $reports): JsonResponse
    {
        $this->owns($request, $interview);

        return response()->json($reports->cohort($interview));
    }

    /** POST /tpo/interviews/{interview}/report — render the cohort PDF, store it, return its record. */
    public function storeReport(Request $request, Interview $interview, MockInterviewReportService $reports, PdfRenderer $pdf, ReportArchive $archive): JsonResponse
    {
        $this->owns($request, $interview);

        $data = $reports->cohort($interview);
        $id = (string) Str::ulid();
        $label = 'AR-'.strtoupper(substr($id, -10));
        $rendered = $pdf->render('reports.interview', ['data' => $data], "Report {$label}  |  Confidential: student results");

        $report = $archive->store($rendered['binary'], [
            'public_id' => $id,
            'kind' => GeneratedReport::KIND_INTERVIEW,
            'title' => $interview->title.' — interview report',
            'filename' => 'AptRun-Interview-Report-'.ReportFormat::slug($interview->title).'-'.now()->format('Ymd').'.pdf',
            'college_id' => $interview->owning_college_id,
            'interview_id' => $interview->id,
            'pages' => $rendered['pages'],
            'params' => ['label' => $label],
            'summary' => [
                'audience' => $data['participation']['audience'],
                'completed' => $data['participation']['completed'],
                'not_started' => $data['participation']['not_started'],
                'average' => $data['scores']['average'],
                'pass_rate' => $data['scores']['pass_rate'],
            ],
        ], $request->user());

        ActivityLog::record($request->user(), 'Generated an interview report', 'Interview', $interview->title, ['report' => $label]);

        return response()->json(['report' => $report->load(['generator:id,name', 'interview:id,slug,title'])->present()], 201);
    }

    /** POST /tpo/interviews/{interview}/sessions/{interviewSession}/report — one student's sitting as a PDF. */
    public function storeSessionReport(Request $request, Interview $interview, InterviewSession $interviewSession, MockInterviewReportService $reports, PdfRenderer $pdf, ReportArchive $archive): JsonResponse
    {
        $this->owns($request, $interview);
        abort_unless($interviewSession->interview_id === $interview->id, 404);

        $data = $reports->sitting($interviewSession);
        $id = (string) Str::ulid();
        $label = 'AR-'.strtoupper(substr($id, -10));
        $student = $interviewSession->user;
        $rendered = $pdf->render('reports.interview-session', ['data' => $data], "Report {$label}  |  Confidential: personal data of ".Str::limit($student->name, 28));

        $report = $archive->store($rendered['binary'], [
            'public_id' => $id,
            'kind' => GeneratedReport::KIND_INTERVIEW_SESSION,
            'title' => $student->name.' — '.$interview->title,
            'filename' => 'AptRun-Interview-'.ReportFormat::slug($student->name).'-'.ReportFormat::slug($interview->title).'-'.now()->format('Ymd').'.pdf',
            'college_id' => $interview->owning_college_id,
            'subject_user_id' => $student->id,
            'interview_id' => $interview->id,
            'interview_session_id' => $interviewSession->id,
            'pages' => $rendered['pages'],
            'params' => ['label' => $label],
            'summary' => ['score' => $data['result']['score'], 'tier' => $data['result']['tier'], 'answered' => $data['result']['answered']],
        ], $request->user());

        ActivityLog::record($request->user(), 'Generated an interview sitting report', 'User', $student->name, ['interview' => $interview->title, 'report' => $label]);

        return response()->json(['report' => $report->load(['generator:id,name', 'subject:id,name,roll_number,section,branch', 'interview:id,slug,title'])->present()], 201);
    }

    /** GET /tpo/interviews/{interview}/reports — every stored report about this interview (the cohort one and individual sittings). */
    public function reportHistory(Request $request, Interview $interview): JsonResponse
    {
        $this->owns($request, $interview);

        return response()->json([
            'reports' => GeneratedReport::query()->where('interview_id', $interview->id)
                ->with(['generator:id,name', 'subject:id,name,roll_number,section,branch'])->latest('id')->limit(60)->get()->map->present(),
        ]);
    }

    private function owns(Request $request, Interview $interview): void
    {
        abort_unless($interview->isTpoMock() && $interview->owning_college_id === $request->user()->college_id, 404);
    }
}
