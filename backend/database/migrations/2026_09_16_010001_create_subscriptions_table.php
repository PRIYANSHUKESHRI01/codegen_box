<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per plan activation. `subscriber` is polymorphic so both a User
 * (individual/self-serve) and a College (institutional, admin-assigned —
 * see SubscriptionService::assignInstitutionPlan) can hold subscriptions
 * through the same table and the same day-counting logic. A subscriber can
 * have multiple rows over time (history); only the latest `active` one
 * counts — see HasSubscription::activeSubscription().
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->morphs('subscriber');
            $table->foreignId('plan_id')->constrained()->restrictOnDelete();
            $table->string('status')->default('active'); // active | expired | canceled — see App\Models\Subscription
            $table->timestamp('started_at');
            $table->timestamp('current_period_end')->nullable(); // null = never expires (free plan)
            $table->boolean('auto_renew')->default(false); // inert until a payment gateway exists
            $table->timestamp('canceled_at')->nullable();
            $table->json('meta')->nullable(); // reserved for future gateway refs (customer id, subscription id, ...)
            $table->timestamps();

            $table->index(['subscriber_type', 'subscriber_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};
