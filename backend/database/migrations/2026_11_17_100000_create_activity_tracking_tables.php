<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who is on AptRun, and what they do there — the data behind Superadmin → Live Activity.
 *
 *   activity_visits       one row per visit (a browser session): when it began, when it was last heard from, how long the person was
 *                         really there, what they are looking at right now. "Online now" is a visit heard from in the last couple of minutes.
 *   activity_page_views   one row per page opened inside a visit: which screen, for how long, how far down it was scrolled.
 *   user_activity_days    one row per person per day (India time): the roll-up the daily / weekly / monthly active counts are read from,
 *                         so those never scan the page-view table.
 *   auth_events           every sign-in attempt and password event, including the ones that fail: a college that was handed a demo
 *                         login and tried it — or never did — shows up here.
 *
 * college_id is copied onto every row so "show me this college" is one indexed read. No foreign key to colleges: a purged college's
 * history is swept by the prune job, and a foreign key would only get in the purge's way.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('activity_visits')) {
            Schema::create('activity_visits', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('college_id')->nullable();
                $table->string('role', 30);
                // Made by the browser (a random id per visit), so retries and a second flush from the same tab land on the same row.
                $table->string('token', 40);
                $table->dateTime('started_at');
                $table->dateTime('last_seen_at');
                $table->unsignedInteger('active_seconds')->default(0);
                $table->unsignedSmallInteger('pages')->default(0);
                $table->string('current_path', 190)->nullable();
                $table->string('current_section', 80)->nullable();
                $table->string('entry_path', 190)->nullable();
                $table->string('device', 12)->nullable();
                $table->string('browser', 30)->nullable();
                $table->string('os', 30)->nullable();
                $table->string('ip', 45)->nullable();

                $table->unique(['user_id', 'token']);
                $table->index('last_seen_at');
                $table->index(['college_id', 'last_seen_at']);
                $table->index(['user_id', 'started_at']);
                $table->index('started_at');
            });
        }

        if (! Schema::hasTable('activity_page_views')) {
            Schema::create('activity_page_views', function (Blueprint $table) {
                $table->id();
                $table->foreignId('visit_id')->constrained('activity_visits')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('college_id')->nullable();
                // The browser numbers the pages of a visit 1, 2, 3 …; a later flush of the same page updates its row.
                $table->unsignedSmallInteger('seq');
                $table->string('path', 190);
                $table->string('section', 80);
                $table->dateTime('entered_at');
                $table->unsignedInteger('active_seconds')->default(0);
                $table->unsignedTinyInteger('max_scroll')->default(0);

                $table->unique(['visit_id', 'seq']);
                $table->index(['user_id', 'entered_at']);
                $table->index(['college_id', 'entered_at']);
                $table->index(['section', 'entered_at']);
                $table->index('entered_at');
            });
        }

        if (! Schema::hasTable('user_activity_days')) {
            Schema::create('user_activity_days', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->unsignedBigInteger('college_id')->nullable();
                $table->string('role', 30);
                $table->date('day');
                $table->unsignedSmallInteger('visits')->default(0);
                $table->unsignedInteger('page_views')->default(0);
                $table->unsignedInteger('active_seconds')->default(0);
                $table->dateTime('first_seen_at');
                $table->dateTime('last_seen_at');

                $table->unique(['user_id', 'day']);
                $table->index(['day', 'role']);
                $table->index(['college_id', 'day']);
            });
        }

        if (! Schema::hasTable('auth_events')) {
            Schema::create('auth_events', function (Blueprint $table) {
                $table->id();
                // Null when the address matched nobody (a typo, a stranger).
                $table->unsignedBigInteger('user_id')->nullable();
                $table->unsignedBigInteger('college_id')->nullable();
                $table->string('role', 30)->nullable();
                $table->string('email', 190)->nullable();
                // login | login_failed | login_blocked | temp_password | password_set | password_changed
                $table->string('event', 24);
                $table->string('reason', 40)->nullable();
                $table->string('portal', 20)->nullable();
                $table->string('device', 12)->nullable();
                $table->string('browser', 30)->nullable();
                $table->string('os', 30)->nullable();
                $table->string('ip', 45)->nullable();
                $table->dateTime('created_at');

                $table->index(['user_id', 'created_at']);
                $table->index(['college_id', 'created_at']);
                $table->index(['event', 'created_at']);
                $table->index('created_at');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('auth_events');
        Schema::dropIfExists('user_activity_days');
        Schema::dropIfExists('activity_page_views');
        Schema::dropIfExists('activity_visits');
    }
};
