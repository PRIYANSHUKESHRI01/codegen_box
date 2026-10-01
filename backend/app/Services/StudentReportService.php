<?php

namespace App\Services;

use App\Models\ContestParticipant;
use App\Models\ContestSubmission;
use App\Models\DriveApplication;
use App\Models\InterviewSession;
use App\Models\SoftSkillSession;
use App\Models\Submission;
use App\Models\User;
use Illuminate\Support\Collection;

/**
 * A student's full activity picture — everything a TPO, section coordinator
 * (scoped to their own section), or platform admin needs to answer "what has
 * this student actually done": every contest entered and how they placed,
 * every mock interview taken and how it went, every drive they're in the
 * pipeline for, a day-by-day activity calendar, and a single submission
 * history spanning both practice and contest attempts. Built for
 * TpoStudentReportController and its admin/coordinator mirrors to share, the
 * same "one computation, reused by every caller" convention as
 * StudentCohortService.
 *
 * Every method takes the target `User` directly rather than reading
 * `$request->user()` — the caller is always looking at SOMEONE ELSE's
 * activity here, never their own, so ownership/college/section-scoping is
 * the controller's job (mirroring TpoContestController::authorizeOwnership())
 * before this service is ever called, not this class's.
 */
class StudentReportService
{
    public function __construct(private readonly StudentStatsService $stats) {}

    /**
     * Every contest this student has ever registered for, most recent
     * first — including ones still running (rank/rating_after are null
     * until ContestFinalizeService has run for that contest). A TPO mock
     * contest and a platform-run rated contest both show up here; the
     * frontend distinguishes them by `contest_type`.
     *
     * `problem_count`/`total_points_possible` come from a per-contest
     * subquery count/sum (via the nested `with` closure below) rather than
     * N+1 calls to `$contest->contestProblems()` per row.
     * `problems_solved` is one grouped query across every contest this
     * student has touched, keyed back onto each row — the two-query shape
     * that avoids issuing one query per contest in the list.
     */
    public function contestHistory(User $student): Collection
    {
        $solvedByContest = ContestSubmission::where('user_id', $student->id)
            ->where('status', ContestSubmission::STATUS_ACCEPTED)
            ->select('contest_id')
            ->selectRaw('COUNT(DISTINCT contest_problem_id) as solved_count')
            ->groupBy('contest_id')
            ->pluck('solved_count', 'contest_id');

        return ContestParticipant::where('user_id', $student->id)
            ->with(['contest' => function ($query) {
                $query->select('id', 'title', 'slug', 'contest_type', 'start_at', 'end_at', 'is_rated')
                    ->withCount('contestProblems')
                    ->withSum('contestProblems', 'points');
            }])
            ->orderByDesc('registered_at')
            ->get()
            ->map(fn (ContestParticipant $p) => [
                'contest_id' => $p->contest->id,
                'title' => $p->contest->title,
                'slug' => $p->contest->slug,
                'contest_type' => $p->contest->contest_type,
                'is_rated' => $p->contest->is_rated,
                'start_at' => $p->contest->start_at,
                'end_at' => $p->contest->end_at,
                'registered_at' => $p->registered_at,
                'score' => $p->score,
                'penalty_minutes' => $p->penalty_minutes,
                'rank' => $p->rank,
                'rating_before' => $p->rating_before,
                'rating_after' => $p->rating_after,
                'problem_count' => $p->contest->contest_problems_count,
                'total_points_possible' => (int) ($p->contest->contest_problems_sum_points ?? 0),
                'problems_solved' => (int) ($solvedByContest[$p->contest_id] ?? 0),
            ])
            ->values();
    }

    /**
     * Every mock/platform interview this student has been invited to or
     * taken, most recent first. `composite_score_percent` is null until
     * scored (see InterviewSession::hasScoreAvailable()) — the frontend
     * shows "Awaiting score" rather than 0%, same rule the student's own
     * interview list already follows. Deliberately no AI-scoring detail,
     * video, or transcript excerpt here yet — those are explicitly a later
     * pass; `session_id` + `interview_id` + `slug` are enough for a caller
     * with reviewer access to open the existing full transcript view
     * (ReviewSessionsModal) directly, which is all this needs to expose
     * today.
     */
    public function interviewHistory(User $student): Collection
    {
        return InterviewSession::where('user_id', $student->id)
            ->with(['interview' => function ($query) {
                $query->select('id', 'title', 'slug', 'interview_type', 'round_name', 'company_id')
                    ->withCount('interviewQuestions')
                    ->with('company:id,name');
            }])
            ->orderByDesc('invited_at')
            ->get()
            ->map(fn (InterviewSession $s) => [
                'session_id' => $s->id,
                'interview_id' => $s->interview->id,
                'title' => $s->interview->title,
                'slug' => $s->interview->slug,
                'interview_type' => $s->interview->interview_type,
                'round_name' => $s->interview->round_name,
                'company_name' => $s->interview->company?->name,
                'question_count' => $s->interview->interview_questions_count,
                'answered_count' => $s->current_question_order,
                'status' => $s->status,
                'invited_at' => $s->invited_at,
                'started_at' => $s->started_at,
                'completed_at' => $s->completed_at,
                'composite_score_percent' => $s->composite_score_percent,
                'has_score' => $s->hasScoreAvailable(),
                'advanced' => $s->advanced,
            ])
            ->values();
    }

