<?php

namespace App\Services\Payments;

use App\Jobs\SendPaymentReceiptEmail;
use App\Models\ActivityLog;
use App\Models\PaymentOrder;
use App\Models\Plan;
use App\Models\User;
use App\Services\Payments\Contracts\PaymentGateway;
use App\Services\Payments\Gateways\RazorpayGateway;
use App\Services\PurchaseQuoteService;
use App\Services\SubscriptionService;
use App\Services\LifecycleMailService;
use App\Support\SingleMail;
use DomainException;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * Self-serve plan purchases, end to end — on whichever payment gateway is active (PayU or Razorpay).
 *
 *   begin()    price the cart (PurchaseQuoteService — the server is the only source
 *              of a price), open the gateway side of a checkout for exactly that
 *              amount, and store it as a PaymentOrder. The browser pays against that.
 *   confirm()  Razorpay's browser callback. Believed only after the HMAC signature checks
 *              out AND Razorpay itself confirms the payment. (PayU has no such callback:
 *              its browser return is handled by PayuReturnHandler, which asks PayU.)
 *   settleFromGateway()  what every reporter calls — the callback, the return, the
 *              webhook, the reconcile job: look at a payment as the gateway reports it
 *              and, if it is paid for the right amount, hand over the plan.
 *
 * The whole design is "one order row, many reporters, fulfil once": the reporters race (the
 * browser usually wins; the webhook is the safety net for a closed tab; reconcile is the
 * safety net for a lost webhook), and fulfil() takes a row lock and checks the status inside
 * it, so a plan is activated exactly once no matter who gets there first or how often a
 * gateway re-delivers.
 *
 * Nothing here trusts the client for an amount, a plan or a status. And nothing here knows
 * what a Razorpay order or a PayU txnid looks like: gateways hand back GatewayPayment /
 * GatewayRefund objects (see Contracts\PaymentGateway), so a plan is bought by the same code
 * path whoever took the money. An order is always settled, re-checked and refunded through the
 * gateway it was OPENED on, not whichever one is active now.
 */
class CheckoutService
{
    public function __construct(
        private readonly GatewayManager $gateways,
        private readonly SubscriptionService $subscriptions,
        private readonly PurchaseQuoteService $quotes,
    ) {}

    /** The gateway that opens new checkouts, if one is chosen and has its credentials. */
    public function activeGateway(): ?PaymentGateway
    {
        $gateway = $this->gateways->active();

        return $gateway !== null && $gateway->isConfigured() ? $gateway : null;
    }

    public function isAvailable(): bool
    {
        return $this->activeGateway() !== null;
    }

    // ───────────────────────────── 1. open a checkout ─────────────────────────────

    /**
     * @param  list<string>  $addonCodes
     * @param  array<string, mixed>  $buyer  what the buyer supplied besides the cart (e.g. a mobile number PayU needs)
     *
     * @throws PaymentException
     */
    public function begin(User $user, ?string $planCode, array $addonCodes = [], ?int $expectedTotal = null, array $buyer = []): PaymentOrder
    {
        $gateway = $this->activeGateway();

        if ($gateway === null) {
            throw PaymentException::unavailable();
        }

        // One checkout being opened per student at a time: a double-click or two tabs must
        // not create two gateway orders. (The cache store must support locks — the default
        // `database` store, `array`, `file` and `redis` all do.)
        $lock = Cache::lock('checkout:user:'.$user->id, 30);

        try {
            $lock->block(5);
        } catch (LockTimeoutException) {
            throw new PaymentException('Your checkout is still being set up. Please wait a few seconds and try again.', 'checkout_busy', 429);
        }

        try {
            $quote = $this->quotes->quote($user, $planCode, $addonCodes);

            // The price the student was looking at is confirmed or refused — never silently replaced.
            if ($expectedTotal !== null && $expectedTotal !== $quote['total']) {
                throw new PaymentException(
                    'The price changed since you opened this page. Please review the new total.',
                    PaymentException::PRICE_CHANGED,
                    409,
                    ['quote' => $quote],
                );
            }

            $this->assertPurchasable($user, $quote);

            // What this gateway needs to know about the buyer is checked once the purchase itself is known to be valid
            // (a student who cannot buy this plan is not asked for a phone number) and before anything is opened:
            // a missing number is a question for the student, never a half-created order.
            $buyerMeta = $gateway->prepareBuyer($user, $buyer);

            $cart = [
                'plan_code' => $planCode,
                'addons' => collect($addonCodes)->filter()->unique()->sort()->values()->all(),
            ];
            $amountPaise = $quote['total'] * 100;

            return $this->reusableOrder($gateway, $user, $cart, $amountPaise)
                ?? $this->createOrder($gateway, $user, $cart, $quote, $amountPaise, $buyerMeta);
        } finally {
            $lock->release();
        }
    }

