<?php

namespace App\Services;

use App\Models\StudySitting;
use App\Models\StudySittingViolation;
use App\Models\User;
use App\Services\Integrity\IntegrityService;
use App\Services\Integrity\StrikeMath;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

/**
 * Proctoring for Core Prep practice and Skill Drills ("study sittings"). Same camera / fullscreen / tab-switch rules and the same
 * strike limit as a Core test or an AI interview, with the same split of duties: the BROWSER detects events, the SERVER decides.
 *
 * A student cannot answer into the proctored surfaces without an active, consented sitting — `requireUsable()` is called by every
 * answer endpoint — so skipping the consent screen (a tampered client, a script) simply gets 428. A locked sitting stops accepting
 * answers (423) and opening another of the same kind is refused for a cool-down, so a lock has teeth even though nothing here is graded.
 *
 * Nothing in a sitting feeds the readiness score. PROCTORING_STUDY=false turns the whole thing off (a campus without webcams).
 */
class StudySittingService
{
    public function enabled(): bool
    {
        return (bool) config('proctoring.study_enabled', true);
    }

    /**
     * Starts a new sitting. Any earlier one of the same kind that is still open (a stale tab, a closed laptop) is ended first, so a
     * student has exactly one live sitting per kind.
     */
    public function open(User $user, string $kind, ?string $subject): StudySitting
    {
        $cooldown = (int) config('proctoring.study_lock_cooldown_minutes', 10);
        $lastLock = StudySitting::where('user_id', $user->id)->where('kind', $kind)->where('status', StudySitting::STATUS_LOCKED)->latest('locked_at')->first();

        if ($cooldown > 0 && $lastLock?->locked_at && $lastLock->locked_at->gt(now()->subMinutes($cooldown))) {
            $wait = max(1, (int) ceil(now()->diffInSeconds($lastLock->locked_at->copy()->addMinutes($cooldown)) / 60));

            $this->refuse(423, 'sitting_cooldown', "Your last sitting was closed after repeated proctoring violations. You can start a new one in about {$wait} minute".($wait === 1 ? '' : 's').'.');
        }

        return DB::transaction(function () use ($user, $kind, $subject) {
            StudySitting::where('user_id', $user->id)->where('kind', $kind)->where('status', StudySitting::STATUS_ACTIVE)
                ->update(['status' => StudySitting::STATUS_COMPLETED, 'completed_at' => now()]);

            return StudySitting::create(['user_id' => $user->id, 'kind' => $kind, 'subject' => $subject, 'status' => StudySitting::STATUS_ACTIVE]);
        });
    }

    /** Idempotent: consent is recorded once; a refresh reuses the sitting and its real strike count. */
    public function startOrResume(StudySitting $sitting, array $deviceInfo): StudySitting
    {
        if ($sitting->isCompleted()) {
            $this->refuse(409, 'sitting_ended', 'This sitting has ended. Start a new one.');
        }

        if (! $sitting->isConsented() && ! $sitting->isLocked()) {
            $sitting->update(['consented_at' => now(), 'device_info' => $deviceInfo]);
        }

        return $sitting->fresh();
    }

    /**
     * Logs one event and, when a strike takes the count to the limit, locks the sitting. Row-locked so two events arriving together
     * (leaving fullscreen routinely also fires a visibility change) cannot both slip past the check.
     *
     * @return array{sitting: StudySitting, locked: bool}
     */
    public function recordViolation(StudySitting $sitting, string $type, ?string $ip, array $meta, ?int $strikes = null): array
    {
        if ($sitting->isLocked() || $sitting->isCompleted()) {
            // Nothing left to protect (or already locked): keep the event for the record, never strike it.
            $this->log($sitting, $type, $ip, $meta, false);

            return ['sitting' => $sitting, 'locked' => $sitting->isLocked()];
        }

        // `$strikes` is set only by the integrity layer; null = the original rule.
        $isStrike = $strikes === null ? in_array($type, StudySittingViolation::STRIKE_TYPES, true) : $strikes > 0;

        return DB::transaction(function () use ($sitting, $type, $ip, $meta, $isStrike, $strikes) {
            $row = StudySitting::whereKey($sitting->id)->lockForUpdate()->first();

            $this->log($row, $type, $ip, $meta, $isStrike);

            if (! $isStrike || $row->isLocked()) {
                return ['sitting' => $row->fresh(), 'locked' => $row->isLocked()];
            }

            $row->increment('violation_count', StrikeMath::toAdd($strikes, (int) $row->violation_count));
            $row->refresh();

            $justLocked = false;
            if ($row->violation_count >= (int) config('proctoring.max_violations_before_lock', 3)) {
                $row->update(['status' => StudySitting::STATUS_LOCKED, 'locked_at' => now()]);
                $justLocked = true;
            }

            return ['sitting' => $row->fresh(), 'locked' => $justLocked];
        });
    }

    public function complete(StudySitting $sitting): StudySitting
    {
        if ($sitting->status === StudySitting::STATUS_ACTIVE) {
            $sitting->update(['status' => StudySitting::STATUS_COMPLETED, 'completed_at' => now()]);
        }

        return $sitting->fresh();
    }

    /**
     * The gate every proctored answer endpoint goes through. Returns the sitting to attach the answer to, or null when proctoring of
     * study sittings is switched off. Refuses with a machine-readable `code` the browser reacts to (re-opens the consent screen).
     *
     * @param  bool  $allowCompleted  a drill's answers are sent in the background and may land just after the sitting ended normally
     */
    public function requireUsable(User $user, mixed $sittingId, string $kind, bool $allowCompleted = false): ?StudySitting
    {
        if (! $this->enabled()) {
            return null;
        }

        $sitting = is_numeric($sittingId) ? StudySitting::where('user_id', $user->id)->where('kind', $kind)->find((int) $sittingId) : null;

        if ($sitting === null) {
            $this->refuse(428, 'sitting_required', 'Start a proctored sitting first.');
        }

        if ($sitting->isLocked()) {
            $this->refuse(423, 'sitting_locked', 'This sitting was closed after repeated proctoring violations.');
        }

        if (! $sitting->isConsented()) {
            $this->refuse(428, 'sitting_not_started', 'Allow the camera and fullscreen to begin this sitting.');
        }

        if ($sitting->isCompleted() && ! $allowCompleted) {
            $this->refuse(409, 'sitting_ended', 'This sitting has ended. Start a new one.');
        }

        // ...and only while the proctoring signal is alive (heartbeat, device binding). See IntegrityService::gate().
        app(IntegrityService::class)->gate('study', $sitting, $user);

        return $sitting;
    }

    private function log(StudySitting $sitting, string $type, ?string $ip, array $meta, bool $counted): void
    {
        StudySittingViolation::create([
            'study_sitting_id' => $sitting->id,
            'type' => $type,
            'counted_toward_lock' => $counted,
            'ip_address' => $ip,
            'meta' => $meta ?: null,
            'occurred_at' => now(),
        ]);
    }

    private function refuse(int $status, string $code, string $message): never
    {
        throw new HttpResponseException(response()->json(['message' => $message, 'code' => $code], $status));
    }
}