    /**
     * Every completed Soft Skills attempt, most recent first — mirrors
     * interviewHistory() exactly, just for the option-based test instead
     * of the voice one. In-progress (not yet submitted) sessions are
     * deliberately excluded — there's no partial score to show for one,
     * same "only a real result" posture interviewHistory() applies via
     * hasScoreAvailable().
     */
    public function softSkillHistory(User $student): Collection
    {
        return SoftSkillSession::where('user_id', $student->id)
            ->where('status', SoftSkillSession::STATUS_COMPLETED)
            ->with('assessment:id,title,slug,assessment_type')
            ->orderByDesc('completed_at')
            ->get()
            ->map(fn (SoftSkillSession $s) => [
                'session_id' => $s->id,
                'title' => $s->assessment->title,
                'slug' => $s->assessment->slug,
                'assessment_type' => $s->assessment->assessment_type,
                'score_percent' => (float) $s->score_percent,
                'passed' => $s->passed,
                'completed_at' => $s->completed_at,
            ])
            ->values();
    }

    /**
     * Every placement drive this student is tracked against and their
     * current pipeline stage — the same rows TpoDriveApplicationController
     * manages, read-only here, enriched with the company/role/CTC-range the
     * bare drive title used to leave out.
     */
    public function driveApplications(User $student): Collection
    {
        return DriveApplication::where('user_id', $student->id)
            ->with([
                'placementDrive:id,title,company_id,role_title,ctc_range',
                'placementDrive.company:id,name',
            ])
            ->orderByDesc('stage_updated_at')
            ->get()
            ->map(fn (DriveApplication $a) => [
                'application_id' => $a->id,
                'drive_id' => $a->placementDrive->id,
                'drive_title' => $a->placementDrive->title,
                'company_name' => $a->placementDrive->company?->name,
                'role_title' => $a->placementDrive->role_title,
                'ctc_range' => $a->placementDrive->ctc_range,
                'stage' => $a->stage,
                'stage_updated_at' => $a->stage_updated_at,
                'ctc_offered' => $a->ctc_offered,
            ])
            ->values();
    }

    /**
     * One submission history spanning BOTH practice attempts (`submissions`)
     * and contest attempts (`contest_submissions`) — previously two
     * disconnected lists, one only reachable by opening each contest
     * individually. Every row carries `source`, so the frontend can offer a
     * "where did this come from" filter (Practice vs each Contest::CONTEST_TYPE)
     * without a second round-trip.
     *
     * `kind` (`practice` | `contest`) is what tells the frontend which
     * code-view endpoint a row's id belongs to — the two submission kinds
     * live in different tables with independent id sequences, so a plain
     * numeric id alone would be ambiguous.
     */
    public function submissionHistory(User $student, int $limit = 80): Collection
    {
        $practice = Submission::where('user_id', $student->id)
            ->with('problem:id,slug,title,difficulty')
            ->latest('updated_at')
            ->limit($limit)
            ->get()
            ->map(fn (Submission $s) => [
                'id' => $s->id,
                'kind' => 'practice',
                'source' => 'practice',
                'contest_title' => null,
                'problem_title' => $s->problem->title,
                'problem_slug' => $s->problem->slug,
                'difficulty' => $s->problem->difficulty,
                'language' => $s->language,
                'status' => $s->status,
                'points_awarded' => null,
                'runtime_ms' => $s->runtime_ms,
                'memory_kb' => $s->memory_kb,
                'submitted_at' => $s->updated_at,
            ]);

        $contest = ContestSubmission::where('user_id', $student->id)
            ->with(['contestProblem.problem:id,slug,title,difficulty', 'contest:id,title,contest_type'])
            ->latest('submitted_at')
            ->limit($limit)
            ->get()
            ->map(fn (ContestSubmission $s) => [
                'id' => $s->id,
                'kind' => 'contest',
                // The contest's own type IS the filter value ("tpo_mock",
                // "daily", "general"/Mellow, "company", "company_hiring",
                // "talent_pool") — reusing it directly means a new contest
                // type never needs a matching new filter option written
                // by hand.
                'source' => $s->contest->contest_type,
                'contest_title' => $s->contest->title,
                'problem_title' => $s->contestProblem->problem->title,
                'problem_slug' => $s->contestProblem->problem->slug,
                'difficulty' => $s->contestProblem->problem->difficulty,
                'language' => $s->language,
                'status' => $s->status,
                'points_awarded' => $s->points_awarded,
                'runtime_ms' => null,
                'memory_kb' => null,
                'submitted_at' => $s->submitted_at,
            ]);

        return $practice->concat($contest)
            ->sortByDesc('submitted_at')
            ->values()
            ->take($limit);
    }

    /**
     * The full report payload — profile + readiness (same computation the
     * cohort table row uses) plus every section above. Nothing here is new
     * math beyond what each method above already computes; it's the
     * existing per-student computations, run against a student who isn't
     * the caller.
     */
    public function report(User $student): array
    {
        return [
            'student' => [
                'id' => $student->id,
                'name' => $student->name,
                'email' => $student->email,
                'roll_number' => $student->roll_number,
                'branch' => $student->branch,
                'section' => $student->section,
                'cgpa' => $student->cgpa,
                'backlogs' => $student->backlogs,
                'phone' => $student->phone,
                'is_blocked' => $student->is_blocked,
            ],
            'readiness' => [
                'score' => $student->readinessScore(),
                'tier' => $student->readinessTier(),
                'practice_score' => $student->practiceScore(),
                'components' => $student->readinessBreakdown()['components'],
                'next_steps' => $student->readinessBreakdown()['next_steps'],
            ],
            'rating' => [
                'current_rating' => $student->current_rating,
                'rated_contests_count' => $student->rated_contests_count,
                'display_rating' => $student->displayRating(),
            ],
            'solved' => $this->stats->solvedByDifficulty($student),
            'streak' => $this->stats->streak($student),
            'activity' => $this->stats->activityHeatmap($student),
            'submissions' => $this->submissionHistory($student),
            'contests' => $this->contestHistory($student),
            'interviews' => $this->interviewHistory($student),
            'drive_applications' => $this->driveApplications($student),
        ];
    }
}
