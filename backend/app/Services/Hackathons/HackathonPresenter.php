<?php

namespace App\Services\Hackathons;

use App\Models\Hackathon;
use App\Models\HackathonAnnouncement;
use App\Models\HackathonParticipant;
use App\Models\HackathonSubmission;
use App\Models\HackathonTeam;
use App\Models\User;
use Carbon\CarbonInterface;

/**
 * The one place that decides what each audience gets to see of a hackathon.
 *
 * Students never see a score, rank, feedback or disqualification until the
 * host publishes the results; the public gallery only opens once the deadline
 * has passed (so nobody can copy a rival's work mid-event) and never lists a
 * draft or a disqualified entry. Keeping those rules in one class — instead of
 * re-deriving them in each controller — is what makes it safe to add another
 * endpoint without leaking a field.
 *
 * Callers should eager-load `company` and `withCount(['participants', 'teams'])`
 * for lists; the presenter falls back to a query when a count is missing, but
 * that is one query per row.
 */
class HackathonPresenter
{
    public function __construct(private readonly HackathonSubmissionService $submissions) {}

    // ───────────────────────────── audience: students ─────────────────────────────

    /** The summary used by every list and tile. `$mine` is the viewer's own registration (with team.submission loaded), if any. */
    public function card(Hackathon $h, ?HackathonParticipant $mine = null): array
    {
        $count = $this->participantCount($h);

        return [
            'id' => $h->id,
            'slug' => $h->slug,
            'title' => $h->title,
            'tagline' => $h->tagline,
            'cover_url' => $h->coverUrl(),
            'accent' => $h->accent,
            'themes' => $h->themes ?? [],
            'mode' => $h->mode,
            'location' => $h->location,
            'host' => $this->host($h),
            'status' => $h->status,
            'phase' => $h->phase(),
            'is_featured' => $h->is_featured,
            // 'all' or 'colleges'. A student only ever receives a 'colleges' hackathon when their own college is mapped,
            // so for them this simply means "exclusive to your college"; which other colleges are mapped is host-only.
            'audience' => $h->audience,
            'registration_opens_at' => $h->registration_opens_at->toIso8601String(),
            'registration_closes_at' => $h->registration_closes_at->toIso8601String(),
            'starts_at' => $h->starts_at->toIso8601String(),
            'ends_at' => $h->ends_at->toIso8601String(),
            'results_published_at' => $h->results_published_at?->toIso8601String(),
            'prize_pool' => ['amount' => $h->prize_pool_amount, 'currency' => $h->currency],
            'team_size' => ['min' => $h->min_team_size, 'max' => $h->max_team_size],
            'participants_count' => $count,
            'teams_count' => (int) ($h->teams_count ?? $h->teams()->count()),
            'max_participants' => $h->max_participants,
            'spots_left' => $h->max_participants === null ? null : max(0, $h->max_participants - $count),
            'registration_open' => $this->registrationState($h, $mine, $count) === 'open',
            'mine' => $mine ? $this->mine($h, $mine) : null,
        ];
    }

    /**
     * The full hackathon page.
     *
     * @param  HackathonParticipant|null  $mine  the viewer's registration, with team.participants.user and team.submission loaded
     */
    public function detail(Hackathon $h, ?User $viewer, ?HackathonParticipant $mine, bool $canManage): array
    {
        $count = $this->participantCount($h);
        $state = $this->registrationState($h, $mine, $count);

        return $this->card($h, $mine) + [
            'description' => $h->description,
            'rules' => $h->rules,
            'eligibility' => $h->eligibility,
            'prizes' => array_values($h->prizes ?? []),
            'tracks' => array_values($h->tracks ?? []),
            'criteria' => $h->effectiveCriteria(),
            'faqs' => array_values($h->faqs ?? []),
            'resources' => array_values($h->resources ?? []),
            'timeline' => $this->timeline($h),
            'registration' => [
                'state' => $state,
                'can_register' => $state === 'open' && $viewer?->isStudent() === true,
                'allows_teams' => $h->allowsTeams(),
                'team_required' => $h->min_team_size > 1,
            ],
            'submission_access' => $this->submissions->editability($h, $mine),
            'my_team' => $mine ? $this->team($h, $mine, $viewer) : null,
            'my_submission' => $mine?->team?->submission ? $this->ownProject($h, $mine->team->submission) : null,
            'announcements' => $h->announcements()->with('author:id,name')->limit(20)->get()
                ->map(fn (HackathonAnnouncement $a) => $this->announcement($a))->all(),
            'gallery_open' => $this->galleryIsOpen($h),
            'results_published' => $h->resultsArePublished(),
            'podium' => $h->resultsArePublished() ? $this->podium($h) : [],
            'viewer' => [
                'role' => $viewer?->role,
                'is_student' => $viewer?->isStudent() === true,
                'can_manage' => $canManage,
                'is_preview' => $viewer !== null && ! $viewer->isStudent(),
            ],
        ];
    }

