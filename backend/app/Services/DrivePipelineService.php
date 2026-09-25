<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * The one write path for a drive application's stage — mirrors
 * SubscriptionService/ActivityLog being the one write path for their own
 * state. Deliberately NOT a strict linear FSM (real TPOs skip rounds and
 * backfill outcomes); the only rules enforced are the ones that actually
 * protect record integrity.
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

        $application->forceFill([
            'stage' => $newStage,
            'stage_updated_at' => now(),
            'stage_updated_by' => $actor->id,
            'ctc_offered' => $movingIntoOffer ? $payload['ctc_offered'] : $application->ctc_offered,
            'notes' => $payload['notes'] ?? $application->notes,
        ])->save();

        // A real placement outcome — exactly the class of event this audit
        // trail exists for, same standard AdminController already applies.
        if ($movingIntoOffer) {
            ActivityLog::record(
                $actor,
                $newStage === DriveApplication::STAGE_OFFER_ACCEPTED ? 'Recorded an accepted offer' : 'Recorded an extended offer',
                'DriveApplication',
                $application->user->name,
                ['drive' => $application->placementDrive->title, 'ctc_offered' => $payload['ctc_offered'] ?? null]
            );
        }

        return $application->fresh();
    }

    /**
     * Bulk-seeds a `registered` application for every currently-eligible
     * student at this drive's mapped college who doesn't already have one —
     * reuses the same EligibilityService rule the student-facing banner and
     * TPO reports already use, so "eligible" never means two different
     * things in two different places. Returns the count of new rows.
     */
    public function registerEligible(PlacementDrive $drive, User $actor): int
    {
        $mapping = DriveCollegeMapping::where('placement_drive_id', $drive->id)
            ->where('college_id', $actor->college_id)
            ->where('is_active', true)
            ->firstOrFail();

        $eligibility = $mapping->effectiveEligibility();

        $alreadyApplied = DriveApplication::where('placement_drive_id', $drive->id)
            ->where('college_id', $actor->college_id)
            ->pluck('user_id')
            ->all();

        $students = User::where('college_id', $actor->college_id)
            ->where('role', User::ROLE_USER)
            ->whereNotIn('id', $alreadyApplied)
            ->get();

        $registered = 0;

        foreach ($students as $student) {
            $verdict = EligibilityService::evaluate($student, $eligibility);

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
        }

        return $registered;
    }
}
