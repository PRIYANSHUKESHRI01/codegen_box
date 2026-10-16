<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The money trail for self-serve plan purchases (Razorpay Standard Checkout).
     *
     * payment_orders: one row per checkout. It is created BEFORE the student pays (the
     * Razorpay order exists first, Checkout opens against it) and is the single record every
     * path settles against — the browser callback, the webhook and the reconcile job all land
     * on the same row, which is what makes a purchase fulfil exactly once however many of them
     * report it. `quote` freezes what was priced at order time: that, not whatever the plan
     * costs when a late webhook arrives, is what the student agreed to and what they get.
     *
     * user_id is nullable + nullOnDelete on purpose: this is a financial record, and the
     * superadmin's "permanently delete a university" purge removes its students. The payer's
     * name and email are snapshotted so the row stays reconcilable against Razorpay after that.
     *
     * payment_webhook_events: one row per event Razorpay delivered, unique on its event id —
     * Razorpay retries, so the same event arrives more than once and must be a no-op the second time.
     */
    public function up(): void
    {
        Schema::create('payment_orders', function (Blueprint $table) {
            $table->id();
            // Our reference (ULID): sent to Razorpay as the receipt, stored on every subscription it creates.
            $table->char('public_id', 26)->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('payer_name');
            $table->string('payer_email');

            $table->string('gateway', 20)->default('razorpay');
            $table->string('gateway_mode', 8)->default('test'); // test | live
            $table->string('gateway_order_id', 64)->unique();
            $table->string('gateway_payment_id', 64)->nullable()->unique();

            // created → paid → (partially_)refunded; created → expired (→ paid, if paid late);
            // needs_review = money moved but we could not hand over the plan (see CheckoutService).
            $table->string('status', 20)->default('created')->index();
            $table->string('currency', 3)->default('INR');
            $table->unsignedBigInteger('amount_paise');
            $table->string('plan_code', 64)->nullable();
            $table->json('cart');
            $table->json('quote');

            $table->string('method', 30)->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->string('failure_code', 80)->nullable();
            $table->text('failure_reason')->nullable();

            $table->timestamp('paid_at')->nullable();
            $table->timestamp('fulfilled_at')->nullable();

            $table->string('refund_id', 64)->nullable();
            $table->unsignedBigInteger('refunded_paise')->default(0);
            $table->timestamp('refunded_at')->nullable();
            $table->string('refund_reason', 255)->nullable();

            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('payment_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('gateway', 20)->default('razorpay');
            $table->string('event_id', 100);
            $table->string('event', 60);
            $table->foreignId('payment_order_id')->nullable()->constrained('payment_orders')->nullOnDelete();
            // received → processed | ignored (not ours / not an event we act on) | failed (will be retried by the sender)
            $table->string('status', 12)->default('received');
            $table->text('error')->nullable();
            $table->json('payload');
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->unique(['gateway', 'event_id']);
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhook_events');
        Schema::dropIfExists('payment_orders');
    }
};