    /** Whether a student can sign up right now: open | full | not_open | closed | registered | unavailable. */
    public function registrationState(Hackathon $h, ?HackathonParticipant $mine, ?int $count = null): string
    {
        if ($mine !== null) {
            return 'registered';
        }

        if (! $h->isPublished()) {
            return 'unavailable';
        }

        $now = now();

        if ($now->lt($h->registration_opens_at)) {
            return 'not_open';
        }

        if (! $h->isRegistrationWindowOpen($now)) {
            return 'closed';
        }

        $count ??= $this->participantCount($h);

        return $h->max_participants !== null && $count >= $h->max_participants ? 'full' : 'open';
    }

    /** The public project gallery opens once the deadline has passed. */
    public function galleryIsOpen(Hackathon $h): bool
    {
        return $h->isPublished() && $h->hasEnded();
    }

    /**
     * A project as other students see it in the gallery and results. Score and rank appear only
     * once results are published.
     */
    public function publicProject(Hackathon $h, HackathonSubmission $s): array
    {
        $published = $h->resultsArePublished();

        return [
            'id' => $s->id,
            'title' => $s->title,
            'tagline' => $s->tagline,
            'description' => $s->description,
            'track' => $s->track,
            'repo_url' => $s->repo_url,
            'demo_url' => $s->demo_url,
            'video_url' => $s->video_url,
            'tech_stack' => $s->tech_stack ?? [],
            'submitted_at' => $s->submitted_at?->toIso8601String(),
            'team' => $this->teamSummary($s->team),
            'rank' => $published ? $s->rank : null,
            'award_label' => $published ? $s->award_label : null,
            'score' => $published && $s->final_score !== null ? (float) $s->final_score : null,
        ];
    }

    public function announcement(HackathonAnnouncement $a): array
    {
        return [
            'id' => $a->id,
            'title' => $a->title,
            'body' => $a->body,
            'author' => $a->author?->name,
            'created_at' => $a->created_at->toIso8601String(),
        ];
    }

    // ───────────────────────────── audience: hosts ─────────────────────────────

    /** A row in a host's hackathon list. Expects withCount participants, teams and the two submission counts below. */
    public function hostRow(Hackathon $h): array
    {
        return [
            'id' => $h->id,
            'slug' => $h->slug,
            'title' => $h->title,
            'tagline' => $h->tagline,
            'cover_url' => $h->coverUrl(),
            'accent' => $h->accent,
            'status' => $h->status,
            'phase' => $h->phase(),
            'host' => $this->host($h),
            'mode' => $h->mode,
            'is_featured' => $h->is_featured,
            'audience' => $h->audience,
            'college_count' => $h->isOpenToAll() ? 0 : (int) ($h->colleges_count ?? $h->colleges()->count()),
            'registration_opens_at' => $h->registration_opens_at->toIso8601String(),
            'registration_closes_at' => $h->registration_closes_at->toIso8601String(),
            'starts_at' => $h->starts_at->toIso8601String(),
            'ends_at' => $h->ends_at->toIso8601String(),
            'results_published_at' => $h->results_published_at?->toIso8601String(),
            'participants_count' => (int) ($h->participants_count ?? 0),
            'teams_count' => (int) ($h->teams_count ?? 0),
            'submitted_count' => (int) ($h->submitted_count ?? 0),
            'unscored_count' => (int) ($h->unscored_count ?? 0),
            'max_participants' => $h->max_participants,
            'prize_pool' => ['amount' => $h->prize_pool_amount, 'currency' => $h->currency],
        ];
    }

