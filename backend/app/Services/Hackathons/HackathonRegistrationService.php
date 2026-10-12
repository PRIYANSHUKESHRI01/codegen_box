<?php

namespace App\Services\Hackathons;

use App\Models\Hackathon;
use App\Models\HackathonParticipant;
use App\Models\HackathonSubmission;
use App\Models\HackathonTeam;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Who is competing in a hackathon, and in which team.
 *
 * Every rule that can be raced lives here, inside one transaction that first
 * locks the hackathon row: two students grabbing the last seat, or two
 * teammates joining a team with one slot left, are serialised so the limits
 * hold no matter how requests interleave. (A lock on the hackathon is
 * cheap — registration is a once-per-student action, not a hot path.)
 *
 * A student who enters alone gets a team of one, so there is exactly one code
 * path for participation, submissions and results.
 */
class HackathonRegistrationService
{
    public const MODE_SOLO = 'solo';

    public const MODE_CREATE = 'create';

    public const MODE_JOIN = 'join';

    public const MODES = [self::MODE_SOLO, self::MODE_CREATE, self::MODE_JOIN];

    public function register(Hackathon $hackathon, User $user, string $mode, ?string $teamName = null, ?string $inviteCode = null): HackathonParticipant
    {
        if (! $user->isStudent() || $user->is_blocked) {
            throw new HackathonRuleException('Only active student accounts can take part in a hackathon.', 'not_a_student', 403);
        }

        return DB::transaction(function () use ($hackathon, $user, $mode, $teamName, $inviteCode) {
            // Serialise every sign-up for this hackathon (see the class docblock).
            $hackathon = Hackathon::whereKey($hackathon->id)->lockForUpdate()->firstOrFail();

            if (! $hackathon->isPublished()) {
                throw new HackathonRuleException('This hackathon is not open for registration.', 'not_available', 404);
            }

            if (HackathonParticipant::where('hackathon_id', $hackathon->id)->where('user_id', $user->id)->exists()) {
                throw new HackathonRuleException('You are already registered for this hackathon.', 'already_registered', 409);
            }

            // A hackathon mapped to specific colleges is invisible — and closed — to every other student. 404, not 403,
            // so its existence is not confirmed to someone it was never meant for.
            if (! $hackathon->isAvailableTo($user)) {
                throw new HackathonRuleException('This hackathon is not open for registration.', 'not_available', 404);
            }

            $this->assertRegistrationOpen($hackathon);

            if ($hackathon->max_participants !== null
                && HackathonParticipant::where('hackathon_id', $hackathon->id)->count() >= $hackathon->max_participants) {
                throw new HackathonRuleException('This hackathon is full.', 'full', 409);
            }

            return match ($mode) {
                self::MODE_SOLO => $this->registerSolo($hackathon, $user),
                self::MODE_CREATE => $this->registerWithNewTeam($hackathon, $user, $teamName),
                self::MODE_JOIN => $this->registerIntoTeam($hackathon, $user, $inviteCode),
                default => throw new HackathonRuleException('Choose solo, create a team, or join one.', 'invalid_mode'),
            };
        });
    }

    /** Leave the hackathon. A leader who leaves hands the team to its longest-standing member; the last member out removes the team. */
    public function withdraw(Hackathon $hackathon, User $user): void
    {
        DB::transaction(function () use ($hackathon, $user) {
            $participant = HackathonParticipant::where('hackathon_id', $hackathon->id)
                ->where('user_id', $user->id)
                ->lockForUpdate()
                ->first();

            if ($participant === null) {
                throw new HackathonRuleException('You are not registered for this hackathon.', 'not_registered', 404);
            }

            $this->assertTeamEditable($hackathon, $participant->hackathon_team_id);

            $team = HackathonTeam::lockForUpdate()->findOrFail($participant->hackathon_team_id);
            $others = $team->participants()->where('user_id', '!=', $user->id)->get();

            if ($others->isEmpty()) {
                // Cascades the participant row and any saved draft with it.
                $team->delete();

                return;
            }

            $participant->delete();

            if ($participant->isLeader()) {
                $next = $others->sortBy('id')->first();
                $next->update(['role' => HackathonParticipant::ROLE_LEADER]);
                $team->update(['leader_id' => $next->user_id]);
            }
        });
    }

    /** A team leader removes another member. The leader leaves with withdraw(), not this. */
    public function removeMember(Hackathon $hackathon, User $leader, User $member): void
    {
        DB::transaction(function () use ($hackathon, $leader, $member) {
            $mine = HackathonParticipant::where('hackathon_id', $hackathon->id)->where('user_id', $leader->id)->lockForUpdate()->first();

            if ($mine === null || ! $mine->isLeader()) {
                throw new HackathonRuleException('Only the team leader can remove a teammate.', 'not_team_leader', 403);
            }

            $target = HackathonParticipant::where('hackathon_id', $hackathon->id)
                ->where('user_id', $member->id)
                ->where('hackathon_team_id', $mine->hackathon_team_id)
                ->lockForUpdate()
                ->first();

            if ($target === null) {
                throw new HackathonRuleException('That student is not on your team.', 'not_on_team', 404);
            }

            if ($target->isLeader()) {
                throw new HackathonRuleException('You cannot remove yourself — leave the hackathon instead.', 'cannot_remove_leader');
            }

            $this->assertTeamEditable($hackathon, $mine->hackathon_team_id);

            $target->delete();
        });
    }

