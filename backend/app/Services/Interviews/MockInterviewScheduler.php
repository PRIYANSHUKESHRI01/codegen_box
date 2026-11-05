<?php

namespace App\Services\Interviews;

use App\Enums\NotificationType;
use App\Jobs\SendMockInterviewMail;
use App\Models\Interview;
use App\Models\InterviewSession;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Bus;

/**
 * Telling students about a college's scheduled mock AI interview — and nudging the ones who have not done it.
 *
 *   announce()         the interview was published, or its window / audience was changed and the TPO chose to tell people:
 *                      one e-mail per student in the audience (queued, rate-limited) and, for a change, an in-app note.
 *                      (The very first in-app note on publish comes from AssessmentNotifier, so students are never told twice.)
 *   sendDueReminders() run every ten minutes by `interviews:remind`: "opens in about an hour" once the window is near, and
 *                      "closes soon" to the students who have not finished, once the deadline is near.
 *
 * Both are idempotent per schedule: the reminder columns on the interview record that a reminder went out, and changing the
 * window clears them so the new times are reminded about again.
 */
class MockInterviewScheduler
{
    /** How long before it opens the "starting soon" reminder goes out. */
    public const OPEN_REMINDER_LEAD_MINUTES = 60;

    /** How long before it closes the "last chance" reminder goes out. */
    public const CLOSE_REMINDER_LEAD_HOURS = 3;

    public function __construct(
        private readonly InterviewAudience $audience,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @param  bool  $changed  true when this is a change to something students already knew about (adds an in-app note)
     * @return array{recipients: int, emailed: int}
     */
    public function announce(Interview $interview, bool $changed = false): array
    {
        $students = $this->recipients($interview);

        if ($students->isEmpty()) {
            $interview->forceFill(['announced_at' => now()])->saveQuietly();

            return ['recipients' => 0, 'emailed' => 0];
        }

        if ($changed) {
            $this->notifications->notifyMany($students->pluck('id')->all(), NotificationType::AssessmentScheduled, "Updated: {$interview->title}", $this->when($interview), [
                'url' => '/dashboard/interviews',
                'data' => ['kind' => 'AI mock interview', 'id' => $interview->id],
                'group_key' => "mock-interview:{$interview->id}:changed:".now()->format('YmdHis'),
            ]);
        }

        $this->mail($interview, $students->pluck('id')->all(), $changed ? SendMockInterviewMail::KIND_CHANGED : SendMockInterviewMail::KIND_SCHEDULED);

        // A new schedule is reminded about afresh.
        $interview->forceFill(['announced_at' => now(), 'open_reminder_sent_at' => null, 'close_reminder_sent_at' => null])->saveQuietly();

        return ['recipients' => $students->count(), 'emailed' => $students->count()];
    }

    /**
     * @return array{opening: int, closing: int}  how many students each reminder went to
     */
    public function sendDueReminders(): array
    {
        $out = ['opening' => 0, 'closing' => 0];
        $now = now();

        $interviews = Interview::query()
            ->where('interview_type', Interview::INTERVIEW_TYPE_TPO_MOCK)
            ->where('status', Interview::STATUS_PUBLISHED)
            ->whereNull('interview_track_id')
            ->where(fn ($q) => $q->whereNotNull('opens_at')->orWhereNotNull('closes_at'))
            ->where(fn ($q) => $q->whereNull('closes_at')->orWhere('closes_at', '>', $now))
            ->get();

        foreach ($interviews as $interview) {
            // "Opens soon": inside the lead window and not opened yet.
            if ($interview->opens_at !== null && $interview->open_reminder_sent_at === null
                && $now->gte($interview->opens_at->copy()->subMinutes(self::OPEN_REMINDER_LEAD_MINUTES)) && $now->lt($interview->opens_at)) {
                $ids = $this->recipients($interview)->pluck('id')->all();
                $this->mail($interview, $ids, SendMockInterviewMail::KIND_OPENING_SOON);
                $this->notifications->notifyMany($ids, NotificationType::AssessmentScheduled, "Starting soon: {$interview->title}", $this->when($interview), [
                    'url' => '/dashboard/interviews',
                    'data' => ['kind' => 'AI mock interview', 'id' => $interview->id],
                    'group_key' => "mock-interview:{$interview->id}:opening:".$interview->opens_at->timestamp,
                ]);
                $interview->forceFill(['open_reminder_sent_at' => $now])->saveQuietly();
                $out['opening'] += count($ids);
            }

            // "Closes soon": only for the students who have not finished it.
            if ($interview->closes_at !== null && $interview->close_reminder_sent_at === null
                && $now->gte($interview->closes_at->copy()->subHours(self::CLOSE_REMINDER_LEAD_HOURS)) && $now->lt($interview->closes_at)
                && ($interview->opens_at === null || $now->gte($interview->opens_at))) {
                $done = InterviewSession::query()->where('interview_id', $interview->id)->where('status', InterviewSession::STATUS_COMPLETED)->pluck('user_id')->flip();
                $ids = $this->recipients($interview)->reject(fn (User $u) => $done->has($u->id))->pluck('id')->all();
                $this->mail($interview, $ids, SendMockInterviewMail::KIND_CLOSING_SOON);
                $this->notifications->notifyMany($ids, NotificationType::AssessmentScheduled, "Closing soon: {$interview->title}", 'Closes '.$interview->closes_at->timezone(config('app.display_timezone', 'Asia/Kolkata'))->format('j M, g:i A').' (IST). You have not finished it yet.', [
                    'url' => '/dashboard/interviews',
                    'severity' => 'warning',
                    'data' => ['kind' => 'AI mock interview', 'id' => $interview->id],
                    'group_key' => "mock-interview:{$interview->id}:closing:".$interview->closes_at->timestamp,
                ]);
                $interview->forceFill(['close_reminder_sent_at' => $now])->saveQuietly();
                $out['closing'] += count($ids);
            }
        }

        return $out;
    }

    /** Students who can actually be written to: in the audience, not blocked. */
    private function recipients(Interview $interview)
    {
        return $this->audience->students($interview)->reject(fn (User $u) => $u->is_blocked)->values();
    }

    /** @param  list<int>  $userIds */
    private function mail(Interview $interview, array $userIds, string $kind): void
    {
        if ($userIds === []) {
            return;
        }

        Bus::batch(array_map(fn (int $id) => new SendMockInterviewMail($id, $interview->id, $kind), $userIds))
            ->name("mock-interview-{$interview->id}-{$kind}-".now()->timestamp)
            ->dispatch();
    }

    private function when(Interview $interview): string
    {
        $tz = config('app.display_timezone', 'Asia/Kolkata');
        $fmt = fn ($d) => $d->timezone($tz)->format('j M Y, g:i A');

        return match (true) {
            $interview->opens_at !== null && $interview->closes_at !== null => 'Open '.$fmt($interview->opens_at).' to '.$fmt($interview->closes_at).' (IST).',
            $interview->opens_at !== null => 'Opens '.$fmt($interview->opens_at).' (IST).',
            $interview->closes_at !== null => 'Closes '.$fmt($interview->closes_at).' (IST).',
            default => 'Open it to see the details.',
        };
    }
}
