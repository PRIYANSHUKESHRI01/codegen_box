<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GeneratedReport;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Services\Reports\MockInterviewReportService;
use App\Services\Reports\PdfRenderer;
use App\Services\Reports\ReportArchive;
use App\Support\ReportFormat;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * A student's own AI interview result as a PDF: every question with what they said, the score and feedback on each answer, and
 * how they did by question type. Written for the student (audience "student") and kept in their report history; it never contains
 * anything about other students. Only a sitting that is finished AND scored can be turned into a report.
 */
class StudentInterviewReportController extends Controller
{
    /** POST /me/interviews/{interview}/report */
    public function store(Request $request, Interview $interview, MockInterviewReportService $reports, PdfRenderer $pdf, ReportArchive $archive): JsonResponse
    {
        $user = $request->user();
        abort_unless($interview->isVisibleToUser($user), 404);

        $session = InterviewSession::query()->where('interview_id', $interview->id)->where('user_id', $user->id)->firstOrFail();

        abort_unless($session->status === InterviewSession::STATUS_COMPLETED, 422, 'Finish the interview first: the report is made from a completed sitting.');
        abort_unless($session->hasScoreAvailable(), 422, 'This interview is still being marked. Try again in a minute.');

        $data = $reports->sitting($session);
        $id = (string) Str::ulid();
        $label = 'AR-'.strtoupper(substr($id, -10));
        $rendered = $pdf->render('reports.interview-session', ['data' => $data], "Report {$label}  |  Your AptRun interview result");

        $report = $archive->store($rendered['binary'], [
            'public_id' => $id,
            'kind' => GeneratedReport::KIND_INTERVIEW_SESSION,
            'title' => $interview->title,
            'filename' => 'AptRun-Interview-'.ReportFormat::slug($interview->title).'-'.now()->format('Ymd').'.pdf',
            'college_id' => $user->college_id,
            'subject_user_id' => $user->id,
            'interview_id' => $interview->id,
            'interview_session_id' => $session->id,
            'audience' => GeneratedReport::AUDIENCE_STUDENT,
            'pages' => $rendered['pages'],
            'params' => ['label' => $label],
            'summary' => ['score' => $data['result']['score'], 'tier' => $data['result']['tier'], 'answered' => $data['result']['answered']],
        ], $user);

        return response()->json(['report' => $report->load(['generator:id,name', 'interview:id,slug,title'])->present()], 201);
    }
}