    private function registerSolo(Hackathon $hackathon, User $user): HackathonParticipant
    {
        if ($hackathon->min_team_size > 1) {
            throw new HackathonRuleException("This hackathon needs teams of at least {$hackathon->min_team_size}. Create a team or join one.", 'team_required');
        }

        $team = HackathonTeam::create([
            'hackathon_id' => $hackathon->id,
            'name' => HackathonTeam::uniqueNameFor($hackathon->id, $user->name),
            'invite_code' => HackathonTeam::generateInviteCode($hackathon->id),
            'leader_id' => $user->id,
        ]);

        return $this->addParticipant($hackathon, $team, $user, HackathonParticipant::ROLE_LEADER);
    }

    private function registerWithNewTeam(Hackathon $hackathon, User $user, ?string $teamName): HackathonParticipant
    {
        if (! $hackathon->allowsTeams()) {
            throw new HackathonRuleException('This hackathon is solo only.', 'solo_only');
        }

        $name = trim((string) $teamName);

        if (mb_strlen($name) < 3 || mb_strlen($name) > 60) {
            throw new HackathonRuleException('Give your team a name between 3 and 60 characters.', 'invalid_team_name');
        }

        if (HackathonTeam::where('hackathon_id', $hackathon->id)->where('name', $name)->exists()) {
            throw new HackathonRuleException('A team with that name already exists in this hackathon.', 'team_name_taken', 409);
        }

        $team = HackathonTeam::create([
            'hackathon_id' => $hackathon->id,
            'name' => $name,
            'invite_code' => HackathonTeam::generateInviteCode($hackathon->id),
            'leader_id' => $user->id,
        ]);

        return $this->addParticipant($hackathon, $team, $user, HackathonParticipant::ROLE_LEADER);
    }

    private function registerIntoTeam(Hackathon $hackathon, User $user, ?string $inviteCode): HackathonParticipant
    {
        if (! $hackathon->allowsTeams()) {
            throw new HackathonRuleException('This hackathon is solo only.', 'solo_only');
        }

        $code = Str::upper(trim((string) $inviteCode));

        $team = $code === ''
            ? null
            : HackathonTeam::where('hackathon_id', $hackathon->id)->where('invite_code', $code)->lockForUpdate()->first();

        if ($team === null) {
            throw new HackathonRuleException('That invite code does not match any team in this hackathon.', 'invalid_invite_code');
        }

        if ($team->submission?->isSubmitted()) {
            throw new HackathonRuleException('That team has already submitted its project and is closed to new members.', 'team_locked', 409);
        }

        if ($team->participants()->count() >= $hackathon->max_team_size) {
            throw new HackathonRuleException("That team is full ({$hackathon->max_team_size} members).", 'team_full', 409);
        }

        return $this->addParticipant($hackathon, $team, $user, HackathonParticipant::ROLE_MEMBER);
    }

    private function addParticipant(Hackathon $hackathon, HackathonTeam $team, User $user, string $role): HackathonParticipant
    {
        return HackathonParticipant::create([
            'hackathon_id' => $hackathon->id,
            'user_id' => $user->id,
            'hackathon_team_id' => $team->id,
            'role' => $role,
            'registered_at' => now(),
        ]);
    }

    private function assertRegistrationOpen(Hackathon $hackathon): void
    {
        $now = now();

        if ($now->lt($hackathon->registration_opens_at)) {
            throw new HackathonRuleException('Registration for this hackathon has not opened yet.', 'registration_not_open');
        }

        if (! $hackathon->isRegistrationWindowOpen($now)) {
            throw new HackathonRuleException('Registration for this hackathon has closed.', 'registration_closed');
        }
    }

    /** Team membership is frozen once the deadline passes, and once the team has submitted its project. */
    private function assertTeamEditable(Hackathon $hackathon, int $teamId): void
    {
        if (! $hackathon->isTeamChangeWindowOpen()) {
            throw new HackathonRuleException('Teams are locked — the submission deadline has passed.', 'teams_locked', 409);
        }

        $submitted = HackathonSubmission::where('hackathon_team_id', $teamId)
            ->where('status', HackathonSubmission::STATUS_SUBMITTED)
            ->exists();

        if ($submitted) {
            throw new HackathonRuleException('Your team has already submitted its project, so the team is locked.', 'team_locked', 409);
        }
    }
}
