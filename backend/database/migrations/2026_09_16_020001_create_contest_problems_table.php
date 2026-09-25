<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The set of real catalog problems an admin has attached to a contest, with
 * a points value each. `problem_id` is restrictOnDelete (not cascade) —
 * there's no admin "delete problem" route today, but this is cheap
 * insurance against a future one silently corrupting a finalized contest's
 * historical scoring.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contest_problems', function (Blueprint $table) {
            $table->id();
            $table->foreignId('contest_id')->constrained()->cascadeOnDelete();
            $table->foreignId('problem_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('points');
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->unique(['contest_id', 'problem_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contest_problems');
    }
};
