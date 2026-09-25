<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The real test-case store — sample rows (is_sample=true, a handful,
 * pretty-printed back into the problem-page display string) plus a genuine
 * hidden suite that only ever runs server-side (Submit grades against
 * every row; the old `examples`-only judging let a student pass by
 * hardcoding output for just the 2-4 visible cases).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('problem_test_cases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('problem_id')->constrained()->cascadeOnDelete();
            // {"nums": [2,7,11,15], "target": 9} — keyed by each param's real
            // name from problems.params, typed per problems.params[].type.
            $table->json('inputs');
            $table->json('expected_output');
            $table->text('explanation')->nullable();
            $table->boolean('is_sample')->default(false);
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->index(['problem_id', 'is_sample']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('problem_test_cases');
    }
};
