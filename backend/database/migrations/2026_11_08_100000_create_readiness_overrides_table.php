<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A readiness score a superadmin has set by hand for one student. While a row is in force (no expiry, or the expiry is still ahead)
 * ReadinessScoreService reports THIS number instead of the one it worked out, so every screen - the student's own, the TPO roster,
 * the reports, the Vault - agrees. Removing the row (or letting it expire) hands the student back to their calculated score.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('readiness_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->unsignedTinyInteger('score');
            $table->string('reason', 300);
            $table->foreignId('set_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('readiness_overrides');
    }
};
