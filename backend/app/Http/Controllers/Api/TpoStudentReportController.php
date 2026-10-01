<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContestSubmission;
use App\Models\Submission;
use App\Models\User;
use App\Services\StudentReportService;
use Illuminate\Http\Request;

/**
 * The drill-down behind Student Cohort's "View Report" — everything a TPO
 * can see about one of their own students: contest history, mock interview
 * history, drive pipeline, a day-by-day activity calendar, and (new) the
 * actual code behind any of their submissions. Separate from
 * TpoStudentController (roster CRUD) the same way TpoDriveApplicationController
 * is split out from TpoDriveController — this is a read-heavy reporting
 * surface, not roster management.
 */
class TpoStudentReportController extends Controller
{
    public function show(Request $request, User $student, StudentReportService $service)
    {
        $this->authorizeOwnStudent($request, $student);

        return response()->json($service->report($student));
    }

    /**
     * One practice submission's full detail, including the source code —
     * the one place `Submission::$hidden`'s `code` entry gets deliberately
     * un-hidden. Rows written before the code column existed have `code`
     * as null; the frontend shows "Not recorded" rather than a blank editor
     * for those, never fabricating something that wasn't captured.
     */
    public function submission(Request $request, User $student, Submission $submission)
    {
        $this->authorizeOwnStudent($request, $student);

        abort_unless($submission->user_id === $student->id, 404);

        return response()->json([
            'submission' => $submission->load('problem:id,slug,title,difficulty')->makeVisible('code'),
        ]);
    }

    /** Same shape as submission() above, for a contest attempt instead of a practice one. */
    public function contestSubmission(Request $request, User $student, ContestSubmission $contestSubmission)
    {
        $this->authorizeOwnStudent($request, $student);

        abort_unless($contestSubmission->user_id === $student->id, 404);

        return response()->json([
            'submission' => $contestSubmission->load('contestProblem.problem:id,slug,title,difficulty', 'contest:id,title,slug')->makeVisible('code'),
        ]);
    }

    /**
     * Same isolation rule every other TPO-reachable student endpoint
     * enforces (see TpoStudentController) — a college_id mismatch 404s
     * rather than 403s, so a TPO guessing another college's student id
     * can't even confirm the account exists.
     */
    private function authorizeOwnStudent(Request $request, User $student): void
    {
        abort_unless(
            $student->role === User::ROLE_USER && $student->college_id === $request->user()->college_id,
            404
        );
    }
}
