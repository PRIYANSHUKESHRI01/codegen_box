<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContestSubmission;
use App\Models\Submission;
use App\Models\User;
use App\Services\StudentReportService;
use Illuminate\Http\Request;

/**
 * Section-Coordinator mirror of TpoStudentReportController — the identical
 * report (contest/interview/drive history, activity calendar, the full
 * unified submission history, and the actual code behind any submission),
 * narrowed to students already in the coordinator's own section (see
 * CoordinatorStudentController's docblock for the "coordinator never sees
 * outside their one section" rule this mirrors exactly).
 *
 * No interview-transcript deep link is exposed from this scope: reviewing a
 * candidate's full interview transcript/proctoring feed is a TPO/Admin
 * reviewer action everywhere else in this app (see TpoInterviewController::
 * responses()) and has never been a coordinator capability — this
 * controller doesn't change that, it only extends the report and code
 * visibility a coordinator already has reason to see for their own section.
 */
class CoordinatorStudentReportController extends Controller
{
    public function show(Request $request, User $student, StudentReportService $service)
    {
        $this->authorizeInSection($request, $student);

        return response()->json($service->report($student));
    }

    public function submission(Request $request, User $student, Submission $submission)
    {
        $this->authorizeInSection($request, $student);

        abort_unless($submission->user_id === $student->id, 404);

        return response()->json([
            'submission' => $submission->load('problem:id,slug,title,difficulty')->makeVisible('code'),
        ]);
    }

    public function contestSubmission(Request $request, User $student, ContestSubmission $contestSubmission)
    {
        $this->authorizeInSection($request, $student);

        abort_unless($contestSubmission->user_id === $student->id, 404);

        return response()->json([
            'submission' => $contestSubmission->load('contestProblem.problem:id,slug,title,difficulty', 'contest:id,title,slug')->makeVisible('code'),
        ]);
    }

    /** Same 404-not-403 rule as CoordinatorStudentController::authorizeInSection() — never confirms an out-of-scope id exists. */
    private function authorizeInSection(Request $request, User $student): void
    {
        $coordinator = $request->user();

        abort_unless(
            $student->role === User::ROLE_USER
                && $student->college_id === $coordinator->college_id
                && $student->section === $coordinator->section,
            404
        );
    }
}
