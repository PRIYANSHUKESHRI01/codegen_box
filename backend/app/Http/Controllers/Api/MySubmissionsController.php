<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContestSubmission;
use App\Models\Submission;
use App\Services\StudentReportService;
use Illuminate\Http\Request;

/**
 * A student's own submission history + the code behind any of it — the
 * self-service counterpart to TpoStudentReportController/
 * CoordinatorStudentReportController/AdminStudentReportController, which all
 * expose the exact same thing about SOMEONE ELSE'S submissions. Deliberately
 * not added to SubmissionController: that controller is judge-execution only
 * (run/submit), and this is a read-heavy reporting surface — the same split
 * TpoStudentReportController already keeps from TpoDriveApplicationController.
 */
class MySubmissionsController extends Controller
{
    public function index(Request $request, StudentReportService $service)
    {
        return response()->json(['submissions' => $service->submissionHistory($request->user())]);
    }

    /** One practice submission's full detail, including the source code — same reveal as TpoStudentReportController::submission(), scoped to the caller instead of an arbitrary student. */
    public function show(Request $request, Submission $submission)
    {
        abort_unless($submission->user_id === $request->user()->id, 404);

        return response()->json([
            'submission' => $submission->load('problem:id,slug,title,difficulty')->makeVisible('code'),
        ]);
    }

    /** Same shape as show() above, for a contest attempt instead of a practice one. */
    public function contestSubmission(Request $request, ContestSubmission $contestSubmission)
    {
        abort_unless($contestSubmission->user_id === $request->user()->id, 404);

        return response()->json([
            'submission' => $contestSubmission->load('contestProblem.problem:id,slug,title,difficulty', 'contest:id,title,slug')->makeVisible('code'),
        ]);
    }
}