    /** @throws PaymentException */
    private function assertPurchasable(User $user, array $quote): void
    {
        if ($quote['total'] <= 0) {
            throw new PaymentException('That plan is free, so there is nothing to pay for.', PaymentException::NOTHING_TO_PAY, 422);
        }

        // A college that pays for its students already covers them: charging one of them
        // personally would be taking money for something they already have.
        $coverage = $user->subscriptionCoverage();
        if ($coverage['source'] === 'institution' && ($coverage['days_remaining'] ?? 0) > 0) {
            throw new PaymentException(
                'Your college already includes full access for you, so there is no need to pay individually.',
                PaymentException::ALREADY_COVERED,
                409,
            );
        }

        // Buying a lower plan while a higher one still has paid time left would quietly
        // throw that time away. Renewing the same plan, or moving up, is fine.
        if ($lower = $this->lowerThanHeldPlan($user, $quote)) {
            [$held, $target] = $lower;
            $until = $held->current_period_end?->format('j M Y');

            throw new PaymentException(
                "You're on the {$held->plan->name} plan".($until ? " until {$until}" : '').". Switching to {$target->name} now would cut that short — you can choose {$target->name} after it ends.",
                PaymentException::DOWNGRADE_BLOCKED,
                409,
            );
        }
    }

    /**
     * The student's current paid plan and the cheaper plan this cart would replace it with, or null when
     * the cart renews or raises their plan (or they hold no paid plan with time left).
     *
     * @return array{0: \App\Models\Subscription, 1: Plan}|null
     */
    private function lowerThanHeldPlan(User $user, array $quote): ?array
    {
        $held = $user->activeSubscription();

        if ($held === null || ! $held->isActive() || $held->plan === null || $held->plan->isFree()) {
            return null;
        }

        foreach ($quote['lines'] as $line) {
            if ($line['kind'] !== Plan::KIND_BASE) {
                continue;
            }

            $target = Plan::where('code', $line['code'])->first();

            if ($target !== null && (int) $target->sort_order < (int) $held->plan->sort_order) {
                return [$held, $target];
            }
        }

        return null;
    }

    /**
     * The student opened Checkout, closed it, and is back: hand them the same open order
     * (same gateway, same cart, same amount, same credentials) instead of creating another —
     * for gateways whose orders can be paid more than once-open (Razorpay). PayU never takes the
     * same transaction id to a bank twice, so each of its attempts is a new order.
     */
    private function reusableOrder(PaymentGateway $gateway, User $user, array $cart, int $amountPaise): ?PaymentOrder
    {
        if (! $gateway->reusesOpenOrders()) {
            return null;
        }

        return PaymentOrder::where('user_id', $user->id)
            ->where('status', PaymentOrder::STATUS_CREATED)
            ->where('gateway', $gateway->code())
            ->where('gateway_mode', $gateway->mode())
            ->where('amount_paise', $amountPaise)
            ->where('created_at', '>=', now()->subMinutes((int) config('billing.order_reuse_minutes', 30)))
            ->latest('id')
            ->limit(10)
            ->get()
            ->first(fn (PaymentOrder $order) => $order->cart === $cart
                && ($order->meta['key_id'] ?? null) === $gateway->credentialsId());
    }

