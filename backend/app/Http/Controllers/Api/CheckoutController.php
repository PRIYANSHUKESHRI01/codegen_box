<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentOrder;
use App\Models\User;
use App\Services\OfferRedemptionService;
use App\Services\Payments\CheckoutService;
use App\Services\Payments\GatewayRequestException;
use App\Services\Payments\PaymentException;
use App\Services\SubscriptionPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A student paying for a plan, in the order the browser does it:
 *
 *   POST /me/checkout          price the cart on the server, open an order on the ACTIVE gateway
 *                              (PayU or Razorpay — config billing.gateway) and return what the browser
 *                              needs to pay: PayU's signed form (`checkout.gateway = "payu"`, the browser
 *                              posts it to PayU's page) or Razorpay's Checkout options
 *   (card/UPI/netbanking details are typed on the gateway's own page or window — never on our server)
 *   POST /me/checkout/redeem   a plan the superadmin has discounted to ₹0: claimed with one click, no gateway involved
 *                              (and /me/checkout refuses a ₹0 cart, so a price is paid for XOR redeemed — never both)
 *   POST /me/checkout/verify   Razorpay only: its signed success callback — signature + gateway check,
 *                              then the plan activates and the new subscription state comes back.
 *                              (PayU's browser comes back through POST /payu/return instead, see
 *                              PayuReturnController, and lands on the billing page.)
 *   GET  /me/payments/{id}     status of one payment — what the browser polls while it waits, and a lazy
 *                              "ask the gateway" for unpaid orders
 *   GET  /me/payments          the student's payment history (receipts)
 *
 * Only a student (role: user) buys; a college's plan is assigned by Mellow staff. All the
 * rules (price, downgrade guard, college cover, idempotency) live in CheckoutService.
 */
class CheckoutController extends Controller
{
    public function __construct(
        private readonly CheckoutService $checkout,
        private readonly OfferRedemptionService $redemptions,
        private readonly SubscriptionPresenter $presenter,
    ) {}

    public function create(Request $request): JsonResponse
    {
        $user = $this->student($request);

        $validated = $request->validate([
            'plan_code' => ['nullable', 'string', 'max:64'],
            'addons' => ['nullable', 'array', 'max:5'],
            'addons.*' => ['string', 'max:64'],
            // The total the student was looking at; a mismatch is refused (409 price_changed), never silently charged.
            'expected_total' => ['nullable', 'integer', 'min:0'],
            // A mobile number for gateways that need one (PayU). Only used when the student has none on file;
            // it goes to the gateway for this payment and is not written to their profile.
            'phone' => ['nullable', 'string', 'max:20'],
        ]);

        $order = $this->checkout->begin(
            $user,
            $validated['plan_code'] ?? null,
            $validated['addons'] ?? [],
            isset($validated['expected_total']) ? (int) $validated['expected_total'] : null,
            ['phone' => $validated['phone'] ?? null],
        );

        return response()->json([
            'checkout' => $this->checkout->checkoutOptions($order, $user),
            'quote' => $order->quote,
        ], 201);
    }

    /**
     * Claim a plan whose price the superadmin has discounted to ₹0 — no gateway, no payment page. The server prices the
     * plan again itself and refuses anything that costs money (409 payment_required) or whose price moved since the
     * student looked (409 price_changed); see OfferRedemptionService.
     */
    public function redeem(Request $request): JsonResponse
    {
        $user = $this->student($request);

        $validated = $request->validate([
            'plan_code' => ['required', 'string', 'max:64'],
            'expected_total' => ['nullable', 'integer', 'min:0'],
        ]);

        $subscription = $this->redemptions->redeem(
            $user,
            $validated['plan_code'],
            isset($validated['expected_total']) ? (int) $validated['expected_total'] : null,
        );

        return response()->json($this->presenter->individual($user->fresh()) + [
            'redemption' => [
                'plan_code' => $subscription->plan->code,
                'plan_name' => $subscription->plan->name,
                'current_period_end' => $subscription->current_period_end,
                'days_remaining' => $subscription->daysRemaining(),
            ],
        ], 201);
    }

    public function verify(Request $request): JsonResponse
    {
        $user = $this->student($request);

        $validated = $request->validate([
            'razorpay_order_id' => ['required', 'string', 'max:64'],
            'razorpay_payment_id' => ['required', 'string', 'max:64'],
            'razorpay_signature' => ['required', 'string', 'max:128'],
        ]);

        $order = $this->checkout->confirm(
            $user,
            $validated['razorpay_order_id'],
            $validated['razorpay_payment_id'],
            $validated['razorpay_signature'],
        );

        return response()->json($this->presenter->individual($user->fresh()) + ['payment' => $order->toReceipt()]);
    }

    public function show(Request $request, string $publicId): JsonResponse
    {
        $user = $this->student($request);

        $order = PaymentOrder::where('public_id', $publicId)->where('user_id', $user->id)->firstOrFail();

        // The student is waiting on this answer, so don't make them wait for a webhook that may never come
        // (local development has no public URL for one): ask the order's gateway directly.
        if ($order->isAwaitingPayment()) {
            try {
                $order = $this->checkout->reconcile($order);
            } catch (GatewayRequestException) {
                // The gateway is unreachable: report what we know; the next poll tries again.
            }
        }

        return response()->json(['payment' => $order->toReceipt()]);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $this->student($request);

        $payments = PaymentOrder::where('user_id', $user->id)
            // Orders that were opened and closed again without a payment attempt are noise, not history.
            ->where(fn ($q) => $q->whereNotIn('status', [PaymentOrder::STATUS_CREATED, PaymentOrder::STATUS_EXPIRED])
                ->orWhereNotNull('failure_code'))
            ->latest('id')
            ->limit(50)
            ->get();

        return response()->json([
            'payments' => $payments->map->toReceipt()->values(),
            'checkout' => $this->presenter->individual($user)['checkout'],
        ]);
    }

    private function student(Request $request): User
    {
        $user = $request->user();

        if ($user->role !== User::ROLE_USER) {
            throw new PaymentException('Only individual student accounts can purchase plans.', 'student_only', 403);
        }

        return $user;
    }
}
