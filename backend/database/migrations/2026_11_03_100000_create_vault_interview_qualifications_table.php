<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('vault_interview_qualifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('stack_key', 50)->index();
            $table->string('role_key', 50)->index();
            $table->unsignedTinyInteger('current_attempt')->default(1);
            $table->unsignedTinyInteger('max_attempts')->default(3);
            $table->string('status', 30)->default('in_progress')->index(); // in_progress | qualified | cooling_down
            $table->string('active_series_id', 60)->nullable();
            $table->json('series_scores')->nullable(); // {"1": 70, "2": 65, "3": 80}
            $table->decimal('series_average', 5, 2)->nullable();
            $table->json('attempt_history')->nullable(); // past attempts with scores, average, timestamps
            $table->timestamp('qualified_at')->nullable();
            $table->timestamp('cooldown_until')->nullable()->index();
            $table->timestamps();

            $table->unique(['user_id', 'stack_key'], 'uniq_user_stack_qualification');
            $table->index(['user_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('vault_interview_qualifications');
    }
};

