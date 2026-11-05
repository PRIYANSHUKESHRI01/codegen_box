<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Project Lab "Save progress": a checkpoint of a student's workspace, packed by AptRun out of the live editor and kept privately so a
 * reviewer can see how the project grew, not only how it ended. A submission is the same snapshot with a hand-in around it; a save has
 * none. The file itself lives on the private snapshot disk (never publicly served); only the newest few are kept per project.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('project_saves')) {
            return;
        }

        Schema::create('project_saves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_enrollment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('snapshot_path', 255);
            $table->unsignedBigInteger('snapshot_size_bytes')->default(0);
            $table->string('snapshot_sha256', 64)->nullable();
            $table->unsignedInteger('files_count')->default(0);
            $table->unsignedSmallInteger('milestones_done')->default(0);
            $table->unsignedSmallInteger('milestones_total')->default(0);
            // What the provenance check found in this snapshot (files that predate the workspace, archives inside the project).
            $table->json('provenance')->nullable();
            $table->timestamps();

            $table->index(['project_enrollment_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('project_saves');
    }
};
