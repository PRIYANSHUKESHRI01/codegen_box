<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The exam-integrity layer under every proctored surface (contest, AI interview, Soft Skills, Core test, study sitting).
 *
 *  - guardian_installs   one row per AptRun Guardian (desktop agent) installation: its public key, so every report it
 *                        sends can be verified as coming from THAT install and nothing else.
 *  - guardian_links      a student's currently-paired Guardian: a revocable token (hashed), the last operating-system
 *                        state it reported, and when it last spoke. A link belongs to the USER, not to one exam, so the
 *                        Guardian can be running and verified before an attempt starts.
 *  - integrity_sessions  one per proctored attempt (unique per surface + surface_id). Holds liveness (last beat), the
 *                        binding to the first device / address, the running risk score and the head of the hash chain.
 *  - integrity_events    the append-only, hash-chained log. Rows are only ever inserted; each carries the hash of the
 *                        one before it, so editing or deleting a row afterwards is detectable (`integrity:verify`).
 *  - integrity_evidence  stills (webcam / screen) sent by the browser, stored encrypted on a private disk.
 *
 * `payload` is TEXT holding the exact canonical JSON that was hashed. A JSON column would be re-serialised by the
 * database and the hash could never be recomputed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guardian_installs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->char('install_id', 36)->unique();
            $table->text('public_key'); // base64 Ed25519
            $table->string('platform', 24)->nullable();
            $table->string('version', 24)->nullable();
            $table->char('exe_sha256', 64)->nullable();
            $table->json('machine')->nullable();
            $table->dateTime('first_seen_at');
            $table->dateTime('last_seen_at')->nullable();
            $table->dateTime('revoked_at')->nullable();
            $table->timestamps();
        });

        Schema::create('guardian_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('guardian_install_id')->constrained('guardian_installs')->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->dateTime('paired_at');
            $table->dateTime('last_beat_at')->nullable();
            $table->unsignedBigInteger('last_seq')->default(0);
            $table->json('state')->nullable();
            $table->dateTime('expires_at');
            $table->dateTime('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'revoked_at']);
        });

        Schema::create('integrity_sessions', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('surface', 24); // contest | interview | soft_skill | core_test | study
            $table->unsignedBigInteger('surface_id'); // id of that surface's own proctoring session / sitting
            $table->string('profile', 16);
            $table->string('status', 16)->default('active'); // active | locked | ended
            $table->string('assurance', 16)->default('web'); // web | guardian
            $table->json('context')->nullable();

            // Who/where this attempt is bound to.
            $table->string('client_instance', 64)->nullable();
            $table->string('device_fp', 64)->nullable();
            $table->string('device_id', 64)->nullable()->index(); // a random id the browser keeps for itself — the same on two accounts means one browser profile
            $table->string('bound_ip', 45)->nullable();
            $table->string('last_ip', 45)->nullable();
            $table->string('bound_ua', 255)->nullable();
            $table->json('ips')->nullable();
            $table->integer('clock_offset_ms')->nullable();

            // Liveness + replay protection.
            $table->unsignedBigInteger('last_batch_id')->default(0);
            $table->string('nonce', 40)->nullable();
            $table->string('nonce_prev', 40)->nullable();
            $table->dateTime('started_at');
            $table->dateTime('last_beat_at')->nullable();
            $table->dateTime('ended_at')->nullable();
            $table->unsignedInteger('gap_seconds')->default(0);
            $table->unsignedSmallInteger('gap_count')->default(0);
            $table->json('page_state')->nullable();
            $table->dateTime('last_incident_at')->nullable();

            // Guardian coverage of this attempt.
            $table->unsignedBigInteger('guardian_link_id')->nullable();
            $table->dateTime('guardian_first_at')->nullable();
            $table->dateTime('guardian_last_at')->nullable();
            $table->unsignedInteger('guardian_gap_seconds')->default(0);

            // The verdict so far.
            $table->unsignedInteger('risk_score')->default(0);
            $table->string('risk_level', 12)->default('low');
            $table->json('flags')->nullable();
            $table->unsignedInteger('event_count')->default(0);
            $table->char('chain_head', 64)->nullable();
            $table->timestamps();

            $table->unique(['surface', 'surface_id']);
            $table->index(['user_id', 'status']);
            $table->index(['status', 'last_beat_at']);
        });

        Schema::create('integrity_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('integrity_session_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('seq');
            $table->string('source', 10); // web | guardian | server
            $table->string('type', 48);
            $table->string('severity', 10);
            $table->unsignedSmallInteger('strike')->default(0);
            $table->unsignedSmallInteger('weight')->default(0);
            $table->dateTime('occurred_at', 3);
            $table->dateTime('client_at', 3)->nullable();
            $table->text('payload')->nullable();
            $table->char('prev_hash', 64);
            $table->char('hash', 64);

            $table->unique(['integrity_session_id', 'seq']);
            $table->index(['integrity_session_id', 'type']);
        });

        Schema::create('integrity_evidence', function (Blueprint $table) {
            $table->id();
            $table->foreignId('integrity_session_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 12); // webcam | screen
            $table->string('disk', 24);
            $table->string('path');
            $table->unsignedInteger('bytes');
            $table->char('sha256', 64);
            $table->boolean('encrypted')->default(true);
            $table->dateTime('captured_at');
            $table->json('meta')->nullable();
            $table->boolean('flagged')->default(false);
            $table->string('reason', 48)->nullable();
            $table->timestamps();

            $table->index(['integrity_session_id', 'kind', 'captured_at'], 'integrity_evidence_session_kind_time');
            $table->index('created_at');
        });

        // A college's own exam network (CIDR ranges): a proctored attempt by one of its students may start from inside them.
        if (! Schema::hasColumn('colleges', 'exam_networks')) {
            Schema::table('colleges', function (Blueprint $table) {
                $table->json('exam_networks')->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('colleges', 'exam_networks')) {
            Schema::table('colleges', function (Blueprint $table) {
                $table->dropColumn('exam_networks');
            });
        }

        Schema::dropIfExists('integrity_evidence');
        Schema::dropIfExists('integrity_events');
        Schema::dropIfExists('integrity_sessions');
        Schema::dropIfExists('guardian_links');
        Schema::dropIfExists('guardian_installs');
    }
};
