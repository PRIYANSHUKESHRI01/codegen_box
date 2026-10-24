<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\DriveApplication;
use App\Models\DriveCollegeMapping;
use App\Models\PlacementDrive;
use App\Models\User;
use App\Services\EligibilityService;
use App\Services\NotificationService;
use App\Support\NotificationAudience;

/**
 * Everything a placement drive tells people: students (it is open to you, it moved, it was cancelled, your application
 * advanced), a college's TPOs (a drive was proposed to you) and the proposer (the college answered).
 *
 * Raised from observers (App\Observers\DriveMappingObserver, PlacementDriveObserver) and the two services that own the
 * application pipeline — never from a controller — so every path that makes a drive live for a college is covered,
 * including ones added later.
 */
class DriveNotifier
{
    public function __construct(private readonly NotificationService $notifications) {}

    /**
     * The drive just became open to this college. Tells every student who is eligible — or whose eligibility we can't
     * judge yet (no CGPA/branch on file) — and skips the ones who definitely are not, so the bell never says "new drive"
     * about something they can't apply to. Runs after the response: it looks at every student of the college.
     */
    public function live(DriveCollegeMapping $mapping): void
    {
        $mappingId = $mapping->id;

        $this->notifications->afterResponse(function () use ($mappingId) {
            $mapping = DriveCollegeMapping::with('placementDrive.company')->find($mappingId);

            // The request that raised this may have rolled back, or the college backed out a moment later.
            if ($mapping === null || ! $mapping->is_active || ! $mapping->isApproved() || ! $mapping->placementDrive?->isPublished()) {
                return;
            }

            $drive = $mapping->placementDrive;
            $eligibility = $mapping->effectiveEligibility();
            $eligible = [];
            $unknown = [];

            NotificationAudience::students($mapping->college_id)->where('is_blocked', false)->chunkById(500, function ($students) use ($eligibility, &$eligible, &$unknown) {
                foreach ($students as $student) {
                    match (EligibilityService::evaluate($student, $eligibility)['status']) {
                        'eligible' => $eligible[] = $student->id,
                        'unknown' => $unknown[] = $student->id,
                        default => null,
                    };
                }
            });

            $company = $drive->company?->name ?? 'A company';
            $title = "New drive: {$company}".($drive->role_title ? " — {$drive->role_title}" : '');
            $when = $drive->drive_date ? 'on '.$drive->drive_date->format('j M Y') : 'soon';
            $options = [
                'url' => '/dashboard/drives',
                'data' => ['drive_id' => $drive->id, 'college_id' => $mapping->college_id],
                'group_key' => "drive.live:{$drive->id}:{$mapping->college_id}:".($mapping->mapped_at?->getTimestamp() ?? 0),
                'actor' => $mapping->mapped_by,
            ];

            $this->notifications->notifyMany($eligible, NotificationType::DriveLive, $title, "{$drive->title} is {$when}. You're eligible — open it to prepare and see the rounds.", $options);
            $this->notifications->notifyMany($unknown, NotificationType::DriveLive, $title, "{$drive->title} is {$when}. Check whether you meet the eligibility criteria.", $options);
        });
    }

    /** Students who were attending lose a drive: the college closed it, or the drive itself was cancelled. */
    public function closed(DriveCollegeMapping $mapping, string $why): void
    {
        $mappingId = $mapping->id;

        $this->notifications->afterResponse(function () use ($mappingId, $why) {
            $mapping = DriveCollegeMapping::with('placementDrive.company')->find($mappingId);
            $drive = $mapping?->placementDrive;

            if ($mapping === null || $drive === null) {
                return;
            }

            $company = $drive->company?->name ?? 'A company';

            $this->notifications->notifyMany(
                NotificationAudience::students($mapping->college_id),
                NotificationType::DriveUnmapped,
                "Drive closed: {$company}",
                "{$drive->title} is no longer open to you. {$why}",
                [
                    'url' => '/dashboard/drives',
                    'data' => ['drive_id' => $drive->id],
                    'group_key' => "drive.closed:{$drive->id}:{$mapping->college_id}:".now()->format('YmdHi'),
                ]
            );
        });
    }

    /** The date of a live drive moved. */
    public function rescheduled(DriveCollegeMapping $mapping, PlacementDrive $drive): void
    {
        $mappingId = $mapping->id;
        $date = $drive->drive_date?->format('j M Y');

        if ($date === null) {
            return;
        }

        $this->notifications->afterResponse(function () use ($mappingId, $drive, $date) {
            $mapping = DriveCollegeMapping::find($mappingId);

            if ($mapping === null || ! $mapping->is_active || ! $mapping->isApproved()) {
                return;
            }

            $company = $drive->company?->name ?? 'A company';

            $this->notifications->notifyMany(
                NotificationAudience::students($mapping->college_id),
                NotificationType::DriveStage,
                "Drive rescheduled: {$company}",
                "{$drive->title} is now on {$date}.",
                [
                    'url' => '/dashboard/drives',
                    'data' => ['drive_id' => $drive->id],
                    'severity' => 'warning',
                    'group_key' => "drive.date:{$drive->id}:{$mapping->college_id}:{$date}",
                ]
            );
        });
    }