    /**
     * @param  array<string, mixed>  $buyerMeta  kept on the order (e.g. the phone number the gateway was given)
     *
     * @throws PaymentException
     */
    private function createOrder(PaymentGateway $gateway, User $user, array $cart, array $quote, int $amountPaise, array $buyerMeta = []): PaymentOrder
    {
        $publicId = (string) Str::ulid();

        try {
            $remote = $gateway->openOrder($amountPaise, $quote['currency'], $publicId, [
                'purchase_ref' => $publicId,
                'user_id' => (string) $user->id,
                'cart' => Str::limit(implode('+', array_column($quote['lines'], 'code')), 200, ''),
            ]);
        } catch (GatewayRequestException) {
            throw PaymentException::gateway();
        }

        return PaymentOrder::create([
            'public_id' => $publicId,
            'user_id' => $user->id,
            'payer_name' => $user->name,
            'payer_email' => $user->email,
            'gateway' => $gateway->code(),
            'gateway_mode' => $gateway->mode(),
            'gateway_order_id' => $remote['id'],
            'status' => PaymentOrder::STATUS_CREATED,
            'currency' => $quote['currency'],
            'amount_paise' => $amountPaise,
            'plan_code' => $cart['plan_code'],
            'cart' => $cart,
            'quote' => $quote,
            'meta' => array_merge(['key_id' => $gateway->credentialsId()], $remote['meta'] ?? [], $buyerMeta),
        ]);
    }

    /**
     * What the browser is handed to take the payment: Razorpay's `new Razorpay(options)` object, or the
     * signed form PayU's hosted page is POSTed. Assembled by the gateway from what the server priced, so
     * the browser gets nothing it could alter to its advantage.
     *
     * @return array<string, mixed>
     */
    public function checkoutOptions(PaymentOrder $order, User $user): array
    {
        return $this->gateways->forOrder($order)->checkoutPayload($order, $user);
    }

    // ───────────────────────────── 2. Razorpay's browser callback ─────────────────────────────

    /**
     * Razorpay Checkout's success callback: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`.
     * Idempotent — a double submit, or the webhook getting there first, returns the already-paid order.
     *
     * @throws PaymentException
     */
    public function confirm(User $user, string $gatewayOrderId, string $paymentId, string $signature): PaymentOrder
    {
        // Looked up by the id WE stored, scoped to this student: one student cannot confirm
        // (or probe) another's order, and an unknown id is simply "not found".
        $order = PaymentOrder::where('gateway', PaymentOrder::GATEWAY_RAZORPAY)
            ->where('gateway_order_id', $gatewayOrderId)
            ->where('user_id', $user->id)
            ->first();

        if ($order === null) {
            throw new PaymentException('We could not find that payment. If money was deducted, it will be refunded automatically.', PaymentException::ORDER_NOT_FOUND, 404);
        }

        /** @var RazorpayGateway $razorpay */
        $razorpay = $this->gateways->get(PaymentOrder::GATEWAY_RAZORPAY);

        if (! $razorpay->verifyPaymentSignature($order->gateway_order_id, $paymentId, $signature)) {
            Log::warning('Razorpay payment signature mismatch', ['order' => $order->public_id, 'user_id' => $user->id]);

            throw new PaymentException('We could not verify that payment. If money was deducted, it will be refunded automatically.', PaymentException::SIGNATURE_INVALID, 422);
        }

        return $this->conclude($order, fn () => $razorpay->fetchPayment($paymentId));
    }

