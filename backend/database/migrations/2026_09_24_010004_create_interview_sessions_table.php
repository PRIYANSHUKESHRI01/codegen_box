<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors `contest_participants` — one row per candidate per interview.
 * `invited_at`/`invited_by` stay null for a self-started general/tpo_mock/
 * company session (no invite step — see InterviewController::start()); both
 * are set by CompanyInterviewController::inviteCandidates() for a
 * company_hiring session, which always starts life as `invited` before the
 * candidate flips it to `in_progress` themselves.
 *
 * Deliberately no `expired` status in v1 — nothing computes or enforces
 * expiry yet, and a status no code ever sets is worse than not having it;
 * add it alongside whatever real expiry policy gets built later.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('status')->default('invited'); // invited | in_progress | completed
            $table->dateTime('invited_at')->nullable();
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('started_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->unsignedInteger('current_question_order')->default(0);
            $table->timestamps();

            $table->unique(['interview_id', 'user_id']);
            $table->index(['interview_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_sessions');
    }
};
