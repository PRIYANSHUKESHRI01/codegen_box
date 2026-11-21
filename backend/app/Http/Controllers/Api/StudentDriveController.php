<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\Problem;
use App\Models\User;
use App\Services\EligibilityService;
use App\Support\DepartmentCapabilities;
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
                // Only on the single-drive detail response, never the list —
                // this can run long, and a student has no reason to see it
                // until they've opened the drive they're actually preparing for.
                'terms_and_conditions' => $mapping->placementDrive->terms_and_conditions,
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
            // Coding problems only mean something to a programme that codes; a Commerce student is not sent to a Practice Arena they do not have.
            'recommended_problems' => DepartmentCapabilities::allows($user, 'coding_practice') ? $this->recommendedProblems($company) : [],
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

    /**
     * Student self-registration for an active placement drive mapped to their college.
     * Enforces plan entitlements, published state, college mapping, and academic eligibility criteria.
     * Without registering, students are gated from sitting for linked drive assessments and interviews.
     */
    public function register(Request $request, PlacementDrive $placementDrive)
    {
        $user = $request->user();

        abort_unless(
            $user->effectiveEntitlements()['drive_access'],
            402,
            'Placement drives are not included on your current plan. Upgrade to register.'
        );

        if (! $placementDrive->isPublished()) {
            return response()->json(['message' => 'This placement drive is not open for registration.'], 422);
        }

        if (! $user->college_id) {
            return response()->json(['message' => 'You must be associated with a partner college to register for drives.'], 422);
        }

        // Must be actively mapped to the student's college
        $mapping = DriveCollegeMapping::where('placement_drive_id', $placementDrive->id)
            ->where('college_id', $user->college_id)
            ->where('is_active', true)
            ->where('status', DriveCollegeMapping::STATUS_APPROVED)
            ->first();

        if (! $mapping) {
            return response()->json(['message' => 'This placement drive is not available for your college.'], 404);
        }

        // Academic eligibility verification
        $eligibility = $mapping->effectiveEligibility();
        $evaluation = EligibilityService::evaluate($user, $eligibility);

        if ($evaluation['status'] === 'not_eligible') {
            return response()->json([
                'message' => 'You do not meet the eligibility criteria for this placement drive.',
                'reasons' => $evaluation['reasons'] ?? [],
            ], 422);
        }

        $existing = DriveApplication::where('placement_drive_id', $placementDrive->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            if ($existing->stage === DriveApplication::STAGE_WITHDRAWN) {
                $existing->update([
                    'stage' => DriveApplication::STAGE_REGISTERED,
                    'stage_updated_at' => now(),
                    'stage_updated_by' => $user->id,
                ]);

                ActivityLog::record($user, 'Re-registered for placement drive', 'PlacementDrive', $placementDrive->title);

                return response()->json([
                    'message' => 'Successfully re-registered for '.$placementDrive->title.'.',
                    'application' => [
                        'stage' => $existing->stage,
                        'stage_label' => DriveApplication::stageLabel($existing->stage),
                        'ctc_offered' => $existing->ctc_offered,
                        'is_terminal' => $existing->isTerminal(),
                    ],
                ]);
            }

            if ($existing->isTerminal()) {
                return response()->json([
                    'message' => 'Your application for this drive is concluded ('.$existing->stage.') and cannot be updated.',
                ], 422);
            }

            return response()->json([
                'message' => 'You are already registered for this placement drive.',
                'application' => [
                    'stage' => $existing->stage,
                    'stage_label' => DriveApplication::stageLabel($existing->stage),
                    'ctc_offered' => $existing->ctc_offered,
                    'is_terminal' => $existing->isTerminal(),
                ],
            ]);
        }

        $application = DriveApplication::create([
            'placement_drive_id' => $placementDrive->id,
            'user_id' => $user->id,
            'college_id' => $user->college_id,
            'stage' => DriveApplication::STAGE_REGISTERED,
            'stage_updated_at' => now(),
            'stage_updated_by' => $user->id,
        ]);

        ActivityLog::record($user, 'Registered for placement drive', 'PlacementDrive', $placementDrive->title);

        return response()->json([
            'message' => 'Successfully registered for '.$placementDrive->title.'.',
            'application' => [
                'stage' => $application->stage,
                'stage_label' => DriveApplication::stageLabel($application->stage),
                'ctc_offered' => $application->ctc_offered,
                'is_terminal' => $application->isTerminal(),
            ],
        ], 201);
    }

    /**
     * Withdraw registration for a placement drive before it takes place.
     */
    public function withdraw(Request $request, PlacementDrive $placementDrive)
    {
        $user = $request->user();

        $application = DriveApplication::where('placement_drive_id', $placementDrive->id)
            ->where('user_id', $user->id)
            ->first();

        if (! $application) {
            return response()->json(['message' => 'You have not registered for this placement drive.'], 404);
        }

        if ($application->stage !== DriveApplication::STAGE_REGISTERED) {
            return response()->json(['message' => 'Cannot withdraw an application that has already progressed past registration.'], 422);
        }

        $application->update([
            'stage' => DriveApplication::STAGE_WITHDRAWN,
            'stage_updated_at' => now(),
            'stage_updated_by' => $user->id,
        ]);

        ActivityLog::record($user, 'Withdrew from placement drive', 'PlacementDrive', $placementDrive->title);

        return response()->json([
            'message' => 'Registration withdrawn successfully.',
            'application' => [
                'stage' => $application->stage,
                'stage_label' => DriveApplication::stageLabel($application->stage),
                'ctc_offered' => $application->ctc_offered,
                'is_terminal' => $application->isTerminal(),
            ],
        ]);
    }
}
