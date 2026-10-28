<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('vault_profiles', function (Blueprint $table) {
            $table->decimal('ai_interview_score', 5, 2)->nullable()->after('qualification_source')->index();
            $table->string('ai_interview_stack', 50)->nullable()->after('ai_interview_score')->index();
            $table->string('ai_interview_role', 50)->nullable()->after('ai_interview_stack')->index();
            $table->json('ai_interview_scores')->nullable()->after('ai_interview_role');
            $table->unsignedTinyInteger('ai_interview_attempt')->nullable()->after('ai_interview_scores');
            $table->timestamp('ai_interview_qualified_at')->nullable()->after('ai_interview_attempt')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('vault_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'ai_interview_score',
                'ai_interview_stack',
                'ai_interview_role',
                'ai_interview_scores',
                'ai_interview_attempt',
                'ai_interview_qualified_at',
            ]);
        });
    }
};

