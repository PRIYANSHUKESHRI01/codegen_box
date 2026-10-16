<?php

namespace App\Console\Commands;

use App\Models\PaymentOrder;
use App\Models\PaymentWebhookEvent;
use App\Services\Payments\CheckoutService;
use App\Services\Payments\GatewayManager;
use App\Services\Payments\GatewayRequestException;
use Illuminate\Console\Command;

/**
 * Scheduled every few minutes (routes/console.php). The safety net under the other two ways a
 * payment reaches us: a student who paid and then closed the tab never sends the browser
 * callback / return, and a webhook can be lost or arrive before we are up. Both leave an order still
 * `created` — this asks the order's own gateway (PayU, Razorpay) what happened to each, activates the plan
 * for any that were paid, and marks the ones nobody paid in the gateway's window as expired. It also prunes
 * old webhook payloads.
 *
 * Every gateway that has credentials is checked, whichever one is "active": an order opened on one gateway
 * before a switch to the other is still chased through the gateway it was opened on.
 *
 * Needs the same every-minute `schedule:run` cron as every other scheduled task here.
 */
class ReconcilePayments extends Command
{
    protected $signature = 'payments:reconcile {--all : Re-check every unpaid order from the last 7 days at once, expired ones included}';

    protected $description = 'Ask the payment gateways about unpaid orders (activating any that were paid) and prune old webhook events';

    public function handle(GatewayManager $gateways, CheckoutService $checkout): int
    {
        $pruned = PaymentWebhookEvent::where('created_at', '<', now()->subDays((int) config('billing.webhook_retention_days', 90)))->delete();

        $configured = array_filter($gateways->all(), fn ($gateway) => $gateway->isConfigured());

        if ($configured === []) {
            $this->info('No payment gateway is configured — nothing to reconcile.');

            return self::SUCCESS;
        }

        // Give a payment in progress a moment to finish through the normal callback first (not with --all).
        $grace = $this->option('all') ? 0 : (int) config('billing.reconcile_after_minutes', 5);

        $checked = 0;
        $activated = 0;
        $expired = 0;
        $errors = 0;

        foreach ($configured as $gateway) {
            // Orders can only be asked about in the mode the current keys belong to.
            // The scheduled run only chases orders still open; a day-old expired one is left to its webhook
            // (or to the student's own status check) unless an operator asks for everything with --all.
            $orders = PaymentOrder::query()
                ->when($this->option('all'), fn ($q) => $q->awaitingPayment(), fn ($q) => $q->where('status', PaymentOrder::STATUS_CREATED))
                ->where('gateway', $gateway->code())
                ->where('gateway_mode', $gateway->mode())
                ->where('created_at', '<=', now()->subMinutes($grace))
                // An order nobody paid in a week is not coming back, and keeps this job's bill at the gateway bounded.
                ->where('created_at', '>=', now()->subDays(7))
                ->orderBy('id')
                ->limit(500)
                ->get();

            $checked += $orders->count();

            foreach ($orders as $order) {
                // reconcile() refreshes and updates this same instance, so what it was has to be noted first.
                $before = $order->status;

                try {
                    $result = $checkout->reconcile($order);
                } catch (GatewayRequestException) {
                    // The gateway is unreachable or erroring: leave the order, the next run tries again.
                    $errors++;

                    continue;
                } catch (\Throwable $e) {
                    report($e);
                    $errors++;

                    continue;
                }

                $activated += $result->isPaid() ? 1 : 0;
                $expired += $result->status === PaymentOrder::STATUS_EXPIRED && $before !== PaymentOrder::STATUS_EXPIRED ? 1 : 0;
            }
        }

        $this->info("Checked {$checked} order(s): {$activated} activated, {$expired} expired, {$errors} error(s); {$pruned} old webhook event(s) pruned.");

        return $errors > 0 && $errors === $checked ? self::FAILURE : self::SUCCESS;
    }
}
