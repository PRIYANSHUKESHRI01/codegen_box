<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The ledger of weekly leaderboard prizes: when a week closes, whoever held a prize rank gets a row here, so there is a permanent
 * record of who won what (the live board resets every Monday) and a place to track the voucher until it has been sent.
 *
 * The prize and the person are copied onto the row (brand, amount, name, e-mail, college) because the shelf and the accounts can change
 * afterwards; the row has to keep saying what was actually won. `user_id` is nulled if the account is deleted, the copy stays.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('weekly_reward_winners')) {
            return;
        }

        Schema::create('weekly_reward_winners', function (Blueprint $table) {
            $table->id();
            // The Monday that names the week (India time).
            $table->date('week_key');
            $table->unsignedSmallInteger('rank');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('user_name', 190);
            $table->string('user_handle', 64)->nullable();
            $table->string('email', 190)->nullable();
            $table->string('college', 190)->nullable();
            $table->unsignedInteger('contest_score')->default(0);
            $table->string('card', 40);
            $table->string('brand', 80);
            $table->unsignedInteger('amount');
            // pending: to be sent · sent: the student has been told (and may be shown the code) · cancelled: not being paid out
            $table->string('status', 12)->default('pending');
            // Encrypted with the app key: it is money.
            $table->text('voucher_code')->nullable();
            $table->string('note', 255)->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->unsignedBigInteger('handled_by')->nullable();
            $table->timestamp('notified_at')->nullable();
            $table->timestamps();

            $table->unique(['week_key', 'user_id']);
            $table->index(['week_key', 'rank']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('weekly_reward_winners');
    }
};
