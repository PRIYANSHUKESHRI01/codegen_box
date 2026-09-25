<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per interview attempt under proctoring — 1:1 with
 * InterviewSession, created the moment a candidate starts an interview
 * (see InterviewProctoringController::start()), mirroring
 * `proctoring_sessions` (contest proctoring) exactly. `violation_count` is
 * the authoritative, server-side strike counter — the client shows
 * warnings, but the SERVER decides when 3 strikes locks a candidate out
 * (see InterviewController::start()/answer(), which reject once
 * `status = locked`), so a tampered client can never bypass enforcement.
 *
 * No recording bytes are ever stored here or anywhere else — webcam/mic
 * capture happens entirely client-side and is discarded when the session
 * ends (reuses frontend/src/lib/proctoring/recordingSink.ts's
 * NullRecordingSink, unchanged). `device_info` is the only "evidence"
 * persisted server-side, same as contest proctoring.
 *
 * Deliberately no `reported_at`/email-fan-out column yet (unlike contest
 * proctoring's SendProctoringViolationReport) — who to notify differs by
 * interview_type (a college's TPO for tpo_mock, but no TPO exists for a
 * company_hiring candidate) and wasn't part of this pass; violation counts
 * are visible to whoever reviews the interview via the existing session
 * list instead. Add it in a follow-up migration if/when that's built.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_proctoring_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_session_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('active'); // active | locked | completed
            $table->dateTime('consented_at')->nullable();
            $table->unsignedInteger('violation_count')->default(0);
            $table->dateTime('locked_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->json('device_info')->nullable();
            $table->timestamps();

            $table->unique('interview_session_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_proctoring_sessions');
    }
};
