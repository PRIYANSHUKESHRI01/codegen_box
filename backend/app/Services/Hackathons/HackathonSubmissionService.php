<?php

namespace App\Services\Hackathons;

use App\Models\Hackathon;
use App\Models\HackathonParticipant;
use App\Models\HackathonSubmission;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * A team's project: saving a draft, and submitting it for judging.
 *
 * Any member of the team may edit it (it is the team's project, not the
 * leader's), from kickoff until the deadline. Saving a draft keeps it hidden
 * from the judges; submitting runs the stricter checks and is what gets
 * scored. Both stay editable until `ends_at`, so a team that submits early can
 * still polish — but submitting also freezes the team's membership (see
 * HackathonRegistrationService), so nobody can join late to ride on the work.
 */
class HackathonSubmissionService
{
    /**
     * @param  array<string, mixed>  $data  validated project fields
     */
    public function save(Hackathon $hackathon, User $user, array $data, bool $submit): HackathonSubmission
    {
        return DB::transaction(function () use ($hackathon, $user, $data, $submit) {
            $participant = HackathonParticipant::where('hackathon_id', $hackathon->id)
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if ($participant === null) {
                throw new HackathonRuleException('Register for this hackathon before submitting a project.', 'not_registered', 403);
            }

            $this->assertSubmissionWindowOpen($hackathon);

            $this->assertTrackIsValid($hackathon, $data['track'] ?? null);

            $submission = HackathonSubmission::firstOrNew(['hackathon_team_id' => $participant->hackathon_team_id]);
            $submission->hackathon_id = $hackathon->id;
            $submission->fill($this->only($data));
            $submission->submitted_by = $user->id;

            if ($submit) {
                $this->assertReadyToSubmit($hackathon, $submission, $participant->hackathon_team_id);

                $submission->status = HackathonSubmission::STATUS_SUBMITTED;
                $submission->submitted_at ??= now();
            } elseif ($submission->status === null) {
                $submission->status = HackathonSubmission::STATUS_DRAFT;
            }

            $submission->save();

            return $submission->fresh();
        });
    }

    /**
     * Whether `$user` may change their team's project right now, and if not, why — in the shape the
     * frontend renders directly, so the rule is only ever written here.
     *
     * @return array{allowed: bool, code: ?string, message: ?string}
     */
    public function editability(Hackathon $hackathon, ?HackathonParticipant $participant): array
    {
        if ($participant === null) {
            return ['allowed' => false, 'code' => 'not_registered', 'message' => 'Register to submit a project.'];
        }

        if (! $hackathon->isPublished()) {
            return ['allowed' => false, 'code' => 'not_available', 'message' => 'This hackathon is not accepting projects.'];
        }

        if (now()->lt($hackathon->starts_at)) {
            return ['allowed' => false, 'code' => 'not_started', 'message' => 'Project submission opens when the hackathon kicks off.'];
        }

        if ($hackathon->hasEnded()) {
            return ['allowed' => false, 'code' => 'submissions_closed', 'message' => 'The submission deadline has passed.'];
        }

        return ['allowed' => true, 'code' => null, 'message' => null];
    }

    private function assertSubmissionWindowOpen(Hackathon $hackathon): void
    {
        if (! $hackathon->isPublished()) {
            throw new HackathonRuleException('This hackathon is not accepting projects.', 'not_available', 404);
        }

        if (now()->lt($hackathon->starts_at)) {
            throw new HackathonRuleException('Project submission opens when the hackathon kicks off.', 'not_started', 409);
        }

        if ($hackathon->hasEnded()) {
            throw new HackathonRuleException('The submission deadline has passed.', 'submissions_closed', 409);
        }
    }

    private function assertTrackIsValid(Hackathon $hackathon, ?string $track): void
    {
        $tracks = collect($hackathon->tracks ?? [])->pluck('name')->filter()->values();

        if ($track !== null && $track !== '' && $tracks->isNotEmpty() && ! $tracks->contains($track)) {
            throw new HackathonRuleException('Choose one of the hackathon\'s tracks.', 'invalid_track');
        }
    }

    private function assertReadyToSubmit(Hackathon $hackathon, HackathonSubmission $submission, int $teamId): void
    {
        $missing = $submission->missingRequiredFields();

        if ($missing !== []) {
            $labels = ['title' => 'a title', 'description' => 'a description', 'repo_url' => 'a repository link'];
            $names = array_map(fn (string $field) => $labels[$field] ?? $field, $missing);

            throw new HackathonRuleException('Add '.implode(', ', $names).' before submitting.', 'incomplete_submission');
        }

        $hasTracks = collect($hackathon->tracks ?? [])->isNotEmpty();

        if ($hasTracks && trim((string) $submission->track) === '') {
            throw new HackathonRuleException('Pick the track you are entering before submitting.', 'track_required');
        }

        $size = HackathonParticipant::where('hackathon_team_id', $teamId)->count();

        if ($size < $hackathon->min_team_size) {
            throw new HackathonRuleException(
                "This hackathon needs teams of at least {$hackathon->min_team_size}. Your team has {$size}.",
                'team_too_small'
            );
        }
    }

    /**
     * Only the project fields a team may set — never status, scores or rank, whatever the request carried.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function only(array $data): array
    {
        $fields = array_intersect_key($data, array_flip(['title', 'tagline', 'description', 'track', 'repo_url', 'demo_url', 'video_url']));

        if (array_key_exists('tech_stack', $data)) {
            $fields['tech_stack'] = array_values(array_unique(array_map('trim', $data['tech_stack'] ?? [])));
        }

        return $fields;
    }
}
