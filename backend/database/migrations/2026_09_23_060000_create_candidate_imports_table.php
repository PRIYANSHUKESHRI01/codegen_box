<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Column-for-column mirror of student_imports, except scoped to
 * placement_drive_id instead of college_id — there's no company-wide
 * candidate roster to import into, only a specific job opening's pipeline
 * (a candidate applies per-opening, not per-tenant the way a student
 * belongs to their college for the whole program).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('candidate_imports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('placement_drive_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('original_filename');
            $table->enum('status', ['pending', 'processing', 'completed', 'completed_with_errors', 'failed'])->default('pending');
            $table->unsignedInteger('total_rows')->default(0);
            $table->unsignedInteger('processed_rows')->default(0);
            $table->unsignedInteger('successful_rows')->default(0);
            $table->unsignedInteger('failed_rows')->default(0);
            $table->json('errors')->nullable();
            $table->string('email_batch_id')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('candidate_imports');
    }
};
