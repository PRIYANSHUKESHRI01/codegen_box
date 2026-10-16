<?php

namespace App\Services\Vault;

use App\Jobs\SendVaultReadyEmail;
use App\Models\User;
use App\Models\VaultProfile;
use App\Services\LifecycleMailService;
use App\Support\SingleMail;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * The only writer of a Vault profile's state.
 *
 * Whatever happens — a student's score moves, they say yes or change their mind,
 * staff hide a profile, a hiring partner hires them, they edit their bio, their
 * account is blocked — it ends in reconcile(): re-derive `visibility_status` from
 * the primitives on the row (VaultProfile::resolveStatus()), and, if the answer
 * changed what Mellow Vault should know, queue it (VaultSyncService). One
 * derivation, one place that reacts to it, so the screen a hiring partner sees,
 * the screen the student sees and what Mellow Vault holds cannot disagree.
 *
 * Every change runs under a row lock, so the scheduled refresh and a student
 * clicking "Join" at the same instant serialise instead of overwriting each other.
 */
class VaultService
{
    public function __construct(private readonly VaultSyncService $sync) {}

    /** @return array{enter: int, exit: int} */
    public function thresholds(): array
    {
        $enter = (int) config('vault.enter_score', 60);

        // The exit line can never sit above the entry line — that would list and delist the same student on every refresh.
        return ['enter' => $enter, 'exit' => min((int) config('vault.exit_score', 55), $enter)];
    }

    public function profileFor(User $user): VaultProfile
    {
        return VaultProfile::where('user_id', $user->id)->first() ?? $this->createProfile($user);
    }

    private function createProfile(User $user): VaultProfile
    {
        try {
            return VaultProfile::create(['user_id' => $user->id]);
        } catch (UniqueConstraintViolationException) {
            // Two requests created it at once — the other one won, use theirs.
            return VaultProfile::where('user_id', $user->id)->firstOrFail();
        }
    }

    // ───────────────────────────── readiness ─────────────────────────────

    /**
     * Takes a student's freshly computed readiness and moves their profile
     * accordingly. A student who is nowhere near the bar and has no profile costs
     * nothing — no row is created for them.
     *
     * Entering takes the entry score; leaving takes dropping below the (lower)
     * exit score. A student in between keeps whatever state they were in.
     *
     * @param  array{score: int, tier: string, components: array}  $breakdown
     */
    public function applyReadiness(User $user, array $breakdown, ?VaultProfile $known = null): ?VaultProfile
    {
        if (! $user->isStudent()) {
            return null;
        }

        $score = (int) $breakdown['score'];
        $line = $this->thresholds();
        $profile = $known ?? VaultProfile::where('user_id', $user->id)->first();

        if ($profile === null && $score < $line['enter']) {
            return null;
        }

        $profile ??= $this->createProfile($user);

        // Remembered so a student who WAS live and has just fallen out is told (below); one who was merely
        // "ready, awaiting consent" or "ready, needs a plan" had nothing to lose and needs no such message.
        $wasListed = $profile->is_eligible && $profile->visibility_status === VaultProfile::STATUS_VISIBLE;

        $profile = $this->mutate($profile, function (VaultProfile $p) use ($breakdown, $score, $line) {
            $p->readiness_score = $score;
            $p->peak_readiness = max((int) $p->peak_readiness, $score);
            $p->readiness_tier = $breakdown['tier'];
            $p->readiness_components = $breakdown['components'];
            $p->readiness_version = (int) config('readiness.version');
            $p->readiness_computed_at = now();

            if (! $p->is_eligible && $score >= $line['enter']) {
                $p->is_eligible = true;
                $p->qualified_at ??= now();
                $p->eligible_since = now();
                $p->qualification_source = VaultProfile::SOURCE_READINESS;
            } elseif ($p->is_eligible && $score < $line['exit']) {
                $p->is_eligible = false;
                $p->eligible_since = null;
                $p->left_at = now();
            }
        });

        // Told once, the first time they are eligible and it is theirs to act on. "Eligible and never told"
        // rather than "just became eligible": a student carried over from the old Talent Pool arrives already
        // marked eligible, and still needs to hear that the Vault now asks for their yes again.
        if ($profile->is_eligible
            && $profile->ready_notified_at === null
            && in_array($profile->visibility_status, [VaultProfile::STATUS_PENDING_CONSENT, VaultProfile::STATUS_VISIBLE], true)) {
            $profile->forceFill(['ready_notified_at' => now()])->save();

            // One student, one action: sent right here (a refresh command, or the request that opened the page) so
            // it needs no queue worker — the SingleMail rule.
            SingleMail::afterResponse(new SendVaultReadyEmail($user->id));
        }

        // Ready, but the plan has no Vault: nobody can see them yet, and a plan is what changes that. The best moment
        // to say so is the moment they qualify; LifecycleSweepService sends the reminders. Once ever per student
        // (the mail's own key), so the every-ten-minutes refresh does not repeat it.
        if ($profile->is_eligible && $profile->visibility_status === VaultProfile::STATUS_UPGRADE_REQUIRED) {
            app(LifecycleMailService::class)->vaultUpgrade($user, $score);
        }

        if ($wasListed && ! $profile->is_eligible) {
            app(LifecycleMailService::class)->vaultDelisted($user, $score, (array) ($breakdown['next_steps'] ?? []));
        }

        return $profile;
    }

