<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The first real persistence for a code submission — previously
 * SubmissionController::run() executed code via Piston and returned the
 * result without saving anything, so there was no way to measure whether a
 * student actually practices. Only real "Submit" clicks (not "Run") create
 * a row here, and only ever one per (user, problem, day) — see
 * SubmissionController::submit()'s updateOrCreate — so repeatedly
 * resubmitting the same already-solved problem can never be used to
 * inflate a day's distinct-problems-solved count.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('submissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('problem_id')->constrained()->cascadeOnDelete();
            $table->string('language');
            $table->string('status'); // accepted | wrong_answer | runtime_error | compile_error
            $table->date('submitted_on'); // calendar day in server time, for the daily-practice-streak query
            $table->timestamps();

            $table->unique(['user_id', 'problem_id', 'submitted_on']);
            $table->index(['user_id', 'submitted_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('submissions');
    }
};
