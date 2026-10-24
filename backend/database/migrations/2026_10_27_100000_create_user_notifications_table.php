<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * In-app notifications — the bell in every dashboard header.
 *
 * One row per (recipient, event): a drive going live fans out to every student of a college as one row each, so
 * reading, dismissing and muting are all plain per-user operations with no join and no shared state.
 *
 *  • `type` is the event ("drive.live"); `category` is what the recipient can mute ("drives"). Both come from
 *    App\Enums\NotificationType, never from user input.
 *  • `group_key` makes a notification idempotent: (user_id, group_key) is unique, so a retried request, a re-run
 *    job or a webhook delivered twice cannot tell the same person the same thing twice. Null = no dedupe.
 *  • `read_at` null = unread. Rows are pruned by `notifications:prune` (read after 60 days, unread after 180).
 *  • users.notification_prefs holds only what a person MUTED ({"hackathons": false}); no value = everything on.
 *
 * Deliberately not Laravel's built-in `notifications` table: that one is per-channel Notification classes with
 * one uuid row per send and no dedupe, and this needs bulk fan-out and an unread-count that is one index scan.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('user_notifications')) {
            Schema::create('user_notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->string('type', 48);
                $table->string('category', 24);
                $table->string('severity', 10)->default('info');
                $table->string('title', 160);
                $table->string('body', 500)->nullable();
                $table->string('url', 255)->nullable();
                $table->json('data')->nullable();
                $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('group_key', 120)->nullable();
                $table->dateTime('read_at')->nullable();
                $table->dateTime('expires_at')->nullable();
                $table->dateTime('created_at')->useCurrent();

                $table->index(['user_id', 'id']);
                $table->index(['user_id', 'read_at', 'id']);
                $table->index(['user_id', 'category', 'id']);
                $table->unique(['user_id', 'group_key']);
                $table->index('created_at');
            });
        }

        if (! Schema::hasColumn('users', 'notification_prefs')) {
            Schema::table('users', function (Blueprint $table) {
                $table->json('notification_prefs')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notifications');

        if (Schema::hasColumn('users', 'notification_prefs')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('notification_prefs');
            });
        }
    }
};