    /**
     * Turns "the gateway vouched for a payment" into the outcome a student is told, refusing in words they can
     * act on. `$fetch` is how to ask the gateway what state that payment is really in.
     *
     * @param  callable(): GatewayPayment  $fetch
     *
     * @throws PaymentException
     */
    private function conclude(PaymentOrder $order, callable $fetch): PaymentOrder
    {
        // A payment that went back to the student (automatically, or from the dashboard) is not a purchase,
        // however the order got there: say so rather than "success".
        if ($order->status === PaymentOrder::STATUS_REFUNDED) {
            throw new PaymentException(
                $order->fulfilled_at === null
                    ? "This payment was refunded in full, so the plan wasn't activated. The money is on its way back to you."
                    : 'This payment has been refunded in full.',
                PaymentException::PAYMENT_REFUNDED,
                409,
            );
        }

        if ($order->isPaid()) {
            return $order;
        }

        try {
            // The signature proves the callback is genuine; the API tells us what state the payment is actually in.
            $order = $this->settleFromGateway($order, $fetch());
        } catch (GatewayRequestException) {
            throw new PaymentException(
                "Your payment went through, but we couldn't confirm it with the bank just yet. Your plan will activate automatically within a few minutes — you don't need to pay again.",
                'activation_delayed',
                503,
            );
        } catch (Throwable $e) {
            Log::error('Activating a verified payment failed; it will be retried', ['order' => $order->public_id, 'error' => $e->getMessage()]);

            throw new PaymentException(
                "Your payment went through and we're activating your plan — this can take a minute. You don't need to pay again.",
                'activation_delayed',
                503,
            );
        }

        return match (true) {
            $order->isPaid() => $order,
            $order->status === PaymentOrder::STATUS_NEEDS_REVIEW => throw new PaymentException(
                "We received your payment but couldn't activate your plan automatically. Our team has been notified — you'll be activated or refunded shortly.",
                PaymentException::PAYMENT_MISMATCH,
                409,
            ),
            default => throw new PaymentException('That payment has not completed yet. Please try again.', PaymentException::PAYMENT_NOT_COMPLETE, 409),
        };
    }

    // ───────────────────────────── 3. one payment, as the gateway reports it ─────────────────────────────

    /**
     * Acts on a payment fetched from (or delivered by) the order's gateway. Safe to call with
     * the same payment any number of times, from any reporter.
     *
     * @param  GatewayPayment|array<string, mixed>  $payment  a raw gateway entity is normalised by the order's own gateway
     *
     * @throws GatewayRequestException when an authorized payment could not be captured (the caller retries later)
     */
    public function settleFromGateway(PaymentOrder $order, GatewayPayment|array $payment): PaymentOrder
    {
        $gateway = $this->gateways->forOrder($order);

        if (is_array($payment)) {
            $payment = $gateway->normalizePayment($payment);
        }

        if ($payment->isFailed()) {
            $this->recordFailure($order, $payment);

            return $order->refresh();
        }

        if (! $payment->isPaid()) {
            return $order;
        }

        if (! $this->paymentMatchesOrder($order, $payment)) {
            $this->flagForReview($order, 'payment_mismatch', 'The payment does not match the order (amount, currency or order id).', $payment);

            return $order->refresh();
        }

        if ($payment->status === GatewayPayment::AUTHORIZED) {
            $payment = $gateway->capture($payment);
        }

        return $this->fulfil($order, $payment);
    }

    private function paymentMatchesOrder(PaymentOrder $order, GatewayPayment $payment): bool
    {
        return $payment->id !== ''   // an unidentifiable payment can neither be recorded (unique ids) nor refunded
            && $payment->orderId === $order->gateway_order_id
            && $payment->amountPaise === $order->amount_paise
            && $payment->currency === $order->currency;
    }

    // ───────────────────────────── fulfilment ─────────────────────────────

    /**
     * Marks the order paid and activates what it bought — once. Everything happens inside one
     * transaction behind a row lock on the order: whoever gets the lock second finds it paid and
     * returns, so a callback, a webhook and a reconcile racing each other buy exactly one plan.
     */
    private function fulfil(PaymentOrder $order, GatewayPayment $payment): PaymentOrder
    {
        $fulfilledNow = false;

        try {
            $paid = DB::transaction(function () use ($order, $payment, &$fulfilledNow) {
                $locked = PaymentOrder::whereKey($order->id)->lockForUpdate()->firstOrFail();

                if ($locked->isPaid()) {
                    return $locked;
                }

                $user = $locked->user_id !== null ? User::find($locked->user_id) : null;

                if ($user === null) {
                    throw new DomainException('The buyer no longer has an account.');
                }

                // A checkout opened for a cheaper plan and paid only after a dearer one was bought (two tabs, a
                // forgotten window): honouring it would replace what they have with less. Money goes back instead.
                if ($this->lowerThanHeldPlan($user, $locked->quote) !== null) {
                    throw new DomainException('The buyer now holds a higher plan than this payment was for.');
                }

                $subscriptions = $this->subscriptions->purchase($user, $locked->quote, [
                    'reference' => $locked->public_id,
                    'payment_order_id' => $locked->id,
                    'gateway' => $locked->gateway,
                    'gateway_payment_id' => $payment->id,
                ]);

                $locked->forceFill([
                    'status' => PaymentOrder::STATUS_PAID,
                    'gateway_payment_id' => $payment->id,
                    'method' => $payment->method ?? $locked->method,
                    'paid_at' => now(),
                    'fulfilled_at' => now(),
                    'failure_code' => null,
                    'failure_reason' => null,
                    'meta' => array_merge($locked->meta ?? [], array_filter([
                        'subscription_ids' => collect($subscriptions)->pluck('id')->all(),
                        'fee_paise' => $payment->feePaise,
                        'tax_paise' => $payment->taxPaise,
                    ], fn ($v) => $v !== null)),
                ])->save();

                $fulfilledNow = true;

                return $locked;
            });
        } catch (Throwable $e) {
            return $this->fulfilmentFailed($order, $payment, $e);
        }

        if ($fulfilledNow) {
            // One action, one recipient: sent by this very request (no queue worker needed) — see App\Support\SingleMail.
            SingleMail::afterResponse(new SendPaymentReceiptEmail($paid->id));
        }

        return $paid;
    }

