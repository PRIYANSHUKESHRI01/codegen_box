<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contest;
use App\Models\ContestParticipant;
use App\Models\ContestProblem;
use App\Models\ContestSubmission;
use App\Models\DriveApplication;
use App\Models\PlacementDrive;
use App\Services\ContestFinalizeService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * A company hiring tenant's own proctored assessments — near-verbatim mirror
 * of TpoContestController (see that class's docblock for the shared
 * reasoning: never rated, problems pickable from the whole shared bank).
 * Every method scoped to `contest_type = company_hiring` AND
 * `owning_company_id = $request->user()->company_id`. The one structural
 * difference: an assessment always belongs to exactly one job opening
 * (`placement_drive_id` required on create) since it's tied to a specific
 * hiring pipeline, unlike a TPO's floating tpo_mock contest.
 */
class CompanyContestController extends Controller
{
    public function index(Request $request)
    {
        return response()->json([
            'contests' => $this->ownedContests($request)->withCount('participants')->with('placementDrive:id,title,role_title')->latest('start_at')->get(),
        ]);
    }

    public function store(Request $request)
    {
        $companyId = $request->user()->company_id;

        if (! $companyId) {
            return response()->json(['message' => 'Your account is not linked to a company.'], 422);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_at' => ['required', 'date'],
            'end_at' => ['required', 'date', 'after:start_at'],
            'placement_drive_id' => ['required', 'integer', 'exists:placement_drives,id'],
        ]);

        $drive = PlacementDrive::where('id', $validated['placement_drive_id'])
            ->where('company_id', $companyId)
            ->where('source', PlacementDrive::SOURCE_COMPANY_DIRECT)
            ->firstOrFail();

        $contest = Contest::create([
            'title' => $validated['title'],
            'slug' => Contest::uniqueSlug($validated['title']),
            'description' => $validated['description'] ?? null,
            'start_at' => $validated['start_at'],
            'end_at' => $validated['end_at'],
            'is_rated' => false,
            'status' => Contest::STATUS_DRAFT,
            'contest_type' => Contest::CONTEST_TYPE_COMPANY_HIRING,
            'company_id' => $companyId,
            'owning_company_id' => $companyId,
            'placement_drive_id' => $drive->id,
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
            return response()->json(['message' => 'Cannot remove a problem after the assessment has started.'], 422);
        }

        if (ContestSubmission::where('contest_problem_id', $contestProblem->id)->exists()) {
            return response()->json(['message' => 'Cannot remove a problem that already has submissions.'], 422);
        }

        $contestProblem->delete();

        return response()->json(['message' => 'Problem removed from assessment.']);
    }

    public function finalize(Request $request, Contest $contest, ContestFinalizeService $service)
    {
        $this->authorizeOwnership($request, $contest);

        if (! $contest->hasEnded()) {
            return response()->json(['message' => 'This assessment has not ended yet.'], 422);
        }

        return response()->json($service->finalize($contest));
    }

    /**
     * The ONLY way a candidate becomes able to see/take this assessment —
     * see Contest::isVisibleToUser(). Each invited user must already be in
     * this contest's job opening's pipeline (a DriveApplication row), which
     * is what keeps "candidates enter a pipeline via invite/import only"
     * true even at the assessment layer: you can't be invited to a company's
     * assessment without already being a candidate of theirs.
     */
    public function inviteCandidates(Request $request, Contest $contest)
    {
        $this->authorizeOwnership($request, $contest);

        $validated = $request->validate([
            'user_ids' => ['required', 'array', 'min:1'],
            'user_ids.*' => ['integer'],
        ]);

        $eligibleUserIds = DriveApplication::where('placement_drive_id', $contest->placement_drive_id)
            ->whereIn('user_id', $validated['user_ids'])
            ->pluck('user_id')
            ->all();

        $invited = 0;
        foreach ($eligibleUserIds as $userId) {
            ContestParticipant::firstOrCreate(
                ['contest_id' => $contest->id, 'user_id' => $userId],
                ['registered_at' => now()]
            );
            $invited++;
        }

        $skipped = count($validated['user_ids']) - $invited;

        return response()->json([
            'message' => "Invited {$invited} candidate(s)."
                .($skipped > 0 ? " {$skipped} skipped — not in this opening's pipeline." : ''),
            'invited' => $invited,
        ]);
    }

