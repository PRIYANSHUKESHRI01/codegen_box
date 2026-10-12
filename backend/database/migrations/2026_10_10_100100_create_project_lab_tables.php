<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Project Lab: SOW-guided, full-stack projects built in a browser workspace.
 *
 *   project_topics              the catalog; the SOW itself is `sow_markdown`
 *   project_milestones          the SOW's checkable milestones + acceptance criteria
 *   project_enrollments         one per (student, topic); restarting re-uses it
 *   project_milestone_progress  which milestones a student has ticked off
 *   project_workspaces          the student's container (one per enrollment)
 *   project_workspace_sessions  start/stop windows — the source of "hours used"
 *   project_submissions         a snapshot of the code + review outcome
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('project_topics', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->string('category', 60); // e.g. "Web Apps", "AI", "Healthcare" — free text so new categories need no deploy
            $table->text('summary');
            $table->string('difficulty', 16)->default('intermediate'); // beginner | intermediate | advanced
            $table->unsignedSmallInteger('estimated_hours')->default(40);
            $table->json('tech_stack')->nullable(); // ["Laravel", "MySQL", "React"]
            $table->json('outcomes')->nullable(); // what the student will have built / learned
            $table->longText('sow_markdown')->nullable(); // the full Statement of Work (Markdown)
            $table->unsignedSmallInteger('sow_version')->default(1);
            $table->string('status', 16)->default('draft'); // draft | published | archived
            $table->boolean('is_free_sample')->default(false); // SOW readable without Project Lab (never the workspace)
            $table->string('icon', 40)->nullable();
            $table->unsignedInteger('display_order')->default(0);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'display_order']);
        });

        Schema::create('project_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_topic_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('position')->default(0);
            $table->string('title');
            $table->text('description')->nullable();
            $table->json('acceptance_criteria')->nullable(); // ["Admin can create a course", ...]
            $table->unsignedSmallInteger('estimated_hours')->default(4);
            $table->timestamps();

            $table->index(['project_topic_id', 'position']);
        });

        Schema::create('project_enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // restrictOnDelete: a topic someone has worked on is archived, never deleted.
            $table->foreignId('project_topic_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('sow_version')->default(1); // the SOW version the student started against
            $table->string('status', 16)->default('active'); // active | submitted | reviewed | abandoned
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'project_topic_id']);
        });

        Schema::create('project_milestone_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_enrollment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_milestone_id')->constrained()->cascadeOnDelete();
            $table->timestamp('completed_at')->useCurrent();
            $table->timestamps();

            $table->unique(['project_enrollment_id', 'project_milestone_id'], 'project_milestone_progress_unique');
        });

        Schema::create('project_workspaces', function (Blueprint $table) {
            $table->id();
            // Random, unguessable id used in the workspace hostname (ws-<public_id>.ws.<domain>).
            $table->string('public_id', 24)->unique();
            $table->foreignId('project_enrollment_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('host', 120); // which workspace host holds the container + volume
            $table->string('container_name', 80);
            $table->string('volume_name', 80);
            $table->string('status', 16)->default('stopped'); // starting | running | stopped | failed | destroyed
            $table->text('connection_token')->nullable(); // encrypted; rotated on every start
            $table->timestamp('last_heartbeat_at')->nullable();
            $table->timestamp('last_started_at')->nullable();
            $table->timestamp('last_stopped_at')->nullable();
            $table->string('stop_reason', 40)->nullable();
            $table->text('error')->nullable();
            $table->unsignedInteger('disk_mb')->nullable(); // last measured size of the volume
            $table->timestamps();

            $table->index(['status', 'last_heartbeat_at']);
            $table->index(['user_id', 'status']);
        });

        Schema::create('project_workspace_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete(); // denormalised: "hours this period" is a per-user sum
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('ended_at')->nullable();
            $table->unsignedInteger('seconds')->default(0); // advanced by heartbeats, so a crash loses at most one beat
            $table->string('stop_reason', 40)->nullable(); // user | submitted | idle | max_session | lapsed | hours_exhausted | disk_full | host_error
            $table->timestamps();

            $table->index(['user_id', 'started_at']);
        });

        Schema::create('project_submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_enrollment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('attempt')->default(1);
            $table->string('snapshot_path')->nullable(); // private disk; null if the snapshot could not be taken
            $table->unsignedBigInteger('snapshot_size_bytes')->default(0);
            $table->string('snapshot_sha256', 64)->nullable();
            $table->string('repo_url', 500)->nullable();
            $table->string('live_url', 500)->nullable();
            $table->text('notes')->nullable();
            $table->unsignedSmallInteger('milestones_done')->default(0);
            $table->unsignedSmallInteger('milestones_total')->default(0);
            $table->json('warnings')->nullable(); // e.g. committed .env, oversize snapshot
            $table->string('status', 20)->default('pending_review'); // pending_review | in_review | reviewed | needs_changes
            $table->unsignedTinyInteger('score')->nullable(); // 0-100
            $table->json('rubric')->nullable(); // [{criterion, score, max}]
            $table->text('feedback')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('submitted_at')->useCurrent();
            $table->timestamps();

            $table->index(['status', 'submitted_at']);
            $table->unique(['project_enrollment_id', 'attempt']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_submissions');
        Schema::dropIfExists('project_workspace_sessions');
        Schema::dropIfExists('project_workspaces');
        Schema::dropIfExists('project_milestone_progress');
        Schema::dropIfExists('project_enrollments');
        Schema::dropIfExists('project_milestones');
        Schema::dropIfExists('project_topics');
    }
};
