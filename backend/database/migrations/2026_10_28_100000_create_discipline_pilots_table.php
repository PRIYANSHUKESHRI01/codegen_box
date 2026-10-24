<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Staged rollout of Core Prep: a branch family can be shown to chosen pilot colleges before it is switched on for
 * everyone (disciplines.is_live). One row per (family, college). Purely additive — with no rows the product behaves
 * exactly as before.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('discipline_pilots')) {
            return;
        }

        Schema::create('discipline_pilots', function (Blueprint $table) {
            $table->id();
            $table->string('discipline_code', 20);
            $table->foreignId('college_id')->constrained('colleges')->cascadeOnDelete();
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['discipline_code', 'college_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discipline_pilots');
    }
};
