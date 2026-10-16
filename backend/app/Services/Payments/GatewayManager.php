<?php

namespace App\Services\Payments;

use App\Models\PaymentOrder;
use App\Services\Payments\Contracts\PaymentGateway;
use App\Services\Payments\Gateways\PayuGateway;
use App\Services\Payments\Gateways\RazorpayGateway;
use Illuminate\Contracts\Container\Container;
use Illuminate\Support\Facades\Log;

/**
 * Which payment gateway does what.
 *
 * `active()` is the one that opens NEW checkouts — chosen by `PAYMENT_GATEWAY` in .env (config
 * `billing.gateway`). `forOrder()` is the one an EXISTING order belongs to, whatever is active now:
 * an order opened on Razorpay is still re-checked, refunded and settled through Razorpay after the
 * switch to PayU, so nothing in flight is stranded and no payment is ever sent to the wrong gateway.
 *
 * Adding a gateway is one entry in GATEWAYS plus a class implementing PaymentGateway.
 */
class GatewayManager
{
    /** @var array<string, class-string<PaymentGateway>> */
    private const GATEWAYS = [
        PaymentOrder::GATEWAY_PAYU => PayuGateway::class,
        PaymentOrder::GATEWAY_RAZORPAY => RazorpayGateway::class,
    ];

    public function __construct(private readonly Container $container) {}

    /**
     * The gateway new checkouts go to, or null when `PAYMENT_GATEWAY` names something that does not exist.
     * A typo must switch payments OFF — never quietly route real money through a gateway nobody chose.
     *
     * An EMPTY value is not a typo: `PAYMENT_GATEWAY=` left blank in .env (a placeholder not filled in yet) reaches
     * config as "" rather than as "not set", and means the default, exactly as if the line were absent.
     */
    public function active(): ?PaymentGateway
    {
        $code = strtolower(trim((string) config('billing.gateway', PaymentOrder::GATEWAY_PAYU))) ?: PaymentOrder::GATEWAY_PAYU;

        if (! isset(self::GATEWAYS[$code])) {
            Log::error('PAYMENT_GATEWAY names an unknown payment gateway — payments are switched off', [
                'value' => $code,
                'known' => array_keys(self::GATEWAYS),
            ]);

            return null;
        }

        return $this->container->make(self::GATEWAYS[$code]);
    }

    /** @throws GatewayRequestException when no gateway by that code exists */
    public function get(string $code): PaymentGateway
    {
        if (! isset(self::GATEWAYS[$code])) {
            throw new GatewayRequestException("No payment gateway called \"{$code}\" exists.");
        }

        return $this->container->make(self::GATEWAYS[$code]);
    }

    /** @throws GatewayRequestException */
    public function forOrder(PaymentOrder $order): PaymentGateway
    {
        return $this->get((string) $order->gateway);
    }

    /** @return array<string, PaymentGateway> every gateway this app can speak to, keyed by code */
    public function all(): array
    {
        return array_map(fn (string $class) => $this->container->make($class), self::GATEWAYS);
    }
}
