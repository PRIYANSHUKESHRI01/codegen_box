<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

/**
 * A team inside one hackathon. A student who enters alone gets a team of one,
 * so participation, submissions and results all hang off a team and there is
 * no separate "solo" code path anywhere.
 */
class HackathonTeam extends Model
{
    /** No 0/O/1/I/L — a code read aloud or copied off a phone should not be ambiguous. */
    private const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    protected $fillable = ['hackathon_id', 'name', 'invite_code', 'leader_id'];

    public function hackathon(): BelongsTo
    {
        return $this->belongsTo(Hackathon::class);
    }

    public function leader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'leader_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(HackathonParticipant::class)->orderByRaw("CASE role WHEN 'leader' THEN 0 ELSE 1 END")->orderBy('id');
    }

    public function submission(): HasOne
    {
        return $this->hasOne(HackathonSubmission::class);
    }

    /** A code no other team in this hackathon has. */
    public static function generateInviteCode(int $hackathonId): string
    {
        do {
            $code = '';
            for ($i = 0; $i < 8; $i++) {
                $code .= self::CODE_ALPHABET[random_int(0, strlen(self::CODE_ALPHABET) - 1)];
            }
        } while (self::where('hackathon_id', $hackathonId)->where('invite_code', $code)->exists());

        return $code;
    }

    /** A default name for a solo entrant's team — their own name, made unique within the hackathon if needed. */
    public static function uniqueNameFor(int $hackathonId, string $wanted): string
    {
        $base = Str::limit(trim($wanted), 52, '');
        $name = $base;
        $suffix = 1;

        while (self::where('hackathon_id', $hackathonId)->where('name', $name)->exists()) {
            $suffix++;
            $name = "{$base} {$suffix}";
        }

        return $name;
    }
}