    /** A student's application moved to a new round, an offer, or a rejection. */
    public function applicationMoved(DriveApplication $application): void
    {
        $drive = $application->placementDrive()->with('company')->first();
        $company = $drive?->company?->name ?? 'the company';
        $label = DriveApplication::stageLabel($application->stage);

        [$title, $body, $severity] = match ($application->stage) {
            DriveApplication::STAGE_OFFER_EXTENDED => ["You have an offer from {$company}", 'The offer is recorded on your application. Congratulations!', 'success'],
            DriveApplication::STAGE_OFFER_ACCEPTED => ["Offer accepted: {$company}", 'Your acceptance is recorded. Congratulations!', 'success'],
            DriveApplication::STAGE_REJECTED => ["Update on your {$company} application", 'You were not selected for this drive. Keep practising — more drives are coming.', 'warning'],
            DriveApplication::STAGE_WITHDRAWN => ["Application withdrawn: {$company}", 'Your application was marked withdrawn.', 'info'],
            default => ["You're through to the next round at {$company}", "Your application is now at: {$label}.", 'info'],
        };

        $this->notifications->notify($application->user_id, NotificationType::DriveStage, $title, $body, [
            'url' => '/dashboard/drives',
            'severity' => $severity,
            'data' => ['drive_id' => $application->placement_drive_id, 'stage' => $application->stage],
            'group_key' => "drive.stage:{$application->id}:{$application->stage}:".($application->stage_updated_at?->getTimestamp() ?? 0),
            'actor' => $application->stage_updated_by,
        ]);
    }

    /** "Register all eligible students" put these students into the pipeline. @param  list<int>  $studentIds */
    public function registered(PlacementDrive $drive, array $studentIds, User $actor): void
    {
        $drive->loadMissing('company');
        $company = $drive->company?->name ?? 'a company';

        $this->notifications->notifyMany($studentIds, NotificationType::DriveRegistered, "You're registered for the {$company} drive", "Your placement cell registered you for {$drive->title}. Watch here for each round.", [
            'url' => '/dashboard/drives',
            'data' => ['drive_id' => $drive->id],
            'group_key' => "drive.registered:{$drive->id}",
            'actor' => $actor,
        ]);
    }

    /** A drive was proposed to a college: its TPOs need to approve or decline it. */
    public function proposed(DriveCollegeMapping $mapping): void
    {
        $mapping->loadMissing('placementDrive.company', 'mappedBy');
        $drive = $mapping->placementDrive;
        $from = $mapping->mappedBy?->role === User::ROLE_ADMIN_COMPANY ? ($drive->company?->name ?? 'A hiring partner') : 'Mellow';

        $this->notifications->notifyMany(NotificationAudience::tpos($mapping->college_id), NotificationType::DriveProposal, "{$from} proposed a drive to your college", "{$drive->title}".($drive->drive_date ? ' · '.$drive->drive_date->format('j M Y') : '').'. Approve it to open it to your students, or decline.', [
            'url' => '/admin/drives',
            'data' => ['drive_id' => $drive->id],
            'group_key' => "drive.proposal:{$drive->id}:{$mapping->college_id}:".($mapping->mapped_at?->getTimestamp() ?? 0),
            'actor' => $mapping->mapped_by,
        ]);
    }

    /** The college answered the proposal: tell whoever sent it, and the company's hiring team. */
    public function proposalAnswered(DriveCollegeMapping $mapping, bool $approved): void
    {
        $mapping->loadMissing('placementDrive.company', 'college', 'mappedBy');
        $drive = $mapping->placementDrive;
        $college = $mapping->college?->name ?? 'A college';
        $verb = $approved ? 'approved' : 'declined';

        $proposer = $mapping->mappedBy;
        $url = $proposer?->role === User::ROLE_ADMIN_COMPANY ? '/admin/company/drives' : '/admin/placements';

        $recipients = collect([$proposer?->id])->filter();
        if ($drive->company_id !== null && $proposer?->role === User::ROLE_ADMIN_COMPANY) {
            $recipients = $recipients->merge(NotificationAudience::companyTeam($drive->company_id)->pluck('id'));
        }

        $this->notifications->notifyMany($recipients->unique()->values()->all(), NotificationType::DriveProposalResponse, "{$college} {$verb} your drive", "{$drive->title} — {$college} has {$verb} the proposal.", [
            'url' => $url,
            'severity' => $approved ? 'success' : 'warning',
            'data' => ['drive_id' => $drive->id, 'college_id' => $mapping->college_id],
            'group_key' => "drive.answered:{$drive->id}:{$mapping->college_id}:{$verb}:".now()->format('YmdHi'),
        ]);
    }
}
