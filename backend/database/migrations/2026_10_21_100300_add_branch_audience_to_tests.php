<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * "Who is this FOR?" on the things a TPO or Mellow schedules for students: contests, interviews,
 * interview tracks and soft-skill tests. `{disciplines: [...], branches: [...]}`; null = everyone,
 * which is every existing row — so nothing changes until someone sets an audience.
 * (See App\Support\BranchAudience.)
 */
return new class extends Migration
{
    private const TABLES = ['contests', 'interviews', 'interview_tracks', 'soft_skill_assessments'];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            if (! Schema::hasColumn($table, 'branch_audience')) {
                Schema::table($table, fn (Blueprint $t) => $t->json('branch_audience')->nullable());
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            if (Schema::hasColumn($table, 'branch_audience')) {
                Schema::table($table, fn (Blueprint $t) => $t->dropColumn('branch_audience'));
            }
        }
    }
};
