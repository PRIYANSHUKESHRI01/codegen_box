<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One row per Soft Skills attempt taken under proctoring — 1:1 with
 * SoftSkillSession, created when the student passes the consent gate (see
 * SoftSkillProctoringController::start()). Mirrors
 * `interview_proctoring_sessions` / `proctoring_sessions` exactly.
 * `violation_count` is the authoritative server-side strike counter: the
 * client shows warnings, but the SERVER decides when the configured number
 * of strikes ends the attempt (SoftSkillProctoringService), and
 * SoftSkillController::answer()/submit() independently reject a locked
 * session, so a tampered client can't bypass it.
 *
 * No recording bytes are ever stored — webcam/mic capture stays in the
 * browser and is discarded when the attempt ends (recordingSink.ts's
 * NullRecordingSink). `device_info` is the only "evidence" kept here, same
 * as contest and interview proctoring.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('soft_skill_proctoring_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('soft_skill_session_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('active'); // active | locked | completed
            $table->dateTime('consented_at')->nullable();
            $table->unsignedInteger('violation_count')->default(0);
            $table->dateTime('locked_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->json('device_info')->nullable();
            $table->timestamps();

            $table->unique('soft_skill_session_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('soft_skill_proctoring_sessions');
    }
};
