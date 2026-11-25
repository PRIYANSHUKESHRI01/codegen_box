<?php

namespace App\Services;

use App\Enums\NotificationType;
use App\Jobs\SendStudentBulkNotification;
use App\Jobs\SendWhatsAppNotification;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Bus;

class StudentBulkNotificationService
{
    /**
     * @param  Collection<int, User>  $recipients
     * @param  string  $batchPrefix
     * @return array{queued_count: int, skipped_no_phone: int}
     */
    public function send(
        Collection $recipients,
        string $channel,
        string $template,
        string $recipient,
        string $batchPrefix,
        ?string $customSubject = null,
        ?string $customMessage = null,
    ): array {
        $subject = $customSubject !== null && trim($customSubject) !== '' ? trim($customSubject) : null;
        $body = $customMessage !== null && trim($customMessage) !== '' ? trim($customMessage) : null;

        if ($recipient !== 'parent') {
            $termination = $template === SendStudentBulkNotification::TEMPLATE_TERMINATION;

            $bellTitle = $termination
                ? 'Placement drive eligibility notice'
                : ($subject ?? 'A message from your placement cell');
            $bellBody = $termination
                ? 'Your placement cell sent you an eligibility notice by '.($channel === 'email' ? 'email' : 'WhatsApp').'. Please contact your TPO.'
                : ($body ?? ('Your placement cell sent you an update by '.($channel === 'email' ? 'email' : 'WhatsApp').'. Check your '.($channel === 'email' ? 'inbox' : 'messages').'.'));

            app(NotificationService::class)->notifyMany($recipients, NotificationType::AnnouncementMessage, $bellTitle, $bellBody, [
                'severity' => $termination ? 'warning' : 'info',
                'group_key' => "announce:{$batchPrefix}:".now()->format('YmdHis'),
            ]);
        }

        if ($channel === 'email') {
            Bus::batch(
                $recipients->map(fn (User $u) => new SendStudentBulkNotification($u->id, $template, $subject, $body))->all()
            )->name($batchPrefix.'-bulk-notify-email-'.now()->timestamp)->dispatch();

            return ['queued_count' => $recipients->count(), 'skipped_no_phone' => 0];
        }

        $jobs = [];
        $skippedNoPhone = 0;

        foreach ($recipients as $student) {
            $phone = $recipient === 'parent' ? $student->parent_phone : $student->phone;

            if (! $phone) {
                $skippedNoPhone++;

                continue;
            }

            $jobs[] = new SendWhatsAppNotification($phone, $this->whatsAppMessage($student, $template, $body));
        }

        if ($jobs !== []) {
            Bus::batch($jobs)->name($batchPrefix.'-bulk-notify-whatsapp-'.now()->timestamp)->dispatch();
        }

        return ['queued_count' => count($jobs), 'skipped_no_phone' => $skippedNoPhone];
    }

    /**
     * @param  Collection<int, User>  $recipients
     */
    public function announce(Collection $recipients, string $title, string $message, string $batchPrefix, ?User $actor = null): int
    {
        return app(NotificationService::class)->notifyMany($recipients, NotificationType::AnnouncementMessage, $title, $message, [
            'actor' => $actor,
            'data' => ['from' => $actor?->name],
            'group_key' => "announce:{$batchPrefix}:".now()->format('YmdHisv'),
        ]);
    }

    private function whatsAppMessage(User $student, string $template, ?string $customMessage = null): string
    {
        $college = $student->college?->name ?? 'your college';

        if ($template === SendStudentBulkNotification::TEMPLATE_TERMINATION) {
            return "Hi {$student->name}, this is a Placement Drive Eligibility Notice from {$college}'s placement cell (via AptRun). Please contact your TPO immediately regarding your placement readiness standing.";
        }

        if ($customMessage !== null) {
            return "Hi {$student->name}, {$customMessage} — {$college} Placement Cell (via AptRun)";
        }

        return "Hi {$student->name}, there is a new update from {$college}'s placement cell on AptRun. Please sign in to check your dashboard.";
    }
}
