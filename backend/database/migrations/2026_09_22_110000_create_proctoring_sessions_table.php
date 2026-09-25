<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per (contest, student) attempt under proctoring — 1:1 with
 * ContestParticipant, created the moment a student opens their first
 * contest problem (see ContestProctoringController::start()), never on
 * registration alone. `violation_count` is the authoritative, server-side
 * strike counter (see ProctoringViolation::STRIKE_TYPES) — the client
 * shows warnings, but the SERVER decides when 3 strikes locks a student
 * out, so a tampered/modified client can never bypass enforcement (see
 * ContestSubmissionController::assertRegistered(), which rejects
 * run/submit/show once `status = locked`).
 *
 * No recording bytes are ever stored here or anywhere else in this app —
 * webcam/mic capture happens entirely client-side and is discarded when
 * the session ends (see frontend/src/lib/proctoring/recordingSink.ts's
 * NullRecordingSink). `device_info` is the only "evidence" persisted
 * server-side today, by design.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('proctoring_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contest_participant_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('active'); // active | locked | completed — see App\Models\ProctoringSession
            $table->dateTime('consented_at')->nullable();
            $table->unsignedInteger('violation_count')->default(0);
            $table->dateTime('locked_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            // Idempotency guard for SendProctoringViolationReport — mirrors
            // the credentials_email_sent_at convention already used on User.
            $table->dateTime('reported_at')->nullable();
            $table->json('device_info')->nullable();
            $table->timestamps();

            $table->unique('contest_participant_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proctoring_sessions');
    }
};
