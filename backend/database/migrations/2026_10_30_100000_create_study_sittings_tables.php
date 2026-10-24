<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Proctored "sittings" for Core Prep practice and Skill Drills. A sitting is one stretch of practice under the same camera /
 * fullscreen / tab-switch proctoring as a Core test or an AI interview: the student consents, the browser reports violations,
 * and at the shared strike limit the sitting is locked and the server stops accepting answers into it.
 *
 * Nothing is recorded server-side except small JSON events (no media), and none of it feeds the readiness score.
 * `study_sitting_id` on the answer tables ties each answer to the sitting it was given in.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('study_sittings')) {
            Schema::create('study_sittings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                // core_practice | drill
                $table->string('kind', 20);
                // the drill skill, or the Core subject/topic being practised (informational)
                $table->string('subject', 80)->nullable();
                // active | locked | completed
                $table->string('status', 12)->default('active');
                $table->timestamp('consented_at')->nullable();
                $table->unsignedSmallInteger('violation_count')->default(0);
                $table->timestamp('locked_at')->nullable();
                $table->timestamp('completed_at')->nullable();
                $table->json('device_info')->nullable();
                $table->timestamps();

                $table->index(['user_id', 'kind', 'status']);
            });
        }

        if (! Schema::hasTable('study_sitting_violations')) {
            Schema::create('study_sitting_violations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('study_sitting_id')->constrained('study_sittings')->cascadeOnDelete();
                $table->string('type', 40);
                $table->boolean('counted_toward_lock')->default(false);
                $table->string('ip_address', 45)->nullable();
                $table->json('meta')->nullable();
                $table->timestamp('occurred_at')->useCurrent();

                $table->index('study_sitting_id');
            });
        }

        foreach (['drill_attempts', 'core_practice_answers'] as $answers) {
            if (Schema::hasTable($answers) && ! Schema::hasColumn($answers, 'study_sitting_id')) {
                Schema::table($answers, function (Blueprint $table) {
                    $table->unsignedBigInteger('study_sitting_id')->nullable()->index();
                });
            }
        }
    }

    public function down(): void
    {
        foreach (['drill_attempts', 'core_practice_answers'] as $answers) {
            if (Schema::hasTable($answers) && Schema::hasColumn($answers, 'study_sitting_id')) {
                Schema::table($answers, function (Blueprint $table) {
                    $table->dropColumn('study_sitting_id');
                });
            }
        }

        Schema::dropIfExists('study_sitting_violations');
        Schema::dropIfExists('study_sittings');
    }
};