    /** Every editable field, raw — what the host's form is filled from. */
    public function hostDetail(Hackathon $h): array
    {
        return $this->hostRow($h) + [
            'description' => $h->description,
            'themes' => $h->themes ?? [],
            'location' => $h->location,
            'results_expected_at' => $h->results_expected_at?->toIso8601String(),
            'min_team_size' => $h->min_team_size,
            'max_team_size' => $h->max_team_size,
            'currency' => $h->currency,
            'prize_pool_amount' => $h->prize_pool_amount,
            'prizes' => array_values($h->prizes ?? []),
            'tracks' => array_values($h->tracks ?? []),
            'criteria' => array_values($h->criteria ?? []),
            'rules' => $h->rules,
            'eligibility' => $h->eligibility,
            'faqs' => array_values($h->faqs ?? []),
            'resources' => array_values($h->resources ?? []),
            'cancelled_reason' => $h->cancelled_reason,
            'college_ids' => $h->isOpenToAll() ? [] : $h->colleges->pluck('id')->values()->all(),
            'colleges' => $h->isOpenToAll() ? [] : $h->colleges->map(fn ($c) => ['id' => $c->id, 'name' => $c->name, 'short_code' => $c->short_code, 'city' => $c->city])->values()->all(),
            'has_cover' => $h->cover_image !== null,
            'announcements' => $h->announcements()->with('author:id,name')->limit(50)->get()
                ->map(fn (HackathonAnnouncement $a) => $this->announcement($a))->all(),
        ];
    }

