<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\Contest;
use App\Models\CoreTest;
use App\Models\DriveCollegeMapping;
use App\Models\Interview;
use App\Models\InterviewTrack;
use App\Models\SoftSkillAssessment;
use App\Services\NotificationService;
use App\Support\NotificationAudience;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * "A test, contest or interview was scheduled for you." Raised by App\Observers\PublishedAssessmentObserver the moment
 * one of these becomes `published` — whoever published it (a TPO, Mellow staff, a hiring partner) and through whichever
 * controller — so the audience is decided here, once, from what the thing is:
 *
 *   tpo_mock          the owning college's students
 *   company           the students of the colleges it was targeted at, where the drive is still live for them
 *   general contest   every student (a rated, scheduled round) — the only platform-wide type that is an EVENT
 *
 * Deliberately NOT announced: library content (general interviews, soft-skill sets, core papers — Mellow adds these in bulk
 * and they are not events), daily practice contests (one every day), a hiring partner's private candidate assessments
 * (those go through candidate invites) and the retired talent-pool type.
 */
class AssessmentNotifier
{
    public function __construct(private readonly NotificationService $notifications) {}

    public function published(Model $assessment): void
    {
        $plan = $this->plan($assessment);

        if ($plan === null) {
            return;
        }

        [$kind, $url, $audience, $when] = $plan;
        $id = $assessment->getKey();
        $class = class_basename($assessment);
        $title = "New {$kind}: {$assessment->title}";
        $body = $when !== null ? "Opens {$when}. Open it to see the details." : 'Open it to see the details and start when you are ready.';

        $send = fn () => $this->notifications->notifyMany($audience(), NotificationType::AssessmentScheduled, $title, $body, [
            'url' => $url,
            'data' => ['kind' => $kind, 'id' => $id],
            'group_key' => "assessment.published:{$class}:{$id}",
        ]);

        // A platform-wide contest reaches every student: don't hold the publisher's click for it.
        $assessment instanceof Contest && $assessment->contest_type === Contest::CONTEST_TYPE_GENERAL
            ? $this->notifications->afterResponse($send)
            : $send();
    }

    /** @return array{0: string, 1: string, 2: \Closure(): Builder, 3: ?string}|null [kind, url, audience, when] */
    private function plan(Model $m): ?array
    {
        return match (true) {
            $m instanceof Contest => match ($m->contest_type) {
                Contest::CONTEST_TYPE_TPO_MOCK => $this->forCollege($m, 'mock contest', '/dashboard/contests', $this->when($m->start_at)),
                Contest::CONTEST_TYPE_COMPANY => $this->forMappedColleges($m, 'company contest', '/dashboard/contests', $this->when($m->start_at)),
                Contest::CONTEST_TYPE_GENERAL => ['contest', '/dashboard/contests', fn () => NotificationAudience::allStudents(), $this->when($m->start_at)],
                default => null,
            },
            $m instanceof Interview => match ($m->interview_type) {
                Interview::INTERVIEW_TYPE_TPO_MOCK => $this->forCollege($m, 'AI mock interview', '/dashboard/interviews', null),
                Interview::INTERVIEW_TYPE_COMPANY => $this->forMappedColleges($m, 'company interview', '/dashboard/interviews', null),
                default => null,
            },
            $m instanceof SoftSkillAssessment => $m->owning_college_id !== null && $m->assessment_type === SoftSkillAssessment::TYPE_TPO_MOCK
                ? $this->forCollege($m, 'soft-skills assessment', '/dashboard/soft-skills', null)
                : null,
            $m instanceof CoreTest => $m->test_type === CoreTest::TYPE_TPO_MOCK ? $this->forCollege($m, 'core test', '/dashboard/core', null) : null,
            $m instanceof InterviewTrack => $m->track_type === InterviewTrack::TRACK_TYPE_TPO_MOCK ? $this->forCollege($m, 'interview track', '/dashboard/interview-tracks', null) : null,
            default => null,
        };
    }

    private function forCollege(Model $m, string $kind, string $url, ?string $when): ?array
    {
        $collegeId = $m->owning_college_id;

        return $collegeId === null ? null : [$kind, $url, fn () => NotificationAudience::students($collegeId), $when];
    }

    /** A company's contest/interview: the colleges it was targeted at, where the drive is still live. */
    private function forMappedColleges(Model $m, string $kind, string $url, ?string $when): ?array
    {
        if ($m->placement_drive_id === null) {
            return null;
        }

        return [$kind, $url, function () use ($m) {
            $targeted = $m->colleges()->pluck('colleges.id');
            $live = DriveCollegeMapping::query()
                ->where('placement_drive_id', $m->placement_drive_id)
                ->whereIn('college_id', $targeted)
                ->where('status', DriveCollegeMapping::STATUS_APPROVED)
                ->where('is_active', true)
                ->pluck('college_id')
                ->all();

            return NotificationAudience::studentsOfColleges($live);
        }, $when];
    }

    private function when(mixed $at): ?string
    {
        return $at?->format('j M Y, g:i A');
    }
}
