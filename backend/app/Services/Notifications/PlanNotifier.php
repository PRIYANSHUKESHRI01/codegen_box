<?php

namespace App\Services\Notifications;

use App\Enums\NotificationType;
use App\Models\College;
use App\Models\Company;
use App\Models\PaymentOrder;
use App\Models\Subscription;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\NotificationAudience;

/**
 * Plans and money. A plan belongs to a student, a college or a company, so the recipient is whoever HOLDS it: the
 * student themself, the college's TPOs, the company's hiring team. When a college's plan ends, its students are told
 * too — their drive and hackathon access goes with it — and when a payment lands, Mellow's superadmins hear about it.
 *
 * Called from SubscriptionService (a superadmin/ops action or the expiry sweep), LifecycleMailService (which already
 * sits at every student-facing plan/payment event) and CheckoutService (a payment confirmed). Plan and account
 * categories can't be muted, so none of this can be missed.
 */
class PlanNotifier
{
    private const BILLING_URL = '/settings?tab=billing';

    public function __construct(private readonly NotificationService $notifications) {}

    /** A superadmin gave a student a plan (complimentary or against an offline payment). */
    public function granted(User $student, Subscription $subscription, int $days, bool $complimentary): void
    {
        $plan = $subscription->plan?->name ?? 'a plan';
        $until = $subscription->current_period_end?->format('j M Y');

        $this->notifications->notify($student, NotificationType::PlanChanged, "You're on the {$plan} plan", ($complimentary ? 'Added to your account by the AptRun team' : 'Activated on your account')." for {$days} days".($until ? ", until {$until}" : '').'. Everything it includes is unlocked now.', [
            'url' => '/dashboard/billing',
            'severity' => 'success',
            'data' => ['plan_code' => $subscription->plan?->code, 'change' => 'granted'],
            'group_key' => "plan.granted:{$subscription->id}",
        ]);
    }

    /** A student claimed a plan that is free right now (a 100% discount) — see SubscriptionService::redeemOffer(). */
    public function redeemed(User $student, Subscription $subscription): void
    {
        $plan = $subscription->plan?->name ?? 'a plan';
        $until = $subscription->current_period_end?->format('j M Y');

        $this->notifications->notify($student, NotificationType::PlanChanged, "You're on the {$plan} plan", "You redeemed the free {$plan} offer".($until ? ", valid until {$until}" : '').'. Everything it includes is unlocked now.', [
            'url' => '/dashboard/billing',
            'severity' => 'success',
            'data' => ['plan_code' => $subscription->plan?->code, 'change' => 'redeemed'],
            'group_key' => "plan.redeemed:{$subscription->id}",
        ]);
    }

    /** A running plan got more days — a student's, a college's or a company's. */
    public function extended(Subscription $subscription, int $days): void
    {
        $plan = $subscription->plan?->name ?? 'plan';
        $until = $subscription->current_period_end?->format('j M Y');

        $this->tell($subscription, NotificationType::PlanChanged, "{$this->whose($subscription)} {$plan} plan was extended", "Added {$days} day".($days === 1 ? '' : 's').($until ? ", now valid until {$until}" : '').'.', 'success', 'extended', 'extended:'.($subscription->current_period_end?->getTimestamp() ?? 0));
    }

    /** A superadmin ended a plan early. */
    public function ended(Subscription $subscription): void
    {
        if ($this->isFreeOrAddon($subscription)) {
            return;
        }

        $this->tell($subscription, NotificationType::PlanChanged, "{$this->whose($subscription)} {$subscription->plan->name} plan has ended", $this->endedBody($subscription), 'warning', 'ended', 'ended', alsoStudents: true);
    }

    /** A plan reached its end date. */
    public function expired(Subscription $subscription): void
    {
        if ($this->isFreeOrAddon($subscription)) {
            return;
        }

        $this->tell($subscription, NotificationType::PlanChanged, "{$this->whose($subscription)} {$subscription->plan->name} plan has expired", $this->endedBody($subscription, expired: true), 'warning', 'expired', 'expired', alsoStudents: true);
    }

    /** A college or company was put on a plan (or a demo started). */
    public function assigned(Subscription $subscription, bool $trial): void
    {
        $plan = $subscription->plan?->name ?? 'a plan';
        $until = $subscription->current_period_end?->format('j M Y');

        $this->tell($subscription, NotificationType::PlanChanged, $trial ? "Your {$plan} demo has started" : "Your plan is now {$plan}", ($trial ? 'A trial of everything it includes' : 'Everything it includes is active').($until ? ", until {$until}" : '').'.', 'success', 'assigned', 'assigned');
    }

    /** A superadmin changed a college's seat cap. */
    public function seatLimit(College $college, int $max, ?int $previous): void
    {
        $this->notifications->notifyMany(NotificationAudience::tpos($college->id), NotificationType::PlanChanged, 'Your student seat limit changed', 'Your plan now covers up to '.number_format($max).' students'.($previous !== null ? ' (was '.number_format($previous).')' : '').'.', [
            'url' => self::BILLING_URL,
            'data' => ['change' => 'seats', 'max_students' => $max],
            'group_key' => "plan.seats:{$college->id}:{$max}",
        ]);
    }

    // ───────────────────────────── payments ─────────────────────────────

