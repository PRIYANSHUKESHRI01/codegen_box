<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\Hackathon;
use App\Models\HackathonAnnouncement;
use App\Services\NotificationService;
use App\Support\NotificationAudience;

/**
 * Hackathons tell students three things: one is open to you, something changed for one you joined (an announcement, a
 * cancellation), and the results are out. Raised by App\Observers\HackathonObserver / HackathonAnnouncementObserver, so
 * the platform's admin console and a hiring partner's both go through the same code.
 */
class HackathonNotifier
{
    public function __construct(private readonly NotificationService $notifications) {}

    /** Published: everyone it is open to hears about it — after the response, since "open to all" is every student. */
    public function published(Hackathon $hackathon): void
    {
        $id = $hackathon->id;

        $this->notifications->afterResponse(function () use ($id) {
            $h = Hackathon::with('company')->find($id);

            if ($h === null || ! $h->isPublished()) {
                return;
            }

            $audience = $h->audience === Hackathon::AUDIENCE_COLLEGES
                ? NotificationAudience::studentsOfColleges($h->colleges()->pluck('colleges.id')->all())
                : NotificationAudience::allStudents();

            $host = $h->host_type === Hackathon::HOST_COMPANY && $h->company !== null ? $h->company->name : 'AptRun';
            $closes = $h->registration_closes_at ?? $h->starts_at;

            $this->notifications->notifyMany($audience, NotificationType::HackathonPublished, "New hackathon: {$h->title}", "Hosted by {$host}".($closes ? ". Register by {$closes->format('j M Y')}." : '.').($h->tagline ? " {$h->tagline}" : ''), [
                'url' => $this->url($h),
                'data' => ['hackathon_id' => $h->id, 'slug' => $h->slug],
                'group_key' => "hackathon.published:{$h->id}",
            ]);
        });
    }

    /** Cancelled: whoever had registered. */
    public function cancelled(Hackathon $hackathon): void
    {
        $reason = $hackathon->cancelled_reason ? " Reason: {$hackathon->cancelled_reason}" : '';

        $this->notifications->notifyMany($this->participantIds($hackathon), NotificationType::HackathonCancelled, "Hackathon cancelled: {$hackathon->title}", "The organiser cancelled it.{$reason}", [
            'url' => $this->url($hackathon),
            'data' => ['hackathon_id' => $hackathon->id],
            'group_key' => "hackathon.cancelled:{$hackathon->id}",
        ]);
    }

    /** The organiser posted an update. */
    public function announced(HackathonAnnouncement $announcement): void
    {
        $hackathon = $announcement->hackathon;

        if ($hackathon === null) {
            return;
        }

        $this->notifications->notifyMany($this->participantIds($hackathon), NotificationType::HackathonAnnouncement, "{$hackathon->title}: {$announcement->title}", $announcement->body, [
            'url' => $this->url($hackathon, 'updates'),
            'data' => ['hackathon_id' => $hackathon->id, 'announcement_id' => $announcement->id],
            'group_key' => "hackathon.announcement:{$announcement->id}",
            'actor' => $announcement->author_id,
        ]);
    }

    /** Results published. */
    public function resultsOut(Hackathon $hackathon): void
    {
        $this->notifications->notifyMany($this->participantIds($hackathon), NotificationType::HackathonAnnouncement, "Results are out: {$hackathon->title}", 'See where you and your team placed on the leaderboard.', [
            'url' => $this->url($hackathon, 'results'),
            'severity' => 'success',
            'data' => ['hackathon_id' => $hackathon->id],
            'group_key' => "hackathon.results:{$hackathon->id}",
        ]);
    }

    /** @return list<int> */
    private function participantIds(Hackathon $hackathon): array
    {
        return $hackathon->participants()->pluck('user_id')->all();
    }

    private function url(Hackathon $hackathon, ?string $tab = null): string
    {
        return '/arena/hackathon?slug='.rawurlencode($hackathon->slug).($tab ? "&tab={$tab}" : '');
    }
}
