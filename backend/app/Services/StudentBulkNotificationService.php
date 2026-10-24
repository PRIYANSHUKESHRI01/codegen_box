<?php

namespace App\Services;

use App\Jobs\SendStudentBulkNotification;
use App\Jobs\SendWhatsAppNotification;
use App\Enums\NotificationType;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Bus;

/**
 * Fans a notification (email or WhatsApp; a generic check-in or a formal
 * termination-notice template) out to a caller-chosen set of students —
 * extracted out of TpoStudentController::bulkNotify so the Section
 * Coordinator's section-scoped notify action dispatches through the exact
 * same job/rate-limit shape instead of a second copy that could drift.
 * Callers are responsible for their own recipient scoping (college, college
 * + section, etc.) and for the two validation-shaped guards this never had
 * to know about (empty recipient set, parent+email combo) — this only ever
 * runs once a valid, non-empty send is confirmed.
 */
class StudentBulkNotificationService
{
    /**
     * @param  Collection<int, User>  $recipients
     * @param  string  $batchPrefix  Distinguishes batches per caller/scope in the queue dashboard (e.g. "tpo-12" or "coordinator-45").
     * @return array{queued_count: int, skipped_no_phone: int}
     */
    public function send(Collection $recipients, string $channel, string $template, string $recipient, string $batchPrefix): array
    {
        // The in-app twin of what goes out by e-mail/WhatsApp, so the student finds it in the bell as well. Only when the
        // message is for the student themself — a note to their parent is not the student's notification.
        if ($recipient !== 'parent') {
            $termination = $template === SendStudentBulkNotification::TEMPLATE_TERMINATION;

            app(NotificationService::class)->notifyMany($recipients, NotificationType::AnnouncementMessage, $termination ? 'Placement drive eligibility notice' : 'A message from your placement cell', $termination
                ? 'Your placement cell sent you an eligibility notice by '.($channel === 'email' ? 'email' : 'WhatsApp').'. Please contact your TPO.'
                : 'Your placement cell sent you an update by '.($channel === 'email' ? 'email' : 'WhatsApp').'. Check your '.($channel === 'email' ? 'inbox' : 'messages').'.', [
                    'severity' => $termination ? 'warning' : 'info',
                    'group_key' => "announce:{$batchPrefix}:".now()->format('YmdHis'),
                ]);
        }

        if ($channel === 'email') {
            Bus::batch(
                $recipients->map(fn (User $u) => new SendStudentBulkNotification($u->id, $template))->all()
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

            $jobs[] = new SendWhatsAppNotification($phone, $this->whatsAppMessage($student, $template));
        }

        if ($jobs !== []) {
            Bus::batch($jobs)->name($batchPrefix.'-bulk-notify-whatsapp-'.now()->timestamp)->dispatch();
        }

        return ['queued_count' => count($jobs), 'skipped_no_phone' => $skippedNoPhone];
    }

    /**
     * A message the sender wrote, delivered straight to each student's notification bell — no e-mail, no WhatsApp, no
     * provider and no cost. The title and message are the sender's own words, shown as text (never HTML).
     *
     * @param  Collection<int, User>  $recipients
     * @return int how many students it reached (blocked accounts are skipped)
     */
    public function announce(Collection $recipients, string $title, string $message, string $batchPrefix, ?User $actor = null): int
    {
        return app(NotificationService::class)->notifyMany($recipients, NotificationType::AnnouncementMessage, $title, $message, [
            'actor' => $actor,
            'data' => ['from' => $actor?->name],
            'group_key' => "announce:{$batchPrefix}:".now()->format('YmdHisv'),
        ]);
    }

    private function whatsAppMessage(User $student, string $template): string
    {
        $college = $student->college?->name ?? 'your college';

        return $template === SendStudentBulkNotification::TEMPLATE_TERMINATION
            ? "Hi {$student->name}, this is a placeholder Placement Drive Eligibility Notice from {$college}'s placement cell (via AptRun). Please contact your TPO immediately regarding your placement readiness standing."
            : "Hi {$student->name}, this is a placeholder update from {$college}'s placement cell (via AptRun). A real message will follow from your TPO.";
    }
}
