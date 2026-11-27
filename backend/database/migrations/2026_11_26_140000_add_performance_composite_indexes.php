<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private function addIndexIfMissing(string $table, array $columns, string $indexName): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        foreach ($columns as $column) {
            if (! Schema::hasColumn($table, $column)) {
                return;
            }
        }

        foreach (Schema::getIndexes($table) as $existing) {
            if (($existing['name'] ?? null) === $indexName || ($existing['columns'] ?? null) === $columns) {
                return;
            }
        }

        Schema::table($table, function (Blueprint $tableBlueprint) use ($columns, $indexName) {
            $tableBlueprint->index($columns, $indexName);
        });
    }

    private function dropIndexIfPresent(string $table, string $indexName): void
    {
        if (! Schema::hasTable($table)) {
            return;
        }

        foreach (Schema::getIndexes($table) as $existing) {
            if (($existing['name'] ?? null) === $indexName) {
                Schema::table($table, fn (Blueprint $b) => $b->dropIndex($indexName));
                return;
            }
        }
    }

    public function up(): void
    {
        $this->addIndexIfMissing('submissions', ['user_id', 'status', 'problem_id'], 'submissions_user_status_problem_idx');
        $this->addIndexIfMissing('interview_sessions', ['user_id', 'started_at'], 'interview_sessions_user_started_at_idx');
        $this->addIndexIfMissing('interview_sessions', ['user_id', 'status'], 'interview_sessions_user_status_idx');
        $this->addIndexIfMissing('core_practice_answers', ['user_id', 'created_at'], 'core_practice_answers_user_created_at_idx');
    }

    public function down(): void
    {
        $this->dropIndexIfPresent('submissions', 'submissions_user_status_problem_idx');
        $this->dropIndexIfPresent('interview_sessions', 'interview_sessions_user_started_at_idx');
        $this->dropIndexIfPresent('interview_sessions', 'interview_sessions_user_status_idx');
        $this->dropIndexIfPresent('core_practice_answers', 'core_practice_answers_user_created_at_idx');
    }
};
