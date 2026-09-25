<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors `contest_submissions` — the candidate's actual work product per
 * question: a speech-to-text transcript (always present — this is what
 * makes the no-microphone/no-SpeechRecognition text fallback work) plus an
 * optional stored audio recording (private `local` disk, never `public` —
 * served only through an authenticated controller stream, see
 * CompanyInterviewController::responseAudio()/TpoInterviewController::
 * responseAudio()). Unique per (session, question) — InterviewController::
 * answer() does updateOrCreate, so re-answering overwrites, never
 * duplicates.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('interview_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('interview_session_id')->constrained()->cascadeOnDelete();
            $table->foreignId('interview_question_id')->constrained()->restrictOnDelete();
            $table->text('transcript_text')->nullable();
            $table->string('audio_path')->nullable();
            $table->unsignedInteger('audio_duration_seconds')->nullable();
            $table->dateTime('answered_at')->nullable();
            $table->timestamps();

            $table->unique(['interview_session_id', 'interview_question_id'], 'interview_responses_session_question_unique');
            $table->index('interview_session_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('interview_responses');
    }
};