    /**
     * The payment is real but handing over the plan failed.
     *
     * A permanent reason (the buyer's account is gone, a plan was removed) is not going to fix
     * itself: flag the order for a human and give the money back automatically — a student must
     * never be out of pocket and without the plan. Anything else (a deadlock, a dropped
     * connection) is transient: rethrow, so the webhook is retried by the gateway and the reconcile
     * job picks the order up, and the plan is activated on the next attempt.
     */
    private function fulfilmentFailed(PaymentOrder $order, GatewayPayment $payment, Throwable $e): PaymentOrder
    {
        $permanent = $e instanceof DomainException || $e instanceof ModelNotFoundException;

        Log::critical('A payment was captured but the plan could not be activated', [
            'order' => $order->public_id,
            'payment_id' => $payment->id,
            'permanent' => $permanent,
            'error' => $e->getMessage(),
        ]);

        if (! $permanent) {
            throw $e;
        }

        $this->flagForReview($order, 'fulfilment_failed', Str::limit($e->getMessage(), 240), $payment);
        $this->refund($order->refresh(), 'Automatic refund: the plan could not be activated.');

        return $order->refresh();
    }

    private function flagForReview(PaymentOrder $order, string $code, string $reason, GatewayPayment $payment): void
    {
        Log::error('Payment order needs review', ['order' => $order->public_id, 'code' => $code, 'reason' => $reason, 'payment_id' => $payment->id]);

        PaymentOrder::whereKey($order->id)->whereNotIn('status', [PaymentOrder::STATUS_PAID, PaymentOrder::STATUS_REFUNDED, PaymentOrder::STATUS_PARTIALLY_REFUNDED])->update([
            'status' => PaymentOrder::STATUS_NEEDS_REVIEW,
            // An unidentifiable payment must not be written into a unique column (every blank would collide).
            'gateway_payment_id' => $payment->id !== '' ? $payment->id : null,
            'method' => $payment->method,
            'paid_at' => now(),
            'failure_code' => $code,
            'failure_reason' => $reason,
        ]);
    }

    // ───────────────────────────── failed attempts ─────────────────────────────

    /**
     * A payment attempt failed (card declined, UPI timed out…). The order stays open — the student
     * can try again — but the reason is kept so their payment history can say why.
     *
     * @param  GatewayPayment|array<string, mixed>  $payment
     */
    public function recordFailure(PaymentOrder $order, GatewayPayment|array $payment): void
    {
        if (is_array($payment)) {
            $payment = $this->gateways->forOrder($order)->normalizePayment($payment);
        }

        $recorded = DB::transaction(function () use ($order, $payment) {
            $locked = PaymentOrder::whereKey($order->id)->lockForUpdate()->first();

            if ($locked === null || ! $locked->isAwaitingPayment()) {
                return null;
            }

            $seen = $locked->meta['failed_payments'] ?? [];

            if ($payment->id !== '' && in_array($payment->id, $seen, true)) {
                return null;
            }

            $locked->forceFill([
                'attempts' => $locked->attempts + 1,
                'failure_code' => Str::limit($payment->errorCode ?? 'payment_failed', 80, ''),
                'failure_reason' => Str::limit($payment->errorDescription ?? 'The payment did not go through.', 500, ''),
                'method' => $payment->method ?? $locked->method,
                'meta' => array_merge($locked->meta ?? [], ['failed_payments' => array_slice([...$seen, $payment->id], -20)]),
            ])->save();

            return $locked;
        });

        // Told once per order (the mail's own key), however many times they retry and fail.
        if ($recorded !== null) {
            app(LifecycleMailService::class)->paymentFailed($recorded);
        }
    }

