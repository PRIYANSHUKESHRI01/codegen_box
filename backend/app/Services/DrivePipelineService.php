<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\College;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\User;
use App\Services\Notifications\DriveNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * The one write path for a drive application's stage — handles single transitions,
 * bulk stage advances, shortlist imports, post-offer joining tracking, and eligible-cohort registration.
 */
class DrivePipelineService
{
    public function transition(DriveApplication $application, string $newStage, array $payload, User $actor): DriveApplication
    {
        if ($application->isTerminal()) {
            throw ValidationException::withMessages([
                'stage' => ['This application is already closed and cannot be moved to a new stage.'],
            ]);
        }

        if ($newStage === DriveApplication::STAGE_OFFER_ACCEPTED && $application->stage !== DriveApplication::STAGE_OFFER_EXTENDED) {
            throw ValidationException::withMessages([
                'stage' => ['An offer must be recorded as extended before it can be accepted.'],
            ]);
        }

        $movingIntoOffer = in_array($newStage, [DriveApplication::STAGE_OFFER_EXTENDED, DriveApplication::STAGE_OFFER_ACCEPTED], true);

        if ($movingIntoOffer && empty($payload['ctc_offered'])) {
            throw ValidationException::withMessages([
                'ctc_offered' => ['CTC is required when extending or accepting an offer.'],
            ]);
        }

        $attrs = [
            'stage' => $newStage,
            'stage_updated_at' => now(),
            'stage_updated_by' => $actor->id,
            'ctc_offered' => $movingIntoOffer ? $payload['ctc_offered'] : $application->ctc_offered,
            'notes' => $payload['notes'] ?? $application->notes,
        ];

        if ($newStage === DriveApplication::STAGE_OFFER_ACCEPTED && $application->joining_status === null) {
            $attrs['joining_status'] = 'pending';
        }

        $application->forceFill($attrs)->save();

        if ($newStage === DriveApplication::STAGE_OFFER_ACCEPTED && $application->user) {
            if (($application->user->placement_status ?? User::PLACEMENT_STATUS_SEEKING) === User::PLACEMENT_STATUS_SEEKING) {
                $application->user->forceFill(['placement_status' => User::PLACEMENT_STATUS_PLACED])->save();
            }
        }

        if ($movingIntoOffer) {
            ActivityLog::record(
                $actor,
                $newStage === DriveApplication::STAGE_OFFER_ACCEPTED ? 'Recorded an accepted offer' : 'Recorded an extended offer',
                'DriveApplication',
                $application->user->name,
                ['drive' => $application->placementDrive->title, 'ctc_offered' => $payload['ctc_offered'] ?? null]
            );
        }

        $application = $application->fresh();

        try {
            app(DriveNotifier::class)->applicationMoved($application);
        } catch (Throwable $e) {
            report($e);
        }

        return $application;
    }

    /**
     * Advance multiple non-terminal applications at once inside one transaction.
     *
     * @param  list<int>  $applicationIds
     * @return array{updated: list<DriveApplication>, skipped: int}
     */
    public function bulkTransition(PlacementDrive $drive, array $applicationIds, string $newStage, array $payload, User $actor): array
    {
        $collegeId = (int) $actor->college_id;
        $apps = DriveApplication::where('placement_drive_id', $drive->id)
            ->where('college_id', $collegeId)
            ->whereIn('id', $applicationIds)
            ->with(['user', 'placementDrive'])
            ->get();

        $updated = [];
        $skipped = 0;

        DB::transaction(function () use ($apps, $newStage, $payload, $actor, &$updated, &$skipped) {
            foreach ($apps as $app) {
                if ($app->isTerminal() || $app->stage === $newStage) {
                    $skipped++;
                    continue;
                }
                if ($newStage === DriveApplication::STAGE_OFFER_ACCEPTED && $app->stage !== DriveApplication::STAGE_OFFER_EXTENDED) {
                    $skipped++;
                    continue;
                }

                $updated[] = $this->transition($app, $newStage, $payload, $actor);
            }
        });

        return ['updated' => $updated, 'skipped' => $skipped];
    }