    /** Who's invited to this assessment, plus their submission/score status — the recruiter's candidate-tracking view. */
    public function invited(Request $request, Contest $contest)
    {
        $this->authorizeOwnership($request, $contest);

        $participants = $contest->participants()
            ->with('user:id,name,email')
            ->orderByDesc('score')
            ->get();

        return response()->json(['participants' => $participants]);
    }

    /**
     * Score-ranked results for this assessment, whoever the candidates are
     * (invited directly, or self-registered because their college approved
     * the underlying job opening — see Contest::isVisibleToUser()). Live-
     * computed from ContestParticipant.score, same "no need to wait for
     * finalize" convention ContestController::leaderboard() already uses.
     * Each row is annotated with the candidate's current DriveApplication
     * stage (null if not yet pulled into the pipeline) so the frontend can
     * grey out rows already imported.
     */
    public function results(Request $request, Contest $contest)
    {
        $this->authorizeOwnership($request, $contest);

        $totalPoints = (int) $contest->contestProblems()->sum('points');

        $stageByUserId = DriveApplication::where('placement_drive_id', $contest->placement_drive_id)
            ->pluck('stage', 'user_id');

        $participants = $contest->participants()
            ->with('user:id,name,email')
            ->orderByDesc('score')
            ->get();

        return response()->json([
            'total_points' => $totalPoints,
            'results' => $participants->map(fn (ContestParticipant $p) => [
                'user_id' => $p->user_id,
                'user' => ['id' => $p->user->id, 'name' => $p->user->name, 'email' => $p->user->email],
                'score' => $p->score,
                'score_percent' => $totalPoints > 0 ? round($p->score / $totalPoints * 100, 1) : 0.0,
                'penalty_minutes' => $p->penalty_minutes,
                'pipeline_stage' => $stageByUserId[$p->user_id] ?? null,
            ])->values(),
        ]);
    }

    /**
     * Pulls qualifying participants into this opening's DriveApplication
     * pipeline — the one bridge from "took the assessment" to "is a
     * pipeline candidate." Deliberately does nothing beyond that: no new
     * stage machinery here, "hiring" is just CompanyCandidateController::
     * updateStage() moving the resulting row to offer_extended/accepted,
     * exactly like any other candidate. Idempotent via firstOrCreate — an
     * already-piped candidate's existing stage/notes are never touched by
     * re-running this with an overlapping selection.
     */
    public function importResults(Request $request, Contest $contest)
    {
        $this->authorizeOwnership($request, $contest);

        abort_unless($contest->placement_drive_id !== null, 422, 'This assessment has no linked job opening.');

        $validated = $request->validate([
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['integer'],
            'min_score_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        abort_if(
            empty($validated['user_ids']) && ! isset($validated['min_score_percent']),
            422,
            'Provide either user_ids or a min_score_percent threshold.'
        );

        $query = $contest->participants();

        if (! empty($validated['user_ids'])) {
            $query->whereIn('user_id', $validated['user_ids']);
        } else {
            $totalPoints = (int) $contest->contestProblems()->sum('points');
            $minScore = $totalPoints > 0 ? (int) ceil($validated['min_score_percent'] / 100 * $totalPoints) : PHP_INT_MAX;
            $query->where('score', '>=', $minScore);
        }

        $imported = 0;

        foreach ($query->with('user:id,college_id')->get() as $participant) {
            $application = DriveApplication::firstOrCreate(
                ['placement_drive_id' => $contest->placement_drive_id, 'user_id' => $participant->user_id],
                [
                    'college_id' => $participant->user->college_id,
                    'stage' => DriveApplication::STAGE_REGISTERED,
                    'stage_updated_at' => now(),
                    'stage_updated_by' => $request->user()->id,
                ]
            );

            if ($application->wasRecentlyCreated) {
                $imported++;
            }
        }

        return response()->json([
            'message' => "Added {$imported} candidate(s) to the pipeline.",
            'imported' => $imported,
        ]);
    }

    private function ownedContests(Request $request)
    {
        return Contest::where('contest_type', Contest::CONTEST_TYPE_COMPANY_HIRING)
            ->where('owning_company_id', $request->user()->company_id);
    }

    private function authorizeOwnership(Request $request, Contest $contest): void
    {
        abort_unless(
            $contest->isCompanyHiring() && $contest->owning_company_id === $request->user()->company_id,
            404
        );
    }
}
