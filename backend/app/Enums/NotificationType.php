<?php

namespace App\Enums;

/**
 * Every kind of in-app notification the platform can raise. One place so that a type can never be sent without
 * a category (what the person can mute) and a default severity (how the bell draws it).
 *
 * To add one: add a case here, give it a category and severity below, and call
 * App\Services\NotificationService from the one place that makes the event true. The frontend needs no change —
 * it draws any type from the payload's category/severity/title/body/url (and a type's icon falls back to its
 * category's).
 *
 * Where each one is raised:
 *   drive.*                      DriveNotifier (TpoDriveController, DrivePipelineService, DriveCollegeProposalService)
 *   hackathon.*                  HackathonNotifier (Admin/CompanyHackathonController)
 *   assessment.scheduled         AssessmentNotifier (the TPO / Mellow / company contest, interview, soft-skill and core-test controllers)
 *   plan.changed, payment.*      PlanNotifier (SubscriptionService, CheckoutService, the payment webhooks)
 *   account.password_changed     LifecycleMailService::passwordChanged
 *   vault.activity               the Vault interest / interview / offer services
 *   readiness.slip               ReadinessHistoryService::nudge (the refresh, on a student's 1st / 3rd / 7th idle day)
 *   announcement.message         StudentBulkNotificationService (TPO / coordinator → students)
 *   import.completed             ProcessStudentImportJob / ProcessCandidateImportJob
 *   lead.new, payment.received   ContactRequestService / LeadAssignmentService / PlanNotifier (staff)
 */
enum NotificationType: string
{
    case DriveLive = 'drive.live';
    case DriveRegistered = 'drive.registered';
    case DriveStage = 'drive.stage';
    case DriveUnmapped = 'drive.unmapped';
    case DriveProposal = 'drive.proposal';
    case DriveProposalResponse = 'drive.proposal_response';

    case HackathonPublished = 'hackathon.published';
    case HackathonAnnouncement = 'hackathon.announcement';
    case HackathonCancelled = 'hackathon.cancelled';

    case AssessmentScheduled = 'assessment.scheduled';

    case AnnouncementMessage = 'announcement.message';

    case VaultActivity = 'vault.activity';

    case ReadinessSlip = 'readiness.slip';

    case PlanChanged = 'plan.changed';
    case PaymentSucceeded = 'payment.succeeded';
    case PaymentFailed = 'payment.failed';
    case PaymentRefunded = 'payment.refunded';

    case PasswordChanged = 'account.password_changed';

    case ImportCompleted = 'import.completed';
    case LeadNew = 'lead.new';
    case PaymentReceived = 'payment.received';

    public function category(): NotificationCategory
    {
        return match ($this) {
            self::DriveLive, self::DriveRegistered, self::DriveStage, self::DriveUnmapped, self::DriveProposal, self::DriveProposalResponse => NotificationCategory::Drives,
            self::HackathonPublished, self::HackathonAnnouncement, self::HackathonCancelled => NotificationCategory::Hackathons,
            self::AssessmentScheduled => NotificationCategory::Assessments,
            self::AnnouncementMessage => NotificationCategory::Announcements,
            self::VaultActivity => NotificationCategory::Vault,
            self::ReadinessSlip => NotificationCategory::Progress,
            self::PlanChanged, self::PaymentSucceeded, self::PaymentFailed, self::PaymentRefunded => NotificationCategory::Plan,
            self::PasswordChanged => NotificationCategory::Account,
            self::ImportCompleted, self::LeadNew, self::PaymentReceived => NotificationCategory::Operations,
        };
    }

    /** How the bell draws it unless the caller says otherwise: info (blue), success (green), warning (amber), critical (red). */
    public function severity(): string
    {
        return match ($this) {
            self::DriveLive, self::PaymentSucceeded, self::PaymentReceived, self::ImportCompleted => 'success',
            self::DriveUnmapped, self::HackathonCancelled, self::PaymentFailed, self::PasswordChanged => 'warning',
            default => 'info',
        };
    }

    public function mandatory(): bool
    {
        return $this->category()->mandatory();
    }
}
