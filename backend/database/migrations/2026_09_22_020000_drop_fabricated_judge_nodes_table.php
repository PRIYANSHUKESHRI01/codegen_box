<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The judge_nodes table only ever held hand-written seed rows ("Cluster-
 * Alpha-US1: 142/250 active jobs, 28 ms") for the superadmin Infrastructure
 * tab — nothing measured them, and they implied ~1,000 execution slots the
 * platform never had. The tab now reports live telemetry straight from the
 * real Piston pool and queues (App\Services\Judge\JudgeStatusService), so
 * the table has no reader or writer left. down() restores the empty shape.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('judge_nodes');
    }

    public function down(): void
    {
        Schema::create('judge_nodes', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('region');
            $table->string('provider');
            $table->string('status')->default('healthy');
            $table->unsignedTinyInteger('cpu_usage')->default(0);
            $table->unsignedTinyInteger('memory_usage')->default(0);
            $table->unsignedInteger('active_jobs')->default(0);
            $table->unsignedInteger('max_jobs')->default(250);
            $table->unsignedInteger('latency_ms')->default(0);
            $table->timestamps();
        });
    }
};
