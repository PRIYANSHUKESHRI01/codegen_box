<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The lifecycle e-mails (plan changes, refunds, "you are close to the Vault",
 * "your plan is ending", upgrade and win-back nudges…).
 *
 * lifecycle_emails — one row per message actually sent. It does two jobs:
 *   • idempotency — (user_id, type, dedupe_key) is unique, so a retried job, a
 *     scheduler that runs twice or two requests racing each other can never send
 *     the same message twice. The row is written BEFORE the send and removed if
 *     the send fails, so a failed attempt can be retried and a crash can at worst
 *     skip a message, never duplicate one. `dedupe_key` is '' (not NULL — a NULL
 *     would defeat the unique index on MySQL) when the message is once-ever.
 *   • pacing — the nudge sweeps read it to space messages out ("at most one
 *     nudge to a student every few days", "a second reminder only a week after
 *     the first").
 *
 * users.email_nudges_opt_out_at — set when the student uses the unsubscribe link
 * in a nudge. It silences ENGAGEMENT mail only (nudges, reminders to improve,
 * win-backs). Mail about the student's own account, money or security — receipts,
 * refunds, plan changes, password changes — is never switched off by it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lifecycle_emails', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type', 40);
            $table->string('dedupe_key', 80)->default('');
            $table->timestamp('sent_at')->useCurrent();
            $table->timestamps();

            $table->unique(['user_id', 'type', 'dedupe_key']);
            $table->index(['user_id', 'sent_at']);
            $table->index(['type', 'sent_at']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('email_nudges_opt_out_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('email_nudges_opt_out_at');
        });

        Schema::dropIfExists('lifecycle_emails');
    }
};