    // ───────────────────────────── refunds ─────────────────────────────

    /**
     * Asks the order's gateway to refund its payment in full. Razorpay confirms at once, so the order
     * flips to `refunded` (and any access is revoked) right away; PayU only queues the refund, and the
     * order flips now too — a failure PayU reports later is caught by revertRefund(). One code path for
     * refunds we start and refunds finance starts from a gateway dashboard.
     */
    public function refund(PaymentOrder $order, string $reason): bool
    {
        if ($order->gateway_payment_id === null) {
            return false;
        }

        try {
            $refund = $this->gateways->forOrder($order)->refund($order, null, $reason);
        } catch (GatewayRequestException $e) {
            if ($e->isAlreadyDone()) {
                return true;
            }

            Log::critical('Automatic refund failed — refund this payment manually', ['order' => $order->public_id, 'payment_id' => $order->gateway_payment_id]);

            return false;
        }

        $order->forceFill(['refund_id' => $refund->id !== '' ? $refund->id : null, 'refund_reason' => Str::limit($reason, 250, '')])->save();

        // The gateway has just told us the refund exists, so close the order now rather than waiting for its
        // webhook (which then changes nothing — refunds are recorded by their id).
        if ($refund->id !== '') {
            try {
                $this->applyRefund($order->refresh(), new GatewayRefund($refund->id, $refund->amountPaise, $reason));
            } catch (Throwable $e) {
                report($e);   // the refund itself went through; the webhook (or an operator) can still close the order
            }
        }

        return true;
    }

    /**
     * A refund the gateway has made (or accepted): record it, and when the whole payment has gone back, take
     * the plan away. A partial refund (a goodwill gesture) never touches access.
     */
    public function applyRefund(PaymentOrder $order, GatewayRefund $refund): PaymentOrder
    {
        $applied = DB::transaction(function () use ($order, $refund) {
            $locked = PaymentOrder::whereKey($order->id)->lockForUpdate()->firstOrFail();

            $meta = $locked->meta ?? [];
            $refunds = $meta['refunds'] ?? [];
            $refunds[$refund->id] = $refund->amountPaise;   // keyed by refund id: a re-delivered event changes nothing

            $total = min((int) array_sum($refunds), $locked->amount_paise);
            $full = $total >= $locked->amount_paise;
            $label = $this->gateways->forOrder($locked)->label();

            $locked->forceFill([
                'status' => $full ? PaymentOrder::STATUS_REFUNDED : PaymentOrder::STATUS_PARTIALLY_REFUNDED,
                'refund_id' => $refund->id,
                'refunded_paise' => $total,
                'refunded_at' => now(),
                'refund_reason' => Str::limit($refund->reason ?? $locked->refund_reason ?? "Refunded from the {$label} dashboard", 250, ''),
                'meta' => array_merge($meta, ['refunds' => $refunds]),
            ])->save();

            $user = $locked->user_id !== null ? User::find($locked->user_id) : null;

            if ($user !== null) {
                $revoked = $full ? $this->subscriptions->revokePurchase($user, $meta['subscription_ids'] ?? []) : 0;

                ActivityLog::record(
                    $user,
                    $full ? 'Payment refunded in full' : 'Payment partially refunded',
                    'Payment',
                    $locked->description(),
                    ['purchase_ref' => $locked->public_id, 'refunded_rupees' => intdiv($total, 100), 'subscriptions_cancelled' => $revoked]
                );
            }

            return $locked;
        });

        // After the transaction has committed, so a rolled-back refund is never announced. The mail's key is the
        // refund id: the gateway re-delivering the same refund event cannot send it twice.
        app(LifecycleMailService::class)->refunded($order, $refund->id, $refund->amountPaise, $applied->status === PaymentOrder::STATUS_REFUNDED);

        return $applied;
    }

