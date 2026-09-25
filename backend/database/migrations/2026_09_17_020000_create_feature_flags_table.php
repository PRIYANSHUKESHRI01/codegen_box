<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Real, persisted platform config toggles for the superadmin "Infrastructure
 * & Flags" tab — replaces a frontend-only toggle that reset on every reload
 * and gated nothing. A toggle written here genuinely survives a reload;
 * wiring application code to actually branch on a flag's `enabled` value is
 * a separate, later initiative and is not implied by this table existing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feature_flags', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('category')->default('General');
            $table->boolean('enabled')->default(false);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feature_flags');
    }
};
