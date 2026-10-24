<?php

namespace App\Services;

use App\Enums\LifecycleEmail;
use App\Jobs\SendLifecycleEmail;
use App\Models\LifecycleEmailLog;
use App\Models\PaymentOrder;
use App\Models\Subscription;
use App\Models\User;
use App\Enums\NotificationType;
use App\Services\Notifications\PlanNotifier;
use App\Support\SingleMail;
use Throwable;

/**
 * "Something just happened to this student — tell them." One small method per
 * event, called from the one place that makes it true (CheckoutService for a
 * failed payment or a refund, SubscriptionService for a plan being given, extended,
 * ended or expiring, VaultService for the Vault score, the two password flows).
 *
 * Every method is fire-and-forget by design: telling the student must never be
 * the reason the thing itself fails. Anything that throws is reported to the log
 * and swallowed here, and the send goes through SingleMail (inside the request
 * that caused it, no queue worker needed — see that class).
 *
 * The things that are DUE rather than that happened — reminders, nudges, win-backs —
 * are LifecycleSweepService's job.
 */
class LifecycleMailService
{
    /** The in-app twin of a mail: same fire-and-forget rule — telling them must never be the reason the thing itself fails. */
    private function notifyInApp(\Closure $work): void
    {
        try {
            $work();
        } catch (Throwable $e) {
            report($e);
        }
    }

    /**
     * The first time anyone who was ADDED by someone else (a college, a TPO, Mellow staff) — a student, section coordinator, TPO, company hiring-team member or Mellow staff, never a superadmin — sets their own password:
     * the moment the account actually becomes theirs. Once ever — a later superadmin-issued temporary password and a
     * second reset must not "welcome" them again. Returns false when they have been welcomed already.
     */
    public function welcomeActivated(User $user): bool
    {
        try {
            if (LifecycleEmailLog::where('user_id', $user->id)->where('type', LifecycleEmail::WelcomeActivated->value)->exists()) {
                return false;
            }
        } catch (Throwable $e) {
            report($e);

            return false;
        }

        return $this->send($user->id, LifecycleEmail::WelcomeActivated, [
            'college' => $user->college?->name,
            'role' => $user->role,
            'section' => $user->section,
            'company' => $user->company?->name,
        ], 'activation');
    }

    public function passwordChanged(User $user, string $via): void
    {
        $now = now();

        // The security notice, in-app as well as by e-mail: if it was not them, the bell is where they will see it first.
        $this->notifyInApp(fn () => app(NotificationService::class)->notify($user, NotificationType::PasswordChanged, 'Your password was changed', match ($via) {
            'reset' => 'You reset your password. If this was not you, contact support right away.',
            default => 'Your password was changed from Settings. If this was not you, reset it and contact support right away.',
        }, ['url' => '/settings?tab=security', 'group_key' => 'password.changed:'.$user->id.':'.$now->format('YmdHis'), 'data' => ['via' => $via]]));

        $this->send($user->id, LifecycleEmail::PasswordChanged, ['via' => $via, 'at' => $now->toIso8601String()], 'at'.$now->format('YmdHis'));
    }

    public function paymentFailed(PaymentOrder $order): void
    {
        if ($order->user_id === null) {
            return;
        }

        $this->notifyInApp(fn () => app(PlanNotifier::class)->paymentFailed($order));

        // One mail per order: a student who retries three times gets told once, not three times.
        $this->send($order->user_id, LifecycleEmail::PaymentFailed, [
            'order' => $order->public_id,
            'plan' => $order->description(),
            'amount' => $order->amountRupees(),
            'reason' => $order->failure_reason,
        ], $order->public_id);
    }

    public function refunded(PaymentOrder $order, string $refundId, int $refundedPaise, bool $full): void
    {
        if ($order->user_id === null) {
            return;
        }

        $this->notifyInApp(fn () => app(PlanNotifier::class)->refunded($order, $refundedPaise, $full));

        $this->send($order->user_id, LifecycleEmail::RefundProcessed, [
            'order' => $order->public_id,
            'plan' => $order->description(),
            'amount' => intdiv($refundedPaise, 100),
            'full' => $full,
        ], $refundId !== '' ? $refundId : $order->public_id.'-refund');
    }