    /**
     * The gateway reports that a refund it had accepted did NOT go through (PayU refunds are queued first and
     * settled with the bank later, so this can happen after applyRefund()). Take that refund back out of the
     * record. An order that never handed over a plan and is no longer refunded is money the customer paid and
     * has neither a plan nor their money back — it goes to `needs_review`, loudly, so a person makes it right.
     */
    public function revertRefund(PaymentOrder $order, string $refundId): PaymentOrder
    {
        return DB::transaction(function () use ($order, $refundId) {
            $locked = PaymentOrder::whereKey($order->id)->lockForUpdate()->firstOrFail();

            $meta = $locked->meta ?? [];
            $refunds = $meta['refunds'] ?? [];

            if (! array_key_exists($refundId, $refunds)) {
                return $locked;   // we never recorded this refund, so there is nothing to undo
            }

            unset($refunds[$refundId]);

            $total = min((int) array_sum($refunds), $locked->amount_paise);

            $status = match (true) {
                $total >= $locked->amount_paise => PaymentOrder::STATUS_REFUNDED,
                $total > 0 => PaymentOrder::STATUS_PARTIALLY_REFUNDED,
                $locked->fulfilled_at !== null => PaymentOrder::STATUS_PAID,
                default => PaymentOrder::STATUS_NEEDS_REVIEW,
            };

            $locked->forceFill([
                'status' => $status,
                'refunded_paise' => $total,
                'refunded_at' => $total > 0 ? $locked->refunded_at : null,
                'refund_id' => $total > 0 ? $locked->refund_id : null,
                'refund_reason' => $total > 0 ? $locked->refund_reason : null,
                'failure_code' => $status === PaymentOrder::STATUS_NEEDS_REVIEW ? 'refund_failed' : $locked->failure_code,
                'failure_reason' => $status === PaymentOrder::STATUS_NEEDS_REVIEW
                    ? 'The refund was rejected by the payment gateway. The customer has paid and has neither a plan nor their money back — refund it from the gateway dashboard.'
                    : $locked->failure_reason,
                'meta' => array_merge($meta, ['refunds' => $refunds]),
            ])->save();

            Log::critical('A refund failed at the payment gateway — the customer has NOT been repaid', [
                'order' => $locked->public_id,
                'payment_id' => $locked->gateway_payment_id,
                'refund_id' => $refundId,
                'order_status' => $status,
            ]);

            return $locked;
        });
    }

    // ───────────────────────────── reconcile ─────────────────────────────

    /**
     * Asks the order's gateway what actually happened to an order we are still waiting on — the net under
     * a lost webhook and a student who paid and closed the tab. Also used by the student's status poll
     * and the superadmin's "re-check". Gives up on orders nobody paid in the gateway's window
     * (they stay payable: a late payment is still honoured).
     *
     * @throws GatewayRequestException when the gateway cannot be reached
     */
    public function reconcile(PaymentOrder $order): PaymentOrder
    {
        if (! $order->isAwaitingPayment() && $order->status !== PaymentOrder::STATUS_NEEDS_REVIEW) {
            return $order;
        }

        $gateway = $this->gateways->forOrder($order);
        $payments = collect($gateway->paymentsFor($order));

        $paid = $payments->first(fn (GatewayPayment $p) => $p->status === GatewayPayment::CAPTURED)
            ?? $payments->first(fn (GatewayPayment $p) => $p->status === GatewayPayment::AUTHORIZED);

        if ($paid !== null) {
            return $this->settleFromGateway($order, $paid);
        }

        $failed = $payments->last(fn (GatewayPayment $p) => $p->isFailed());
        if ($failed !== null) {
            $this->recordFailure($order, $failed);
        }

        $order->refresh();

        if ($order->status === PaymentOrder::STATUS_CREATED
            && $order->created_at->lt(now()->subMinutes($gateway->expireAfterMinutes()))) {
            $order->forceFill(['status' => PaymentOrder::STATUS_EXPIRED])->save();
        }

        return $order;
    }
}