    public function paymentSucceeded(PaymentOrder $order): void
    {
        if ($order->user_id !== null) {
            $this->notifications->notify($order->user_id, NotificationType::PaymentSucceeded, 'Payment received — thank you', "₹{$this->rupees($order)} for {$order->description()}. Your plan is active now; a receipt is on its way to your inbox.", [
                'url' => '/dashboard/billing',
                'data' => ['order' => $order->public_id],
                'group_key' => "payment.ok:{$order->public_id}",
            ]);
        }

        // Mellow's own view of revenue arriving.
        $buyer = $order->user_id !== null ? (User::find($order->user_id)?->name ?? 'A student') : 'A student';
        $this->notifications->notifyMany(NotificationAudience::superadmins(), NotificationType::PaymentReceived, "Payment received: ₹{$this->rupees($order)}", "{$buyer} bought {$order->description()}.", [
            'url' => '/superadmin?tab=payments',
            'data' => ['order' => $order->public_id],
            'group_key' => "payment.received:{$order->public_id}",
        ]);
    }

    public function paymentFailed(PaymentOrder $order): void
    {
        if ($order->user_id === null) {
            return;
        }

        $this->notifications->notify($order->user_id, NotificationType::PaymentFailed, "Your payment didn't go through", "₹{$this->rupees($order)} for {$order->description()} wasn't completed".($order->failure_reason ? " ({$order->failure_reason})" : '').'. You have not been charged for the plan — you can try again.', [
            'url' => '/dashboard/billing',
            'data' => ['order' => $order->public_id],
            'group_key' => "payment.failed:{$order->public_id}",
        ]);
    }

    public function refunded(PaymentOrder $order, int $refundedPaise, bool $full): void
    {
        if ($order->user_id === null) {
            return;
        }

        $this->notifications->notify($order->user_id, NotificationType::PaymentRefunded, $full ? 'Your payment was refunded' : 'Part of your payment was refunded', '₹'.number_format(intdiv($refundedPaise, 100)).' for '.$order->description().' is on its way back to you'.($full ? '; the plan it bought has ended' : '').'.', [
            'url' => '/dashboard/billing',
            'severity' => 'info',
            'data' => ['order' => $order->public_id],
            'group_key' => "payment.refunded:{$order->public_id}:{$refundedPaise}",
        ]);
    }

    // ───────────────────────────── internals ─────────────────────────────

    private function tell(Subscription $subscription, NotificationType $type, string $title, string $body, string $severity, string $change, string $keySuffix, bool $alsoStudents = false): void
    {
        $subscriber = $subscription->subscriber;
        $options = ['severity' => $severity, 'data' => ['plan_code' => $subscription->plan?->code, 'change' => $change], 'group_key' => "plan.{$subscription->id}:{$keySuffix}"];

        match (true) {
            $subscriber instanceof User => $this->notifications->notify($subscriber, $type, $title, $body, $options + ['url' => '/dashboard/billing']),
            $subscriber instanceof College => $this->college($subscriber, $type, $title, $body, $options, $alsoStudents),
            $subscriber instanceof Company => $this->notifications->notifyMany(NotificationAudience::companyTeam($subscriber->id), $type, $title, $body, $options + ['url' => self::BILLING_URL]),
            default => null,
        };
    }

    private function college(College $college, NotificationType $type, string $title, string $body, array $options, bool $alsoStudents): void
    {
        $this->notifications->notifyMany(NotificationAudience::tpos($college->id), $type, $title, $body, $options + ['url' => self::BILLING_URL]);

        // Their access to drives and hackathons goes with the college's plan, so they are told, once, after the response.
        if ($alsoStudents) {
            $this->notifications->notifyManyAfterResponse(NotificationAudience::students($college->id), $type, "Your college's plan has ended", 'Some features covered by your college may be locked until it is renewed. Your TPO has been told.', [
                'url' => '/dashboard/billing',
                'severity' => 'warning',
                'data' => ['change' => $options['data']['change'] ?? 'ended'],
                'group_key' => $options['group_key'].':students',
            ]);
        }
    }

    /** "Your" for a student's own plan, "Your college's" / "Your company's" otherwise. */
    private function whose(Subscription $subscription): string
    {
        return match (true) {
            $subscription->subscriber instanceof College => "Your college's",
            $subscription->subscriber instanceof Company => "Your company's",
            default => 'Your',
        };
    }

    private function endedBody(Subscription $subscription, bool $expired = false): string
    {
        return match (true) {
            $subscription->subscriber instanceof College => 'Features covered by the plan are locked for your students until it is renewed. Contact the AptRun team to continue.',
            $subscription->subscriber instanceof Company => 'Hiring features are locked until the plan is renewed. Contact the AptRun team to continue.',
            default => ($expired ? 'It ran its full term.' : 'The AptRun team ended it.')." You're on the free Coder plan now — upgrade any time to unlock everything again.",
        };
    }

    /**
     * "Not worth announcing": the free Coder plan or a Project Lab add-on ending is not news to a student. Only a student's
     * own plans are filtered — a college's or company's plan has no online price at all, which must never read as "free".
     */
    private function isFreeOrAddon(Subscription $subscription): bool
    {
        if ($subscription->plan === null) {
            return true;
        }

        return $subscription->subscriber instanceof User && ($subscription->plan->isFree() || $subscription->plan->isAddon());
    }

    private function rupees(PaymentOrder $order): string
    {
        return number_format($order->amountRupees());
    }
}
