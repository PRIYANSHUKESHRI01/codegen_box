<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\Problem;
use App\Models\User;
use App\Services\EligibilityService;
use Illuminate\Http\Request;

/**
 * Student-facing, read-only access to placement drives. A student only ever
 * sees drives actively mapped to their own college and currently published —
 * never another college's, and never a draft/cancelled one — enforced here
 * rather than left to the frontend.
 */
class StudentDriveController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $collegeId = $user->college_id;

        // `drive_access` is included even on the empty-array paths (no
        // college, or a plan that doesn't grant it) so the frontend can
        // show an "upgrade to unlock placement drives" prompt instead of a
        // generic "no drives yet" — those are two different situations for
        // a candidate, even though both return zero drives today.
        if (! $collegeId) {
            return response()->json(['drives' => [], 'drive_access' => false]);
        }

        $driveAccess = $user->effectiveEntitlements()['drive_access'];

        if (! $driveAccess) {
            return response()->json(['drives' => [], 'drive_access' => false]);
        }

        $mappings = DriveCollegeMapping::with('placementDrive.company')
            ->where('college_id', $collegeId)
            ->where('is_active', true)
            ->whereHas('placementDrive', function ($query) {
                $query->where('status', PlacementDrive::STATUS_PUBLISHED);
            })
            ->get()
            ->sortBy(fn (DriveCollegeMapping $mapping) => $mapping->placementDrive->drive_date)
            ->values();

        return response()->json([
            'drives' => $mappings->map(fn (DriveCollegeMapping $mapping) => $this->formatDriveSummary($mapping, $user))->all(),
            'drive_access' => true,
        ]);
    }

    /**
     * The single "Prepare" payload: drive + eligibility, company overview,
     * previous-year questions, and recommended problems in one round trip.
     * Re-checked on every request (never cached from the index call) so a
     * drive unmapped after a student loaded/bookmarked it degrades to a
     * clean 404 instead of serving stale content.
     */
    public function show(Request $request, PlacementDrive $placementDrive)
    {
        $user = $request->user();

        abort_unless(
            $user->effectiveEntitlements()['drive_access'],
            402,
            'Placement drives aren\'t included on your current plan. Upgrade to unlock this drive.'
        );

        $mapping = DriveCollegeMapping::with('placementDrive.company')
            ->where('placement_drive_id', $placementDrive->id)
            ->where('college_id', $user->college_id)
            ->where('is_active', true)
            ->first();

        if (! $mapping || ! $mapping->placementDrive->isPublished()) {
            return response()->json(['message' => 'This drive is not available.'], 404);
        }

        $company = $mapping->placementDrive->company;

        return response()->json([
            'drive' => [
                ...$this->formatDriveSummary($mapping, $user),
                'status' => $mapping->placementDrive->status,
            ],
            'company' => [
                'id' => $company->id,
                'name' => $company->name,
                'slug' => $company->slug,
                'logo' => $company->logo,
                'overview' => $company->overview,
                'hiring_process' => $company->hiring_process,
            ],
            'prep_questions' => $company->prepQuestions()
                ->orderByDesc('asked_year')
                ->orderBy('display_order')
                ->get(['id', 'asked_year', 'category', 'round_name', 'question', 'answer_notes']),
            'recommended_problems' => $this->recommendedProblems($company),
        ]);
    }

    /**
     * `company_recommended_problems.problem_slug` is a plain string, not a
     * foreign key (see its migration) — it was previously resolved on the
     * FRONTEND against a wholly disconnected mock catalog
     * (frontend/src/data/problems.ts), which could never reliably match the
     * real problems table. Resolving it here, server-side, against the real
     * Problem catalog means the frontend never touches that mock data again,
     * and a slug with no real match is flagged rather than silently mismatched.
     */
    private function recommendedProblems($company): array
    {
        $recommended = $company->recommendedProblems()->orderBy('priority')->get(['problem_slug', 'topic_tag', 'priority']);

        $realProblems = Problem::whereIn('slug', $recommended->pluck('problem_slug'))
            ->get(['slug', 'title', 'difficulty'])
            ->keyBy('slug');

        return $recommended->map(function ($rec) use ($realProblems) {
            $problem = $realProblems->get($rec->problem_slug);

            return [
                'problem_slug' => $rec->problem_slug,
                'topic_tag' => $rec->topic_tag,
                'priority' => $rec->priority,
                'title' => $problem?->title,
                'difficulty' => $problem?->difficulty,
                'available' => $problem !== null,
            ];
        })->all();
    }

    private function formatDriveSummary(DriveCollegeMapping $mapping, User $user): array
    {
        $drive = $mapping->placementDrive;
        $company = $drive->company;
        $eligibility = $mapping->effectiveEligibility();

        $application = DriveApplication::where('placement_drive_id', $drive->id)
            ->where('user_id', $user->id)
            ->first();

        return [
            'id' => $drive->id,
            'title' => $drive->title,
            'company' => [
                'id' => $company->id,
                'name' => $company->name,
                'slug' => $company->slug,
                'logo' => $company->logo,
            ],
            'role_title' => $drive->role_title,
            'ctc_range' => $drive->ctc_range,
            'drive_date' => $drive->drive_date,
            'duration_minutes' => $drive->duration_minutes,
            'eligibility' => $eligibility,
            'student_eligibility' => EligibilityService::evaluate($user, $eligibility),
            // Real, TPO-driven application status — null until a TPO actually
            // registers this student into the pipeline (see DriveApplication).
            'my_application' => $application ? [
                'stage' => $application->stage,
                'stage_label' => DriveApplication::stageLabel($application->stage),
                'ctc_offered' => $application->ctc_offered,
                'is_terminal' => $application->isTerminal(),
            ] : null,
        ];
    }
}
