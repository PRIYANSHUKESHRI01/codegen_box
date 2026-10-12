<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Authorship evidence for Project Lab ("students write the code themselves").
 *
 * The editor's guard reports what it did — pastes refused, a burst of typing no person produces, a guard that
 * stopped answering — as METADATA ONLY: kind, size, target, time. Never the text that was copied or typed.
 * Each row has a client-chosen id that is unique per workspace, so a retried upload cannot double-count.
 *
 * The rest is the frozen summary stored on a submission (what the reviewer reads), the seconds the guard was
 * confirmed running (coverage), and a per-project switch for the rare project where pasting is fine.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_workspace_integrity_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_workspace_id')->constrained('project_workspaces')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('client_event_id', 40);
            $table->string('kind', 32);
            $table->unsignedInteger('size')->nullable();
            $table->string('target', 24)->nullable();
            $table->string('guard_version', 16)->nullable();
            $table->json('meta')->nullable();
            // `useCurrent()` on every NOT NULL timestamp: MariaDB 10.4 (XAMPP) rejects a zero-date default otherwise.
            $table->timestamp('occurred_at')->useCurrent();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['project_workspace_id', 'client_event_id'], 'integrity_events_unique');
            $table->index(['project_workspace_id', 'kind', 'occurred_at'], 'integrity_events_lookup');
            $table->index('occurred_at');
        });

        Schema::table('project_workspace_sessions', function (Blueprint $table) {
            $table->unsignedInteger('guard_active_seconds')->default(0)->after('seconds');
        });

        Schema::table('project_workspaces', function (Blueprint $table) {
            $table->timestamp('guard_last_seen_at')->nullable()->after('last_heartbeat_at');
            $table->string('guard_version', 16)->nullable()->after('guard_last_seen_at');
        });

        Schema::table('project_submissions', function (Blueprint $table) {
            $table->json('integrity')->nullable()->after('warnings');
        });

        Schema::table('project_topics', function (Blueprint $table) {
            $table->string('authorship_mode', 12)->default('strict')->after('is_free_sample');
        });
    }

    public function down(): void
    {
        Schema::table('project_topics', fn (Blueprint $table) => $table->dropColumn('authorship_mode'));
        Schema::table('project_submissions', fn (Blueprint $table) => $table->dropColumn('integrity'));
        Schema::table('project_workspaces', fn (Blueprint $table) => $table->dropColumn(['guard_last_seen_at', 'guard_version']));
        Schema::table('project_workspace_sessions', fn (Blueprint $table) => $table->dropColumn('guard_active_seconds'));
        Schema::dropIfExists('project_workspace_integrity_events');
    }
};
