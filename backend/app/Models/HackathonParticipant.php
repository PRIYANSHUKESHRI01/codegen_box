<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One student's registration for one hackathon. See HackathonRegistrationService for the rules that create and remove these. */
class HackathonParticipant extends Model
{
    public const ROLE_LEADER = 'leader';

    public const ROLE_MEMBER = 'member';

    protected $fillable = ['hackathon_id', 'user_id', 'hackathon_team_id', 'role', 'registered_at'];

    protected function casts(): array
    {
        return [
            'registered_at' => 'datetime',
        ];
    }

    public function hackathon(): BelongsTo
    {
        return $this->belongsTo(Hackathon::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(HackathonTeam::class, 'hackathon_team_id');
    }

    public function isLeader(): bool
    {
        return $this->role === self::ROLE_LEADER;
    }
}