    /**
     * Match uploaded roll numbers or emails from a recruiter's shortlist sheet, register missing students,
     * and move non-terminal applications to the target stage.
     *
     * @param  list<string>  $identifiers
     * @return array{updated: list<DriveApplication>, registered: int, advanced: int, skipped: int, unmatched: list<string>}
     */
    public function importShortlist(PlacementDrive $drive, array $identifiers, string $targetStage, array $payload, User $actor): array
    {
        $collegeId = (int) $actor->college_id;
        $tokens = collect($identifiers)
            ->map(fn ($v) => trim((string) $v))
            ->filter(fn ($v) => $v !== '')
            ->unique(fn ($v) => mb_strtolower($v))
            ->values();

        $students = User::where('college_id', $collegeId)
            ->where('role', User::ROLE_USER)
            ->where('is_blocked', false)
            ->get();

        $byEmail = $students->keyBy(fn (User $u) => mb_strtolower($u->email));
        $byRoll = $students->filter(fn (User $u) => ! empty($u->roll_number))
            ->keyBy(fn (User $u) => mb_strtolower(trim((string) $u->roll_number)));

        $existingApps = DriveApplication::where('placement_drive_id', $drive->id)
            ->where('college_id', $collegeId)
            ->get()
            ->keyBy('user_id');

        $updated = [];
        $registered = 0;
        $advanced = 0;
        $skipped = 0;
        $unmatched = [];

        DB::transaction(function () use ($tokens, $byEmail, $byRoll, $existingApps, $drive, $collegeId, $targetStage, $payload, $actor, &$updated, &$registered, &$advanced, &$skipped, &$unmatched) {
            $seenUserIds = [];

            foreach ($tokens as $raw) {
                $key = mb_strtolower($raw);
                $student = $byEmail->get($key) ?? $byRoll->get($key);

                if (! $student) {
                    $unmatched[] = $raw;
                    continue;
                }
                if (isset($seenUserIds[$student->id])) {
                    continue;
                }
                $seenUserIds[$student->id] = true;

                $app = $existingApps->get($student->id);
                if (! $app) {
                    $app = DriveApplication::create([
                        'placement_drive_id' => $drive->id,
                        'user_id' => $student->id,
                        'college_id' => $collegeId,
                        'stage' => DriveApplication::STAGE_REGISTERED,
                        'stage_updated_at' => now(),
                        'stage_updated_by' => $actor->id,
                    ]);
                    $registered++;
                }

                if ($targetStage === DriveApplication::STAGE_REGISTERED) {
                    $updated[] = $app;
                    continue;
                }

                if ($app->isTerminal() || $app->stage === $targetStage) {
                    $skipped++;
                    continue;
                }
                if ($targetStage === DriveApplication::STAGE_OFFER_ACCEPTED && $app->stage !== DriveApplication::STAGE_OFFER_EXTENDED) {
                    $skipped++;
                    continue;
                }

                $updated[] = $this->transition($app, $targetStage, $payload, $actor);
                $advanced++;
            }
        });

        return [
            'updated' => $updated,
            'registered' => $registered,
            'advanced' => $advanced,
            'skipped' => $skipped,
            'unmatched' => $unmatched,
        ];
    }

    public function updateJoiningStatus(DriveApplication $application, string $joiningStatus, User $actor): DriveApplication
    {
        if ($application->stage !== DriveApplication::STAGE_OFFER_ACCEPTED) {
            throw ValidationException::withMessages([
                'joining_status' => ['Joining status can only be recorded after an offer is accepted.'],
            ]);
        }

        $application->forceFill([
            'joining_status' => $joiningStatus,
            'joined_at' => $joiningStatus === 'joined' ? ($application->joined_at ?? now()) : null,
            'stage_updated_by' => $actor->id,
        ])->save();

        ActivityLog::record(
            $actor,
            "Updated offer joining status to {$joiningStatus}",
            'DriveApplication',
            $application->user?->name ?? 'Student',
            ['drive' => $application->placementDrive?->title]
        );

        return $application->fresh();
    }

    /**
     * Bulk-seeds a `registered` application for every currently-eligible, active (non-blocked)
     * student at this drive's mapped college who satisfies both eligibility criteria and college placement policy.
     */
    public function registerEligible(PlacementDrive $drive, User $actor): int
    {
        $mapping = DriveCollegeMapping::where('placement_drive_id', $drive->id)
            ->where('college_id', $actor->college_id)
            ->where('is_active', true)
            ->firstOrFail();

        $college = College::findOrFail($actor->college_id);
        $eligibility = $mapping->effectiveEligibility();

        $alreadyApplied = DriveApplication::where('placement_drive_id', $drive->id)
            ->where('college_id', $actor->college_id)
            ->pluck('user_id')
            ->all();

        $students = User::where('college_id', $actor->college_id)
            ->where('role', User::ROLE_USER)
            ->where('is_blocked', false)
            ->whereNotIn('id', $alreadyApplied)
            ->get();

        $offerStats = EligibilityService::acceptedOfferStatsForCollege($college->id);

        $registered = 0;
        $registeredIds = [];

        foreach ($students as $student) {
            $stats = $offerStats[$student->id] ?? ['accepted_offers' => 0, 'best_ctc' => 0.0];
            $verdict = EligibilityService::evaluate($student, $eligibility, [
                'college' => $college,
                'accepted_offers' => $stats['accepted_offers'],
                'best_ctc' => $stats['best_ctc'],
            ]);

            if ($verdict['status'] !== 'eligible') {
                continue;
            }

            DriveApplication::create([
                'placement_drive_id' => $drive->id,
                'user_id' => $student->id,
                'college_id' => $actor->college_id,
                'stage' => DriveApplication::STAGE_REGISTERED,
                'stage_updated_at' => now(),
                'stage_updated_by' => $actor->id,
            ]);

            $registered++;
            $registeredIds[] = $student->id;
        }

        try {
            app(DriveNotifier::class)->registered($drive, $registeredIds, $actor);
        } catch (Throwable $e) {
            report($e);
        }

        return $registered;
    }
}
