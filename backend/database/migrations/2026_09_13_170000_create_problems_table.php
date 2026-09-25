<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('problems', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique();
            $table->string('title');
            $table->enum('difficulty', ['easy', 'medium', 'hard']);
            $table->json('tags')->nullable();
            $table->text('description');

            // Each entry: {"input": string, "output": string, "explanation": string|null}
            $table->json('examples');
            $table->json('constraints')->nullable();

            // Ordered, progressive hints — revealed one at a time on the solve screen.
            $table->json('hints')->nullable();

            // Per-language stub code for the (future) editor: {"javascript": "...", "python": "...", ...}
            $table->json('starter_code')->nullable();

            $table->decimal('acceptance_rate', 5, 2)->nullable();
            $table->unsignedInteger('total_submissions')->default(0);
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();

            $table->index(['difficulty']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('problems');
    }
};
