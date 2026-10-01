<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ContestSubmission;
use App\Models\Submission;
use App\Models\User;
use App\Services\StudentReportService;
use Illuminate\Http\Request;

/**
 * Mellow-internal-staff mirror of TpoStudentReportController — same report,
 * for any student platform-wide rather than one TPO's own college. Reached
 * from Platform Users (AdminController::users()) rather than a college's
 * Student Cohort table.
 */
class AdminStudentReportController extends Controller
{
    public function show(User $student, StudentReportService $service)
    {
        $this->authorizeStudent($student);

        return response()->json($service->report($student));
    }

    public function submission(User $student, Submission $submission)
    {
        $this->authorizeStudent($student);

        abort_unless($submission->user_id === $student->id, 404);

        return response()->json([
            'submission' => $submission->load('problem:id,slug,title,difficulty')->makeVisible('code'),
        ]);
    }

    public function contestSubmission(User $student, ContestSubmission $contestSubmission)
    {
        $this->authorizeStudent($student);

        abort_unless($contestSubmission->user_id === $student->id, 404);

        return response()->json([
            'submission' => $contestSubmission->load('contestProblem.problem:id,slug,title,difficulty', 'contest:id,title,slug')->makeVisible('code'),
        ]);
    }

    private function authorizeStudent(User $student): void
    {
        abort_unless($student->role === User::ROLE_USER, 404);
    }
}
