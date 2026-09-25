<?php

namespace App\Services;

use App\Jobs\SendStudentBulkNotification;
use App\Jobs\SendWhatsAppNotification;
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

    private function whatsAppMessage(User $student, string $template): string
    {
        $college = $student->college?->name ?? 'your college';

        return $template === SendStudentBulkNotification::TEMPLATE_TERMINATION
            ? "Hi {$student->name}, this is a placeholder Placement Drive Eligibility Notice from {$college}'s placement cell (via CodeGen Box). Please contact your TPO immediately regarding your placement readiness standing."
            : "Hi {$student->name}, this is a placeholder update from {$college}'s placement cell (via CodeGen Box). A real message will follow from your TPO.";
    }
}
