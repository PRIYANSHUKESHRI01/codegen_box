<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contest;
use App\Models\ContestProblem;
use App\Models\ContestSubmission;
use App\Models\User;
use App\Services\ContestFinalizeService;
use App\Services\ContestReportService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * College-TPO-only: a TPO's own private practice ("mock") contests for their
 * own students, entirely separate from Mellow's platform-run contests (see
 * AdminContestController). Every method here scopes strictly to
 * `contest_type = tpo_mock` AND `owning_college_id = $request->user()->college_id`
 * — a TPO can never see, let alone edit, another college's mock contest, nor
 * any `general`/`daily`/`company` contest Mellow owns.
 *
 * Deliberately never rated (`is_rated` is hard-coded false on create and
 * simply not accepted on update) — a TPO's own mock round must never move a
 * student's platform-wide competitive rating, only Mellow-run contests do
 * that. Problems may be picked from the entire shared bank (no company-tag
 * restriction the way AdminContestController enforces for `company`
 * contests) since a mock round is generic interview practice, not tied to
 * one employer.
 */
class TpoContestController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'contests' => $this->ownedContests($request)->withCount('participants')->latest('start_at')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $collegeId = $request->user()->college_id;

        if (! $collegeId) {
            return response()->json(['message' => 'Your account is not linked to a college.'], 422);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after:start_at'],
        ]);

        $contest = Contest::create([
            'title' => $validated['title'],
            'slug' => Contest::uniqueSlug($validated['title']),
            'description' => $validated['description'] ?? null,
            'start_at' => $validated['start_at'],
            'end_at' => $validated['end_at'],
            'is_rated' => false,
            'status' => Contest::STATUS_DRAFT,
            'contest_type' => Contest::CONTEST_TYPE_TPO_MOCK,
            'owning_college_id' => $collegeId,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['contest' => $contest], 201);
    }

    public function update(Request $request, Contest $contest)
    {
        $this->authorizeOwnership($request, $contest);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_at' => ['sometimes', 'date'],
            'end_at' => ['sometimes', 'date', 'after:start_at'],
            'status' => ['sometimes', Rule::in(Contest::STATUSES)],
        ]);

        $contest->update($validated);

        return response()->json(['contest' => $contest->fresh()]);
    }

    public function problems(Request $request, Contest $contest)
    {
        $this->authorizeOwnership($request, $contest);

        return response()->json([
            'problems' => $contest->contestProblems()
                ->with('problem:id,slug,title,difficulty')
                ->orderBy('display_order')
                ->get(),
        ]);
    }

    public function storeProblem(Request $request, Contest $contest)
    {
        $this->authorizeOwnership($request, $contest);

        $validated = $request->validate([
            'problem_id' => ['required', 'integer', 'exists:problems,id'],
            'points' => ['required', 'integer', 'min:1'],
            'display_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $contestProblem = ContestProblem::create([
            'contest_id' => $contest->id,
            'problem_id' => $validated['problem_id'],
            'points' => $validated['points'],
            'display_order' => $validated['display_order'] ?? $contest->contestProblems()->count(),
        ]);

        return response()->json([
            'contest_problem' => $contestProblem->load('problem:id,slug,title,difficulty'),
        ], 201);
    }

    public function destroyProblem(Request $request, Contest $contest, ContestProblem $contestProblem)
    {
        $this->authorizeOwnership($request, $contest);

        abort_unless($contestProblem->contest_id === $contest->id, 404);

        if ($contest->hasStarted()) {
            return response()->json(['message' => 'Cannot remove a problem after the contest has started.'], 422);
        }

        if (ContestSubmission::where('contest_problem_id', $contestProblem->id)->exists()) {
            return response()->json(['message' => 'Cannot remove a problem that already has submissions.'], 422);
        }

        $contestProblem->delete();

        return response()->json(['message' => 'Problem removed from contest.']);
    }

    /** Same idempotent finalize path AdminContestController uses — is_rated is always false here, so this only ever computes ranks, never rating deltas. */
    public function finalize(Request $request, Contest $contest, ContestFinalizeService $service)
    {
        $this->authorizeOwnership($request, $contest);

        if (! $contest->hasEnded()) {
            return response()->json(['message' => 'This contest has not ended yet.'], 422);
        }

        return response()->json($service->finalize($contest));
    }

    /**
     * The report a TPO opens to see how their own mock contest actually
     * went — every registrant, ranked, with score and penalty. Previously
     * nonexistent: the mock-contests list only ever showed a bare
     * `participants_count`.
     */
    public function participants(Request $request, Contest $contest, ContestReportService $report)
    {
        $this->authorizeOwnership($request, $contest);

        return response()->json(['participants' => $report->participants($contest)]);
    }

    /**
     * One participant's full per-problem submission trail for this contest,
     * including the actual code they submitted (see
     * ContestReportService::participantSubmissions()'s docblock for why
     * that's safe to include inline here but not in a multi-row listing).
     * `$student` scoped to the SAME college as the contest — a TPO viewing
     * a participant id that belongs to a different college's student (which
     * shouldn't be possible via this UI, but ids are still guessable)
     * quietly 404s rather than leaking that account exists.
     */
    public function participantSubmissions(Request $request, Contest $contest, User $student, ContestReportService $report)
    {
        $this->authorizeOwnership($request, $contest);

        abort_unless($student->college_id === $contest->owning_college_id, 404);

        return response()->json(['submissions' => $report->participantSubmissions($contest, $student)]);
    }

    private function ownedContests(Request $request)
    {
        return Contest::where('contest_type', Contest::CONTEST_TYPE_TPO_MOCK)
            ->where('owning_college_id', $request->user()->college_id);
    }

    private function authorizeOwnership(Request $request, Contest $contest): void
    {
        abort_unless(
            $contest->isTpoMock() && $contest->owning_college_id === $request->user()->college_id,
            404
        );
    }
}
