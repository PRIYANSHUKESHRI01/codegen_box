<?php

namespace App\Services\Activity;

use App\Models\AuthEvent;
use App\Models\User;
use App\Support\ClientInfo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Writes the sign-in log: every login (and every failed or blocked one), the moment a one-time password was used, a code asked for,
 * and the moment an owner chose their own password. It is what tells the superadmin whether a college that was handed a demo login
 * ever opened it.
 *
 * Fire-and-forget: a failure here (a database that has not been migrated yet, a full disk) is logged once an hour and swallowed,
 * because the log must never stand between a person and their account.
 */
class AuthEventRecorder
{
    public function record(string $event, ?User $user, ?Request $request = null, ?string $email = null, ?string $reason = null, ?string $portal = null): void
    {
        if (! config('activity.enabled', true) || $user?->role === User::ROLE_SUPERADMIN) {
            return;
        }

        $request ??= request();
        $client = ClientInfo::parse($request?->userAgent());

        try {
            AuthEvent::create([
                'user_id' => $user?->id,
                'college_id' => $user?->college_id,
                'role' => $user?->role,
                'email' => $email !== null ? mb_substr(mb_strtolower($email), 0, 190) : $user?->email,
                'event' => $event,
                'reason' => $reason,
                'portal' => $portal,
                'device' => $client['device'],
                'browser' => $client['browser'],
                'os' => $client['os'],
                'ip' => $request?->ip(),
            ]);
        } catch (\Throwable $e) {
            if (Cache::add('auth-event-write-failed', true, 3600)) {
                Log::warning('Could not write the sign-in log: '.$e->getMessage());
            }
        }
    }
}
