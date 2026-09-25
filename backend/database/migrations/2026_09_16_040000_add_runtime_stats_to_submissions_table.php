<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CodeExecutionService already computes cpuTimeMs/memoryBytes for every run
 * — SubmissionController::execute() just never persisted them. Adding these
 * two columns lets "Recent Submissions" show real numbers instead of
 * omitting the columns entirely.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->unsignedInteger('runtime_ms')->nullable()->after('status');
            $table->unsignedInteger('memory_kb')->nullable()->after('runtime_ms');
        });
    }

    public function down(): void
    {
        Schema::table('submissions', function (Blueprint $table) {
            $table->dropColumn(['runtime_ms', 'memory_kb']);
        });
    }
};
