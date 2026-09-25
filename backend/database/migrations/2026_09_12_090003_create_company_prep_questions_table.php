<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_prep_questions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->smallInteger('asked_year');
            $table->enum('category', ['Aptitude', 'Coding', 'Technical', 'System Design', 'HR', 'Behavioral']);
            $table->string('round_name')->nullable();
            $table->text('question');
            $table->text('answer_notes')->nullable();
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->index(['company_id', 'asked_year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_prep_questions');
    }
};
