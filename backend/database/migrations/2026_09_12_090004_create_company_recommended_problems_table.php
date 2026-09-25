<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_recommended_problems', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained('companies')->cascadeOnDelete();
            $table->string('problem_slug');
            $table->string('topic_tag')->nullable();
            $table->unsignedInteger('priority')->default(0);
            $table->timestamps();

            $table->unique(['company_id', 'problem_slug']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_recommended_problems');
    }
};