    public function hostRegistration(HackathonParticipant $p): array
    {
        $user = $p->user;

        return [
            'id' => $p->id,
            'registered_at' => $p->registered_at?->toIso8601String(),
            'role' => $p->role,
            'student' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'handle' => $user->handle,
                'avatar_url' => $user->avatar_url,
                'college' => $user->college?->name,
                'branch' => $user->branch,
            ],
            'team' => ['id' => $p->team->id, 'name' => $p->team->name],
        ];
    }

    /** A project as the host sees it while judging — everything, including marks. */
    public function hostSubmission(HackathonSubmission $s): array
    {
        return [
            'id' => $s->id,
            'title' => $s->title,
            'tagline' => $s->tagline,
            'description' => $s->description,
            'track' => $s->track,
            'repo_url' => $s->repo_url,
            'demo_url' => $s->demo_url,
            'video_url' => $s->video_url,
            'tech_stack' => $s->tech_stack ?? [],
            'status' => $s->status,
            'submitted_at' => $s->submitted_at?->toIso8601String(),
            'updated_at' => $s->updated_at?->toIso8601String(),
            'team' => $this->teamSummary($s->team) + ['size' => $s->team?->participants->count() ?? 0],
            'scores' => $s->scores ?? (object) [],
            'final_score' => $s->final_score !== null ? (float) $s->final_score : null,
            'rank' => $s->rank,
            'award_label' => $s->award_label,
            'feedback' => $s->feedback,
            'scored_at' => $s->scored_at?->toIso8601String(),
            'is_disqualified' => $s->is_disqualified,
            'disqualified_reason' => $s->disqualified_reason,
        ];
    }

    // ───────────────────────────── shared pieces ─────────────────────────────

    public function host(Hackathon $h): array
    {
        if ($h->isHostedByCompany() && $h->company !== null) {
            return [
                'type' => 'company',
                'name' => $h->company->name,
                'logo' => $h->company->logo,
                'industry' => $h->company->industry,
                'website_url' => $h->company->website_url,
            ];
        }

        return ['type' => 'platform', 'name' => 'AptRun', 'logo' => null, 'industry' => null, 'website_url' => null];
    }

    /** @return list<array{key: string, label: string, at: string, state: string, expected: bool}> */
    private function timeline(Hackathon $h): array
    {
        $now = now();
        $resultsAt = $h->results_published_at ?? $h->results_expected_at;

        $events = array_filter([
            ['key' => 'registration_opens', 'label' => 'Registration opens', 'at' => $h->registration_opens_at, 'expected' => false],
            ['key' => 'registration_closes', 'label' => 'Registration closes', 'at' => $h->registration_closes_at, 'expected' => false],
            ['key' => 'kickoff', 'label' => 'Hackathon kicks off', 'at' => $h->starts_at, 'expected' => false],
            ['key' => 'deadline', 'label' => 'Submission deadline', 'at' => $h->ends_at, 'expected' => false],
            $resultsAt ? ['key' => 'results', 'label' => 'Results announced', 'at' => $resultsAt, 'expected' => $h->results_published_at === null] : null,
        ]);

        usort($events, fn (array $a, array $b) => $a['at']->getTimestamp() <=> $b['at']->getTimestamp());

        $nextMarked = false;

        return array_map(function (array $event) use ($now, &$nextMarked, $h) {
            // Results only count as "done" once they are actually out, however late the host is.
            $done = $event['key'] === 'results' ? $h->results_published_at !== null : $event['at']->lte($now);

            $state = 'done';
            if (! $done) {
                $state = $nextMarked ? 'upcoming' : 'next';
                $nextMarked = true;
            }

            return [
                'key' => $event['key'],
                'label' => $event['label'],
                'at' => $event['at']->toIso8601String(),
                'state' => $state,
                'expected' => $event['expected'],
            ];
        }, $events);
    }

    /** The viewer's own entry, with the outcome only once results are out. */
    private function mine(Hackathon $h, HackathonParticipant $p): array
    {
        $submission = $p->team?->submission;
        $published = $h->resultsArePublished();

        return [
            'team_id' => $p->hackathon_team_id,
            'team_name' => $p->team?->name,
            'role' => $p->role,
            'submission_status' => $submission?->status,
            'rank' => $published && $submission && ! $submission->is_disqualified ? $submission->rank : null,
            'award_label' => $published && $submission && ! $submission->is_disqualified ? $submission->award_label : null,
            'score' => $published && $submission && $submission->final_score !== null && ! $submission->is_disqualified ? (float) $submission->final_score : null,
            'is_disqualified' => $published && $submission?->is_disqualified === true,
        ];
    }

    private function team(Hackathon $h, HackathonParticipant $p, ?User $viewer): array
    {
        $team = $p->team;
        $submitted = $team->submission?->isSubmitted() === true;

        return [
            'id' => $team->id,
            'name' => $team->name,
            // Only a member of the team is ever sent this (this method is reached only for the viewer's own participation).
            'invite_code' => $team->invite_code,
            'is_leader' => $p->isLeader(),
            'max_size' => $h->max_team_size,
            'min_size' => $h->min_team_size,
            'locked' => $submitted || ! $h->isTeamChangeWindowOpen(),
            'members' => $team->participants->map(fn (HackathonParticipant $m) => $this->member($m->user, $m->isLeader()) + [
                'is_you' => $viewer !== null && $m->user_id === $viewer->id,
            ])->values()->all(),
        ];
    }

    /** The viewer's own project — their team's work, so marks and feedback appear only after results. */
    private function ownProject(Hackathon $h, HackathonSubmission $s): array
    {
        $published = $h->resultsArePublished();

        return [
            'id' => $s->id,
            'title' => $s->title,
            'tagline' => $s->tagline,
            'description' => $s->description,
            'track' => $s->track,
            'repo_url' => $s->repo_url,
            'demo_url' => $s->demo_url,
            'video_url' => $s->video_url,
            'tech_stack' => $s->tech_stack ?? [],
            'status' => $s->status,
            'submitted_at' => $s->submitted_at?->toIso8601String(),
            'updated_at' => $s->updated_at?->toIso8601String(),
            'feedback' => $published ? $s->feedback : null,
            'scores' => $published ? ($s->scores ?? (object) []) : (object) [],
            'score' => $published && $s->final_score !== null ? (float) $s->final_score : null,
            'rank' => $published ? $s->rank : null,
            'award_label' => $published ? $s->award_label : null,
            'is_disqualified' => $published && $s->is_disqualified,
            'disqualified_reason' => $published && $s->is_disqualified ? $s->disqualified_reason : null,
        ];
    }

    /** @return list<array<string, mixed>> the top three, for the podium. */
    private function podium(Hackathon $h): array
    {
        return $h->submissions()
            ->where('status', HackathonSubmission::STATUS_SUBMITTED)
            ->where('is_disqualified', false)
            ->whereNotNull('rank')
            ->where('rank', '<=', 3)
            ->orderBy('rank')
            ->with('team.participants.user:id,name,handle,avatar_path,college_id')
            ->get()
            ->map(fn (HackathonSubmission $s) => $this->publicProject($h, $s))
            ->all();
    }

    /** @return array{id: int, name: string, members: list<array<string, mixed>>}|array{} */
    private function teamSummary(?HackathonTeam $team): array
    {
        if ($team === null) {
            return ['id' => 0, 'name' => 'Unknown team', 'members' => []];
        }

        return [
            'id' => $team->id,
            'name' => $team->name,
            'members' => $team->participants->map(fn (HackathonParticipant $m) => $this->member($m->user, $m->isLeader()))->values()->all(),
        ];
    }

    /** A person on a team — name and avatar only, never an email. */
    private function member(User $user, bool $isLeader): array
    {
        return [
            'user_id' => $user->id,
            'name' => $user->name,
            'handle' => $user->handle,
            'avatar_url' => $user->avatar_url,
            'is_leader' => $isLeader,
        ];
    }

    private function participantCount(Hackathon $h): int
    {
        return (int) ($h->participants_count ?? $h->participants()->count());
    }
}