    public function planGranted(User $user, Subscription $subscription, int $days, bool $complimentary): void
    {
        $this->send($user->id, LifecycleEmail::PlanGranted, [
            'plan' => $subscription->plan?->name,
            'plan_code' => $subscription->plan?->code,
            'days' => $days,
            'ends_at' => $subscription->current_period_end?->toIso8601String(),
            'complimentary' => $complimentary,
        ], 'sub'.$subscription->id);
    }

    public function planExtended(Subscription $subscription, int $days): void
    {
        $student = $this->studentOf($subscription);

        if ($student === null) {
            return;
        }

        $this->send($student->id, LifecycleEmail::PlanExtended, [
            'plan' => $subscription->plan?->name,
            'plan_code' => $subscription->plan?->code,
            'days' => $days,
            'ends_at' => $subscription->current_period_end?->toIso8601String(),
        ], 'sub'.$subscription->id.'-'.($subscription->current_period_end?->getTimestamp() ?? 0));
    }

    /** A superadmin ended a student's paid plan. (A refund ends one too, but that student is told by the refund mail.) */
    public function planEnded(Subscription $subscription): void
    {
        $student = $this->studentOf($subscription);

        if ($student === null || $subscription->plan === null || $subscription->plan->isFree() || $subscription->plan->isAddon()) {
            return;
        }

        $this->send($student->id, LifecycleEmail::PlanEnded, [
            'plan' => $subscription->plan->name,
            'plan_code' => $subscription->plan->code,
        ], 'sub'.$subscription->id);
    }

    public function planExpired(Subscription $subscription): void
    {
        $student = $this->studentOf($subscription);

        if ($student === null || $subscription->plan === null) {
            return;
        }

        $this->send($student->id, LifecycleEmail::PlanExpired, [
            'plan' => $subscription->plan->name,
            'plan_code' => $subscription->plan->code,
            'ended_at' => $subscription->current_period_end?->toIso8601String(),
            'had_vault' => (bool) $subscription->plan->vault_access,
        ], 'sub'.$subscription->id);
    }

    public function vaultDelisted(User $user, int $score, array $steps = []): void
    {
        $this->send($user->id, LifecycleEmail::VaultDelisted, [
            'score' => $score,
            'enter' => (int) config('vault.enter_score', 60),
            'exit' => (int) config('vault.exit_score', 55),
            'steps' => array_values($steps),
        ], 'at'.now()->format('YmdHis'));
    }

    /** $stage 0 = the moment they qualify; 1 and 2 are the reminders the daily run sends. */
    public function vaultUpgrade(User $user, int $score, int $stage = 0): bool
    {
        $key = $stage === 0 ? 'first' : 'r'.$stage;

        // Called from the Vault refresh, which runs every few minutes for an active student: one cheap lookup beats
        // building a job each time just to have it find the message already sent.
        try {
            if (LifecycleEmailLog::where('user_id', $user->id)->where('type', LifecycleEmail::VaultUpgrade->value)->where('dedupe_key', $key)->exists()) {
                return false;
            }
        } catch (Throwable $e) {
            report($e);   // e.g. code deployed a moment before `migrate`: the Vault refresh must carry on regardless

            return false;
        }

        return $this->send($user->id, LifecycleEmail::VaultUpgrade, [
            'score' => $score,
            'enter' => (int) config('vault.enter_score', 60),
            'stage' => $stage,
        ], $key);
    }

    /** @param array<string, mixed> $data */
    private function send(int $userId, LifecycleEmail $type, array $data, string $key): bool
    {
        try {
            SingleMail::afterResponse(new SendLifecycleEmail($userId, $type->value, $data, $key));

            return true;
        } catch (Throwable $e) {
            report($e);

            return false;
        }
    }

    /** The student a subscription belongs to — null for a college's or a company's. */
    private function studentOf(Subscription $subscription): ?User
    {
        if ($subscription->subscriber_type !== User::class) {
            return null;
        }

        $user = User::find($subscription->subscriber_id);

        return $user !== null && $user->isStudent() ? $user : null;
    }
}
