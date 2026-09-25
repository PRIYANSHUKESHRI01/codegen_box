<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registered judge-execution infrastructure for the superadmin
 * "Infrastructure & Flags" tab. No sandboxed execution cluster exists yet —
 * these rows are superadmin-managed inventory (seeded, then editable),
 * replacing what used to be a hardcoded frontend TS array. Once a real
 * telemetry agent exists, only the write path changes (a scheduled job
 * updating these columns instead of a seeder) — the table/API shape stays.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('judge_nodes', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('region');
            $table->string('provider'); // AWS | GCP | BareMetal
            $table->string('status')->default('healthy'); // healthy | busy | degraded | offline — see App\Models\JudgeNode
            $table->unsignedTinyInteger('cpu_usage')->default(0); // 0-100
            $table->unsignedTinyInteger('memory_usage')->default(0); // 0-100
            $table->unsignedInteger('active_jobs')->default(0);
            $table->unsignedInteger('max_jobs')->default(250);
            $table->unsignedInteger('latency_ms')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('judge_nodes');
    }
};
