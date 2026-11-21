<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mock_interview_questions', function (Blueprint $table) {
            if (! Schema::hasColumn('mock_interview_questions', 'parent_set_number')) {
                $table->unsignedTinyInteger('parent_set_number')->default(1)->after('stack_key');
                $table->index(['stack_key', 'parent_set_number', 'round_number', 'position'], 'mock_questions_parent_set_idx');
            }
        });
    }

    public function down(): void
    {
        Schema::table('mock_interview_questions', function (Blueprint $table) {
            if (Schema::hasColumn('mock_interview_questions', 'parent_set_number')) {
                $table->dropIndex('mock_questions_parent_set_idx');
                $table->dropColumn('parent_set_number');
            }
        });
    }
};
