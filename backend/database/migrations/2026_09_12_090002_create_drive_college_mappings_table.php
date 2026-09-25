<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('drive_college_mappings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('placement_drive_id')->constrained('placement_drives')->cascadeOnDelete();
            $table->foreignId('college_id')->constrained('colleges')->cascadeOnDelete();
            $table->decimal('min_cgpa_override', 4, 2)->nullable();
            $table->unsignedTinyInteger('max_backlogs_override')->nullable();
            $table->json('eligible_branches_override')->nullable();
            $table->foreignId('mapped_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('mapped_at')->nullable();
            $table->timestamp('unmapped_at')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['placement_drive_id', 'college_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('drive_college_mappings');
    }
};
