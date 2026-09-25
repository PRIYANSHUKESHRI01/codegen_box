<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrors `company_recommended_problems` — which bank questions Ops has
 * tagged as relevant to a specific company, enforced by
 * AdminInterviewController::storeQuestion() for a `company`-type interview
 * (never for tpo_mock/company_hiring, which may free-pick from the whole
 * bank — same asymmetry AdminContestController/CompanyContestController
 * already have for problems).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_recommended_interview_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->foreignId('interview_question_bank_id')->constrained('interview_question_banks', 'id', 'crq_question_bank_foreign')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'interview_question_bank_id'], 'company_recommended_interview_q_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_recommended_interview_questions');
    }
};
