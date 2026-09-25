<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('placement_drives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('title');
            $table->string('role_title');
            $table->string('ctc_range')->nullable();
            $table->dateTime('drive_date');
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->decimal('min_cgpa', 4, 2)->nullable();
            $table->unsignedTinyInteger('max_backlogs')->nullable();
            $table->json('eligible_branches')->nullable();
            $table->enum('status', ['draft', 'published', 'completed', 'cancelled'])->default('draft');
            $table->timestamps();

            $table->index(['status', 'drive_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('placement_drives');
    }
};
