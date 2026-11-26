<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voice_verification_prompts', function (Blueprint $table) {
            $table->id();
            $table->unsignedTinyInteger('position');
            $table->string('slug', 80)->unique();
            $table->string('title', 160);
            $table->string('category', 60);
            $table->text('prompt_text');
            $table->text('guidance')->nullable();
            $table->unsignedSmallInteger('target_seconds')->default(60);
            $table->unsignedSmallInteger('min_seconds')->default(20);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('voice_verification_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('status', 30)->default('not_started')->index();
            $table->unsignedSmallInteger('required_duration_seconds')->default(300);
            $table->unsignedInteger('total_duration_seconds')->default(0);
            $table->unsignedTinyInteger('samples_count')->default(0);
            $table->string('master_audio_path', 500)->nullable();
            $table->json('acoustic_signature')->nullable();
            $table->text('voice_summary')->nullable();
            $table->decimal('match_threshold', 5, 2)->default(60.00);
            $table->decimal('last_match_score', 5, 2)->nullable();
            $table->unsignedTinyInteger('mismatch_strikes')->default(0);
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('last_verified_at')->nullable();
            $table->timestamp('blocked_at')->nullable();
            $table->text('blocked_reason')->nullable();
            $table->foreignId('blocked_interview_id')->nullable()->constrained('interviews')->nullOnDelete();
            $table->foreignId('unblocked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('unblocked_at')->nullable();
            $table->timestamps();
        });

        Schema::create('voice_verification_samples', function (Blueprint $table) {
            $table->id();
            $table->foreignId('voice_verification_profile_id')->constrained('voice_verification_profiles')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('voice_verification_prompt_id')->nullable()->constrained('voice_verification_prompts')->nullOnDelete();
            $table->unsignedTinyInteger('prompt_index');
            $table->string('audio_path', 500);
            $table->unsignedSmallInteger('duration_seconds')->default(0);
            $table->text('transcript_text')->nullable();
            $table->json('acoustic_features')->nullable();
            $table->text('ai_vocal_notes')->nullable();
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->unique(['voice_verification_profile_id', 'prompt_index'], 'vv_profile_prompt_unique');
        });

        Schema::create('voice_verification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('voice_verification_profile_id')->constrained('voice_verification_profiles')->cascadeOnDelete();
            $table->foreignId('interview_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('interview_session_id')->nullable()->constrained('interview_sessions')->nullOnDelete();
            $table->foreignId('interview_response_id')->nullable()->constrained('interview_responses')->nullOnDelete();
            $table->string('sample_audio_path', 500)->nullable();
            $table->decimal('similarity_score', 5, 2)->nullable();
            $table->decimal('acoustic_score', 5, 2)->nullable();
            $table->decimal('ai_score', 5, 2)->nullable();
            $table->string('verdict', 30)->index();
            $table->text('reason')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('checked_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('voice_verification_logs');
        Schema::dropIfExists('voice_verification_samples');
        Schema::dropIfExists('voice_verification_profiles');
        Schema::dropIfExists('voice_verification_prompts');
    }
};