    // ───────────────────────────── the student's choices ─────────────────────────────

    /**
     * One standing, revocable yes — covering AptRun's hiring partners and Mellow
     * Vault. Allowed before the student is ready: it means "list me as soon as I
     * am", and is what makes the Vault automatic after a single click.
     */
    public function giveConsent(User $user): VaultProfile
    {
        return $this->mutate($this->profileFor($user), function (VaultProfile $p) {
            $p->consent_given_at = now();
            $p->consent_withdrawn_at = null;
        });
    }

    public function withdrawConsent(User $user): VaultProfile
    {
        return $this->mutate($this->profileFor($user), function (VaultProfile $p) {
            if ($p->consent_given_at !== null) {
                $p->consent_withdrawn_at = now();
            }
        });
    }

    // ───────────────────────────── staff and hiring partners ─────────────────────────────

    public function staffHide(VaultProfile $profile, User $staff, ?string $reason = null): VaultProfile
    {
        return $this->mutate($profile, function (VaultProfile $p) use ($staff, $reason) {
            $p->hidden_by_staff_at = now();
            $p->hidden_by_staff_id = $staff->id;
            $p->hidden_reason = $reason !== null ? mb_substr($reason, 0, 300) : null;
        });
    }

    public function staffUnhide(VaultProfile $profile): VaultProfile
    {
        return $this->mutate($profile, function (VaultProfile $p) {
            $p->hidden_by_staff_at = null;
            $p->hidden_by_staff_id = null;
            $p->hidden_reason = null;
        });
    }

    /** A hire — by an AptRun hiring partner, or reported back by Mellow Vault. Permanent: a hired student is never re-listed. */
    public function markHired(VaultProfile $profile, string $via, ?int $companyId = null, ?string $employerName = null): VaultProfile
    {
        return $this->mutate($profile, function (VaultProfile $p) use ($via, $companyId, $employerName) {
            $p->hired_at ??= now();
            $p->hired_via = $via;
            $p->hired_by_company_id = $companyId;
            $p->hired_employer_name = $employerName !== null ? mb_substr($employerName, 0, 160) : null;
        });
    }

    // ───────────────────────────── changes around the profile ─────────────────────────────

    /**
     * The student edited something Mellow Vault shows (name, bio, skills, links,
     * resume). Costs one indexed lookup for a student who is not in the Vault.
     */
    public function profileChanged(User $user): void
    {
        $profile = VaultProfile::where('user_id', $user->id)->first();

        if ($profile !== null && $profile->isBrowsable()) {
            $this->mutate($profile, fn () => null);
        }
    }

    /** An account was blocked or unblocked, or its plan changed: a student who no longer qualifies must come off the list immediately, and return when they do again. */
    public function accountStateChanged(User $user): void
    {
        $profile = VaultProfile::where('user_id', $user->id)->first();

        if ($profile !== null) {
            $this->mutate($profile, fn () => null);
        }
    }

    /** Pushes the current state of a profile out again (the admin's "Re-sync" button) — for a listed profile only. */
    public function resync(VaultProfile $profile): VaultProfile
    {
        return $this->mutate($profile, fn () => null, forceUpsert: true);
    }

    // ───────────────────────────── the one place state changes ─────────────────────────────

    /**
     * Re-reads the row under a lock, applies the change, re-derives the status,
     * saves, and queues whatever Mellow Vault now needs to be told.
     */
    private function mutate(VaultProfile $profile, callable $change, bool $forceUpsert = false): VaultProfile
    {
        return DB::transaction(function () use ($profile, $change, $forceUpsert) {
            /** @var VaultProfile $locked */
            $locked = VaultProfile::whereKey($profile->id)->lockForUpdate()->firstOrFail();
            $user = User::find($locked->user_id);
            $before = $locked->visibility_status;

            $change($locked);

            $after = $locked->resolveStatus((bool) $user?->is_blocked, $this->hasPlanAccess($user));
            $locked->visibility_status = $after;
            $locked->save();

            if ($after === VaultProfile::STATUS_VISIBLE) {
                $this->sync->queueUpsert($locked, immediate: $before !== VaultProfile::STATUS_VISIBLE || $forceUpsert);
            } elseif ($before === VaultProfile::STATUS_VISIBLE) {
                $this->sync->queueWithdraw($locked, $this->withdrawReason($locked, $after));
            }

            return $locked->refresh();
        });
    }

    /** Whether this student's plan includes the Vault — judged live, so a plan that has just ended counts as ended. */
    public function hasPlanAccess(?User $user): bool
    {
        return $user !== null && (bool) $user->effectiveEntitlements()['vault_access'];
    }

    private function withdrawReason(VaultProfile $profile, string $newStatus): string
    {
        return match ($newStatus) {
            VaultProfile::STATUS_UPGRADE_REQUIRED => 'plan_ended',
            VaultProfile::STATUS_HIRED => 'hired',
            VaultProfile::STATUS_HIDDEN_BY_MELLOW => 'hidden_by_staff',
            VaultProfile::STATUS_NOT_READY => 'below_threshold',
            default => 'consent_withdrawn',
        };
    }
}
