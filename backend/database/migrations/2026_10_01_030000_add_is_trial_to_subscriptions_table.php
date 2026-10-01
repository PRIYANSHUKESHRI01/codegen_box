<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Marks a subscription whose `current_period_end` was set by a
 * superadmin-chosen demo length (see SubscriptionService::activate()'s
 * `$trialDays` param) rather than derived from `plan->duration_days`.
 * `SubscriptionService::activate()` is the only write path that ever sets
 * this — everywhere else reads it to show a "Demo" badge or distinguish a
 * trial expiry from a normal renewal lapse.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->boolean('is_trial')->default(false)->after('current_period_end');
        });
    }

    public function down(): void
    {
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropColumn('is_trial');
        });
    }
};
