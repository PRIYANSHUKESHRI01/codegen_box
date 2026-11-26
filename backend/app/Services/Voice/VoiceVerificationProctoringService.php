<?php

namespace App\Services\Voice;

use App\Models\InterviewProctoringViolation;
use App\Models\VoiceVerificationProfile;
use App\Models\VoiceVerificationProctoringViolation;
use App\Services\Integrity\EventCatalog;
use App\Services\Integrity\StrikeMath;
use Illuminate\Support\Facades\DB;

/**
 * Server-side proctoring authority for the one-time 5-minute Voice Baseline Verification.
 * Ensures the baseline voice recording itself cannot be proxied, multi-person assisted,
 * or recorded with phone/tab-switching assistance.
 */
class VoiceVerificationProctoringService
{
    public function startOrResume(VoiceVerificationProfile $profile, array $deviceInfo): VoiceVerificationProfile
    {
        return DB::transaction(function () use ($profile, $deviceInfo) {
            /** @var VoiceVerificationProfile $locked */
            $locked = VoiceVerificationProfile::whereKey($profile->id)->lockForUpdate()->firstOrFail();

            if ($locked->isProctoringLocked()) {
                return $locked;
            }

            $updates = [];
            if ($locked->proctoring_status === 'inactive') {
                $updates['proctoring_status'] = 'active';
            }
            if ($locked->proctoring_consented_at === null) {
                $updates['proctoring_consented_at'] = now();
            }
            if (! empty($deviceInfo)) {
                $updates['proctoring_device_info'] = $deviceInfo;
            }

            if ($updates !== []) {
                $locked->update($updates);
            }

            return $locked->fresh();
        });
    }

    /**
     * @param  array<string, mixed>  $meta
     * @return array{session: VoiceVerificationProfile, locked: bool, already_locked: bool}
     */
    public function recordViolation(
        VoiceVerificationProfile $profile,
        string $type,
        ?string $ip,
        array $meta,
        ?int $strikes = null,
    ): array {
        if ($profile->isProctoringLocked() || $profile->isVerified()) {
            $this->logViolation($profile, $type, $ip, $meta, false);

            return ['session' => $profile, 'locked' => $profile->isProctoringLocked(), 'already_locked' => $profile->isProctoringLocked()];
        }

        if ($strikes === null && $type === InterviewProctoringViolation::TYPE_MULTIPLE_FACES && ! empty($meta['grace_period_exceeded'])) {
            $strikes = EventCatalog::STRIKE_LOCK;
        }
        $isStrike = $strikes === null ? InterviewProctoringViolation::isStrikeType($type) : $strikes > 0;

        return DB::transaction(function () use ($profile, $type, $ip, $meta, $isStrike, $strikes) {
            /** @var VoiceVerificationProfile $locked */
            $locked = VoiceVerificationProfile::whereKey($profile->id)->lockForUpdate()->firstOrFail();

            $this->logViolation($locked, $type, $ip, $meta, $isStrike);

            if (! $isStrike || $locked->isProctoringLocked()) {
                return ['session' => $locked->fresh(), 'locked' => $locked->isProctoringLocked(), 'already_locked' => $locked->isProctoringLocked()];
            }

            $locked->increment('proctoring_violation_count', StrikeMath::toAdd($strikes, (int) $locked->proctoring_violation_count));
            $locked->refresh();

            $threshold = (int) config('proctoring.max_violations_before_lock', 3);
            $justLocked = false;

            if ($locked->proctoring_violation_count >= $threshold) {
                $newLockCount = (int) $locked->enrollment_lock_count + 1;
                $maxAttempts = $locked->maxEnrollmentAttempts();
                $remaining = max(0, $maxAttempts - $newLockCount);
                $label = EventCatalog::label($type);

                if ($remaining > 0) {
                    $reason = "Your 5-minute Voice Baseline attempt ({$newLockCount} of {$maxAttempts}) was stopped due to a proctoring violation ({$label}). "
                        . "You have {$remaining} " . ($remaining === 1 ? 'attempt' : 'attempts')
                        . ' remaining — please stay alone in the camera frame, keep fullscreen active, and try again.';

                    $locked->update([
                        'proctoring_status' => 'locked',
                        'proctoring_locked_at' => now(),
                        'enrollment_lock_count' => $newLockCount,
                        'blocked_reason' => $reason,
                    ]);
                } else {
                    $reason = "All {$maxAttempts} attempts for the 5-minute Voice Baseline Verification were terminated due to proctoring violations ({$label}). "
                        . 'Your voice verification access is now permanently locked — please contact your administrator or placement cell (TPO) for review and reinstatement.';

                    $locked->update([
                        'proctoring_status' => 'locked',
                        'proctoring_locked_at' => now(),
                        'enrollment_lock_count' => $newLockCount,
                        'status' => VoiceVerificationProfile::STATUS_BLOCKED,
                        'blocked_at' => $locked->blocked_at ?? now(),
                        'blocked_reason' => $reason,
                    ]);
                }
                $justLocked = true;
            }

            return ['session' => $locked->fresh(), 'locked' => $justLocked, 'already_locked' => false];
        });
    }

    private function logViolation(
        VoiceVerificationProfile $profile,
        string $type,
        ?string $ip,
        array $meta,
        bool $countedTowardLock,
    ): void {
        VoiceVerificationProctoringViolation::create([
            'voice_verification_profile_id' => $profile->id,
            'type' => $type,
            'counted_toward_lock' => $countedTowardLock,
            'ip_address' => $ip,
            'meta' => $meta ?: null,
            'occurred_at' => now(),
        ]);
    }
}
