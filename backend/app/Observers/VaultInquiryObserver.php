<?php

namespace App\Observers;

use App\Enums\NotificationType;
use App\Models\VaultInquiry;
use App\Models\VaultMessage;
use App\Services\NotificationService;
use App\Support\NotificationAudience;

/**
 * The Vault conversation between a hiring partner and a student, told as it happens — to the student when a company
 * shows interest, invites them to interview, messages them or hires them, and to the company's hiring team when the
 * student answers an invite. Raised from the models' own lifecycle, so it does not matter which controller made it so.
 */
class VaultInquiryObserver
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function created(VaultInquiry $inquiry): void
    {
        $this->toStudent($inquiry, 'A hiring partner is interested in you', '{company} expressed interest in your Vault profile.', 'interest', $inquiry->created_at?->getTimestamp());
    }

    public function updated(VaultInquiry $inquiry): void
    {
        if (! $inquiry->wasChanged('status')) {
            return;
        }

        match ($inquiry->status) {
            VaultInquiry::STATUS_INTERVIEW_SCHEDULED => $inquiry->wasChanged('interview_scheduled_at') || $inquiry->getOriginal('status') !== VaultInquiry::STATUS_INTERVIEW_SCHEDULED
                ? $this->toStudent(
                    $inquiry,
                    'You have an interview invitation',
                    '{company} invited you to interview on '.($inquiry->interview_scheduled_at?->format('j M Y, g:i A') ?? 'a date they will confirm').'. Accept or decline from your Vault.',
                    'invite',
                    $inquiry->interview_scheduled_at?->getTimestamp(),
                    'success'
                )
                : null,
            VaultInquiry::STATUS_HIRED => $this->toStudent($inquiry, 'You have been hired', 'Congratulations — {company} hired you through the Vault.', 'hired', $inquiry->hired_at?->getTimestamp(), 'success'),
            VaultInquiry::STATUS_DECLINED_BY_CANDIDATE => $this->toCompany($inquiry),
            default => null,
        };

        // The student answering an invite without changing status (accepting) still deserves the company hearing it.
        if ($inquiry->wasChanged('responded_at') && $inquiry->responded_at !== null && $inquiry->status === VaultInquiry::STATUS_INTERVIEW_SCHEDULED) {
            $this->toCompany($inquiry, accepted: true);
        }
    }

    public function messageCreated(VaultMessage $message): void
    {
        $inquiry = $message->inquiry;

        if ($inquiry !== null) {
            $this->toStudent($inquiry, 'New message from a hiring partner', '{company} sent you a message. Open your Vault to read it.', "message:{$message->id}", $message->id);
        }
    }

    private function toStudent(VaultInquiry $inquiry, string $title, string $body, string $key, ?int $stamp, string $severity = 'info'): void
    {
        $inquiry->loadMissing('profile', 'company');
        $userId = $inquiry->profile?->user_id;

        if ($userId === null) {
            return;
        }

        $this->notifications->notify($userId, NotificationType::VaultActivity, $title, str_replace('{company}', $inquiry->company?->name ?? 'A hiring partner', $body), [
            'url' => '/dashboard/vault',
            'severity' => $severity,
            'data' => ['inquiry_id' => $inquiry->id],
            'group_key' => "vault.{$key}:{$inquiry->id}:".($stamp ?? 0),
        ]);
    }

    private function toCompany(VaultInquiry $inquiry, bool $accepted = false): void
    {
        $inquiry->loadMissing('profile.user', 'company');

        if ($inquiry->company_id === null) {
            return;
        }

        $name = $inquiry->profile?->user?->name ?? 'A candidate';

        $this->notifications->notifyMany(
            NotificationAudience::companyTeam($inquiry->company_id),
            NotificationType::VaultActivity,
            $accepted ? "{$name} accepted your interview invite" : "{$name} declined your interview invite",
            $accepted ? 'The interview is confirmed for the time you proposed.' : 'You can invite another candidate from the Vault.',
            [
                'url' => '/admin/company/vault',
                'severity' => $accepted ? 'success' : 'warning',
                'data' => ['inquiry_id' => $inquiry->id],
                'group_key' => 'vault.answer:'.$inquiry->id.':'.($accepted ? 'a' : 'd').':'.($inquiry->responded_at?->getTimestamp() ?? 0),
            ]
        );
    }
}
