<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tracks which student has read which article — powers the reader's
 * auto-"mark as read" (see ArticleController::markRead()), the per-topic
 * progress shown on the topic grid/list, and the read checkmark in a topic's
 * article list. A first-class tracking model (App\Models\ArticleRead),
 * queried via firstOrCreate() exactly like InterviewSession — not a
 * belongsToMany pivot, matching every other "did user X do Y" relationship
 * in this codebase.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('article_reads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('article_id')->constrained('articles')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('read_at');

            $table->unique(['article_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('article_reads');
    }
};
